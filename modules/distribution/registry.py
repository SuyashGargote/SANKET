"""
Document Distribution Registry & Strict Authorization Layer.
Backed by local SQLite database (data/sanket.db) with WAL mode for high-concurrency multi-device LAN access.

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
from typing import Optional, Tuple

from config import DATA_DIR, ENCRYPTED_DIR
from modules.database.db import get_db_connection, init_db, log_audit_event

DOCS_DIR = os.path.join(DATA_DIR, "documents")
DOCS_REGISTRY_FILE = os.path.join(DOCS_DIR, "registry.json")


def _ensure_dir():
    os.makedirs(DOCS_DIR, exist_ok=True)
    os.makedirs(ENCRYPTED_DIR, exist_ok=True)
    init_db()


def _row_to_doc(row) -> dict:
    if not row:
        return {}
    d = dict(row)
    if isinstance(d.get("recipients"), str):
        try:
            d["recipients"] = json.loads(d["recipients"])
        except Exception:
            d["recipients"] = [r.strip() for r in d["recipients"].split(",") if r.strip()]
    return d


def _save_json_backup(doc_record: dict):
    """Keep legacy JSON file updated for backwards compatibility."""
    try:
        os.makedirs(DOCS_DIR, exist_ok=True)
        registry = {}
        if os.path.exists(DOCS_REGISTRY_FILE):
            with open(DOCS_REGISTRY_FILE, "r", encoding="utf-8") as f:
                registry = json.load(f)
        registry[doc_record["document_id"]] = doc_record
        with open(DOCS_REGISTRY_FILE, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=2)
    except Exception:
        pass


def register_document(
    sender: str,
    recipients: list[str],
    encrypted_package_path: str,
    filename: str,
    document_id: Optional[str] = None,
    file_size_bytes: int = 0,
) -> dict:
    """
    Register a newly distributed document in the SQLite database and legacy registry.
    The single encrypted package is logically associated with multiple recipients.
    """
    _ensure_dir()
    clean_recipients = [r.strip() for r in recipients if r.strip()]
    doc_id = document_id or f"doc_{uuid.uuid4().hex[:12]}"
    package_name = os.path.basename(os.path.normpath(encrypted_package_path))
    created_at = datetime.now(timezone.utc).isoformat()

    doc_record = {
        "document_id": doc_id,
        "filename": filename,
        "sender": sender,
        "recipients": clean_recipients,
        "encrypted_package_path": encrypted_package_path,
        "package_name": package_name,
        "file_size_bytes": file_size_bytes,
        "created_at": created_at,
    }

    # Save to SQLite
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT OR REPLACE INTO documents (
                    document_id, filename, sender, recipients,
                    encrypted_package_path, package_name, file_size_bytes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                doc_id,
                filename,
                sender,
                json.dumps(clean_recipients),
                encrypted_package_path,
                package_name,
                file_size_bytes,
                created_at,
            ))

            for r in clean_recipients:
                conn.execute("""
                    INSERT OR IGNORE INTO document_recipients (
                        document_id, recipient_id, status
                    ) VALUES (?, ?, 'pending');
                """, (doc_id, r))
    finally:
        conn.close()

    _save_json_backup(doc_record)
    log_audit_event("DOCUMENT_DISTRIBUTED", user_id=sender, document_id=doc_id, details={
        "filename": filename,
        "recipients": clean_recipients,
        "file_size_bytes": file_size_bytes,
    })
    return doc_record


def get_document(doc_id: str) -> Optional[dict]:
    """Retrieve document metadata by document_id, package_name, or package_path from SQLite."""
    _ensure_dir()
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM documents
            WHERE document_id = ? OR package_name = ? OR encrypted_package_path = ?
            LIMIT 1;
        """, (doc_id, doc_id, doc_id))
        row = cur.fetchone()
        if row:
            return _row_to_doc(row)

        # Fallback to base name comparison
        cur.execute("SELECT * FROM documents;")
        for r in cur.fetchall():
            d = _row_to_doc(r)
            if os.path.basename(d.get("encrypted_package_path", "")) == doc_id:
                return d
    finally:
        conn.close()

    # Legacy file fallback
    if os.path.exists(DOCS_REGISTRY_FILE):
        try:
            with open(DOCS_REGISTRY_FILE, "r", encoding="utf-8") as f:
                registry = json.load(f)
            if doc_id in registry:
                return registry[doc_id]
            for doc in registry.values():
                if (
                    doc.get("document_id") == doc_id
                    or doc.get("package_name") == doc_id
                    or doc.get("encrypted_package_path") == doc_id
                    or os.path.basename(doc.get("encrypted_package_path", "")) == doc_id
                ):
                    return doc
        except Exception:
            pass

    return None


def get_document_by_package(package_path: str) -> Optional[dict]:
    """Find document by package directory path."""
    return get_document(os.path.normpath(package_path))


def list_inbox_documents(user_id: str) -> list[dict]:
    """
    List documents accessible by user_id from SQLite:
    - User is an authorized recipient (can decrypt)
    - User is the sender (dispatched by them)
    """
    _ensure_dir()
    conn = get_db_connection()
    user_docs = []
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM documents ORDER BY created_at DESC;")
        rows = cur.fetchall()

        for row in rows:
            doc = _row_to_doc(row)
            recipients = doc.get("recipients", [])
            is_recipient = user_id in recipients
            is_sender = doc.get("sender") == user_id

            if is_recipient or is_sender:
                entry = dict(doc)
                entry["is_recipient"] = is_recipient
                entry["is_sender"] = is_sender
                entry["can_decrypt"] = is_recipient
                user_docs.append(entry)
    finally:
        conn.close()

    return user_docs


def list_all_documents() -> list[dict]:
    """Return all distributed documents ordered by created_at DESC."""
    _ensure_dir()
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM documents ORDER BY created_at DESC;")
        return [_row_to_doc(r) for r in cur.fetchall()]
    finally:
        conn.close()


def mark_document_decrypted(
    document_id: str,
    recipient_id: str,
    watermark_id: str,
    ledger_block_index: int,
):
    """Mark a document as decrypted by a recipient in the SQLite database."""
    _ensure_dir()
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                UPDATE document_recipients
                SET status = 'decrypted',
                    watermark_id = ?,
                    decrypted_at = ?,
                    ledger_block_index = ?
                WHERE document_id = ? AND recipient_id = ?;
            """, (
                watermark_id,
                datetime.now(timezone.utc).isoformat(),
                ledger_block_index,
                document_id,
                recipient_id,
            ))
    finally:
        conn.close()


def authorize_document_access(document_id_or_pkg: str, user_id: str) -> Tuple[bool, str, Optional[dict]]:
    """
    STRICT AUTHORIZATION LAYER:
    Verifies that the user attempting decryption is in the authorized recipients list.

    Returns: (is_authorized: bool, message: str, doc_metadata: Optional[dict])
    """
    doc = get_document(document_id_or_pkg)

    if doc:
        recipients = doc.get("recipients", [])
        if user_id not in recipients:
            return (
                False,
                f"ACCESS DENIED: User '{user_id}' is not in the authorized recipients list {recipients} for document '{doc.get('document_id')}'.",
                doc,
            )
        return True, "Authorized", doc

    # Fall back to checking encrypted package metadata.json
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
