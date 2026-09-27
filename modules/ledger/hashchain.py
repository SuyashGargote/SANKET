"""
Ledger Module — Multi-Signature Append-only Hash-Chain with Periodic Secondary Anchors.
Implements Phase 2: Real Multi-Node Distributed Ledger with Consensus Quorum.

Block structure (Phase 2):
{
  "index": int,
  "data": {
    "watermark_id": str,
    "user_id": str,
    "timestamp": str,
    "file_hash": str,
    "decrypted_hash": str
  },
  "prev_hash": str,
  "hash": str,
  "signatures": {
    "recipient": str,
    "gateway": str,
    "peers": [
      {"node_id": str, "signature": str}
    ]
  }
}
"""

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from typing import Optional

from config import ANCHOR_FILE, DATA_DIR, LEDGER_BACKUP, LEDGER_DIR, LEDGER_FILE, NODE_CONFIG_FILE
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


def get_ledger_dir() -> str:
    """Return this node's independent ledger directory (enforcing no shared storage)."""
    node_id = os.getenv("NODE_ID")
    if not node_id and os.path.exists(NODE_CONFIG_FILE):
        try:
            with open(NODE_CONFIG_FILE, "r", encoding="utf-8") as f:
                node_id = json.load(f).get("node_id")
        except Exception:
            pass

    if not node_id or node_id in ("node_A", "primary"):
        os.makedirs(LEDGER_DIR, exist_ok=True)
        return LEDGER_DIR

    node_dir = os.path.join(DATA_DIR, "nodes", node_id, "ledger")
    os.makedirs(node_dir, exist_ok=True)
    return node_dir


def get_ledger_file() -> str:
    return os.path.join(get_ledger_dir(), "ledger.json")


def get_anchors_file() -> str:
    return os.path.join(get_ledger_dir(), "anchors.json")


def get_anchor_head_file() -> str:
    return os.path.join(get_ledger_dir(), "anchor.json")


def get_ledger_backup_file() -> str:
    return os.path.join(get_ledger_dir(), "ledger_backup.json")


