"""
Decryption Module — SECURE pipeline that combines decryption + watermarking.

CRITICAL DESIGN:
  Raw decrypted bytes are NEVER returned to external callers.
  This module is the ONLY path from encrypted package → watermarked output.

Pipeline:
  1. Decrypt file (internal)
  2. Generate watermark ID (with nonce for uniqueness)
  3. Embed watermark into decrypted image
  4. Sign decryption record
  5. Append record to ledger
  6. Save watermarked output
  7. Return output path + metadata (NOT raw bytes)
"""

import os
from datetime import datetime, timezone

from config import DECRYPTED_DIR
from modules.crypto.encryption import decrypt_file_raw
from modules.crypto.signature import load_private_key, sign_record
from modules.ledger.hashchain import append_record
from modules.watermark.embedder import embed_watermark
from utils.helpers import (
    generate_file_id,
    generate_nonce,
    generate_watermark_id,
    validate_file_type,
)


def decrypt_file(pkg_dir: str, user_id: str) -> dict:
    """
    Secure decryption pipeline.

    1. Decrypts the encrypted package.
    2. Generates a unique watermark (with nonce).
    3. Embeds watermark BEFORE any bytes leave this function.
    4. Signs and logs the decryption event.
    5. Saves the watermarked output.

    Args:
        pkg_dir: Path to the encrypted package directory.
        user_id: ID of the decrypting user.

    Returns:
        dict with:
            output_path: str   — path to watermarked output file
            watermark_id: str  — the embedded watermark
            file_id: str       — hash of original encrypted package
            record: dict       — the signed ledger record
    """
    # ── Step 1: Decrypt (internal, raw bytes never leave this function) ──
    raw_bytes, original_filename = decrypt_file_raw(pkg_dir, user_id)

    # ── Step 2: Validate file type ──
    validate_file_type(original_filename)

    # ── Step 3: Generate unique watermark ID ──
    file_id = generate_file_id(os.path.join(pkg_dir, "payload.enc"))
    timestamp = datetime.now(timezone.utc).isoformat()
    nonce = generate_nonce()
    watermark_id = generate_watermark_id(user_id, file_id, timestamp, nonce)

    # ── Step 4: Embed watermark (raw_bytes are consumed here) ──
    watermarked_bytes = embed_watermark(raw_bytes, watermark_id)
    # raw_bytes is no longer needed — could be explicitly deleted
    del raw_bytes

    # ── Step 5: Sign the decryption record ──
    record = {
        "watermark_id": watermark_id,
        "user_id":      user_id,
        "file_id":      file_id,
        "timestamp":    timestamp,
        "nonce":        nonce,
    }
    private_key = load_private_key(user_id)
    signature = sign_record(record, private_key)
    record["signature"] = signature

    # ── Step 6: Append to ledger ──
    block = append_record(record)

    # ── Step 7: Save watermarked output ──
    out_filename = f"{os.path.splitext(original_filename)[0]}_{user_id}_{watermark_id[:8]}.png"
    output_path = os.path.join(DECRYPTED_DIR, out_filename)
    with open(output_path, "wb") as f:
        f.write(watermarked_bytes)

    return {
        "output_path":  output_path,
        "watermark_id": watermark_id,
        "file_id":      file_id,
        "record":       record,
        "block":        block,
    }
