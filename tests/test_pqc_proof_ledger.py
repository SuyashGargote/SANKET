#!/usr/bin/env python3
"""
Test Suite for SANKET Cryptographic Attribution System Upgrades:
  - Phase 1: Cryptographic Proof Bundle (Generation, Verification, Tamper Detection)
  - Phase 2: Real Multi-Node Distributed Ledger (HTTP P2P, Consensus Quorum, Independent Ledgers, Sync)
  - Phase 3: User-Side Signing Enforcement (Post-Quantum Dilithium, Session Binding, Non-Repudiation)
"""

import json
import os
import shutil
import sys
import threading
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from api.server import app
from config import DATA_DIR, KEYS_DIR, LEDGER_DIR, PROOFS_DIR
from modules.crypto.signature import (
    generate_keypair,
    load_private_key,
    load_public_key,
    sign_decryption_event,
    verify_decryption_event,
    verify_key_uniqueness,
)
from modules.crypto.encryption import encrypt_file, generate_kyber_keypair
from modules.crypto.decryption import decrypt_file
from modules.ledger.hashchain import (
    append_record,
    get_all_records,
    query_by_watermark,
    verify_chain,
    verify_ledger_with_anchors,
    _load_chain,
    _compute_block_hash,
)
from modules.ledger.network import (
    load_node_config,
    get_node_info,
    validate_block,
    request_peer_signatures,
    broadcast_block,
    receive_block,
    sync_with_peers,
    ensure_node_keys,
)
from modules.proof.proof_bundle import (
    generate_proof_bundle,
    verify_proof_bundle,
    save_proof_bundle,
    load_proof_bundle,
)
from modules.verification.verifier import verify_leaked_file


