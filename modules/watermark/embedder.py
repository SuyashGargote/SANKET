"""
Watermark Embedder -- Multi-coefficient DCT + QIM with zone-interleaved
spread-spectrum and synchronization template.

Architecture (24 votes per watermark bit):
  - 4 mid-frequency DCT coefficients per block: (2,2), (3,1), (1,3), (2,3)
  - 2 spread-blocks per bit, drawn from DIFFERENT spatial zones
  - 3x macro-redundancy (watermark repeated 3 times)
  Total: 4 coefficients x 2 zones x 3 copies = 24 votes per bit

Synchronization Template:
  A deterministic periodic binary pattern is embedded in coefficient (4,2)
  of EVERY block, using a strong QIM delta (80).  This pattern is:
  - Independent of watermark_id (always the same)
  - Periodic with period 4 blocks in both X and Y
  - Used by the extractor to detect and correct rotation via angle search
  - Used to identify corrupted blocks (cropped regions)

  Coefficient (4,2) is distinct from all watermark coefficients, so sync
  and watermark do not interfere.

Adaptive QIM:
  Delta varies per block based on spatial variance (38-62).
"""

import hashlib

import cv2
import numpy as np

from config import WATERMARK_REDUNDANCY
from utils.helpers import watermark_to_bits

# -- Multi-Coefficient DCT Parameters -----------------------------------------

EMBED_COEFFICIENTS = [(2, 2), (3, 1), (1, 3), (2, 3)]
NUM_COEFFS = len(EMBED_COEFFICIENTS)

TARGET_SPREAD = 2
BLOCK_SIZE = 8

# Adaptive QIM for watermark
QIM_DELTA_MIN = 38.0
QIM_DELTA_MAX = 62.0
VARIANCE_THRESHOLD = 500.0

# Deterministic seed for zone block selection
_BLOCK_SEED = int(hashlib.sha256(b"dct-zone-seed-v4").hexdigest()[:8], 16)

# -- Synchronization Template Parameters --------------------------------------

SYNC_COEFF = (4, 2)     # Separate from watermark coefficients
SYNC_DELTA = 80.0        # Strong QIM delta for robust sync
SYNC_PERIOD = 4          # Pattern repeats every 4 blocks in each axis

# Deterministic 4x4 binary pattern (good autocorrelation at zero offset)
_sync_rng = np.random.RandomState(54321)
SYNC_PATTERN = _sync_rng.randint(0, 2, size=(SYNC_PERIOD, SYNC_PERIOD)).tolist()


# -- Shared functions ----------------------------------------------------------

def _zone_interleaved_indices(
    payload_len: int,
    total_blocks: int,
    blocks_x: int,
    blocks_y: int,
    spread_factor: int,
) -> list[list[int]]:
    """
    Allocate block indices so each spread copy is in a different spatial zone.
    """
    rng = np.random.RandomState(_BLOCK_SEED)
    zone_blocks: list[list[int]] = [[] for _ in range(spread_factor)]
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
            raise ValueError(
                f"Zone {z} has {len(zone_blocks[z])} blocks, need {payload_len}."
            )

    return [zone_blocks[z][:payload_len] for z in range(spread_factor)]


def _adaptive_delta(block: np.ndarray) -> float:
    """QIM step based on block variance."""
    variance = float(np.var(block))
    scale = min(variance / VARIANCE_THRESHOLD, 1.0)
    return QIM_DELTA_MIN + scale * (QIM_DELTA_MAX - QIM_DELTA_MIN)


def _qim_embed(coeff: float, bit: int, delta: float) -> float:
    """Quantization Index Modulation -- embed one bit."""
    q = int(np.round(coeff / delta))
    if q % 2 != bit:
        q_lo, q_hi = q - 1, q + 1
        if abs(q_lo * delta - coeff) <= abs(q_hi * delta - coeff):
            q = q_lo
        else:
            q = q_hi
    return float(q * delta)


def _compute_spread_factor(payload_len: int, total_blocks: int, blocks_y: int) -> int:
    sf = TARGET_SPREAD
    while sf > 1:
        zone_rows = blocks_y // sf
        if zone_rows >= 1 and total_blocks // sf >= payload_len:
            break
        sf -= 1
    if total_blocks < payload_len:
        raise ValueError(
            f"Image too small: need {payload_len} blocks, have {total_blocks}."
        )
    return sf


# -- Main embedding function ---------------------------------------------------

def embed_watermark(image_bytes: bytes, watermark_hex: str) -> bytes:
    """
    Embed watermark + synchronization template into a PNG image.

    Args:
        image_bytes: Raw PNG file bytes.
        watermark_hex: 32-char hex watermark ID.

    Returns:
        Watermarked PNG bytes (visually near-identical to original).
    """
    # -- Decode image --
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Failed to decode image.")

    has_alpha = len(img.shape) == 3 and img.shape[2] == 4
    if has_alpha:
        alpha = img[:, :, 3].copy()
        bgr = img[:, :, :3]
    elif len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        alpha = None
    else:
        bgr = img
        alpha = None

    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0].astype(np.float64)
    h, w = y_channel.shape

    # -- Pad to block-size multiples --
    pad_h = (BLOCK_SIZE - h % BLOCK_SIZE) % BLOCK_SIZE
    pad_w = (BLOCK_SIZE - w % BLOCK_SIZE) % BLOCK_SIZE
    if pad_h or pad_w:
        y_channel = np.pad(y_channel, ((0, pad_h), (0, pad_w)), mode="reflect")

    ph, pw = y_channel.shape
    blocks_y, blocks_x = ph // BLOCK_SIZE, pw // BLOCK_SIZE
    total_blocks = blocks_y * blocks_x

    # -- Build payload --
    single_bits = watermark_to_bits(watermark_hex)
    payload = single_bits * WATERMARK_REDUNDANCY

    # -- Zone-interleaved watermark embedding --
    spread_factor = _compute_spread_factor(len(payload), total_blocks, blocks_y)
    zone_indices = _zone_interleaved_indices(
        len(payload), total_blocks, blocks_x, blocks_y, spread_factor
    )

    for bit_idx, bit_val in enumerate(payload):
        for z in range(spread_factor):
            bidx = zone_indices[z][bit_idx]
            by = bidx // blocks_x
            bx = bidx % blocks_x
            r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

            block = y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()
            delta = _adaptive_delta(block)
            dct_block = cv2.dct(block)

            for u, v in EMBED_COEFFICIENTS:
                dct_block[u, v] = _qim_embed(dct_block[u, v], bit_val, delta)

            y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE] = cv2.idct(dct_block)

    # -- Synchronization template embedding (ALL blocks) --
    su, sv = SYNC_COEFF
    for by in range(blocks_y):
        for bx in range(blocks_x):
            r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

            block = y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()
            dct_block = cv2.dct(block)

            sync_bit = SYNC_PATTERN[by % SYNC_PERIOD][bx % SYNC_PERIOD]
            dct_block[su, sv] = _qim_embed(dct_block[su, sv], sync_bit, SYNC_DELTA)

            y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE] = cv2.idct(dct_block)

    # -- Remove padding, reconstruct --
    y_channel = y_channel[:h, :w]
    ycrcb[:, :, 0] = np.clip(np.round(y_channel), 0, 255).astype(np.uint8)
    bgr_out = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    if has_alpha:
        img_out = np.dstack([bgr_out, alpha])
    else:
        img_out = bgr_out

    success, encoded = cv2.imencode(".png", img_out)
    if not success:
        raise RuntimeError("Failed to encode watermarked image as PNG.")
    return encoded.tobytes()
