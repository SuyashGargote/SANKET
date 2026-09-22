"""
Forensic Analysis Module — multi-signal verification and tamper analysis.

Provides:
  - Sync pattern scoring (independent analysis of sync template)
  - Block-level corruption ratio
  - Multi-signal verification (original + blurred + JPEG re-compressed)
  - Structured forensic report assembly

This module does NOT modify the watermark algorithm.  It operates as a
read-only analysis layer on top of the existing extractor.
"""

import cv2
import numpy as np

from modules.watermark.extractor import (
    BLOCK_SIZE,
    CORRUPTION_VAR,
    SYNC_COEFF,
    SYNC_DELTA,
    SYNC_PATTERN,
    SYNC_PERIOD,
    extract_watermark,
)


# ── Image decoding helpers ───────────────────────────────────────


def _decode_to_bgr(image_bytes: bytes) -> np.ndarray | None:
    """Decode raw image bytes to BGR numpy array."""
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if len(img.shape) == 3 and img.shape[2] == 4:
        return img[:, :, :3]
    if len(img.shape) == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img


def _get_y_channel(bgr: np.ndarray) -> np.ndarray:
    """BGR → Y channel (float64)."""
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    return ycrcb[:, :, 0].astype(np.float64)


# ── Signal analysis ──────────────────────────────────────────────


