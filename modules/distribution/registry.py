"""
Document Distribution Registry & Strict Authorization Layer.

Schema:
{
  "document_id": str,
  "filename": str,
  "sender": str,
  "recipients": list[str],
  "encrypted_package_path": str,
  "package_name": str,
  "file_size_bytes": int,
  "created_at": str
}
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from config import DATA_DIR, ENCRYPTED_DIR

DOCS_DIR = os.path.join(DATA_DIR, "documents")
DOCS_REGISTRY_FILE = os.path.join(DOCS_DIR, "registry.json")


def _ensure_dir():
    os.makedirs(DOCS_DIR, exist_ok=True)
    os.makedirs(ENCRYPTED_DIR, exist_ok=True)


def _load_registry() -> dict[str, dict]:
    _ensure_dir()
    if not os.path.exists(DOCS_REGISTRY_FILE):
        return {}
    try:
        with open(DOCS_REGISTRY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_registry(registry: dict[str, dict]):
    _ensure_dir()
    with open(DOCS_REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)


def register_document(
    sender: str,
    recipients: list[str],
    encrypted_package_path: str,
    filename: str,
    document_id: Optional[str] = None,
    file_size_bytes: int = 0,
) -> dict:
    """
    Register a newly distributed document in the Document Registry.
    The single encrypted package is logically associated with multiple recipients.
    """
    _ensure_dir()
    registry = _load_registry()

    clean_recipients = [r.strip() for r in recipients if r.strip()]
    doc_id = document_id or f"doc_{uuid.uuid4().hex[:12]}"
    package_name = os.path.basename(os.path.normpath(encrypted_package_path))

    doc_record = {
        "document_id": doc_id,
        "filename": filename,
        "sender": sender,
        "recipients": clean_recipients,
        "encrypted_package_path": encrypted_package_path,
        "package_name": package_name,
        "file_size_bytes": file_size_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    registry[doc_id] = doc_record
    _save_registry(registry)
    return doc_record


def get_document(doc_id: str) -> Optional[dict]:
    """Retrieve document metadata by document_id."""
    registry = _load_registry()
    if doc_id in registry:
        return registry[doc_id]

    # Check if doc_id was passed as package name or package path
    for doc in registry.values():
        if (
            doc["document_id"] == doc_id
            or doc["package_name"] == doc_id
            or doc["encrypted_package_path"] == doc_id
            or os.path.basename(doc["encrypted_package_path"]) == doc_id
        ):
            return doc

    return None


def get_document_by_package(package_path: str) -> Optional[dict]:
    """Find document by package directory path."""
    registry = _load_registry()
    norm_pkg = os.path.normpath(package_path)
    base_pkg = os.path.basename(norm_pkg)

    for doc in registry.values():
        if (
            os.path.normpath(doc.get("encrypted_package_path", "")) == norm_pkg
            or doc.get("package_name") == base_pkg
        ):
            return doc
    return None


def list_inbox_documents(user_id: str) -> list[dict]:
    """
    List documents accessible by user_id:
    - User is an authorized recipient (can decrypt)
    - User is the sender (dispatched by them)
    """
    registry = _load_registry()
    user_docs = []

    for doc in registry.values():
        is_recipient = user_id in doc.get("recipients", [])
        is_sender = doc.get("sender") == user_id

        if is_recipient or is_sender:
            entry = dict(doc)
            entry["is_recipient"] = is_recipient
            entry["is_sender"] = is_sender
            entry["can_decrypt"] = is_recipient
            user_docs.append(entry)

    # Sort descending by creation date
    user_docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return user_docs


def list_all_documents() -> list[dict]:
    """Return all distributed documents."""
    registry = _load_registry()
    docs = list(registry.values())
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


def authorize_document_access(document_id_or_pkg: str, user_id: str) -> tuple[bool, str, Optional[dict]]:
    """
    STRICT AUTHORIZATION LAYER:
    Verifies that the user attempting decryption is in the authorized recipients list.

    Returns: (is_authorized: bool, message: str, doc_metadata: Optional[dict])
    """
    doc = get_document(document_id_or_pkg)

    # If document is in registry:
    if doc:
        recipients = doc.get("recipients", [])
        if user_id not in recipients:
            return (
                False,
                f"ACCESS DENIED: User '{user_id}' is not in the authorized recipients list {recipients} for document '{doc.get('document_id')}'.",
                doc,
            )
        return True, "Authorized", doc

    # If not registered in registry, fall back to checking encrypted package metadata.json
    pkg_dir = document_id_or_pkg
    if not os.path.isdir(pkg_dir):
        cand = os.path.join(ENCRYPTED_DIR, os.path.basename(pkg_dir))
        if os.path.isdir(cand):
            pkg_dir = cand

    meta_file = os.path.join(pkg_dir, "metadata.json")
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            wrapped_recipients = list(meta.get("wrapped_keys", {}).keys())
            if user_id not in wrapped_recipients:
                return (
                    False,
                    f"ACCESS DENIED: User '{user_id}' is not an authorized recipient in package metadata ({wrapped_recipients}).",
                    None,
                )
            return True, "Authorized via package metadata", None
        except Exception as e:
            return False, f"Package metadata inspection failed: {e}", None

    return False, f"Document or package '{document_id_or_pkg}' not found.", None
