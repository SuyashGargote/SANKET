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

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

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


def cmd_send(args):
    """Distribute a document to recipients with Post-Quantum encryption and logical registry."""
    from modules.crypto.encryption import encrypt_file
    from modules.distribution.registry import register_document
    from modules.identity.users import ensure_user_keys

    sender = getattr(args, "sender", None) or "alice"
    recipients = [u.strip() for u in args.recipients.split(",") if u.strip()]

    ensure_user_keys(sender)
    for r in recipients:
        ensure_user_keys(r)

    pkg_dir = encrypt_file(args.file, recipients)
    doc = register_document(
        sender=sender,
        recipients=recipients,
        encrypted_package_path=pkg_dir,
        filename=os.path.basename(args.file),
        file_size_bytes=os.path.getsize(args.file),
    )
    print(f"\n  ✓ Document distributed successfully!")
    print(f"    Document ID : {doc['document_id']}")
    print(f"    Sender      : {sender}")
    print(f"    Recipients  : {', '.join(recipients)}")
    print(f"    Package     : {pkg_dir}")
    print(f"    Cipher      : AES-256-GCM + Post-Quantum Kyber (ML-KEM-768)")


def cmd_inbox(args):
    """List documents in user's inbox."""
    from modules.distribution.registry import list_inbox_documents

    user = args.user
    docs = list_inbox_documents(user)
    print(f"\n  ┌─────────────────────────────────────────────────────────────┐")
    print(f"  │               INBOX FOR USER: {user:<28}  │")
    print(f"  └─────────────────────────────────────────────────────────────┘")
    if not docs:
        print("  (inbox empty)")
        return

    print(f"\n  {'Doc ID':<18} {'Filename':<24} {'Sender':<10} {'Can Decrypt':<12}")
    print(f"  {'─'*18} {'─'*24} {'─'*10} {'─'*12}")
    for d in docs:
        can_dec = "YES" if d.get("can_decrypt") else "NO"
        print(f"  {d['document_id']:<18} {d['filename'][:22]:<24} {d['sender']:<10} {can_dec:<12}")


def cmd_decrypt(args):
    """Decrypt a file as a specific user with authorization enforcement."""
    from modules.crypto.decryption import decrypt_file
    from modules.distribution.registry import get_document, authorize_document_access

    pkg = args.package
    doc = get_document(pkg)
    if doc:
        pkg = doc["encrypted_package_path"]

    is_auth, msg, _ = authorize_document_access(pkg, args.user)
    if not is_auth:
        print(f"\n  ✗ ACCESS DENIED: {msg}")
        return

    result = decrypt_file(pkg, args.user)
    print(f"  ✓ Decrypted and watermarked → {result['output_path']}")
    print(f"    Watermark ID : {result['watermark_id']}")
    print(f"    File ID      : {result['file_id'][:16]}...")
    print(f"    Ledger block : #{result['block']['index']}")
    print(f"    Recipient Sig: {result['block']['recipient_signature'][:24]}...")
    print(f"    System Sig   : {result['block']['system_signature'][:24]}...")




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


def cmd_report(args):
    """Generate a full forensic analysis report."""
    from modules.forensics.report import generate_report, print_report

    report, json_path = generate_report(args.file)
    print_report(report)
    print(f"\n  [SAVED] Report: {json_path}")


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


def cmd_ledger_verify(args):
    """Verify ledger with anchor-based tamper detection."""
    from modules.ledger.hashchain import verify_ledger_with_anchors

    result = verify_ledger_with_anchors()
    print(f"\n  Ledger Status     : {result['ledger_status']}")
    print(f"  Chain Integrity   : {'OK' if result['chain_ok'] else 'FAILED'}")
    print(f"  Anchors Verified  : {'YES' if result['anchor_ok'] else 'NO'}")
    print(f"  Message           : {result['message']}")


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

    # send (document distribution)
    p_send = subparsers.add_parser("send", help="Distribute a document to recipients")
    p_send.add_argument("--file", required=True, help="Path to PNG file to send")
    p_send.add_argument("--recipients", required=True, help="Comma-separated recipient user IDs")
    p_send.add_argument("--sender", default="alice", help="Sender user ID (default: alice)")

    # inbox
    p_inbox = subparsers.add_parser("inbox", help="List documents for a user")
    p_inbox.add_argument("--user", required=True, help="User ID to view inbox for")

    # decrypt
    p_dec = subparsers.add_parser("decrypt", help="Decrypt as a user")
    p_dec.add_argument("--package", required=True, help="Path to the encrypted package dir or document ID")
    p_dec.add_argument("--user", required=True, help="User ID")

    # verify
    p_ver = subparsers.add_parser("verify", help="Verify a leaked file")
    p_ver.add_argument("--file", required=True, help="Path to the leaked PNG file")

    # report
    p_rpt = subparsers.add_parser("report", help="Generate forensic analysis report")
    p_rpt.add_argument("--file", required=True, help="Path to the leaked PNG file")

    # ledger
    subparsers.add_parser("ledger", help="Show and verify ledger")

    # ledger-verify
    subparsers.add_parser("ledger-verify", help="Verify ledger with anchor tamper detection")

    # demo
    subparsers.add_parser("demo", help="Run end-to-end demo suite")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    commands = {
        "setup": cmd_setup,
        "send": cmd_send,
        "inbox": cmd_inbox,
        "encrypt": cmd_encrypt,
        "decrypt": cmd_decrypt,
        "verify": cmd_verify,
        "report": cmd_report,
        "ledger": cmd_ledger,
        "ledger-verify": cmd_ledger_verify,
        "demo": cmd_demo,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
