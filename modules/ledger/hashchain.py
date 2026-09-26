"""
Ledger Module — Multi-Signature Append-only Hash-Chain with Periodic Secondary Anchors.

Block structure:
{
  "index": int,
  "hash": str,
  "prev_hash": str,
  "previous_hash": str,
  "watermark_id": str,
  "user_id": str,
  "file_id": str,
  "timestamp": str,
  "nonce": str,
  "recipient_signature": str,
  "system_signature": str,
  "optional_validator_signature": Optional[str],
  "signature": str
}

Trust Improvements:
  - Multi-signature validation: Minimum 2 signatures required per block
    (Recipient Dilithium signature + System Authority Dilithium signature).
  - Incomplete or invalid blocks are strictly rejected.
  - Head anchor file stores the latest block hash independently for tamper detection.
  - Periodic secondary anchors (every 5 blocks) detect rollback and hash-recomputation attacks.
  - Automatic backup file on every ledger append.
"""

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from typing import Optional

from config import ANCHOR_FILE, DATA_DIR, LEDGER_BACKUP, LEDGER_DIR, LEDGER_FILE
from modules.crypto.signature import (
    generate_keypair,
    load_private_key,
    load_public_key,
    sign_record,
    verify_signature,
)

# Periodic anchor config
ANCHOR_INTERVAL = 5
ANCHORS_FILE = os.path.join(LEDGER_DIR, "anchors.json")


