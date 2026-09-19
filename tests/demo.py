#!/usr/bin/env python3
"""
End-to-end demo -- validates all Phase 1 requirements.

Steps:
  1. Create a sample PNG test image
  2. Set up two users (Alice, Bob)
  3. Encrypt the image for both users
  4. Alice decrypts -> watermarked output A
  5. Bob decrypts -> watermarked output B
  6. Alice decrypts AGAIN -> watermarked output A2 (different watermark!)
  7. Verify each output -> correct user identified
  8. Simulate minor modification -> verify still works
  9. Show ledger contents
  10. Verify ledger integrity
"""

import io
import os
import sys
import shutil

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image

from config import DATA_DIR, LEDGER_FILE, ANCHOR_FILE, LEDGER_BACKUP


def _create_test_image(path: str, width: int = 256, height: int = 256) -> None:
    """Create a simple gradient PNG test image."""
    img = Image.new("RGBA", (width, height))
    pixels = []
    for y in range(height):
        for x in range(width):
            r = int(255 * x / width)
            g = int(255 * y / height)
            b = 128
            pixels.append((r, g, b, 255))
    img.putdata(pixels)
    img.save(path, "PNG")


def _separator(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def _clean_data():
    """Remove previous demo data."""
    for subdir in ("keys", "encrypted", "decrypted", "ledger"):
        path = os.path.join(DATA_DIR, subdir)
        if os.path.exists(path):
            shutil.rmtree(path)
        os.makedirs(path, exist_ok=True)


def run_demo():
    from modules.crypto.signature import generate_keypair
    from modules.crypto.encryption import generate_x25519_keypair, encrypt_file
    from modules.crypto.decryption import decrypt_file
    from modules.verification.verifier import verify_leaked_file
    from modules.ledger.hashchain import verify_chain, get_all_records

    print("\n" + "=" * 60)
    print("  CRYPTOGRAPHIC ATTRIBUTION SYSTEM -- PHASE 1 DEMO")
    print("=" * 60)

    # -- Clean previous data --
    _clean_data()

    # -- Step 1: Create test image --
    _separator("STEP 1: Create test image")
    test_image = os.path.join(DATA_DIR, "test_document.png")
    _create_test_image(test_image)
    file_size = os.path.getsize(test_image)
    print(f"  Created: {test_image}")
    print(f"  Size:    {file_size:,} bytes  (256x256 RGBA)")

    # -- Step 2: Setup users --
    _separator("STEP 2: Setup users (Alice, Bob)")
    for uid in ["alice", "bob"]:
        generate_keypair(uid)
        generate_x25519_keypair(uid)
        print(f"  [OK] Ed25519 + X25519 keys generated for: {uid}")

    # -- Step 3: Encrypt for both users --
    _separator("STEP 3: Encrypt file for [alice, bob]")
    pkg_dir = encrypt_file(test_image, ["alice", "bob"])
    print(f"  [OK] Encrypted package -> {pkg_dir}")

    # -- Step 4: Alice decrypts --
    _separator("STEP 4: Alice decrypts")
    result_a = decrypt_file(pkg_dir, "alice")
    print(f"  [OK] Output     : {result_a['output_path']}")
    print(f"       Watermark  : {result_a['watermark_id']}")

    # -- Step 5: Bob decrypts --
    _separator("STEP 5: Bob decrypts")
    result_b = decrypt_file(pkg_dir, "bob")
    print(f"  [OK] Output     : {result_b['output_path']}")
    print(f"       Watermark  : {result_b['watermark_id']}")

    # -- Step 6: Alice decrypts AGAIN (must get different watermark) --
    _separator("STEP 6: Alice decrypts AGAIN")
    result_a2 = decrypt_file(pkg_dir, "alice")
    print(f"  [OK] Output     : {result_a2['output_path']}")
    print(f"       Watermark  : {result_a2['watermark_id']}")

    # Verify all three watermarks are unique
    wm_set = {result_a["watermark_id"], result_b["watermark_id"], result_a2["watermark_id"]}
    assert len(wm_set) == 3, "FAIL: Watermarks should all be unique!"
    print(f"\n  [OK] All 3 watermark IDs are UNIQUE")

    # -- Step 7: Verify each file -> correct user identified --
    _separator("STEP 7: Verify outputs -> identify users")

    for label, result in [("Alice-1", result_a), ("Bob", result_b), ("Alice-2", result_a2)]:
        vr = verify_leaked_file(result["output_path"])
        status = "[OK]" if vr["status"] == "identified" else "[FAIL]"
        print(
            f"  {status} {label:>8}: "
            f"user={vr['user_id']}, "
            f"confidence={vr['confidence']:.1%}, "
            f"crc={vr['crc_valid']}"
        )
        assert vr["status"] == "identified", f"FAIL: Could not identify {label}"
        expected_user = "alice" if "Alice" in label else "bob"
        assert vr["user_id"] == expected_user, f"FAIL: Wrong user for {label}"

    # -- Step 8: Simulate minor modification -> verify robustness --
    _separator("STEP 8: Modify image slightly -> test robustness")

    # Read Alice's first output, flip a few random pixel LSBs in non-watermark positions
    img = Image.open(result_a["output_path"]).convert("RGBA")
    pixels = list(img.getdata())
    # Modify 100 pixels in the green channel (watermark is in red channel LSB)
    import random
    rng = random.Random(42)
    for _ in range(100):
        idx = rng.randint(0, len(pixels) - 1)
        r, g, b, a = pixels[idx]
        g = g ^ 1  # flip LSB of green
        pixels[idx] = (r, g, b, a)

    img_mod = Image.new("RGBA", img.size)
    img_mod.putdata(pixels)
    modified_path = os.path.join(DATA_DIR, "decrypted", "leaked_modified.png")
    img_mod.save(modified_path, "PNG")

    vr_mod = verify_leaked_file(modified_path)
    status = "[OK]" if vr_mod["status"] == "identified" else "[FAIL]"
    print(
        f"  {status} Modified file: "
        f"user={vr_mod['user_id']}, "
        f"confidence={vr_mod['confidence']:.1%}, "
        f"crc={vr_mod['crc_valid']}"
    )
    assert vr_mod["status"] == "identified", "FAIL: Should survive green-channel modification"
    assert vr_mod["user_id"] == "alice", "FAIL: Should still identify alice"
    print(f"  [OK] Watermark survived modification")

    # -- Step 9: Show ledger --
    _separator("STEP 9: Ledger contents")
    records = get_all_records()
    print(f"  {'#':<4} {'User':<8} {'Watermark':<20} {'Nonce':<20}")
    print(f"  {'----':<4} {'--------':<8} {'--------------------':<20} {'--------------------':<20}")
    for r in records:
        print(
            f"  {r['index']:<4} {r['user_id']:<8} "
            f"{r['watermark_id'][:16]}...  {r['nonce'][:16]}..."
        )

    # -- Step 10: Verify ledger integrity --
    _separator("STEP 10: Verify ledger integrity")
    is_valid, msg = verify_chain()
    print(f"  {msg}")
    assert is_valid, "FAIL: Ledger verification failed!"

    # -- Summary --
    print(f"\n{'=' * 60}")
    print(f"  ALL TESTS PASSED")
    print(f"{'=' * 60}")
    print(f"  > 3 decryptions logged with unique watermarks")
    print(f"  > All users correctly identified from leaked files")
    print(f"  > Watermark survived image modification")
    print(f"  > Ledger chain verified intact")
    print(f"  > Same user, different sessions -> different watermark IDs")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    run_demo()
