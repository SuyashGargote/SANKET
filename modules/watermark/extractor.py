"""
Watermark Extractor -- Zone-interleaved multi-coefficient extraction with
synchronization-based geometric recovery.

Recovery strategy: TRY-AND-VERIFY on full color image
  Instead of rotating the Y channel alone, rotate the FULL BGR image and
  re-convert to YCrCb.  This matches the attacker's transform pipeline
  (rotate BGR → save → load → convert to Y) more faithfully, yielding
  better interpolation cancellation.

  Try candidate angles ordered by |angle|.  Pre-filter each candidate
  using sync correlation on interior blocks, then run full extraction.
  Accept the first result where CRC validates.

Corruption detection:
  Blocks with variance < 15 are skipped (gray fill, rotation borders).
"""

import hashlib

import cv2
import numpy as np

from config import CHECKSUM_BITS, WATERMARK_HEX_LENGTH, WATERMARK_REDUNDANCY
from utils.helpers import bits_to_watermark

# -- Must match embedder constants exactly --
EMBED_COEFFICIENTS = [(2, 2), (3, 1), (1, 3), (2, 3)]
NUM_COEFFS = len(EMBED_COEFFICIENTS)
TARGET_SPREAD = 2
BLOCK_SIZE = 8
QIM_DELTA_MIN = 38.0
QIM_DELTA_MAX = 62.0
VARIANCE_THRESHOLD = 500.0
_BLOCK_SEED = int(hashlib.sha256(b"dct-zone-seed-v4").hexdigest()[:8], 16)

# -- Synchronization constants (must match embedder) --
SYNC_COEFF = (4, 2)
SYNC_DELTA = 80.0
SYNC_PERIOD = 4
_sync_rng = np.random.RandomState(54321)
SYNC_PATTERN = _sync_rng.randint(0, 2, size=(SYNC_PERIOD, SYNC_PERIOD)).tolist()

# -- Corruption detection --
CORRUPTION_VAR = 15.0

# -- Rotation search candidates (degrees) --
# 0.25° resolution from -5.5 to +5.5, sorted by |angle|
_all_angles = sorted(
    [x * 0.25 for x in range(-22, 23)],
    key=lambda a: abs(a),
)
CANDIDATE_ANGLES = _all_angles

# Sync scoring for pre-filtering
SYNC_SAMPLE_COUNT = 120
SYNC_BORDER_MARGIN = 4
SYNC_PREFILTER = 0.52


# -- Helper functions ----------------------------------------------------------

def _qim_extract_raw(coeff: float, delta: float) -> int:
    q = int(np.round(coeff / delta))
    return int(q % 2)


def _get_y_channel(bgr: np.ndarray) -> np.ndarray:
    """BGR -> Y channel (float64)."""
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    return ycrcb[:, :, 0].astype(np.float64)


def _sync_score(y: np.ndarray) -> float:
    """Quick sync correlation on interior blocks."""
    h, w = y.shape
    byt = h // BLOCK_SIZE
    bxt = w // BLOCK_SIZE
    m = SYNC_BORDER_MARGIN
    by_lo, by_hi = m, byt - m
    bx_lo, bx_hi = m, bxt - m
    if by_hi <= by_lo or bx_hi <= bx_lo:
        by_lo, bx_lo, by_hi, bx_hi = 0, 0, byt, bxt

    rng = np.random.RandomState(42)
    n = min(SYNC_SAMPLE_COUNT, (by_hi - by_lo) * (bx_hi - bx_lo))
    matches = total = 0
    su, sv = SYNC_COEFF

    for _ in range(n):
        by = rng.randint(by_lo, by_hi)
        bx = rng.randint(bx_lo, bx_hi)
        r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE
        block = y[r0:r0 + BLOCK_SIZE, c0:c0 + BLOCK_SIZE].copy()
        if np.var(block) < CORRUPTION_VAR:
            continue
        dct_block = cv2.dct(block)
        extracted = _qim_extract_raw(dct_block[su, sv], SYNC_DELTA)
        expected = SYNC_PATTERN[by % SYNC_PERIOD][bx % SYNC_PERIOD]
        if extracted == expected:
            matches += 1
        total += 1

    return matches / total if total > 0 else 0.0


def _rotate_bgr(bgr: np.ndarray, angle: float) -> np.ndarray:
    """Rotate BGR image by `angle` degrees (counter-clockwise)."""
    h, w = bgr.shape[:2]
    center = (w / 2.0, h / 2.0)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        bgr, M, (w, h),
        flags=cv2.INTER_LINEAR,
        borderValue=(128, 128, 128),
    )


# -- Watermark extraction core -------------------------------------------------

