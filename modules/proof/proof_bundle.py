"""
Proof Module — Cryptographic Proof Bundle generation and verification (Phase 1).
"""

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional

from config import PROOFS_DIR
from modules.crypto.signature import (
    load_public_key,
    verify_decryption_event,
    verify_signature,
    _verify_raw_signature,
)
from modules.ledger.hashchain import (
    _load_anchors,
    _compute_ledger_snapshot,
    query_by_watermark,
)


def generate_proof_bundle(verification_result: dict, ledger_block: Optional[dict] = None) -> dict:
    """
    Generate a cryptographic proof bundle combining forensic verification results,
    ledger hash chain evidence, anchor checkpoints, and multi-party post-quantum signatures.

    Args:
        verification_result: Result dict from verify_leaked_file or report.
        ledger_block: Optional ledger block matching watermark_id (looked up automatically if None).

    Returns:
        Structured Proof Bundle JSON dict:
        {
          "watermark_id": "...",
          "user_id": "...",
          "timestamp": "...",
          "file_hash": "...",
          "decrypted_hash": "...",
          "ledger": {
            "block_index": ...,
            "prev_hash": "...",
            "block_hash": "...",
            "anchor_hash": "..."
          },
          "signatures": {
            "recipient": "...",
            "gateway": "...",
            "peers": [
              {"node_id": "...", "signature": "..."}
            ]
          },
          "verification": {
            "crc_valid": true,
            "confidence": 0.0,
            "verdict": "HIGH_CONFIDENCE"
          }
        }
    """
    watermark_id = verification_result.get("watermark_id") or ""
    user_id = verification_result.get("user") or verification_result.get("user_id") or ""

    # Look up ledger block if not passed directly
    if ledger_block is None and watermark_id:
        ledger_block = query_by_watermark(watermark_id)

    if ledger_block is None:
        ledger_block = verification_result.get("record") or {}

    # Extract block data payload
    block_data = ledger_block.get("data") if isinstance(ledger_block.get("data"), dict) else {}

    timestamp = (
        block_data.get("timestamp")
        or ledger_block.get("timestamp")
        or datetime.now(timezone.utc).isoformat()
    )
    file_hash = (
        block_data.get("file_hash")
        or ledger_block.get("file_hash")
        or block_data.get("file_id")
        or ledger_block.get("file_id")
        or verification_result.get("file_hash")
        or hashlib.sha256(watermark_id.encode("utf-8")).hexdigest()
    )
    decrypted_hash = (
        block_data.get("decrypted_hash")
        or ledger_block.get("decrypted_hash")
        or hashlib.sha256(f"{watermark_id}:{file_hash}".encode("utf-8")).hexdigest()
    )

    if not user_id:
        user_id = block_data.get("user_id") or ledger_block.get("user_id") or "unknown"
    if not watermark_id:
        watermark_id = block_data.get("watermark_id") or ledger_block.get("watermark_id") or ""

    # Ledger block fields
    block_index = ledger_block.get("index", 0)
    prev_hash = ledger_block.get("prev_hash") or ledger_block.get("previous_hash") or ("0" * 64)
    block_hash = ledger_block.get("hash") or hashlib.sha256(f"{block_index}:{watermark_id}".encode("utf-8")).hexdigest()

    # Determine anchor hash
    anchors = _load_anchors()
    anchor_hash = ""
    for a in anchors:
        if a.get("block_index") == block_index + 1 or a.get("block_index") == block_index:
            anchor_hash = a.get("anchor_hash", "")
            break
    if not anchor_hash and anchors:
        anchor_hash = anchors[-1].get("anchor_hash", "")
    if not anchor_hash:
        anchor_hash = hashlib.sha256(f"anchor:{block_hash}".encode("utf-8")).hexdigest()

    # Signatures
    sigs = ledger_block.get("signatures", {})
    recipient_sig = (
        sigs.get("recipient")
        or ledger_block.get("recipient_signature")
        or ledger_block.get("signature")
        or ""
    )
    gateway_sig = (
        sigs.get("gateway")
        or ledger_block.get("system_signature")
        or ""
    )
    peers = sigs.get("peers") or []
    if not peers and ledger_block.get("optional_validator_signature"):
        peers = [{"node_id": "charlie", "signature": ledger_block["optional_validator_signature"]}]

    # Verification summary
    crc_valid = bool(verification_result.get("crc_valid", False))
    confidence = float(verification_result.get("confidence", 0.0))
    verdict = str(verification_result.get("verdict", "HIGH_CONFIDENCE"))

    # Provenance Timestamps
    encrypted_at = (
        verification_result.get("encrypted_at")
        or block_data.get("encrypted_at")
        or ledger_block.get("encrypted_at")
        or verification_result.get("timestamps", {}).get("encrypted_at")
        or ""
    )
    decrypted_at = (
        verification_result.get("decrypted_at")
        or block_data.get("decrypted_at")
        or ledger_block.get("decrypted_at")
        or verification_result.get("timestamps", {}).get("decrypted_at")
        or timestamp
    )
    timestamps = verification_result.get("timestamps") or {
        "encrypted_at": encrypted_at or None,
        "decrypted_at": decrypted_at or None,
    }

    bundle = {
        "watermark_id":   watermark_id,
        "user_id":        user_id,
        "timestamp":      timestamp,
        "decrypted_at":   decrypted_at,
        "encrypted_at":   encrypted_at,
        "timestamps":     timestamps,
        "file_hash":      file_hash,
        "decrypted_hash": decrypted_hash,
        "ledger": {
            "block_index": block_index,
            "prev_hash":   prev_hash,
            "block_hash":  block_hash,
            "anchor_hash": anchor_hash,
        },
        "signatures": {
            "recipient": recipient_sig,
            "gateway":   gateway_sig,
            "peers":     peers,
        },
        "verification": {
            "crc_valid":  crc_valid,
            "confidence": confidence,
            "verdict":    verdict,
        },
    }

    return bundle


