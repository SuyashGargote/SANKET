"""
Utility helpers — file validation, watermark ID generation, common functions.
"""

import hashlib
import os
import struct
from datetime import datetime, timezone
from typing import Optional

from config import SUPPORTED_EXTENSIONS, WATERMARK_HEX_LENGTH


def validate_file_type(filepath: str) -> None:
    """Raise ValueError if the file is not a supported type (PNG only in Phase 1)."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            f"Phase 1 supports only: {', '.join(SUPPORTED_EXTENSIONS)}"
        )


def generate_file_id(filepath: str) -> str:
    """Deterministic file ID = SHA-256 of file contents (hex)."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_nonce() -> str:
    """Cryptographically secure random nonce (32 hex chars)."""
    return os.urandom(16).hex()


def _parse_to_epoch(ts: str | float | int | None) -> int:
    """Parse ISO-8601 string or numeric timestamp to integer epoch seconds."""
    if not ts:
        return int(datetime.now(timezone.utc).timestamp())
    if isinstance(ts, (int, float)):
        return int(ts)
    try:
        clean_ts = str(ts).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_ts)
        return int(dt.timestamp())
    except Exception:
        try:
            return int(float(ts))
        except Exception:
            return int(datetime.now(timezone.utc).timestamp())


def generate_watermark_id(
    user_id: str,
    file_id: str,
    timestamp: str,
    nonce: str,
    encrypted_at: Optional[str] = None,
) -> str:
    """
    Generate a 32-hex (128-bit) watermark ID that directly embeds provenance timestamps:
      - Bytes 0..3 (8 hex chars): Unix timestamp of when document was encrypted (encrypted_at)
      - Bytes 4..7 (8 hex chars): Unix timestamp of when document was decrypted & watermarked (timestamp)
      - Bytes 8..15 (16 hex chars): Cryptographic entropy binding user_id, file_id, timestamps, and nonce.
    
    This enables direct extraction of both encryption and decryption timestamps from the recovered
    watermark bits even before querying the distributed ledger.
    """
    dec_epoch = _parse_to_epoch(timestamp)
    enc_epoch = _parse_to_epoch(encrypted_at) if encrypted_at else dec_epoch

    enc_hex = struct.pack(">I", enc_epoch & 0xFFFFFFFF).hex()
    dec_hex = struct.pack(">I", dec_epoch & 0xFFFFFFFF).hex()

    entropy_payload = f"{user_id}:{file_id}:{timestamp}:{nonce}:{encrypted_at or ''}"
    entropy_hex = hashlib.sha256(entropy_payload.encode("utf-8")).hexdigest()[:16]

    wm_id = f"{enc_hex}{dec_hex}{entropy_hex}"
    return wm_id[:WATERMARK_HEX_LENGTH]


def decode_watermark_timestamps(watermark_id: str) -> dict:
    """
    Extract embedded encryption and decryption timestamps from a 32-hex watermark ID.
    Returns:
        {
            "encrypted_at": str | None,
            "decrypted_at": str | None,
            "has_embedded_timestamps": bool,
        }
    """
    if not watermark_id or not isinstance(watermark_id, str) or len(watermark_id) != 32:
        return {"encrypted_at": None, "decrypted_at": None, "has_embedded_timestamps": False}

    try:
        enc_epoch = struct.unpack(">I", bytes.fromhex(watermark_id[:8]))[0]
        dec_epoch = struct.unpack(">I", bytes.fromhex(watermark_id[8:16]))[0]

        # Sanity check: valid epoch timestamps between 2020 and 2100 (1500000000 to 4200000000)
        if 1500000000 <= enc_epoch <= 4200000000 and 1500000000 <= dec_epoch <= 4200000000:
            dt_enc = datetime.fromtimestamp(enc_epoch, timezone.utc).isoformat()
            dt_dec = datetime.fromtimestamp(dec_epoch, timezone.utc).isoformat()
            elapsed_sec = max(0, dec_epoch - enc_epoch)
            return {
                "encrypted_at": dt_enc,
                "decrypted_at": dt_dec,
                "elapsed_seconds": elapsed_sec,
                "elapsed_formatted": format_elapsed_time(elapsed_sec),
                "has_embedded_timestamps": True,
            }
    except Exception:
        pass

    return {
        "encrypted_at": None,
        "decrypted_at": None,
        "elapsed_seconds": None,
        "elapsed_formatted": "N/A",
        "has_embedded_timestamps": False,
    }


def format_elapsed_time(seconds: float | None) -> str:
    """Format elapsed seconds into human-readable string (e.g. '1h 24m 10s' or '45.2s')."""
    if seconds is None:
        return "N/A"
    seconds = max(0.0, float(seconds))
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes, sec = divmod(int(seconds), 60)
    if minutes < 60:
        return f"{minutes}m {sec}s"
    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return f"{hours}h {minutes}m {sec}s"
    days, hours = divmod(hours, 24)
    return f"{days}d {hours}h {minutes}m"


def crc16(data: bytes) -> int:
    """CRC-16/CCITT checksum for watermark integrity validation."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc


def watermark_to_bits(watermark_hex: str) -> list[int]:
    """Convert hex watermark string to list of bits, with 16-bit CRC appended."""
    wm_bytes = bytes.fromhex(watermark_hex)
    checksum = crc16(wm_bytes)
    # Append 2-byte CRC
    payload = wm_bytes + struct.pack(">H", checksum)
    bits = []
    for byte in payload:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits


def bits_to_watermark(bits: list[int]) -> tuple[str | None, bool]:
    """
    Convert bit list back to hex watermark + validate CRC.
    Returns (watermark_hex, crc_valid).  Returns (None, False) on failure.
    """
    # Total bits = watermark bytes * 8 + 16 (CRC)
    expected_wm_bytes = WATERMARK_HEX_LENGTH // 2  # 16 bytes
    expected_total_bits = (expected_wm_bytes + 2) * 8  # 144 bits

    if len(bits) < expected_total_bits:
        return None, False

    bits = bits[:expected_total_bits]

    # Reconstruct bytes
    all_bytes = bytearray()
    for i in range(0, len(bits), 8):
        byte_val = 0
        for j in range(8):
            byte_val = (byte_val << 1) | bits[i + j]
        all_bytes.append(byte_val)

    wm_bytes = bytes(all_bytes[:expected_wm_bytes])
    crc_bytes = bytes(all_bytes[expected_wm_bytes:])
    stored_crc = struct.unpack(">H", crc_bytes)[0]
    computed_crc = crc16(wm_bytes)

    watermark_hex = wm_bytes.hex()
    return watermark_hex, (stored_crc == computed_crc)
