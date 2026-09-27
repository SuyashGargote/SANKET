#!/usr/bin/env python3
"""
Comprehensive Validation Test for Phase 1, Phase 2, and Phase 3:
  - Real Multi-Node Distributed Ledger (Node A & Node B with independent ledgers)
  - Consensus Quorum (Recipient + Gateway + Peer Node Dilithium signatures)
  - Proof Bundle generation and full cryptographic verification
  - Tamper detection across peer nodes and secondary anchors
  - User-side session binding and key uniqueness
"""

import json
import os
import shutil
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from PIL import Image

from api.server import app
from config import DATA_DIR, KEYS_DIR
from modules.crypto.encryption import encrypt_file, generate_kyber_keypair
from modules.crypto.decryption import decrypt_file
from modules.crypto.signature import (
    generate_keypair,
    load_private_key,
    load_public_key,
    sign_decryption_event,
    verify_decryption_event,
    verify_key_uniqueness,
    _verify_raw_signature,
)
from modules.ledger.hashchain import (
    _compute_block_hash,
    _load_chain,
    _load_anchors,
    append_record,
    get_ledger_dir,
    verify_chain,
    verify_ledger_with_anchors,
)
from modules.ledger.network import (
    load_node_config,
    get_node_info,
    validate_block,
    receive_block,
    broadcast_block,
    sync_with_peers,
    verify_peer_anchors,
    ensure_node_keys,
)
from modules.proof.proof_bundle import (
    generate_proof_bundle,
    verify_proof_bundle,
    save_proof_bundle,
    load_proof_bundle,
)
from modules.verification.verifier import verify_leaked_file


class TestMultiNodeAndAttributionSystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.headers = {"X-API-KEY": "sanket-admin-key-2026"}

        # Ensure identities exist with Dilithium + Kyber keypairs
        for uid in ["alice", "bob", "node_A", "node_B", "node_C", "system"]:
            ensure_node_keys(uid)
            generate_kyber_keypair(uid)

        # Create a valid test image (256x256 to ensure > 432 blocks for DCT watermark payload)
        cls.test_img = os.path.join(DATA_DIR, "pqc_multinode_test.png")
        img = Image.new("RGBA", (256, 256), color=(120, 160, 210, 255))
        img.save(cls.test_img, "PNG")

        # Encrypt package for alice and bob
        cls.pkg_dir = encrypt_file(cls.test_img, ["alice", "bob"])

    def test_01_user_signing_enforcement_and_non_repudiation(self):
        """Phase 3: Decryption event is signed with recipient's private key covering all 5 mandatory fields."""
        res = decrypt_file(self.pkg_dir, "alice", active_session_user="alice")
        record = res["record"]
        block = res["block"]

        # Check required fields
        for field in ("watermark_id", "user_id", "timestamp", "file_hash", "decrypted_hash"):
            self.assertIn(field, record)
            self.assertIn(field, block["data"])
            self.assertTrue(len(record[field]) > 0)

        # Verify recipient Dilithium signature
        alice_pub = load_public_key("alice")
        bob_pub = load_public_key("bob")
        self.assertTrue(verify_decryption_event(record, record["signature"], alice_pub))
        self.assertFalse(verify_decryption_event(record, record["signature"], bob_pub))

    def test_02_session_binding_prevention(self):
        """Phase 3: Active session binding strictly prevents impersonation or signing as another user."""
        # Active session alice attempting to decrypt as bob MUST be rejected
        with self.assertRaises(PermissionError):
            decrypt_file(self.pkg_dir, "bob", active_session_user="alice")

        # API endpoint with mismatching session header
        resp = self.client.post(
            "/decrypt?sync=true",
            headers={**self.headers, "X-User-ID": "alice"},
            json={"package_path": self.pkg_dir, "user": "bob"},
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("cannot decrypt or sign as", resp.json()["error"])

    def test_03_no_key_reuse_across_users(self):
        """Phase 3: Key uniqueness enforcement across all registered identities."""
        ok, msg = verify_key_uniqueness()
        self.assertTrue(ok, msg)

    def test_04_independent_ledgers_per_node(self):
        """Phase 2: Independent storage per node identity (NO shared storage)."""
        os.environ["NODE_ID"] = "node_B"
        node_b_dir = get_ledger_dir()
        self.assertIn("node_B", node_b_dir)

        os.environ["NODE_ID"] = "node_A"
        node_a_dir = get_ledger_dir()
        self.assertNotEqual(node_a_dir, node_b_dir)

    def test_05_block_structure_and_consensus_quorum(self):
        """Phase 2: Step 6 Block structure and Step 4 Consensus Quorum (Recipient + Gateway + Peer)."""
        chain = _load_chain()
        self.assertTrue(len(chain) > 0)
        b = chain[-1]

        # Step 6 required structure
        self.assertIn("index", b)
        self.assertIn("data", b)
        self.assertIn("prev_hash", b)
        self.assertIn("hash", b)
        self.assertIn("signatures", b)

        sigs = b["signatures"]
        self.assertIn("recipient", sigs)
        self.assertIn("gateway", sigs)
        self.assertIn("peers", sigs)
        self.assertTrue(len(sigs["peers"]) >= 1)

        # Quorum validation
        valid, reason = validate_block(b, require_quorum=True)
        self.assertTrue(valid, reason)

        # Quorum failure if peer signature missing
        bad_b = json.loads(json.dumps(b))
        bad_b["signatures"]["peers"] = []
        valid, reason = validate_block(bad_b, require_quorum=True)
        self.assertFalse(valid)
        self.assertIn("at least ONE peer node", reason)

    def test_06_peer_block_reception_and_validation(self):
        """Phase 2: Step 3 & 7 POST /ledger/block/sign and POST /ledger/block/receive."""
        chain = _load_chain()
        sample_b = chain[-1]

        # Peer signs candidate block
        resp = self.client.post("/ledger/block/sign", json={"block": sample_b}, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        res_data = resp.json().get("data", resp.json())
        self.assertIn("signature", res_data)
        self.assertIn("node_id", res_data)

        # Receive broadcast block (idempotency check)
        resp2 = self.client.post("/ledger/block/receive", json={"block": sample_b}, headers=self.headers)
        self.assertEqual(resp2.status_code, 200)

    def test_07_proof_bundle_generation_and_full_verification(self):
        """Phase 1: Generate proof bundle and perform full cryptographic verification."""
        res = decrypt_file(self.pkg_dir, "bob", active_session_user="bob")
        vr = verify_leaked_file(res["output_path"])
        self.assertEqual(vr["status"], "identified")
        self.assertEqual(vr["user"], "bob")

        proof = generate_proof_bundle(vr, res["block"])

        # Check JSON schema exactly as specified in problem statement
        for field in ("watermark_id", "user_id", "timestamp", "file_hash", "decrypted_hash", "ledger", "signatures", "verification"):
            self.assertIn(field, proof)

        for l_field in ("block_index", "prev_hash", "block_hash", "anchor_hash"):
            self.assertIn(l_field, proof["ledger"])

        for s_field in ("recipient", "gateway", "peers"):
            self.assertIn(s_field, proof["signatures"])

        for v_field in ("crc_valid", "confidence", "verdict"):
            self.assertIn(v_field, proof["verification"])

        # Cryptographically verify proof bundle
        v_res = verify_proof_bundle(proof)
        self.assertTrue(v_res["valid"], v_res["reason"])

    def test_08_proof_bundle_tamper_detection_on_all_fields(self):
        """Phase 1: Proof bundle rejects tampering with any signature, hash, or identity."""
        res = decrypt_file(self.pkg_dir, "alice", active_session_user="alice")
        vr = verify_leaked_file(res["output_path"])
        proof = generate_proof_bundle(vr, res["block"])

        # Tampered recipient signature
        t1 = json.loads(json.dumps(proof))
        t1["signatures"]["recipient"] = "deadbeef" * 20
        self.assertFalse(verify_proof_bundle(t1)["valid"])

        # Tampered gateway signature
        t2 = json.loads(json.dumps(proof))
        t2["signatures"]["gateway"] = "deadbeef" * 20
        self.assertFalse(verify_proof_bundle(t2)["valid"])

        # Tampered user_id
        t3 = json.loads(json.dumps(proof))
        t3["user_id"] = "eve"
        self.assertFalse(verify_proof_bundle(t3)["valid"])

        # Tampered file_hash
        t4 = json.loads(json.dumps(proof))
        t4["file_hash"] = "0" * 64
        self.assertFalse(verify_proof_bundle(t4)["valid"])

        # Tampered decrypted_hash
        t5 = json.loads(json.dumps(proof))
        t5["decrypted_hash"] = "0" * 64
        self.assertFalse(verify_proof_bundle(t5)["valid"])

        # Tampered CRC
        t6 = json.loads(json.dumps(proof))
        t6["verification"]["crc_valid"] = False
        self.assertFalse(verify_proof_bundle(t6)["valid"])

        # Missing peer signatures (quorum failure)
        t7 = json.loads(json.dumps(proof))
        t7["signatures"]["peers"] = []
        self.assertFalse(verify_proof_bundle(t7)["valid"])

    def test_09_apis_include_proof_bundles(self):
        """Phase 1 APIs: POST /verify, POST /report, GET /proof/{id}, POST /proof/verify."""
        res = decrypt_file(self.pkg_dir, "bob", active_session_user="bob")
        filename = os.path.basename(res["output_path"])

        # POST /verify
        with open(res["output_path"], "rb") as f:
            resp = self.client.post("/verify", files={"file": (filename, f, "image/png")}, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        v_data = resp.json().get("data", resp.json())
        self.assertIn("proof", v_data)
        self.assertIn("proof_id", v_data)
        proof_id = v_data["proof_id"]

        # GET /proof/{id}
        resp = self.client.get(f"/proof/{proof_id}")
        self.assertEqual(resp.status_code, 200)
        loaded_proof = resp.json().get("data", resp.json())
        self.assertEqual(loaded_proof["watermark_id"], res["watermark_id"])

        # POST /proof/verify
        resp = self.client.post("/proof/verify", json=loaded_proof, headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("data", resp.json())["valid"])


if __name__ == "__main__":
    unittest.main()
