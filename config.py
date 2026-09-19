"""
Global configuration — all paths and constants for the system.
"""

import os

# ── Project root ──────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# ── Data directories ──────────────────────────────────────────
DATA_DIR        = os.path.join(PROJECT_ROOT, "data")
KEYS_DIR        = os.path.join(DATA_DIR, "keys")
ENCRYPTED_DIR   = os.path.join(DATA_DIR, "encrypted")
DECRYPTED_DIR   = os.path.join(DATA_DIR, "decrypted")
LEDGER_DIR      = os.path.join(DATA_DIR, "ledger")

# ── Ledger files ──────────────────────────────────────────────
LEDGER_FILE     = os.path.join(LEDGER_DIR, "ledger.json")
ANCHOR_FILE     = os.path.join(LEDGER_DIR, "anchor.json")
LEDGER_BACKUP   = os.path.join(LEDGER_DIR, "ledger_backup.json")

# ── Crypto constants ─────────────────────────────────────────
AES_KEY_SIZE    = 32   # 256 bits
AES_NONCE_SIZE  = 12   # 96 bits for GCM

# ── Watermark constants ──────────────────────────────────────
WATERMARK_HEX_LENGTH = 32          # 32 hex chars = 128 bits
WATERMARK_BIT_LENGTH = WATERMARK_HEX_LENGTH * 4  # 128 bits
WATERMARK_REDUNDANCY = 3           # embed watermark N times for robustness
CHECKSUM_BITS        = 16          # 16-bit CRC appended to watermark

# ── Supported file types (Phase 1) ───────────────────────────
SUPPORTED_EXTENSIONS = {".png"}

# ── Ensure directories exist ─────────────────────────────────
for d in (KEYS_DIR, ENCRYPTED_DIR, DECRYPTED_DIR, LEDGER_DIR):
    os.makedirs(d, exist_ok=True)