def compute_sync_score(image_bytes: bytes) -> float:
    """
    Compute sync template match ratio across all interior blocks.

    Extracts the QIM-encoded bit at the sync coefficient position in each
    8×8 DCT block and compares against the expected deterministic pattern.
    Border blocks are skipped to reduce edge effects.

    Returns:
        Match ratio (0.0 – 1.0).  Returns 0.0 on decode failure.
    """
    bgr = _decode_to_bgr(image_bytes)
    if bgr is None:
        return 0.0

    y = _get_y_channel(bgr)
    h, w = y.shape
    blocks_y = h // BLOCK_SIZE
    blocks_x = w // BLOCK_SIZE

    if blocks_y < 2 or blocks_x < 2:
        return 0.0

    su, sv = SYNC_COEFF
    matches = 0
    total = 0

    margin = min(2, blocks_y // 4, blocks_x // 4)
    for by in range(margin, blocks_y - margin):
        for bx in range(margin, blocks_x - margin):
            r0 = by * BLOCK_SIZE
            c0 = bx * BLOCK_SIZE
            block = y[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()

            if np.var(block) < CORRUPTION_VAR:
                continue

            dct_block = cv2.dct(block)
            coeff = dct_block[su, sv]
            q = int(np.round(coeff / SYNC_DELTA))
            extracted_bit = int(q % 2)
            expected_bit = SYNC_PATTERN[by % SYNC_PERIOD][bx % SYNC_PERIOD]

            if extracted_bit == expected_bit:
                matches += 1
            total += 1

    return matches / total if total > 0 else 0.0


def compute_corruption_ratio(image_bytes: bytes) -> float:
    """
    Compute fraction of 8×8 blocks with variance below corruption threshold.

    A high ratio indicates large areas of uniform fill (gray borders from
    rotation, cropped regions, or heavily damaged content).

    Returns:
        Ratio (0.0 – 1.0).  Returns 1.0 on decode failure.
    """
    bgr = _decode_to_bgr(image_bytes)
    if bgr is None:
        return 1.0

    y = _get_y_channel(bgr)
    h, w = y.shape
    blocks_y = h // BLOCK_SIZE
    blocks_x = w // BLOCK_SIZE
    total = blocks_y * blocks_x

    if total == 0:
        return 1.0

    corrupted = 0
    for by in range(blocks_y):
        for bx in range(blocks_x):
            r0 = by * BLOCK_SIZE
            c0 = bx * BLOCK_SIZE
            block = y[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE]
            if np.var(block) < CORRUPTION_VAR:
                corrupted += 1

    return corrupted / total


# ── Multi-signal verification ────────────────────────────────────


def _blur_image(image_bytes: bytes) -> bytes:
    """Apply mild Gaussian blur and re-encode as PNG."""
    bgr = _decode_to_bgr(image_bytes)
    if bgr is None:
        return image_bytes
    blurred = cv2.GaussianBlur(bgr, (3, 3), 0.8)
    _, buf = cv2.imencode(".png", blurred)
    return buf.tobytes()


def _jpeg_roundtrip(image_bytes: bytes, quality: int = 85) -> bytes:
    """JPEG compress/decompress then re-encode as PNG."""
    bgr = _decode_to_bgr(image_bytes)
    if bgr is None:
        return image_bytes
    _, jpeg_buf = cv2.imencode(
        ".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality]
    )
    img_back = cv2.imdecode(jpeg_buf, cv2.IMREAD_COLOR)
    _, png_buf = cv2.imencode(".png", img_back)
    return png_buf.tobytes()


def multi_signal_extraction(image_bytes: bytes) -> dict:
    """
    Run watermark extraction on three versions of the image:
      1. Original (primary)
      2. Mildly Gaussian-blurred (kernel 3×3, σ=0.8)
      3. JPEG Q85 re-compressed

    If the primary extraction clearly fails (CRC invalid AND agreement
    below 45%), the secondary extractions are skipped to save time.

    Returns:
        dict with:
            primary:        extraction result from original
            blurred:        extraction result from blurred version
            jpeg:           extraction result from JPEG version
            agreement:      count of versions matching primary watermark_id (0–3)
            stable:         True if all three agree on the same non-None id
            watermark_ids:  list of the three extracted watermark_ids
            skipped:        True if secondary extractions were skipped
    """
    primary = extract_watermark(image_bytes)

    # Fast path: skip secondary extractions when primary clearly fails.
    # This avoids 2 expensive rotation-search passes on non-watermarked images.
    if not primary["crc_valid"] and primary["confidence"] < 0.45:
        return {
            "primary": primary,
            "blurred": primary,
            "jpeg": primary,
            "agreement": 0,
            "stable": False,
            "watermark_ids": [primary["watermark_id"]] * 3,
            "skipped": True,
        }

    # Blurred extraction
    blurred_bytes = _blur_image(image_bytes)
    blurred = extract_watermark(blurred_bytes)

    # JPEG extraction
    jpeg_bytes = _jpeg_roundtrip(image_bytes, quality=85)
    jpeg_result = extract_watermark(jpeg_bytes)

    ids = [
        primary["watermark_id"],
        blurred["watermark_id"],
        jpeg_result["watermark_id"],
    ]

    if primary["watermark_id"] is not None:
        agreement = sum(1 for wid in ids if wid == primary["watermark_id"])
    else:
        agreement = 0

    return {
        "primary": primary,
        "blurred": blurred,
        "jpeg": jpeg_result,
        "agreement": agreement,
        "stable": agreement == 3 and primary["watermark_id"] is not None,
        "watermark_ids": ids,
        "skipped": False,
    }


# ── Forensic report assembly ─────────────────────────────────────


def build_forensic_report(
    extraction: dict,
    sync_score: float,
    corruption_ratio: float,
    multi_signal: dict,
    confidence_result: dict,
    ledger_record: dict | None = None,
    ledger_valid: bool = False,
    user_id: str | None = None,
    signature_valid: bool | None = None,
) -> dict:
    """
    Assemble the full forensic tamper analysis report.

    Combines extraction results, signal analysis, confidence scoring,
    and ledger verification into a single structured report with
    human-readable notes.
    """
    notes = []
    tamper_detected = False

    # CRC analysis
    if extraction["crc_valid"]:
        notes.append("CRC checksum validated")
    elif extraction["watermark_id"] is not None:
        tamper_detected = True
        notes.append("CRC mismatch — watermark may be partially corrupted")

    # Corruption analysis
    if corruption_ratio > 0.30:
        tamper_detected = True
        notes.append(f"High corruption: {corruption_ratio:.1%} of blocks affected")
    elif corruption_ratio > 0.15:
        tamper_detected = True
        notes.append(
            f"Moderate corruption: {corruption_ratio:.1%} of blocks affected"
        )
    elif corruption_ratio > 0.05:
        notes.append(
            f"Minor corruption: {corruption_ratio:.1%} of blocks affected"
        )

    # Multi-signal stability
    if multi_signal.get("skipped"):
        notes.append("Multi-signal check skipped (primary extraction too weak)")
    elif multi_signal["stable"]:
        notes.append("Watermark stable across blur and JPEG perturbation")
    elif multi_signal["primary"]["watermark_id"] is not None:
        tamper_detected = True
        notes.append(
            f"Multi-signal instability: "
            f"{multi_signal['agreement']}/3 extractions agree"
        )

    # Sync analysis
    if sync_score >= 0.75:
        notes.append(f"Strong sync template ({sync_score:.1%})")
    elif sync_score >= 0.50:
        notes.append(f"Moderate sync template ({sync_score:.1%})")
    else:
        notes.append(f"Weak/absent sync template ({sync_score:.1%})")

    # Ledger
    if not ledger_valid:
        notes.append("Ledger integrity check failed or not verified")

    return {
        "user": user_id,
        "watermark_id": extraction["watermark_id"],
        "confidence": confidence_result["confidence"],
        "verdict": confidence_result["verdict"],
        "reasoning": confidence_result["reasoning"],
        "crc_valid": extraction["crc_valid"],
        "vote_ratio": extraction["confidence"],
        "sync_score": round(sync_score, 4),
        "corruption": round(corruption_ratio, 4),
        "tamper_detected": tamper_detected,
        "multi_signal_agreement": multi_signal["agreement"],
        "multi_signal_stable": multi_signal["stable"],
        "ledger_valid": ledger_valid,
        "signature_valid": signature_valid,
        "record": ledger_record,
        "notes": notes,
    }