def _compute_block_hash(block: dict) -> str:
    """
    SHA-256 hash of block contents (excluding the 'hash' field itself).
    For Phase 2 blocks, hashes canonical core fields (index, data, prev_hash, recipient, gateway).
    Synchronizes top-level fields (e.g. user_id, watermark_id) into data payload so tampering
    at any level immediately breaks the block hash.
    """
    if "previous_hash" in block and "prev_hash" not in block:
        block["prev_hash"] = block["previous_hash"]
    elif "prev_hash" in block and "previous_hash" not in block:
        block["previous_hash"] = block["prev_hash"]

    # Canonical hash for Phase 2 block format
    if "data" in block and isinstance(block["data"], dict):
        data_copy = dict(block["data"])
        for k in ("watermark_id", "user_id", "timestamp", "file_hash", "decrypted_hash", "file_id", "nonce"):
            if k in block:
                data_copy[k] = block[k]

        core = {
            "index": block["index"],
            "data": data_copy,
            "prev_hash": block.get("prev_hash") or block.get("previous_hash"),
        }
        sigs = block.get("signatures", {})
        if sigs:
            if "recipient" in sigs:
                core["recipient"] = sigs["recipient"]
            if "gateway" in sigs:
                core["gateway"] = sigs["gateway"]
        canonical = json.dumps(core, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    # Legacy block format (excluding 'hash')
    fields = {k: v for k, v in block.items() if k != "hash"}
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _compute_ledger_snapshot(chain: list[dict]) -> str:
    """SHA-256 of the full ledger JSON (canonical). Used for periodic anchors."""
    canonical = json.dumps(chain, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_chain() -> list[dict]:
    """Load the ledger from node-specific disk path."""
    lfile = get_ledger_file()
    if not os.path.exists(lfile):
        return []
    try:
        with open(lfile, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _load_anchors() -> list[dict]:
    """Load periodic anchors from disk."""
    afile = get_anchors_file()
    if not os.path.exists(afile):
        return []
    try:
        with open(afile, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_anchors(anchors: list[dict]) -> None:
    """Persist anchors to disk."""
    with open(get_anchors_file(), "w", encoding="utf-8") as f:
        json.dump(anchors, f, indent=2)


def _maybe_create_anchor(chain: list[dict]) -> None:
    """Create a periodic anchor if the chain length hits an interval of 5."""
    chain_len = len(chain)
    if chain_len == 0 or chain_len % ANCHOR_INTERVAL != 0:
        return

    anchors = _load_anchors()

    if anchors and anchors[-1]["block_index"] == chain_len:
        return

    anchor_hash = _compute_ledger_snapshot(chain)
    anchors.append({
        "block_index": chain_len,
        "anchor_hash": anchor_hash,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    _save_anchors(anchors)

    # Step 9: Compare anchor with peers every N blocks
    try:
        from modules.ledger.network import verify_peer_anchors
        verify_peer_anchors()
    except Exception:
        pass


def _save_chain(chain: list[dict]) -> None:
    """Persist chain to disk and update anchor + backup."""
    lfile = get_ledger_file()
    with open(lfile, "w", encoding="utf-8") as f:
        json.dump(chain, f, indent=2)

    # Update anchor with latest hash
    head_file = get_anchor_head_file()
    if chain:
        anchor = {
            "latest_index": chain[-1]["index"],
            "latest_hash": chain[-1]["hash"],
            "chain_length": len(chain),
        }
    else:
        anchor = {"latest_index": -1, "latest_hash": "", "chain_length": 0}

    with open(head_file, "w", encoding="utf-8") as f:
        json.dump(anchor, f, indent=2)

    # Backup
    backup_file = get_ledger_backup_file()
    try:
        shutil.copy2(lfile, backup_file)
    except Exception:
        pass

    # Periodic anchor check
    _maybe_create_anchor(chain)


def ensure_system_keys():
    """Ensure system authority keys exist for gateway signing ledger blocks."""
    try:
        load_public_key("system")
    except (FileNotFoundError, Exception):
        generate_keypair("system")


def verify_block_multisig(block: dict) -> tuple[bool, str]:
    """Validate multi-signatures and consensus rules on a block."""
    from modules.ledger.network import validate_block
    return validate_block(block, require_quorum=False)


def append_record(record: dict) -> dict:
    """
    Append a signed decryption record to the distributed hash chain.
    Follows Phase 2 Step 5 Block Flow:
      1. Create candidate block locally
      2. Send block to peers to request signatures
      3. Each peer validates block and signs block hash
      4. Origin node verifies peer signatures, ensures consensus quorum, appends block
      5. Broadcast final block to all peers
    """
    chain = _load_chain()

    previous_hash = chain[-1]["hash"] if chain else "0" * 64
    index = len(chain)

    recipient_signature = record.get("recipient_signature") or record.get("signature")
    if not recipient_signature:
        raise ValueError("Cannot append block without recipient signature.")

    # Generate gateway authority signature (system authority)
    ensure_system_keys()
    system_private = load_private_key("system")
    system_signature = sign_record(record, system_private)

    # Step 1: Create candidate block locally
    file_hash = record.get("file_hash") or record.get("file_id")
    decrypted_hash = record.get("decrypted_hash", "")

    data_payload = {
        "watermark_id":   record["watermark_id"],
        "user_id":        record["user_id"],
        "timestamp":      record["timestamp"],
        "file_hash":      file_hash,
        "decrypted_hash": decrypted_hash,
        "file_id":        record.get("file_id", file_hash),
        "nonce":          record.get("nonce", ""),
    }

    block = {
        "index":                        index,
        "data":                         data_payload,
        "prev_hash":                    previous_hash,
        "previous_hash":                previous_hash,
        "signatures": {
            "recipient": recipient_signature,
            "gateway":   system_signature,
            "peers":     [],
        },
        # Backwards compatibility top-level fields
        "watermark_id":                 record["watermark_id"],
        "user_id":                      record["user_id"],
        "file_id":                      record.get("file_id", file_hash),
        "timestamp":                    record["timestamp"],
        "nonce":                        record.get("nonce", ""),
        "recipient_signature":          recipient_signature,
        "system_signature":             system_signature,
        "optional_validator_signature": None,
        "signature":                    recipient_signature,
    }
    block["hash"] = _compute_block_hash(block)

    # Step 2 & 3: Request peer signatures over real network
    from modules.ledger.network import broadcast_block, request_peer_signatures
    peer_signatures = request_peer_signatures(block)

    # Step 4: Consensus Quorum Enforcement (at least ONE peer node signature)
    if not peer_signatures:
        raise ValueError("Consensus quorum not reached: block must be signed by at least ONE peer node.")

    block["signatures"]["peers"] = peer_signatures
    if peer_signatures:
        block["optional_validator_signature"] = peer_signatures[0]["signature"]

    # Validate multi-signature before accepting into ledger
    is_valid, err_msg = verify_block_multisig(block)
    if not is_valid:
        raise ValueError(f"Ledger block rejected: {err_msg}")

    chain.append(block)
    _save_chain(chain)

    # Step 5: Broadcast final committed block to peer nodes
    try:
        broadcast_block(block)
    except Exception:
        pass

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
    head_file = get_anchor_head_file()
    if os.path.exists(head_file):
        try:
            with open(head_file, "r", encoding="utf-8") as f:
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
    4. Peer anchor verification (detects divergence across nodes)
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

    # Step 4: Cross-node peer anchor verification
    from modules.ledger.network import verify_peer_anchors
    peer_anchors_ok, peer_anchors_msg = verify_peer_anchors()
    if not peer_anchors_ok:
        anchor_ok = False
        anchor_msg = peer_anchors_msg

    # Step 5: Determine status
    if not chain_ok:
        status = "TAMPERED"
        message = chain_msg
    elif not anchor_ok:
        status = "COMPROMISED" if ("COMPROMISED" in anchor_msg or not peer_anchors_ok) else "ANCHOR_MISMATCH"
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
        w_id = block.get("data", {}).get("watermark_id") if isinstance(block.get("data"), dict) else block.get("watermark_id")
        if w_id == watermark_id:
            return block
    return None


def get_all_records() -> list[dict]:
    """Return all ledger records."""
    return _load_chain()
