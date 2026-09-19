"""
Encryption Module — AES-256-GCM file encryption with per-recipient key wrapping.

Key wrapping uses X25519 ECDH + HKDF to derive a wrapping key per recipient,
then encrypts the file-level AES key with AES-256-GCM under that wrapping key.
"""

import json
import os

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


# ── X25519 Key Exchange Keys ─────────────────────────────────

def _x25519_paths(user_id: str) -> tuple[str, str]:
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return (
        os.path.join(user_dir, "x25519_private.pem"),
        os.path.join(user_dir, "x25519_public.pem"),
    )


def generate_x25519_keypair(user_id: str) -> tuple[X25519PrivateKey, X25519PublicKey]:
    """Generate and persist an X25519 keypair for key exchange."""
    priv_path, pub_path = _x25519_paths(user_id)
    private_key = X25519PrivateKey.generate()
    public_key = private_key.public_key()

    with open(priv_path, "wb") as f:
        f.write(private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    with open(pub_path, "wb") as f:
        f.write(public_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo))

    return private_key, public_key


def load_x25519_private(user_id: str) -> X25519PrivateKey:
    priv_path, _ = _x25519_paths(user_id)
    with open(priv_path, "rb") as f:
        return load_pem_private_key(f.read(), password=None)  # type: ignore[return-value]


def load_x25519_public(user_id: str) -> X25519PublicKey:
    _, pub_path = _x25519_paths(user_id)
    with open(pub_path, "rb") as f:
        return load_pem_public_key(f.read())  # type: ignore[return-value]


# ── Key Wrapping ──────────────────────────────────────────────

def _derive_wrapping_key(shared_secret: bytes) -> bytes:
    """HKDF-SHA256 to derive a 256-bit wrapping key from shared secret."""
    return HKDF(
        algorithm=SHA256(),
        length=AES_KEY_SIZE,
        salt=None,
        info=b"document-key-wrap",
    ).derive(shared_secret)


def _wrap_key(file_key: bytes, recipient_public: X25519PublicKey) -> dict:
    """
    Wrap the file-level AES key for one recipient.
    Uses an ephemeral X25519 keypair → ECDH → HKDF → AES-GCM wrap.
    """
    ephemeral_private = X25519PrivateKey.generate()
    ephemeral_public = ephemeral_private.public_key()
    shared_secret = ephemeral_private.exchange(recipient_public)
    wrapping_key = _derive_wrapping_key(shared_secret)

    nonce = os.urandom(AES_NONCE_SIZE)
    aesgcm = AESGCM(wrapping_key)
    wrapped = aesgcm.encrypt(nonce, file_key, None)

    return {
        "ephemeral_public": ephemeral_public.public_bytes(
            Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
        ).decode(),
        "nonce": nonce.hex(),
        "wrapped_key": wrapped.hex(),
    }


def _unwrap_key(wrap_info: dict, recipient_private: X25519PrivateKey) -> bytes:
    """Unwrap the file-level AES key using the recipient's private key."""
    ephemeral_public = load_pem_public_key(
        wrap_info["ephemeral_public"].encode()
    )
    shared_secret = recipient_private.exchange(ephemeral_public)  # type: ignore[arg-type]
    wrapping_key = _derive_wrapping_key(shared_secret)

    nonce = bytes.fromhex(wrap_info["nonce"])
    wrapped = bytes.fromhex(wrap_info["wrapped_key"])
    aesgcm = AESGCM(wrapping_key)
    return aesgcm.decrypt(nonce, wrapped, None)


# ── File Encryption ──────────────────────────────────────────

def encrypt_file(filepath: str, recipient_ids: list[str]) -> str:
    """
    Encrypt a file for multiple recipients.

    Returns path to the encrypted package directory containing:
      - payload.enc  (AES-256-GCM ciphertext)
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
            pub = load_x25519_public(uid)
        except FileNotFoundError:
            raise ValueError(f"No X25519 public key for user '{uid}'. Generate keys first.")
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
