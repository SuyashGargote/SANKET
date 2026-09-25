"""
Ledger Module — Append-only hash-chain with anchor file and backup.

Each block in the chain:
  {
    index, previous_hash, watermark_id, user_id, file_id,
    timestamp, nonce, signature, hash
  }

Improvements:
  - Anchor file stores the latest block hash independently for tamper detection.
  - Backup copy of ledger is maintained on every write.
  - Full chain verification checks hash linkage + internal consistency.
  - Periodic anchors (every 5 blocks) provide secondary tamper detection
    that catches attackers who recompute hashes after modifying blocks.
"""

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

from config import LEDGER_FILE, ANCHOR_FILE, LEDGER_BACKUP, LEDGER_DIR

# Periodic anchor config
ANCHOR_INTERVAL = 5
ANCHORS_FILE = os.path.join(LEDGER_DIR, "anchors.json")


def _compute_block_hash(block: dict) -> str:
    """SHA-256 hash of block contents (excluding the 'hash' field itself)."""
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
    with open(LEDGER_FILE, "r") as f:
        return json.load(f)


def _load_anchors() -> list[dict]:
    """Load periodic anchors from disk."""
    if not os.path.exists(ANCHORS_FILE):
        return []
    with open(ANCHORS_FILE, "r") as f:
        return json.load(f)


def _save_anchors(anchors: list[dict]) -> None:
    """Persist anchors to disk."""
    with open(ANCHORS_FILE, "w") as f:
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
    with open(LEDGER_FILE, "w") as f:
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

    with open(ANCHOR_FILE, "w") as f:
        json.dump(anchor, f, indent=2)

    # Backup
    shutil.copy2(LEDGER_FILE, LEDGER_BACKUP)

    # Periodic anchor check
    _maybe_create_anchor(chain)


def append_record(record: dict) -> dict:
    """
    Append a signed decryption record to the hash chain.

    Args:
        record: dict with keys: watermark_id, user_id, file_id, timestamp, nonce, signature

    Returns:
        The newly created block (with index, previous_hash, hash).
    """
    chain = _load_chain()

    previous_hash = chain[-1]["hash"] if chain else "0" * 64
    index = len(chain)

    block = {
        "index":         index,
        "previous_hash": previous_hash,
        "watermark_id":  record["watermark_id"],
        "user_id":       record["user_id"],
        "file_id":       record["file_id"],
        "timestamp":     record["timestamp"],
        "nonce":         record["nonce"],
        "signature":     record["signature"],
    }
    block["hash"] = _compute_block_hash(block)

    chain.append(block)
    _save_chain(chain)

    return block


def verify_chain() -> tuple[bool, str]:
    """
    Verify the entire hash chain for integrity.

    Returns (is_valid, message).
    """
    chain = _load_chain()
    if not chain:
        return True, "Ledger is empty — nothing to verify."

    # Check anchor consistency
    if os.path.exists(ANCHOR_FILE):
        with open(ANCHOR_FILE, "r") as f:
            anchor = json.load(f)
        if anchor["latest_hash"] != chain[-1]["hash"]:
            return False, "TAMPERED: Anchor hash does not match latest block."
        if anchor["chain_length"] != len(chain):
            return False, "TAMPERED: Anchor chain length mismatch (possible deletion)."

    # Verify each block
    for i, block in enumerate(chain):
        # Check hash
        expected_hash = _compute_block_hash(block)
        if block["hash"] != expected_hash:
            return False, f"TAMPERED: Block {i} hash mismatch."

        # Check linkage
        if i == 0:
            expected_prev = "0" * 64
        else:
            expected_prev = chain[i - 1]["hash"]

        if block["previous_hash"] != expected_prev:
            return False, f"TAMPERED: Block {i} previous_hash linkage broken."

    return True, f"Ledger verified: {len(chain)} blocks, chain intact."


def verify_ledger_with_anchors() -> dict:
    """
    Verify the ledger with both chain integrity AND periodic anchor checks.

    This catches attackers who modify blocks and then recompute all hashes
    to fix the chain — the periodic anchor snapshots will not match.

    Returns:
        {
            "chain_ok": bool,
            "anchor_ok": bool,
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

    # Step 3: Determine status
    if not chain_ok:
        status = "TAMPERED"
        message = chain_msg
    elif not anchor_ok:
        status = "ANCHOR_MISMATCH"
        message = anchor_msg
    else:
        status = "VALID"
        message = chain_msg

    return {
        "chain_ok": chain_ok,
        "anchor_ok": anchor_ok,
        "ledger_status": status,
        "message": message,
    }


def query_by_watermark(watermark_id: str) -> dict | None:
    """Look up a ledger record by watermark ID."""
    chain = _load_chain()
    for block in chain:
        if block["watermark_id"] == watermark_id:
            return block
    return None


def get_all_records() -> list[dict]:
    """Return all ledger records."""
    return _load_chain()

