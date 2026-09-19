#!/usr/bin/env python3
"""
End-to-end demo -- validates all Phase 1 requirements + DCT robustness.

Steps 1-7:   Core pipeline (encrypt, decrypt, verify, uniqueness)
Step 8:      Pixel modification robustness
Step 9:      JPEG compression robustness (Q50, Q70, Q90)
Step 10:     Resize robustness (downscale + upscale)
Step 11:     Gaussian noise robustness
Step 12:     Ledger contents
Step 13:     Ledger integrity verification
"""

import os
import sys
import shutil

# Ensure project root is on path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import cv2
import numpy as np
from PIL import Image

from config import DATA_DIR
from modules.watermark.extractor import extract_watermark


def _create_test_image(path: str, width: int = 256, height: int = 256) -> None:
    """Create a more realistic test image with gradients and patterns."""
    img = Image.new("RGBA", (width, height))
    pixels = []
    for y in range(height):
        for x in range(width):
            r = int(127 + 64 * np.sin(2 * np.pi * x / width * 3))
            g = int(127 + 64 * np.cos(2 * np.pi * y / height * 2))
            b = int(127 + 64 * np.sin(2 * np.pi * (x + y) / (width + height) * 5))
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


def _jpeg_roundtrip(png_path: str, quality: int) -> bytes:
    """Load PNG, compress as JPEG at given quality, return PNG bytes."""
    img = cv2.imread(png_path, cv2.IMREAD_COLOR)
    _, jpeg_buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    img_jpeg = cv2.imdecode(jpeg_buf, cv2.IMREAD_COLOR)
    _, png_buf = cv2.imencode(".png", img_jpeg)
    return png_buf.tobytes()