def _compute_block_hash(block: dict) -> str:
    """SHA-256 hash of block contents (excluding the 'hash' field itself)."""
    # Keep previous_hash and prev_hash synchronized
    if "previous_hash" in block and "prev_hash" in block:
        block["prev_hash"] = block["previous_hash"]
    elif "previous_hash" in block:
        block["prev_hash"] = block["previous_hash"]
    elif "prev_hash" in block:
        block["previous_hash"] = block["prev_hash"]

    fields = {k: v for k, v in block.items() if k != "hash"}
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _compute_ledger_snapshot(chain: list[dict]) -> str:
    """SHA-256 of the full ledger JSON (canonical). Used for periodic anchors."""
    canonical = json.dumps(chain, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_chain() -> list[dict]:
    """Load the ledger from disk. Returns empty list if file doesn't exist."""
    if not os.path.exists(LEDGER_FILE):
        return []
    try:
        with open(LEDGER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _load_anchors() -> list[dict]:
    """Load periodic anchors from disk."""
    if not os.path.exists(ANCHORS_FILE):
        return []
    try:
        with open(ANCHORS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_anchors(anchors: list[dict]) -> None:
    """Persist anchors to disk."""
    with open(ANCHORS_FILE, "w", encoding="utf-8") as f:
        json.dump(anchors, f, indent=2)


def _maybe_create_anchor(chain: list[dict]) -> None:
    """Create a periodic anchor if the chain length hits an interval of 5."""
    chain_len = len(chain)
    if chain_len == 0 or chain_len % ANCHOR_INTERVAL != 0:
        return

    anchors = _load_anchors()

    # Don't duplicate: check if anchor for this block_index already exists
    if anchors and anchors[-1]["block_index"] == chain_len:
        return

    anchor_hash = _compute_ledger_snapshot(chain)
    anchors.append({
        "block_index": chain_len,
        "anchor_hash": anchor_hash,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    _save_anchors(anchors)


def _save_chain(chain: list[dict]) -> None:
    """Persist chain to disk and update anchor + backup."""
    with open(LEDGER_FILE, "w", encoding="utf-8") as f:
        json.dump(chain, f, indent=2)

    # Update anchor with latest hash
    if chain:
        anchor = {
            "latest_index": chain[-1]["index"],
            "latest_hash": chain[-1]["hash"],
            "chain_length": len(chain),
        }
    else:
        anchor = {"latest_index": -1, "latest_hash": "", "chain_length": 0}

    with open(ANCHOR_FILE, "w", encoding="utf-8") as f:
        json.dump(anchor, f, indent=2)

    # Backup
    shutil.copy2(LEDGER_FILE, LEDGER_BACKUP)

    # Periodic anchor check
    _maybe_create_anchor(chain)


def ensure_system_keys():
    """Ensure system authority keys exist for dual-signing ledger blocks."""
    try:
        load_public_key("system")
    except FileNotFoundError:
        generate_keypair("system")


def verify_block_multisig(block: dict) -> tuple[bool, str]:
    """
    Validate multi-signatures on a block (minimum 2 valid signatures required).
    1. Recipient Dilithium signature over the canonical record.
    2. System Authority Dilithium signature over the canonical record.
    3. Optional validator signature (if provided).
    """
    rec_sig = block.get("recipient_signature") or block.get("signature")
    sys_sig = block.get("system_signature")

    if not rec_sig:
        return False, "Missing recipient signature (incomplete block)."
    if not sys_sig:
        return False, "Missing system authority signature (incomplete block)."

    user_id = block.get("user_id")
    if not user_id:
        return False, "Missing user_id in block."

    # 1. Verify recipient signature
    try:
        user_pub = load_public_key(user_id)
        if not verify_signature(block, rec_sig, user_pub):
            return False, f"Invalid recipient signature for user '{user_id}'."
    except Exception as e:
        return False, f"Recipient key error for user '{user_id}': {e}"

    # 2. Verify system authority signature
    try:
        sys_pub = load_public_key("system")
        if not verify_signature(block, sys_sig, sys_pub):
            return False, "Invalid system authority signature."
    except Exception as e:
        return False, f"System authority key error: {e}"

    # 3. Optional validator signature
    val_sig = block.get("optional_validator_signature")
    if val_sig:
        try:
            val_pub = load_public_key("charlie")
            if not verify_signature(block, val_sig, val_pub):
                return False, "Invalid validator signature."
        except Exception:
            pass  # Validator signature is optional

    return True, "Multi-signature verified (recipient + system authority)."


def append_record(record: dict) -> dict:
    """
    Append a signed decryption record to the hash chain with multi-signature validation.

    Args:
        record: dict with keys: watermark_id, user_id, file_id, timestamp, nonce, signature

    Returns:
        The newly created block (with index, prev_hash, multi-signatures, hash).
    """
    chain = _load_chain()

    previous_hash = chain[-1]["hash"] if chain else "0" * 64
    index = len(chain)

    recipient_signature = record.get("recipient_signature") or record.get("signature")
    if not recipient_signature:
        raise ValueError("Cannot append block without recipient signature.")

    # Generate system authority signature
    ensure_system_keys()
    system_private = load_private_key("system")
    system_signature = sign_record(record, system_private)

    # Optional validator signature (if Charlie key exists)
    validator_signature = None
    try:
        charlie_priv = load_private_key("charlie")
        validator_signature = sign_record(record, charlie_priv)
    except Exception:
        pass

    block = {
        "index":                        index,
        "prev_hash":                    previous_hash,
        "previous_hash":                previous_hash,
        "watermark_id":                 record["watermark_id"],
        "user_id":                      record["user_id"],
        "file_id":                      record["file_id"],
        "timestamp":                    record["timestamp"],
        "nonce":                        record["nonce"],
        "recipient_signature":          recipient_signature,
        "system_signature":             system_signature,
        "optional_validator_signature": validator_signature,
        "signature":                    recipient_signature,  # alias for backwards compatibility
    }
    block["hash"] = _compute_block_hash(block)

    # Validate multi-signature before accepting into ledger
    is_valid, err_msg = verify_block_multisig(block)
    if not is_valid:
        raise ValueError(f"Ledger block rejected: {err_msg}")

    chain.append(block)
    _save_chain(chain)

    return block


def verify_chain() -> tuple[bool, str]:
    """
    Verify the entire hash chain for integrity.
    Checks anchor consistency, block hash correctness, and previous_hash linkage.
    """
    chain = _load_chain()
    if not chain:
        return True, "Ledger is empty — nothing to verify."

    # Check anchor consistency
    if os.path.exists(ANCHOR_FILE):
        try:
            with open(ANCHOR_FILE, "r", encoding="utf-8") as f:
                anchor = json.load(f)
            if anchor.get("latest_hash") != chain[-1]["hash"]:
                return False, "TAMPERED: Anchor hash does not match latest block."
            if anchor.get("chain_length") != len(chain):
                return False, "TAMPERED: Anchor chain length mismatch (possible deletion)."
        except Exception as e:
            return False, f"TAMPERED: Corrupted anchor file: {e}"

    # Verify each block
    for i, block in enumerate(chain):
        # 1. Check hash
        expected_hash = _compute_block_hash(block)
        if block["hash"] != expected_hash:
            return False, f"TAMPERED: Block {i} hash mismatch."

        # 2. Check linkage
        expected_prev = "0" * 64 if i == 0 else chain[i - 1]["hash"]
        actual_prev = block.get("previous_hash") or block.get("prev_hash")

        if actual_prev != expected_prev:
            return False, f"TAMPERED: Block {i} previous_hash linkage broken."

    return True, f"Ledger verified: {len(chain)} blocks, chain intact."


def verify_ledger_with_anchors() -> dict:
    """
    Verify the ledger with:
    1. Chain integrity (hash correctness & linkage)
    2. Periodic secondary anchors (catches hash recomputation attacks)
    3. Multi-signature validation (verifies recipient + system authority signatures)

    Returns:
        {
            "chain_ok": bool,
            "anchor_ok": bool,
            "multisig_ok": bool,
            "ledger_status": "VALID" | "TAMPERED" | "ANCHOR_MISMATCH",
            "message": str,
        }
    """
    # Step 1: Verify chain integrity
    chain_ok, chain_msg = verify_chain()

    # Step 2: Verify periodic anchors
    chain = _load_chain()
    anchors = _load_anchors()
    anchor_ok = True
    anchor_msg = ""

    for anchor in anchors:
        block_index = anchor["block_index"]
        if block_index > len(chain):
            anchor_ok = False
            anchor_msg = f"Anchor references block {block_index} but chain only has {len(chain)} blocks"
            break

        # Recompute snapshot of chain up to this anchor point
        sub_chain = chain[:block_index]
        expected_hash = _compute_ledger_snapshot(sub_chain)
        if expected_hash != anchor["anchor_hash"]:
            anchor_ok = False
            anchor_msg = f"Anchor at block {block_index} hash mismatch -- ledger content was modified"
            break

    if not anchor_msg:
        anchor_msg = f"{len(anchors)} anchor(s) verified" if anchors else "No anchors yet"

    # Step 3: Multi-signature validation across all blocks
    multisig_ok = True
    multisig_msg = "Multi-signatures verified"
    for i, block in enumerate(chain):
        ms_ok, ms_reason = verify_block_multisig(block)
        if not ms_ok:
            multisig_ok = False
            multisig_msg = f"Block {i} multi-signature failure: {ms_reason}"
            break

    # Step 4: Determine status (preserves demo check priority)
    if not chain_ok:
        status = "TAMPERED"
        message = chain_msg
    elif not anchor_ok:
        status = "ANCHOR_MISMATCH"
        message = anchor_msg
    elif not multisig_ok:
        status = "TAMPERED"
        message = multisig_msg
    else:
        status = "VALID"
        message = chain_msg

    return {
        "chain_ok": chain_ok,
        "anchor_ok": anchor_ok,
        "multisig_ok": multisig_ok,
        "ledger_status": status,
        "message": message,
    }


def query_by_watermark(watermark_id: str) -> Optional[dict]:
    """Look up a ledger record by watermark ID."""
    chain = _load_chain()
    for block in chain:
        if block["watermark_id"] == watermark_id:
            return block
    return None


def get_all_records() -> list[dict]:
    """Return all ledger records."""
    return _load_chain()
