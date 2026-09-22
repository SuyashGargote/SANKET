#!/usr/bin/env python3
"""
main.py — CLI entry point for the Cryptographic Attribution System.

Commands:
  setup       Generate keys for a list of users
  encrypt     Encrypt a PNG file for specified recipients
  decrypt     Decrypt as a specific user (watermark + log automatically)
  verify      Verify a leaked file and identify the source user
  ledger      Show ledger contents and verify chain integrity
  demo        Run the full end-to-end demo
"""

import argparse
import json
import os
import sys

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DECRYPTED_DIR, LEDGER_DIR


def cmd_setup(args):
    """Generate Ed25519 + X25519 keypairs for users."""
    from modules.crypto.signature import generate_keypair
    from modules.crypto.encryption import generate_x25519_keypair

    users = [u.strip() for u in args.users.split(",")]
    for uid in users:
        generate_keypair(uid)
        generate_x25519_keypair(uid)
        print(f"  ✓ Keys generated for user: {uid}")
    print(f"\n  {len(users)} user(s) set up successfully.")


def cmd_encrypt(args):
    """Encrypt a file for multiple recipients."""
    from modules.crypto.encryption import encrypt_file

    recipients = [u.strip() for u in args.recipients.split(",")]
    pkg_dir = encrypt_file(args.file, recipients)
    print(f"  ✓ File encrypted → {pkg_dir}")
    print(f"    Recipients: {', '.join(recipients)}")


def cmd_decrypt(args):
    """Decrypt a file as a specific user."""
    from modules.crypto.decryption import decrypt_file

    result = decrypt_file(args.package, args.user)
    print(f"  ✓ Decrypted and watermarked → {result['output_path']}")
    print(f"    Watermark ID : {result['watermark_id']}")
    print(f"    File ID      : {result['file_id'][:16]}...")
    print(f"    Ledger block : #{result['block']['index']}")


def cmd_verify(args):
    """Verify a leaked file with forensic analysis."""
    from modules.verification.verifier import verify_leaked_file

    result = verify_leaked_file(args.file)

    print(f"\n  ┌──────────────────────────────────────────────┐")
    print(f"  │       FORENSIC VERIFICATION REPORT           │")
    print(f"  └──────────────────────────────────────────────┘")

    print(f"\n  [RESULT]")
    print(f"    User        : {result.get('user') or 'N/A'}")
    print(f"    Confidence  : {result['confidence']:.1f}%")
    print(f"    Verdict     : {result['verdict']}")
    print(f"    Status      : {result['status'].upper()}")

    print(f"\n  [DETAILS]")
    print(f"    CRC         : {'OK' if result['crc_valid'] else 'FAILED'}")
    print(f"    Votes       : {result['vote_ratio']:.1%}")
    sync_label = "Strong" if result["sync_score"] >= 0.75 else (
        "Moderate" if result["sync_score"] >= 0.50 else "Weak"
    )
    print(f"    Sync        : {sync_label} ({result['sync_score']:.1%})")
    corr_label = "None" if result["corruption"] < 0.05 else (
        "Low" if result["corruption"] < 0.15 else (
            "Moderate" if result["corruption"] < 0.30 else "High"
        )
    )
    print(f"    Corruption  : {corr_label} ({result['corruption']:.1%})")
    print(f"    Multi-signal: {result['multi_signal_agreement']}/3 agree")
    print(f"    Tamper      : {'DETECTED' if result['tamper_detected'] else 'None'}")

    if result.get("notes"):
        print(f"\n  [NOTES]")
        for note in result["notes"]:
            print(f"    • {note}")

    if result["status"] == "identified":
        print(f"\n  🔍 LEAK SOURCE IDENTIFIED")
        print(f"    User ID      : {result['user']}")
        print(f"    Watermark    : {result['watermark_id']}")
        if result.get("record"):
            print(f"    Timestamp    : {result['record']['timestamp']}")
            print(f"    Nonce        : {result['record']['nonce']}")
    elif result["status"] == "rejected":
        print(f"\n  ✗  REJECTED — confidence too low for reliable attribution.")
    elif result["status"] == "watermark_not_found":
        print(f"\n  ⚠  No watermark could be extracted from this file.")
    elif result["status"] == "ledger_miss":
        print(f"\n  ⚠  Watermark found but no matching ledger record.")
    elif result["status"] == "signature_invalid":
        print(f"\n  ⚠  Ledger record found but signature verification FAILED.")


def cmd_ledger(args):
    """Show ledger contents and verify integrity."""
    from modules.ledger.hashchain import get_all_records, verify_chain

    is_valid, message = verify_chain()
    print(f"  Chain status: {message}")

    records = get_all_records()
    if not records:
        print("  (no records)")
        return

    print(f"\n  {'#':<4} {'User':<12} {'Watermark':<20} {'Timestamp':<28}")
    print(f"  {'─'*4} {'─'*12} {'─'*20} {'─'*28}")
    for r in records:
        print(
            f"  {r['index']:<4} {r['user_id']:<12} "
            f"{r['watermark_id'][:16]}...  {r['timestamp']}"
        )


def cmd_demo(args):
    """Run the complete end-to-end demo."""
    from tests.demo import run_demo
    run_demo()


def main():
    parser = argparse.ArgumentParser(
        prog="provenance",
        description="Cryptographic Attribution & Decryption Provenance System (Phase 1)",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # setup
    p_setup = subparsers.add_parser("setup", help="Generate keys for users")
    p_setup.add_argument("--users", required=True, help="Comma-separated user IDs")

    # encrypt
    p_enc = subparsers.add_parser("encrypt", help="Encrypt a PNG file")
    p_enc.add_argument("--file", required=True, help="Path to the PNG file")
    p_enc.add_argument("--recipients", required=True, help="Comma-separated user IDs")

    # decrypt
    p_dec = subparsers.add_parser("decrypt", help="Decrypt as a user")
    p_dec.add_argument("--package", required=True, help="Path to the encrypted package dir")
    p_dec.add_argument("--user", required=True, help="User ID")

    # verify
    p_ver = subparsers.add_parser("verify", help="Verify a leaked file")
    p_ver.add_argument("--file", required=True, help="Path to the leaked PNG file")

    # ledger
    subparsers.add_parser("ledger", help="Show and verify ledger")

    # demo
    subparsers.add_parser("demo", help="Run end-to-end demo")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    commands = {
        "setup": cmd_setup,
        "encrypt": cmd_encrypt,
        "decrypt": cmd_decrypt,
        "verify": cmd_verify,
        "ledger": cmd_ledger,
        "demo": cmd_demo,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