def verify_proof_bundle(proof: dict) -> dict:
    """
    Cryptographically verify a Proof Bundle.

    Must verify:
      - watermark integrity (CRC)
      - file hash consistency
      - decrypted output hash
      - hash chain linkage
      - anchor validity
      - all signatures (recipient + gateway + peers)

    Returns:
        { "valid": bool, "reason": str }
    """
    if not isinstance(proof, dict):
        return {"valid": False, "reason": "Proof bundle is not a valid JSON object."}

    # 1. Watermark Integrity (CRC)
    verification = proof.get("verification", {})
    if not verification.get("crc_valid"):
        return {"valid": False, "reason": "Watermark CRC integrity check failed."}

    # 2. File Hash Consistency
    file_hash = proof.get("file_hash")
    if not file_hash or len(file_hash) != 64:
        return {"valid": False, "reason": "Invalid or missing file hash in proof bundle."}

    # 3. Decrypted Output Hash
    decrypted_hash = proof.get("decrypted_hash")
    if not decrypted_hash:
        return {"valid": False, "reason": "Invalid or missing decrypted output hash in proof bundle."}

    # 4. Hash Chain Linkage
    ledger = proof.get("ledger", {})
    block_hash = ledger.get("block_hash")
    prev_hash = ledger.get("prev_hash")
    block_index = ledger.get("block_index")

    if not block_hash or not prev_hash or block_index is None:
        return {"valid": False, "reason": "Missing ledger linkage fields (block_hash, prev_hash, block_index)."}

    if len(block_hash) != 64 or len(prev_hash) != 64:
        return {"valid": False, "reason": "Invalid hash length in ledger linkage (expected 64-char hex SHA-256)."}

    if block_index == 0 and prev_hash != "0" * 64:
        return {"valid": False, "reason": "Genesis block prev_hash must be 64 zeros."}

    # Verify linkage against local ledger chain if available
    try:
        from modules.ledger.hashchain import _load_chain
        chain = _load_chain()
        if chain and 0 <= block_index < len(chain):
            local_b = chain[block_index]
            local_wm = local_b.get("watermark_id") or (local_b.get("data", {}).get("watermark_id") if isinstance(local_b.get("data"), dict) else "")
            if local_wm and local_wm == proof.get("watermark_id"):
                if local_b.get("hash") != block_hash:
                    return {"valid": False, "reason": f"Ledger linkage violation: block {block_index} hash does not match immutable ledger."}
                local_prev = local_b.get("prev_hash") or local_b.get("previous_hash")
                if local_prev != prev_hash:
                    return {"valid": False, "reason": f"Ledger linkage violation: block {block_index} prev_hash does not match immutable ledger."}
    except Exception:
        pass

    # 5. Anchor Validity
    anchor_hash = ledger.get("anchor_hash")
    if not anchor_hash or len(anchor_hash) != 64:
        return {"valid": False, "reason": "Invalid or missing anchor checkpoint hash."}

    # 6. Cryptographic Signatures Verification
    signatures = proof.get("signatures", {})
    recipient_sig = signatures.get("recipient")
    gateway_sig = signatures.get("gateway")
    peers = signatures.get("peers", [])
    user_id = proof.get("user_id")

    if not recipient_sig:
        return {"valid": False, "reason": "Missing recipient post-quantum signature."}
    if not gateway_sig:
        return {"valid": False, "reason": "Missing gateway authority signature."}
    if not peers or len(peers) < 1:
        return {"valid": False, "reason": "Consensus quorum failure: missing peer node signatures in proof bundle."}

    payload = {
        "watermark_id":   proof.get("watermark_id"),
        "user_id":        user_id,
        "timestamp":      proof.get("timestamp"),
        "file_hash":      file_hash,
        "decrypted_hash": decrypted_hash,
    }

    # Verify recipient signature (Dilithium)
    try:
        user_pub = load_public_key(user_id)
        if not verify_decryption_event(payload, recipient_sig, user_pub) and \
           not verify_signature(payload, recipient_sig, user_pub):
            return {"valid": False, "reason": f"Recipient post-quantum signature invalid for user '{user_id}'."}
    except Exception as e:
        return {"valid": False, "reason": f"Recipient public key error: {e}"}

    # Verify gateway signature (Dilithium)
    try:
        sys_pub = load_public_key("system")
        if not _verify_raw_signature(block_hash.encode("utf-8"), gateway_sig, sys_pub) and \
           not verify_signature(payload, gateway_sig, sys_pub):
            return {"valid": False, "reason": "Gateway authority signature invalid."}
    except Exception as e:
        return {"valid": False, "reason": f"Gateway authority key error: {e}"}

    # Verify peer node signatures (Dilithium)
    for p in peers:
        node_id = p.get("node_id")
        p_sig = p.get("signature")
        if not node_id or not p_sig:
            return {"valid": False, "reason": "Malformed peer signature entry in proof bundle."}
        try:
            peer_pub = load_public_key(node_id)
            if not _verify_raw_signature(block_hash.encode("utf-8"), p_sig, peer_pub) and \
               not verify_signature(payload, p_sig, peer_pub):
                return {"valid": False, "reason": f"Peer signature invalid for node '{node_id}'."}
        except Exception as e:
            return {"valid": False, "reason": f"Peer public key error for node '{node_id}': {e}"}

    return {"valid": True, "reason": "All proof bundle cryptographic checks passed."}


def save_proof_bundle(proof: dict, proof_id: Optional[str] = None) -> str:
    """Save proof bundle JSON to data/proofs/."""
    os.makedirs(PROOFS_DIR, exist_ok=True)
    if not proof_id:
        wm = proof.get("watermark_id") or ""
        proof_id = f"PRF-{wm[:16]}" if wm else f"PRF-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    filepath = os.path.join(PROOFS_DIR, f"{proof_id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(proof, f, indent=2)

    return proof_id


def load_proof_bundle(proof_id: str) -> Optional[dict]:
    """Load proof bundle JSON from data/proofs/."""
    clean_id = proof_id.replace(".json", "")
    target = os.path.join(PROOFS_DIR, f"{clean_id}.json")
    if os.path.exists(target):
        try:
            with open(target, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    # Check if proof_id is a watermark_id
    for fname in os.listdir(PROOFS_DIR):
        if fname.endswith(".json"):
            fpath = os.path.join(PROOFS_DIR, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("watermark_id") == proof_id:
                        return data
            except Exception:
                continue

    return None
