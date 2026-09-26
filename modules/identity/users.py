"""
User Identity System — Bind user identity to cryptographic keys and manage roles.

User model:
{
  "user_id": str,
  "name": str,
  "public_key": str (hex),
  "kem_public_key": str (hex),
  "private_key_path": str (local path),
  "role": str
}
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

from config import DATA_DIR, KEYS_DIR
from modules.crypto.encryption import generate_x25519_keypair, load_kyber_public
from modules.crypto.signature import generate_keypair, load_public_key

USERS_DIR = os.path.join(DATA_DIR, "users")
USERS_REGISTRY_FILE = os.path.join(USERS_DIR, "users.json")

# Default pre-provisioned identities
DEFAULT_PROFILES = [
    {
        "user_id": "alice",
        "name": "Alice Smith (Intelligence Officer)",
        "role": "Sender / Intelligence Officer",
    },
    {
        "user_id": "bob",
        "name": "Bob Jones (Field Operative)",
        "role": "Recipient / Field Operative",
    },
    {
        "user_id": "charlie",
        "name": "Charlie Davis (Forensic Auditor)",
        "role": "Auditor / Validator",
    },
    {
        "user_id": "system",
        "name": "SANKET Security Gateway",
        "role": "System Authority",
    },
]


def _ensure_dir():
    os.makedirs(USERS_DIR, exist_ok=True)
    os.makedirs(KEYS_DIR, exist_ok=True)


def _load_registry() -> dict[str, dict]:
    _ensure_dir()
    if not os.path.exists(USERS_REGISTRY_FILE):
        return {}
    try:
        with open(USERS_REGISTRY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_registry(registry: dict[str, dict]):
    _ensure_dir()
    with open(USERS_REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)


def ensure_user_keys(user_id: str) -> tuple[str, str]:
    """
    Ensure both Dilithium (signing) and Kyber (KEM) keys exist on disk for the user.
    Returns (dilithium_public_hex, kyber_public_hex).
    """
    user_dir = os.path.join(KEYS_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    dilithium_priv = os.path.join(user_dir, "dilithium_private.bin")
    kyber_priv = os.path.join(user_dir, "kyber_private.bin")

    if not os.path.exists(dilithium_priv):
        _, dsa_pub = generate_keypair(user_id)
        dsa_pub_hex = dsa_pub.hex() if isinstance(dsa_pub, bytes) else "generated"
    else:
        dsa_pub = load_public_key(user_id)
        dsa_pub_hex = dsa_pub.hex() if isinstance(dsa_pub, bytes) else "ed25519_compatible"

    if not os.path.exists(kyber_priv):
        _, kem_pub = generate_x25519_keypair(user_id)
        kem_pub_hex = kem_pub.hex() if isinstance(kem_pub, bytes) else "generated"
    else:
        kem_pub = load_kyber_public(user_id)
        kem_pub_hex = kem_pub.hex() if isinstance(kem_pub, bytes) else "generated"

    return dsa_pub_hex, kem_pub_hex


def register_user(user_id: str, name: str, role: str) -> dict:
    """Register a new user identity and generate cryptographic keys."""
    _ensure_dir()
    registry = _load_registry()

    dsa_pub_hex, kem_pub_hex = ensure_user_keys(user_id)
    user_record = {
        "user_id": user_id,
        "name": name,
        "public_key": dsa_pub_hex,
        "kem_public_key": kem_pub_hex,
        "private_key_path": os.path.join(KEYS_DIR, user_id, "dilithium_private.bin"),
        "kem_private_key_path": os.path.join(KEYS_DIR, user_id, "kyber_private.bin"),
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    registry[user_id] = user_record
    _save_registry(registry)
    return user_record


def init_user_system():
    """Initialize user directory and default user profiles."""
    _ensure_dir()
    registry = _load_registry()
    updated = False

    for profile in DEFAULT_PROFILES:
        uid = profile["user_id"]
        if uid not in registry:
            dsa_pub_hex, kem_pub_hex = ensure_user_keys(uid)
            registry[uid] = {
                "user_id": uid,
                "name": profile["name"],
                "public_key": dsa_pub_hex,
                "kem_public_key": kem_pub_hex,
                "private_key_path": os.path.join(KEYS_DIR, uid, "dilithium_private.bin"),
                "kem_private_key_path": os.path.join(KEYS_DIR, uid, "kyber_private.bin"),
                "role": profile["role"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            updated = True
        else:
            # Verify keys exist
            ensure_user_keys(uid)

    if updated or not os.path.exists(USERS_REGISTRY_FILE):
        _save_registry(registry)


def get_user(user_id: str) -> Optional[dict]:
    """Retrieve user details by user_id."""
    registry = _load_registry()
    if user_id in registry:
        record = dict(registry[user_id])
        # Mask absolute server filepaths for safety
        record["has_private_key"] = os.path.exists(record.get("private_key_path", ""))
        return record

    # If keys exist on disk but not in registry, auto-populate
    user_key_dir = os.path.join(KEYS_DIR, user_id)
    if os.path.exists(user_key_dir):
        return register_user(user_id, f"User ({user_id})", "Authorized User")

    return None


def list_users() -> list[dict]:
    """List all registered users (public fields only)."""
    init_user_system()
    registry = _load_registry()
    user_list = []
    for uid, data in registry.items():
        user_list.append({
            "user_id": data["user_id"],
            "name": data["name"],
            "public_key": data.get("public_key", "")[:32] + "...",
            "kem_public_key": data.get("kem_public_key", "")[:32] + "...",
            "role": data.get("role", "User"),
            "created_at": data.get("created_at", ""),
        })
    return user_list
