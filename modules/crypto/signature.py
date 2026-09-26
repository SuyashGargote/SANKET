"""
Signature Module — Post-Quantum Dilithium (ML-DSA-65) keypair management, signing, and verification.
Compatible with Ed25519 fallback if legacy keys are encountered.

Signature covers ALL record fields: watermark_id, user_id, file_id, timestamp, nonce.
"""

import json
import os

from pqcrypto.sign import ml_dsa_65

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

def _dilithium_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "dilithium_private.bin"),
        os.path.join(user_dir, "dilithium_public.bin"),
    )


def _ed25519_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "ed25519_private.pem"),
        os.path.join(user_dir, "ed25519_public.pem"),
    )


def generate_keypair(user_id: str) -> tuple[bytes, bytes]:
    """
    Generate and persist a post-quantum Dilithium (ML-DSA-65) keypair for the given user.
    Also persists Ed25519 keypair for full backwards compatibility.
    """
    priv_path, pub_path = _dilithium_paths(user_id)
    pub_key, priv_key = ml_dsa_65.keygen()

    with open(priv_path, "wb") as f:
        f.write(priv_key)
    with open(pub_path, "wb") as f:
        f.write(pub_key)

    # Also persist Ed25519 for dual-stack compatibility
    ed_priv_path, ed_pub_path = _ed25519_paths(user_id)
    ed_private = Ed25519PrivateKey.generate()
    with open(ed_priv_path, "wb") as f:
        f.write(ed_private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    with open(ed_pub_path, "wb") as f:
        f.write(ed_private.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo))

    return priv_key, pub_key


def load_private_key(user_id: str):
    """Load private key (ML-DSA-65 Dilithium preferred, Ed25519 fallback)."""
    dilithium_priv, _ = _dilithium_paths(user_id)
    if os.path.exists(dilithium_priv):
        with open(dilithium_priv, "rb") as f:
            return f.read()

    ed_priv, _ = _ed25519_paths(user_id)
    if os.path.exists(ed_priv):
        with open(ed_priv, "rb") as f:
            return load_pem_private_key(f.read(), password=None)

    raise FileNotFoundError(f"No private key for user '{user_id}'. Run key generation first.")


def load_public_key(user_id: str):
    """Load public key (ML-DSA-65 Dilithium preferred, Ed25519 fallback)."""
    _, dilithium_pub = _dilithium_paths(user_id)
    if os.path.exists(dilithium_pub):
        with open(dilithium_pub, "rb") as f:
            return f.read()

    _, ed_pub = _ed25519_paths(user_id)
    if os.path.exists(ed_pub):
        with open(ed_pub, "rb") as f:
            return load_pem_public_key(f.read())

    raise FileNotFoundError(f"No public key for user '{user_id}'. Run key generation first.")


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


def sign_record(record: dict, private_key) -> str:
    """Sign a decryption record using Dilithium (ML-DSA-65). Returns hex-encoded signature."""
    message = _canonical_record(record)
    if isinstance(private_key, bytes):
        sig = ml_dsa_65.sign(private_key, message)
        return sig.hex()
    elif hasattr(private_key, "sign"):
        # Ed25519 fallback
        return private_key.sign(message).hex()
    else:
        raise TypeError(f"Unsupported private key type: {type(private_key)}")


def verify_signature(record: dict, signature_hex: str, public_key) -> bool:
    """Verify signature over the record using Dilithium (ML-DSA-65). Returns True if valid."""
    message = _canonical_record(record)
    try:
        sig_bytes = bytes.fromhex(signature_hex)
    except Exception:
        return False

    if isinstance(public_key, bytes):
        try:
            ml_dsa_65.verify(public_key, message, sig_bytes)
            return True
        except Exception:
            # Maybe public_key was Ed25519 raw bytes?
            try:
                ed_pub = Ed25519PublicKey.from_public_bytes(public_key)
                ed_pub.verify(sig_bytes, message)
                return True
            except Exception:
                return False
    elif hasattr(public_key, "verify"):
        try:
            public_key.verify(sig_bytes, message)
            return True
        except Exception:
            return False
    elif isinstance(public_key, str):
        try:
            ml_dsa_65.verify(bytes.fromhex(public_key), message, sig_bytes)
            return True
        except Exception:
            return False

    return False
