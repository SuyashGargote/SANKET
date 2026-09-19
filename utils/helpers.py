"""
Utility helpers — file validation, watermark ID generation, common functions.
"""

import hashlib
import os
import struct

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


def generate_watermark_id(user_id: str, file_id: str, timestamp: str, nonce: str) -> str:
    """
    Watermark ID = SHA-256(user_id + file_id + timestamp + nonce), truncated.
    The nonce ensures uniqueness even for repeated decryptions by the same user.
    """
    payload = f"{user_id}{file_id}{timestamp}{nonce}"
    full_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return full_hash[:WATERMARK_HEX_LENGTH]


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
