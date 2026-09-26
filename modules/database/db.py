"""
Database Module for SANKET — Local SQLite Database Layer with WAL Mode.

Provides ACID transactions, high concurrency for multi-device LAN access,
and persistent relational storage for users, documents, recipients, and audit logs.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from config import DATA_DIR

DB_PATH = os.path.join(DATA_DIR, "sanket.db")


def get_db_connection() -> sqlite3.Connection:
    """Return an open SQLite connection with WAL mode and row factory."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create tables if they do not exist and migrate existing JSON files."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    public_key TEXT,
                    kem_public_key TEXT,
                    private_key_path TEXT,
                    kem_private_key_path TEXT,
                    created_at TEXT NOT NULL
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    document_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    recipients TEXT NOT NULL,
                    encrypted_package_path TEXT NOT NULL,
                    package_name TEXT NOT NULL,
                    file_size_bytes INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS document_recipients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    recipient_id TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    watermark_id TEXT,
                    decrypted_at TEXT,
                    ledger_block_index INTEGER,
                    FOREIGN KEY(document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
                    UNIQUE(document_id, recipient_id)
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    user_id TEXT,
                    action TEXT NOT NULL,
                    document_id TEXT,
                    ip_address TEXT,
                    details TEXT
                );
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_doc_sender ON documents(sender);
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_doc_recipients ON document_recipients(recipient_id);
            """)

        # Auto-migrate legacy JSON files if tables are empty
        _migrate_legacy_data(conn)
    finally:
        conn.close()


def _migrate_legacy_data(conn: sqlite3.Connection):
    """Migrate legacy users.json and registry.json into SQLite."""
    # 1. Migrate users
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users;")
    user_count = cur.fetchone()[0]

    legacy_users_file = os.path.join(DATA_DIR, "users", "users.json")
    if user_count == 0 and os.path.exists(legacy_users_file):
        try:
            with open(legacy_users_file, "r", encoding="utf-8") as f:
                legacy_users = json.load(f)
            with conn:
                for uid, u in legacy_users.items():
                    conn.execute("""
                        INSERT OR IGNORE INTO users (
                            user_id, name, role, public_key, kem_public_key,
                            private_key_path, kem_private_key_path, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        u.get("user_id", uid),
                        u.get("name", uid),
                        u.get("role", "Authorized User"),
                        u.get("public_key", ""),
                        u.get("kem_public_key", ""),
                        u.get("private_key_path", ""),
                        u.get("kem_private_key_path", ""),
                        u.get("created_at", datetime.now(timezone.utc).isoformat()),
                    ))
        except Exception:
            pass

    # 2. Migrate documents
    cur.execute("SELECT COUNT(*) FROM documents;")
    doc_count = cur.fetchone()[0]

    legacy_docs_file = os.path.join(DATA_DIR, "documents", "registry.json")
    if doc_count == 0 and os.path.exists(legacy_docs_file):
        try:
            with open(legacy_docs_file, "r", encoding="utf-8") as f:
                legacy_docs = json.load(f)
            with conn:
                for doc_id, doc in legacy_docs.items():
                    recs = doc.get("recipients", [])
                    recs_json = json.dumps(recs)
                    conn.execute("""
                        INSERT OR IGNORE INTO documents (
                            document_id, filename, sender, recipients,
                            encrypted_package_path, package_name, file_size_bytes, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        doc.get("document_id", doc_id),
                        doc.get("filename", "unknown.png"),
                        doc.get("sender", "unknown"),
                        recs_json,
                        doc.get("encrypted_package_path", ""),
                        doc.get("package_name", ""),
                        doc.get("file_size_bytes", 0),
                        doc.get("created_at", datetime.now(timezone.utc).isoformat()),
                    ))
                    for r in recs:
                        conn.execute("""
                            INSERT OR IGNORE INTO document_recipients (
                                document_id, recipient_id, status
                            ) VALUES (?, ?, 'pending');
                        """, (doc.get("document_id", doc_id), r))
        except Exception:
            pass


def log_audit_event(action: str, user_id: Optional[str] = None, document_id: Optional[str] = None, ip_address: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
    """Log an audit event to the SQLite database."""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO audit_events (timestamp, user_id, action, document_id, ip_address, details)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (
                datetime.now(timezone.utc).isoformat(),
                user_id,
                action,
                document_id,
                ip_address,
                json.dumps(details or {}),
            ))
    except Exception:
        pass
    finally:
        conn.close()
