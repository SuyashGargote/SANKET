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
"""

import hashlib
import json
import os
import shutil

from config import LEDGER_FILE, ANCHOR_FILE, LEDGER_BACKUP


def _compute_block_hash(block: dict) -> str:
    """SHA-256 hash of block contents (excluding the 'hash' field itself)."""
    fields = {k: v for k, v in block.items() if k != "hash"}
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_chain() -> list[dict]:
    """Load the ledger from disk. Returns empty list if file doesn't exist."""
    if not os.path.exists(LEDGER_FILE):
        return []
    with open(LEDGER_FILE, "r") as f:
        return json.load(f)


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
