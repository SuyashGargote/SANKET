"""
api/cleanup.py — Automatic file retention and cleanup management.
"""

import os
from typing import Dict

from config import DECRYPTED_DIR, MAX_KEPT_FILES, REPORTS_DIR, UPLOADS_DIR


def cleanup_directory(dir_path: str, max_files: int = MAX_KEPT_FILES) -> int:
    """
    Remove oldest files in directory if file count exceeds max_files.
    Returns number of deleted files.
    """
    if not os.path.exists(dir_path):
        return 0

    try:
        entries = []
        for fname in os.listdir(dir_path):
            fpath = os.path.join(dir_path, fname)
            if os.path.isfile(fpath):
                entries.append((os.path.getmtime(fpath), fpath))

        # Sort ascending by modification time (oldest first)
        entries.sort(key=lambda x: x[0])

        deleted_count = 0
        if len(entries) > max_files:
            to_delete = entries[: len(entries) - max_files]
            for _, path in to_delete:
                try:
                    os.remove(path)
                    deleted_count += 1
                except OSError:
                    pass
        return deleted_count
    except Exception:
        return 0


def run_auto_cleanup(max_files: int = MAX_KEPT_FILES) -> Dict[str, int]:
    """
    Run automated cleanup across uploads, decrypted outputs, and reports.
    Returns summary dict of files removed per directory.
    """
    return {
        "uploads_deleted": cleanup_directory(UPLOADS_DIR, max_files),
        "decrypted_deleted": cleanup_directory(DECRYPTED_DIR, max_files),
        "reports_deleted": cleanup_directory(REPORTS_DIR, max_files),
    }