def _zone_interleaved_indices(
    payload_len, total_blocks, blocks_x, blocks_y, spread_factor
):
    rng = np.random.RandomState(_BLOCK_SEED)
    zone_blocks = [[] for _ in range(spread_factor)]
    zone_height = blocks_y // spread_factor
    for bidx in range(total_blocks):
        by = bidx // blocks_x
        zone = min(by // max(zone_height, 1), spread_factor - 1)
        zone_blocks[zone].append(bidx)
    for z in range(spread_factor):
        arr = np.array(zone_blocks[z])
        rng.shuffle(arr)
        zone_blocks[z] = arr.tolist()
    for z in range(spread_factor):
        if len(zone_blocks[z]) < payload_len:
            return []
    return [zone_blocks[z][:payload_len] for z in range(spread_factor)]


def _adaptive_delta(block):
    variance = float(np.var(block))
    scale = min(variance / VARIANCE_THRESHOLD, 1.0)
    return QIM_DELTA_MIN + scale * (QIM_DELTA_MAX - QIM_DELTA_MIN)


def _compute_spread_factor(payload_len, total_blocks, blocks_y):
    sf = TARGET_SPREAD
    while sf > 1:
        zone_rows = blocks_y // sf
        if zone_rows >= 1 and total_blocks // sf >= payload_len:
            break
        sf -= 1
    if total_blocks < payload_len:
        return 0
    return sf


def _majority_vote(copies):
    num_bits = len(copies[0])
    result = []
    for i in range(num_bits):
        ones = sum(c[i] for c in copies)
        result.append(1 if ones > len(copies) // 2 else 0)
    return result


def _extract_from_y(y_raw: np.ndarray) -> dict:
    """Core extraction on a Y channel. Returns standard result dict."""
    h, w = y_raw.shape
    pad_h = (BLOCK_SIZE - h % BLOCK_SIZE) % BLOCK_SIZE
    pad_w = (BLOCK_SIZE - w % BLOCK_SIZE) % BLOCK_SIZE
    y_pad = np.pad(y_raw, ((0, pad_h), (0, pad_w)), mode="reflect") if (pad_h or pad_w) else y_raw

    ph, pw = y_pad.shape
    blocks_y = ph // BLOCK_SIZE
    blocks_x = pw // BLOCK_SIZE
    total_blocks = blocks_y * blocks_x

    wm_bytes = WATERMARK_HEX_LENGTH // 2
    crc_bytes = CHECKSUM_BITS // 8
    single_bits = (wm_bytes + crc_bytes) * 8
    total_payload = single_bits * WATERMARK_REDUNDANCY

    spread_factor = _compute_spread_factor(total_payload, total_blocks, blocks_y)
    if spread_factor == 0:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    zone_indices = _zone_interleaved_indices(
        total_payload, total_blocks, blocks_x, blocks_y, spread_factor
    )
    if not zone_indices:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    payload_bits = []
    for bit_idx in range(total_payload):
        votes = []
        for z in range(spread_factor):
            bidx = zone_indices[z][bit_idx]
            by = bidx // blocks_x
            bx = bidx % blocks_x
            r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

            block = y_pad[r0:r0 + BLOCK_SIZE, c0:c0 + BLOCK_SIZE].copy()
            if np.var(block) < CORRUPTION_VAR:
                continue
            delta = _adaptive_delta(block)
            dct_block = cv2.dct(block)
            for u, v in EMBED_COEFFICIENTS:
                votes.append(_qim_extract_raw(dct_block[u, v], delta))

        if not votes:
            payload_bits.append(0)
        else:
            ones = sum(votes)
            payload_bits.append(1 if ones > len(votes) // 2 else 0)

    copies = []
    for c in range(WATERMARK_REDUNDANCY):
        start = c * single_bits
        end = start + single_bits
        copies.append(payload_bits[start:end])

    voted_bits = _majority_vote(copies)

    agreements = 0
    for i in range(single_bits):
        vals = [c[i] for c in copies]
        if all(v == voted_bits[i] for v in vals):
            agreements += 1
    confidence = agreements / single_bits

    watermark_hex, crc_valid = bits_to_watermark(voted_bits)

    return {
        "watermark_id": watermark_hex,
        "crc_valid": crc_valid,
        "confidence": round(confidence, 4),
    }


# -- Main extraction function --------------------------------------------------

def extract_watermark(image_bytes: bytes) -> dict:
    """
    Extract watermark with automatic rotation recovery and corruption detection.

    Strategy: try-and-verify on full color image
      1. Decode to BGR
      2. Try angle=0 first (fast path)
      3. If CRC fails, try rotation candidates:
         a. Rotate FULL BGR image by -angle (matches attacker's transform)
         b. Convert rotated BGR to Y
         c. Pre-filter by sync score
         d. Run full extraction, accept first CRC-valid result

    Returns dict with keys: watermark_id, crc_valid, confidence
    """
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    # Get BGR (strip alpha if present)
    if len(img.shape) == 3 and img.shape[2] == 4:
        bgr = img[:, :, :3]
    elif len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else:
        bgr = img

    # -- Fast path: no rotation --
    y_raw = _get_y_channel(bgr)
    result_0 = _extract_from_y(y_raw)
    if result_0["crc_valid"]:
        return result_0

    # -- Slow path: try rotation candidates on full BGR --
    best_result = result_0
    best_conf = result_0["confidence"]

    for angle in CANDIDATE_ANGLES:
        if angle == 0.0:
            continue

        # Rotate full BGR, then convert to Y
        bgr_rotated = _rotate_bgr(bgr, -angle)
        y_rotated = _get_y_channel(bgr_rotated)

        # Pre-filter with sync
        sync = _sync_score(y_rotated)
        if sync < SYNC_PREFILTER:
            continue

        result = _extract_from_y(y_rotated)

        if result["crc_valid"]:
            return result

        if result["confidence"] > best_conf:
            best_conf = result["confidence"]
            best_result = result

    return best_result
