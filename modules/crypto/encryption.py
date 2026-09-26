"""
Encryption Module — AES-256-GCM file encryption with Post-Quantum Kyber (ML-KEM-768) key wrapping.

Key wrapping uses ML-KEM-768 (Kyber768) to encapsulate a shared secret per recipient,
then uses HKDF-SHA256 to derive a wrapping key, and encrypts the file-level AES key
with AES-256-GCM under that wrapping key.
"""

import json
import os

from pqcrypto.kem import ml_kem_768

from cryptography.hazmat.primitives.asymmetric.x25519 import (
    X25519PrivateKey,
    X25519PublicKey,
)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
    load_pem_public_key,
)

from config import AES_KEY_SIZE, AES_NONCE_SIZE, ENCRYPTED_DIR, KEYS_DIR
from utils.helpers import validate_file_type


# ── Key Pair Management (Kyber + X25519) ──────────────────────

def _kyber_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "kyber_private.bin"),
        os.path.join(user_dir, "kyber_public.bin"),
    )


def _x25519_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "x25519_private.pem"),
        os.path.join(user_dir, "x25519_public.pem"),
    )


def generate_kyber_keypair(user_id: str) -> tuple[bytes, bytes]:
    """
    Generate and persist an ML-KEM-768 (Kyber) keypair for key encapsulation.
    Also persists X25519 keypair for dual-stack backwards compatibility.
    """
    priv_path, pub_path = _kyber_paths(user_id)
    pub_key, priv_key = ml_kem_768.keygen()

    with open(priv_path, "wb") as f:
        f.write(priv_key)
    with open(pub_path, "wb") as f:
        f.write(pub_key)

    # Persist X25519 as fallback
    x_priv_path, x_pub_path = _x25519_paths(user_id)
    x_priv = X25519PrivateKey.generate()
    with open(x_priv_path, "wb") as f:
        f.write(x_priv.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    with open(x_pub_path, "wb") as f:
        f.write(x_priv.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo))

    return priv_key, pub_key


# Backwards compatibility alias
generate_x25519_keypair = generate_kyber_keypair


def load_kyber_private(user_id: str) -> bytes:
    priv_path, _ = _kyber_paths(user_id)
    if os.path.exists(priv_path):
        with open(priv_path, "rb") as f:
            return f.read()
    raise FileNotFoundError(f"No Kyber private key for user '{user_id}'. Run key generation first.")


def load_kyber_public(user_id: str) -> bytes:
    _, pub_path = _kyber_paths(user_id)
    if os.path.exists(pub_path):
        with open(pub_path, "rb") as f:
            return f.read()
    raise FileNotFoundError(f"No Kyber public key for user '{user_id}'. Run key generation first.")


def load_x25519_private(user_id: str):
    """Load private key for key unwrap (Kyber preferred, X25519 fallback)."""
    try:
        return load_kyber_private(user_id)
    except FileNotFoundError:
        pass

    priv_path, _ = _x25519_paths(user_id)
    if os.path.exists(priv_path):
        with open(priv_path, "rb") as f:
            return load_pem_private_key(f.read(), password=None)
    raise FileNotFoundError(f"No private key for user '{user_id}'. Run key generation first.")


def load_x25519_public(user_id: str):
    """Load public key for key wrap (Kyber preferred, X25519 fallback)."""
    try:
        return load_kyber_public(user_id)
    except FileNotFoundError:
        pass

    _, pub_path = _x25519_paths(user_id)
    if os.path.exists(pub_path):
        with open(pub_path, "rb") as f:
            return load_pem_public_key(f.read())
    raise FileNotFoundError(f"No public key for user '{user_id}'. Run key generation first.")


# ── Key Wrapping (ML-KEM-768 Kyber) ──────────────────────────

def _derive_wrapping_key(shared_secret: bytes) -> bytes:
    """HKDF-SHA256 to derive a 256-bit wrapping key from shared secret."""
    return HKDF(
        algorithm=SHA256(),
        length=AES_KEY_SIZE,
        salt=None,
        info=b"pqc-document-key-wrap",
    ).derive(shared_secret)


def _wrap_key(file_key: bytes, recipient_public: bytes | X25519PublicKey) -> dict:
    """
    Wrap the file-level AES key for one recipient.
    Uses ML-KEM-768 encapsulation -> HKDF -> AES-GCM wrap.
    """
    if isinstance(recipient_public, bytes):
        # Post-quantum Kyber (ML-KEM-768)
        ciphertext, shared_secret = ml_kem_768.encaps(recipient_public)
        wrapping_key = _derive_wrapping_key(shared_secret)

        nonce = os.urandom(AES_NONCE_SIZE)
        aesgcm = AESGCM(wrapping_key)
        wrapped = aesgcm.encrypt(nonce, file_key, None)

        return {
            "algorithm": "ML-KEM-768",
            "kyber_ciphertext": ciphertext.hex(),
            "nonce": nonce.hex(),
            "wrapped_key": wrapped.hex(),
        }
    else:
        # Legacy X25519
        ephemeral_private = X25519PrivateKey.generate()
        ephemeral_public = ephemeral_private.public_key()
        shared_secret = ephemeral_private.exchange(recipient_public)
        wrapping_key = _derive_wrapping_key(shared_secret)

        nonce = os.urandom(AES_NONCE_SIZE)
        aesgcm = AESGCM(wrapping_key)
        wrapped = aesgcm.encrypt(nonce, file_key, None)

        return {
            "algorithm": "X25519",
            "ephemeral_public": ephemeral_public.public_bytes(
                Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
            ).decode(),
            "nonce": nonce.hex(),
            "wrapped_key": wrapped.hex(),
        }


