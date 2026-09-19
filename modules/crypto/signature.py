"""
Signature Module — Ed25519 keypair management, signing, and verification.

Signature covers ALL record fields: watermark_id, user_id, file_id, timestamp, nonce.
"""

import json
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
    load_pem_public_key,
)

from config import KEYS_DIR


# ── Key Management ────────────────────────────────────────────

def _key_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "ed25519_private.pem"),
        os.path.join(user_dir, "ed25519_public.pem"),
    )


def generate_keypair(user_id: str) -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """Generate and persist an Ed25519 keypair for the given user."""
    priv_path, pub_path = _key_paths(user_id)

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    with open(priv_path, "wb") as f:
        f.write(private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    with open(pub_path, "wb") as f:
        f.write(public_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo))

    return private_key, public_key


def load_private_key(user_id: str) -> Ed25519PrivateKey:
    priv_path, _ = _key_paths(user_id)
    if not os.path.exists(priv_path):
        raise FileNotFoundError(f"No private key for user '{user_id}'. Run key generation first.")
    with open(priv_path, "rb") as f:
        return load_pem_private_key(f.read(), password=None)  # type: ignore[return-value]


def load_public_key(user_id: str) -> Ed25519PublicKey:
    _, pub_path = _key_paths(user_id)
    if not os.path.exists(pub_path):
        raise FileNotFoundError(f"No public key for user '{user_id}'. Run key generation first.")
    with open(pub_path, "rb") as f:
        return load_pem_public_key(f.read())  # type: ignore[return-value]


# ── Signing & Verification ───────────────────────────────────

def _canonical_record(record: dict) -> bytes:
    """
    Deterministic serialization of the record fields that MUST be signed.
    Covers: watermark_id, user_id, file_id, timestamp, nonce.
    """
    signed_fields = {
        "watermark_id": record["watermark_id"],
        "user_id":      record["user_id"],
        "file_id":      record["file_id"],
        "timestamp":    record["timestamp"],
        "nonce":        record["nonce"],
    }
    return json.dumps(signed_fields, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_record(record: dict, private_key: Ed25519PrivateKey) -> str:
    """Sign a decryption record. Returns hex-encoded signature."""
    message = _canonical_record(record)
    signature = private_key.sign(message)
    return signature.hex()


def verify_signature(record: dict, signature_hex: str, public_key: Ed25519PublicKey) -> bool:
    """Verify signature over the record. Returns True if valid."""
    message = _canonical_record(record)
    try:
        public_key.verify(bytes.fromhex(signature_hex), message)
        return True
    except Exception:
        return False