def _resize_roundtrip(png_path: str, scale_down: float = 0.75) -> bytes:
    """Load PNG, downscale, upscale back to original size, return PNG bytes."""
    img = cv2.imread(png_path, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    small = cv2.resize(img, (int(w * scale_down), int(h * scale_down)), interpolation=cv2.INTER_AREA)
    restored = cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    _, png_buf = cv2.imencode(".png", restored)
    return png_buf.tobytes()


def _add_noise(png_path: str, sigma: float = 5.0) -> bytes:
    """Load PNG, add Gaussian noise, return PNG bytes."""
    img = cv2.imread(png_path, cv2.IMREAD_COLOR).astype(np.float64)
    noise = np.random.RandomState(42).normal(0, sigma, img.shape)
    noisy = np.clip(img + noise, 0, 255).astype(np.uint8)
    _, png_buf = cv2.imencode(".png", noisy)
    return png_buf.tobytes()


def run_demo():
    from modules.crypto.signature import generate_keypair
    from modules.crypto.encryption import generate_x25519_keypair, encrypt_file
    from modules.crypto.decryption import decrypt_file
    from modules.verification.verifier import verify_leaked_file
    from modules.ledger.hashchain import verify_chain, get_all_records

    print("\n" + "=" * 60)
    print("  CRYPTOGRAPHIC ATTRIBUTION SYSTEM -- PHASE 1 DEMO")
    print("  Watermark Engine: DCT + QIM (Frequency Domain)")
    print("=" * 60)

    # -- Clean previous data --
    _clean_data()

    # ================================================================
    # STEP 1: Create test image
    # ================================================================
    _separator("STEP 1: Create test image")
    test_image = os.path.join(DATA_DIR, "test_document.png")
    _create_test_image(test_image)
    file_size = os.path.getsize(test_image)
    print(f"  Created: {test_image}")
    print(f"  Size:    {file_size:,} bytes  (256x256 RGBA)")

    # ================================================================
    # STEP 2: Setup users
    # ================================================================
    _separator("STEP 2: Setup users (Alice, Bob)")
    for uid in ["alice", "bob"]:
        generate_keypair(uid)
        generate_x25519_keypair(uid)
        print(f"  [OK] Ed25519 + X25519 keys generated for: {uid}")

    # ================================================================
    # STEP 3: Encrypt
    # ================================================================
    _separator("STEP 3: Encrypt file for [alice, bob]")
    pkg_dir = encrypt_file(test_image, ["alice", "bob"])
    print(f"  [OK] Encrypted package -> {pkg_dir}")

    # ================================================================
    # STEP 4: Alice decrypts
    # ================================================================
    _separator("STEP 4: Alice decrypts")
    result_a = decrypt_file(pkg_dir, "alice")
    print(f"  [OK] Output     : {result_a['output_path']}")
    print(f"       Watermark  : {result_a['watermark_id']}")

    # ================================================================
    # STEP 5: Bob decrypts
    # ================================================================
    _separator("STEP 5: Bob decrypts")
    result_b = decrypt_file(pkg_dir, "bob")
    print(f"  [OK] Output     : {result_b['output_path']}")
    print(f"       Watermark  : {result_b['watermark_id']}")

    # ================================================================
    # STEP 6: Alice decrypts AGAIN
    # ================================================================
    _separator("STEP 6: Alice decrypts AGAIN")
    result_a2 = decrypt_file(pkg_dir, "alice")
    print(f"  [OK] Output     : {result_a2['output_path']}")
    print(f"       Watermark  : {result_a2['watermark_id']}")

    # Verify uniqueness
    wm_set = {result_a["watermark_id"], result_b["watermark_id"], result_a2["watermark_id"]}
    assert len(wm_set) == 3, "FAIL: Watermarks should all be unique!"
    print(f"\n  [OK] All 3 watermark IDs are UNIQUE")

    # ================================================================
    # STEP 7: Verify each output
    # ================================================================
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

    # ================================================================
    # STEP 8: Pixel modification robustness
    # ================================================================
    _separator("STEP 8: Pixel modification robustness")

    img = Image.open(result_a["output_path"]).convert("RGBA")
    pixels = list(img.getdata())
    import random
    rng = random.Random(42)
    for _ in range(200):
        idx = rng.randint(0, len(pixels) - 1)
        r, g, b, a = pixels[idx]
        g = g ^ 1
        b = b ^ 1
        pixels[idx] = (r, g, b, a)

    img_mod = Image.new("RGBA", img.size)
    img_mod.putdata(pixels)
    modified_path = os.path.join(DATA_DIR, "decrypted", "leaked_modified.png")
    img_mod.save(modified_path, "PNG")

    vr_mod = verify_leaked_file(modified_path)
    status = "[OK]" if vr_mod["status"] == "identified" else "[FAIL]"
    print(
        f"  {status} 200 pixels modified: "
        f"user={vr_mod['user_id']}, "
        f"confidence={vr_mod['confidence']:.1%}, "
        f"crc={vr_mod['crc_valid']}"
    )
    assert vr_mod["status"] == "identified", "FAIL: Should survive pixel modification"

    # ================================================================
    # STEP 9: JPEG compression robustness  (NEW - DCT advantage)
    # ================================================================
    _separator("STEP 9: JPEG compression robustness")
    alice_path = result_a["output_path"]
    alice_wm = result_a["watermark_id"]

    for quality in [90, 70, 50]:
        jpeg_bytes = _jpeg_roundtrip(alice_path, quality)
        ext = extract_watermark(jpeg_bytes)
        match = ext["watermark_id"] == alice_wm
        label = "[OK]" if (match and ext["crc_valid"]) else "[--]"
        print(
            f"  {label} JPEG Q{quality}: "
            f"match={match}, "
            f"confidence={ext['confidence']:.1%}, "
            f"crc={ext['crc_valid']}"
        )

    # ================================================================
    # STEP 10: Resize robustness  (NEW)
    # ================================================================
    _separator("STEP 10: Resize robustness (75% down, back up)")
    resized_bytes = _resize_roundtrip(alice_path, scale_down=0.75)
    ext_resize = extract_watermark(resized_bytes)
    match = ext_resize["watermark_id"] == alice_wm
    label = "[OK]" if (match and ext_resize["crc_valid"]) else "[--]"
    print(
        f"  {label} Resize 75%%: "
        f"match={match}, "
        f"confidence={ext_resize['confidence']:.1%}, "
        f"crc={ext_resize['crc_valid']}"
    )

    # ================================================================
    # STEP 11: Gaussian noise robustness  (NEW)
    # ================================================================
    _separator("STEP 11: Gaussian noise robustness")
    for sigma in [3.0, 5.0, 10.0]:
        noisy_bytes = _add_noise(alice_path, sigma=sigma)
        ext_noise = extract_watermark(noisy_bytes)
        match = ext_noise["watermark_id"] == alice_wm
        label = "[OK]" if (match and ext_noise["crc_valid"]) else "[--]"
        print(
            f"  {label} Noise sigma={sigma:.0f}: "
            f"match={match}, "
            f"confidence={ext_noise['confidence']:.1%}, "
            f"crc={ext_noise['crc_valid']}"
        )

    # ================================================================
    # STEP 12: Ledger contents
    # ================================================================
    _separator("STEP 12: Ledger contents")
    records = get_all_records()
    print(f"  {'#':<4} {'User':<8} {'Watermark':<20} {'Nonce':<20}")
    print(f"  {'----':<4} {'--------':<8} {'--------------------':<20} {'--------------------':<20}")
    for r in records:
        print(
            f"  {r['index']:<4} {r['user_id']:<8} "
            f"{r['watermark_id'][:16]}...  {r['nonce'][:16]}..."
        )

    # ================================================================
    # STEP 13: Verify ledger integrity
    # ================================================================
    _separator("STEP 13: Verify ledger integrity")
    is_valid, msg = verify_chain()
    print(f"  {msg}")
    assert is_valid, "FAIL: Ledger verification failed!"

    # ================================================================
    # Summary
    # ================================================================
    print(f"\n{'=' * 60}")
    print(f"  ALL CORE TESTS PASSED")
    print(f"{'=' * 60}")
    print(f"  > 3 decryptions logged with unique watermarks")
    print(f"  > All users correctly identified from leaked files")
    print(f"  > Watermark survived pixel modification")
    print(f"  > JPEG compression robustness tested (Q50-Q90)")
    print(f"  > Resize robustness tested")
    print(f"  > Gaussian noise robustness tested")
    print(f"  > Ledger chain verified intact")
    print(f"  > Same user, different sessions -> different watermark IDs")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    run_demo()