def _unwrap_key(wrap_info: dict, recipient_private: bytes | X25519PrivateKey) -> bytes:
    """Unwrap the file-level AES key using recipient's Kyber secret key."""
    if "kyber_ciphertext" in wrap_info and isinstance(recipient_private, bytes):
        ct = bytes.fromhex(wrap_info["kyber_ciphertext"])
        shared_secret = ml_kem_768.decaps(recipient_private, ct)
        wrapping_key = _derive_wrapping_key(shared_secret)

        nonce = bytes.fromhex(wrap_info["nonce"])
        wrapped = bytes.fromhex(wrap_info["wrapped_key"])
        aesgcm = AESGCM(wrapping_key)
        return aesgcm.decrypt(nonce, wrapped, None)
    elif "ephemeral_public" in wrap_info and hasattr(recipient_private, "exchange"):
        ephemeral_public = load_pem_public_key(
            wrap_info["ephemeral_public"].encode()
        )
        shared_secret = recipient_private.exchange(ephemeral_public)
        wrapping_key = _derive_wrapping_key(shared_secret)

        nonce = bytes.fromhex(wrap_info["nonce"])
        wrapped = bytes.fromhex(wrap_info["wrapped_key"])
        aesgcm = AESGCM(wrapping_key)
        return aesgcm.decrypt(nonce, wrapped, None)
    else:
        raise ValueError("Unsupported or mismatched wrap_info algorithm and private key type.")


# ── File Encryption ──────────────────────────────────────────

def encrypt_file(filepath: str, recipient_ids: list[str]) -> str:
    """
    Encrypt a file for multiple recipients using Post-Quantum Kyber key wrapping.

    Returns path to the encrypted package directory containing:
      - payload.enc   (AES-256-GCM ciphertext)
      - metadata.json (nonce, per-recipient wrapped keys, original filename)
    """
    validate_file_type(filepath)

    # Read plaintext
    with open(filepath, "rb") as f:
        plaintext = f.read()

    # Generate file-level AES key
    file_key = os.urandom(AES_KEY_SIZE)
    nonce = os.urandom(AES_NONCE_SIZE)

    # Encrypt
    aesgcm = AESGCM(file_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # Wrap key for each recipient
    wrapped_keys = {}
    for uid in recipient_ids:
        try:
            pub = load_kyber_public(uid)
        except FileNotFoundError:
            try:
                pub = load_x25519_public(uid)
            except FileNotFoundError:
                raise ValueError(f"No Kyber or public key for user '{uid}'. Generate keys first.")
        wrapped_keys[uid] = _wrap_key(file_key, pub)

    # Build output package
    basename = os.path.splitext(os.path.basename(filepath))[0]
    pkg_dir = os.path.join(ENCRYPTED_DIR, basename)
    os.makedirs(pkg_dir, exist_ok=True)

    enc_path = os.path.join(pkg_dir, "payload.enc")
    meta_path = os.path.join(pkg_dir, "metadata.json")

    with open(enc_path, "wb") as f:
        f.write(ciphertext)

    metadata = {
        "original_filename": os.path.basename(filepath),
        "nonce": nonce.hex(),
        "wrapped_keys": wrapped_keys,
        "algorithm": "AES-256-GCM + ML-KEM-768",
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return pkg_dir


def decrypt_file_raw(pkg_dir: str, user_id: str) -> tuple[bytes, str]:
    """
    ⚠️  INTERNAL ONLY — returns raw decrypted bytes.
    This function is called exclusively by the secure decryption pipeline
    in decryption.py.  Do NOT call from external code.

    Returns (decrypted_bytes, original_filename).
    """
    meta_path = os.path.join(pkg_dir, "metadata.json")
    enc_path = os.path.join(pkg_dir, "payload.enc")

    with open(meta_path, "r") as f:
        metadata = json.load(f)

    if user_id not in metadata["wrapped_keys"]:
        raise PermissionError(f"User '{user_id}' is not an authorized recipient.")

    recipient_private = load_x25519_private(user_id)
    file_key = _unwrap_key(metadata["wrapped_keys"][user_id], recipient_private)

    nonce = bytes.fromhex(metadata["nonce"])
    with open(enc_path, "rb") as f:
        ciphertext = f.read()

    aesgcm = AESGCM(file_key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)

    return plaintext, metadata["original_filename"]