class TestPQCProofAndLedger(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.headers = {"X-API-KEY": "sanket-admin-key-2026"}

        # Ensure identities exist with Dilithium + Kyber keypairs
        for uid in ["alice", "bob", "node_A", "node_B", "system"]:
            generate_keypair(uid)
            generate_kyber_keypair(uid)

        # Create a small test image if needed
        cls.test_img = os.path.join(DATA_DIR, "pqc_test.png")
        from PIL import Image
        img = Image.new("RGBA", (256, 256), color=(100, 150, 200, 255))
        img.save(cls.test_img, "PNG")

        # Encrypt file for alice & bob
        cls.pkg_dir = encrypt_file(cls.test_img, ["alice", "bob"])

    def test_01_user_side_signing_enforcement(self):
        """Phase 3: Verify user signs decryption event with own Dilithium key and full required payload."""
        payload = {
            "watermark_id": "wm_test_1234567890abcdef",
            "user_id": "alice",
            "timestamp": "2026-09-27T12:00:00Z",
            "file_hash": "a" * 64,
            "decrypted_hash": "b" * 64,
        }

        alice_priv = load_private_key("alice")
        alice_pub = load_public_key("alice")
        bob_pub = load_public_key("bob")

        # Sign decryption event
        sig = sign_decryption_event(alice_priv, payload)
        self.assertIsInstance(sig, str)
        self.assertTrue(len(sig) > 100)

        # Verification with Alice's public key MUST succeed
        self.assertTrue(verify_decryption_event(payload, sig, alice_pub))

        # Verification with Bob's public key MUST fail (non-repudiation)
        self.assertFalse(verify_decryption_event(payload, sig, bob_pub))

        # Missing any required field MUST raise ValueError
        incomplete_payload = dict(payload)
        del incomplete_payload["decrypted_hash"]
        with self.assertRaises(ValueError):
            sign_decryption_event(alice_priv, incomplete_payload)

    def test_02_session_binding_enforcement(self):
        """Phase 3: Active session binding prevents signing under another user's identity."""
        # Decrypting as alice with alice's session -> OK
        res = decrypt_file(self.pkg_dir, "alice", active_session_user="alice")
        self.assertIn("watermark_id", res)
        self.assertIn("file_hash", res)
        self.assertIn("decrypted_hash", res)
        self.assertEqual(len(res["file_hash"]), 64)
        self.assertEqual(len(res["decrypted_hash"]), 64)

        # Decrypting as alice with bob's session -> STRICT FORBIDDEN
        with self.assertRaises(PermissionError):
            decrypt_file(self.pkg_dir, "alice", active_session_user="bob")

    def test_03_key_uniqueness_enforcement(self):
        """Phase 3: Verify no Dilithium keys are reused across distinct users."""
        ok, msg = verify_key_uniqueness()
        self.assertTrue(ok, msg)

    def test_04_block_structure_and_consensus_rule(self):
        """Phase 2: Verify block structure and consensus rules (quorum of recipient + gateway + peers)."""
        chain = _load_chain()
        self.assertTrue(len(chain) > 0)
        latest_block = chain[-1]

        # Step 6 block structure validation
        self.assertIn("index", latest_block)
        self.assertIn("data", latest_block)
        self.assertIn("prev_hash", latest_block)
        self.assertIn("hash", latest_block)
        self.assertIn("signatures", latest_block)

        sigs = latest_block["signatures"]
        self.assertIn("recipient", sigs)
        self.assertIn("gateway", sigs)
        self.assertIn("peers", sigs)
        self.assertTrue(len(sigs["peers"]) >= 1)

        # Validate consensus quorum
        valid, reason = validate_block(latest_block, require_quorum=True)
        self.assertTrue(valid, reason)

        # Consensus failure test: Remove peer signatures
        tampered_block = json.loads(json.dumps(latest_block))
        tampered_block["signatures"]["peers"] = []
        valid, reason = validate_block(tampered_block, require_quorum=True)
        self.assertFalse(valid)
        self.assertIn("at least ONE peer node", reason)

        # Consensus failure test: Remove recipient signature
        tampered_block = json.loads(json.dumps(latest_block))
        tampered_block["signatures"]["recipient"] = None
        tampered_block["recipient_signature"] = None
        tampered_block["signature"] = None
        valid, reason = validate_block(tampered_block, require_quorum=False)
        self.assertFalse(valid)

    def test_05_proof_bundle_generation_and_verification(self):
        """Phase 1: Generate and cryptographically verify Proof Bundle."""
        # Decrypt to generate fresh evidence
        res = decrypt_file(self.pkg_dir, "bob", active_session_user="bob")
        watermarked_path = res["output_path"]

        # Run forensic verification
        vr = verify_leaked_file(watermarked_path)
        self.assertEqual(vr["status"], "identified")
        self.assertEqual(vr["user"], "bob")

        # Generate proof bundle
        proof = generate_proof_bundle(vr, res["block"])

        # Check required JSON fields exactly matching problem statement
        self.assertIn("watermark_id", proof)
        self.assertIn("user_id", proof)
        self.assertIn("timestamp", proof)
        self.assertIn("file_hash", proof)
        self.assertIn("decrypted_hash", proof)
        self.assertIn("ledger", proof)
        self.assertIn("signatures", proof)
        self.assertIn("verification", proof)

        self.assertEqual(proof["user_id"], "bob")
        self.assertEqual(proof["watermark_id"], res["watermark_id"])
        self.assertEqual(proof["ledger"]["block_index"], res["block"]["index"])
        self.assertTrue(proof["verification"]["crc_valid"])

        # Cryptographically verify proof bundle
        verify_result = verify_proof_bundle(proof)
        self.assertTrue(verify_result["valid"], verify_result["reason"])

    def test_06_proof_bundle_tamper_detection(self):
        """Phase 1: Proof bundle rejects any forged or tampered component."""
        res = decrypt_file(self.pkg_dir, "alice", active_session_user="alice")
        vr = verify_leaked_file(res["output_path"])
        proof = generate_proof_bundle(vr, res["block"])

        # 1. Tamper CRC
        t_proof = json.loads(json.dumps(proof))
        t_proof["verification"]["crc_valid"] = False
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

        # 2. Tamper file_hash
        t_proof = json.loads(json.dumps(proof))
        t_proof["file_hash"] = "0" * 64
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

        # 3. Tamper user_id
        t_proof = json.loads(json.dumps(proof))
        t_proof["user_id"] = "mallory"
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

        # 4. Tamper recipient signature
        t_proof = json.loads(json.dumps(proof))
        t_proof["signatures"]["recipient"] = "deadbeef" * 20
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

        # 5. Tamper gateway signature
        t_proof = json.loads(json.dumps(proof))
        t_proof["signatures"]["gateway"] = "deadbeef" * 20
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

        # 6. Tamper peer signatures
        t_proof = json.loads(json.dumps(proof))
        t_proof["signatures"]["peers"] = []
        v = verify_proof_bundle(t_proof)
        self.assertFalse(v["valid"])

    def test_07_rest_api_proof_endpoints(self):
        """API Validation: POST /verify, POST /report, GET /proof/{id}, POST /proof/verify."""
        # Decrypt a test file
        res = decrypt_file(self.pkg_dir, "alice", active_session_user="alice")
        filename = os.path.basename(res["output_path"])

        # 1. POST /verify with file upload
        with open(res["output_path"], "rb") as f:
            resp = self.client.post(
                "/verify",
                files={"file": (filename, f, "image/png")},
                headers=self.headers,
            )
        self.assertEqual(resp.status_code, 200)
        v_data = resp.json().get("data", resp.json())
        self.assertIn("proof", v_data)
        self.assertIn("proof_id", v_data)
        proof_id = v_data["proof_id"]

        # 2. GET /proof/{id}
        resp = self.client.get(f"/proof/{proof_id}", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        stored_proof = resp.json().get("data", resp.json())
        self.assertEqual(stored_proof["watermark_id"], res["watermark_id"])

        # 3. POST /proof/verify
        resp = self.client.post("/proof/verify", json=stored_proof, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        pv_data = resp.json().get("data", resp.json())
        self.assertTrue(pv_data["valid"])

    def test_08_rest_api_distributed_ledger_endpoints(self):
        """API Validation: GET /ledger/peers, GET /ledger/sync, POST /ledger/block/sign, POST /ledger/block/receive."""
        # 1. GET /ledger/peers
        resp = self.client.get("/ledger/peers", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        peers_data = resp.json().get("data", resp.json())
        self.assertIn("node_id", peers_data)
        self.assertIn("public_key", peers_data)

        # 2. GET /ledger/sync
        resp = self.client.get("/ledger/sync", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        sync_data = resp.json().get("data", resp.json())
        self.assertIn("chain", sync_data)
        self.assertIn("anchors", sync_data)

        # 3. POST /ledger/block/sign (Peer signing simulation via HTTP)
        chain = _load_chain()
        sample_block = chain[-1]
        resp = self.client.post(
            "/ledger/block/sign",
            json={"block": sample_block},
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)
        sign_res = resp.json().get("data", resp.json())
        self.assertIn("signature", sign_res)
        self.assertIn("node_id", sign_res)

        # 4. POST /ledger/block/receive (Peer broadcast reception)
        resp = self.client.post(
            "/ledger/block/receive",
            json={"block": sample_block},
            headers=self.headers,
        )
        self.assertEqual(resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()
