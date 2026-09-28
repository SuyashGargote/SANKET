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

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional

from config import DECRYPTED_DIR
from modules.crypto.encryption import decrypt_file_raw
from modules.crypto.signature import load_private_key, sign_decryption_event
from modules.watermark.embedder import embed_watermark
from utils.helpers import (
    generate_file_id,
    generate_nonce,
    generate_watermark_id,
    validate_file_type,
)


def decrypt_file(pkg_dir: str, user_id: str, active_session_user: Optional[str] = None) -> dict:
    """
    Secure decryption pipeline with strict user-side signing enforcement.

    1. Enforces session binding if active session is provided.
    2. Decrypts the encrypted package using recipient's Kyber private key.
    3. Retrieves original encryption timestamp (encrypted_at) from package metadata.
    4. Generates a unique watermark directly embedding both encryption & decryption timestamps.
    5. Embeds watermark BEFORE any bytes leave this function.
    6. Computes SHA-256 hash of both encrypted input (file_hash) and watermarked output (decrypted_hash).
    7. Recipient signs payload containing: watermark_id, user_id, timestamp, file_hash, decrypted_hash
       using their own post-quantum Dilithium private key.
    8. Appends record to distributed ledger (with multi-signature validation).
    9. Saves the watermarked output.

    Args:
        pkg_dir: Path to the encrypted package directory.
        user_id: ID of the decrypting user.
        active_session_user: Optional active session user ID to enforce session binding.

    Returns:
        dict with:
            output_path: str   — path to watermarked output file
            watermark_id: str  — the embedded watermark
            file_id: str       — hash of original encrypted package
            file_hash: str     — SHA-256 hash of encrypted payload
            decrypted_hash: str — SHA-256 hash of watermarked output
            encrypted_at: str  — timestamp when file was encrypted
            decrypted_at: str  — timestamp when file was decrypted
            timestamp: str     — decryption timestamp
            record: dict       — the signed ledger record
            block: dict        — the committed ledger block
    """
    # ── Session Binding Enforcement ──
    if active_session_user and active_session_user.strip() != user_id.strip():
        raise PermissionError(
            f"Active session user '{active_session_user}' cannot sign decryption as '{user_id}'."
        )

    # ── Step 1: Decrypt (internal, raw bytes never leave this function) ──
    raw_bytes, original_filename = decrypt_file_raw(pkg_dir, user_id)

    # ── Step 2: Validate file type ──
    validate_file_type(original_filename)

    # ── Step 3: Extract encryption timestamp from package metadata or database ──
    meta_path = os.path.join(pkg_dir, "metadata.json")
    encrypted_at = None
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                encrypted_at = meta.get("encrypted_at") or meta.get("created_at")
        except Exception:
            pass

    if not encrypted_at:
        try:
            from modules.distribution.registry import get_document
            doc = get_document(pkg_dir)
            if doc and doc.get("created_at"):
                encrypted_at = doc.get("created_at")
        except Exception:
            pass

    if not encrypted_at:
        payload_enc = os.path.join(pkg_dir, "payload.enc")
        if os.path.exists(payload_enc):
            mtime = os.path.getmtime(payload_enc)
            encrypted_at = datetime.fromtimestamp(mtime, timezone.utc).isoformat()
        else:
            encrypted_at = datetime.now(timezone.utc).isoformat()

    decrypted_at = datetime.now(timezone.utc).isoformat()
    timestamp = decrypted_at

    # ── Step 4: Generate unique watermark ID directly embedding timestamps & file hash ──
    file_id = generate_file_id(os.path.join(pkg_dir, "payload.enc"))
    file_hash = file_id
    nonce = generate_nonce()
    watermark_id = generate_watermark_id(user_id, file_id, timestamp, nonce, encrypted_at=encrypted_at)

    # ── Step 5: Embed watermark (raw_bytes are consumed here) ──
    watermarked_bytes = embed_watermark(raw_bytes, watermark_id)
    del raw_bytes

    # ── Step 6: Compute decrypted output hash ──
    decrypted_hash = hashlib.sha256(watermarked_bytes).hexdigest()

    # ── Step 7: Sign the decryption record with recipient's own Dilithium key ──
    record = {
        "watermark_id":   watermark_id,
        "user_id":        user_id,
        "timestamp":      timestamp,
        "decrypted_at":   decrypted_at,
        "encrypted_at":   encrypted_at,
        "file_hash":      file_hash,
        "decrypted_hash": decrypted_hash,
        "file_id":        file_id,
        "nonce":          nonce,
    }
    private_key = load_private_key(user_id)
    signature = sign_decryption_event(private_key, record)
    record["signature"] = signature
    record["recipient_signature"] = signature

    # ── Step 8: Append to ledger (distributed multi-signature consensus) ──
    from modules.ledger.hashchain import append_record
    block = append_record(record)

    # ── Step 9: Save watermarked output ──
    out_filename = f"{os.path.splitext(original_filename)[0]}_{user_id}_{watermark_id[:8]}.png"
    output_path = os.path.join(DECRYPTED_DIR, out_filename)
    with open(output_path, "wb") as f:
        f.write(watermarked_bytes)

    return {
        "output_path":    output_path,
        "watermark_id":   watermark_id,
        "file_id":        file_id,
        "file_hash":      file_hash,
        "decrypted_hash": decrypted_hash,
        "encrypted_at":   encrypted_at,
        "decrypted_at":   decrypted_at,
        "timestamp":      timestamp,
        "record":         record,
        "block":          block,
    }
