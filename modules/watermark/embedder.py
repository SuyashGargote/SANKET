"""
Watermark Embedder -- Multi-coefficient DCT + QIM with zone-interleaved spread-spectrum.

Architecture (24 votes per watermark bit):
  - 4 mid-frequency DCT coefficients per block: (2,2), (3,1), (1,3), (2,3)
  - 2 spread-blocks per bit, drawn from DIFFERENT spatial zones
  - 3x macro-redundancy (watermark repeated 3 times)
  Total: 4 coefficients x 2 zones x 3 copies = 24 votes per bit

Zone-interleaving:
  Image blocks are divided into 2 spatial zones (top-half / bottom-half).
  Each spread copy of a bit is placed in a different zone, so a localized
  crop (even 25% of the image) cannot destroy both copies of any bit.

Adaptive QIM:
  Delta varies per block based on spatial variance (38-62), preventing
  overfitting to fixed compression assumptions.
"""

import hashlib

import cv2
import numpy as np

from config import WATERMARK_REDUNDANCY
from utils.helpers import watermark_to_bits

# -- Multi-Coefficient DCT Parameters -----------------------------------------

EMBED_COEFFICIENTS = [(2, 2), (3, 1), (1, 3), (2, 3)]
NUM_COEFFS = len(EMBED_COEFFICIENTS)

TARGET_SPREAD = 2       # blocks per bit (zone-interleaved)
BLOCK_SIZE = 8

# Adaptive QIM
QIM_DELTA_MIN = 38.0
QIM_DELTA_MAX = 62.0
VARIANCE_THRESHOLD = 500.0

# Deterministic seed (v4 = zone-interleaved)
_BLOCK_SEED = int(hashlib.sha256(b"dct-zone-seed-v4").hexdigest()[:8], 16)


def _zone_interleaved_indices(
    payload_len: int,
    total_blocks: int,
    blocks_x: int,
    blocks_y: int,
    spread_factor: int,
) -> list[list[int]]:
    """
    Allocate block indices so that each spread copy of a bit is in a different
    spatial zone.  Returns a list of `spread_factor` index-lists, each of
    length `payload_len`.  Zone k contains rows [k*blocks_y//spread_factor ..
    (k+1)*blocks_y//spread_factor).
    """
    rng = np.random.RandomState(_BLOCK_SEED)

    # Build zone membership: zone_blocks[z] = list of block indices in zone z
    zone_blocks: list[list[int]] = [[] for _ in range(spread_factor)]
    zone_height = blocks_y // spread_factor  # rows per zone

    for bidx in range(total_blocks):
        by = bidx // blocks_x
        zone = min(by // max(zone_height, 1), spread_factor - 1)
        zone_blocks[zone].append(bidx)

    # Shuffle each zone independently
    for z in range(spread_factor):
        arr = np.array(zone_blocks[z])
        rng.shuffle(arr)
        zone_blocks[z] = arr.tolist()

    # Validate capacity
    for z in range(spread_factor):
        if len(zone_blocks[z]) < payload_len:
            raise ValueError(
                f"Zone {z} has {len(zone_blocks[z])} blocks, need {payload_len}. "
                f"Image may be too small for zone-interleaved spread."
            )

    # Take first payload_len blocks from each zone
    return [zone_blocks[z][:payload_len] for z in range(spread_factor)]


def _adaptive_delta(block: np.ndarray) -> float:
    """QIM step based on block variance -- textured blocks get stronger embedding."""
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
    """Pick largest spread factor that fits. Each zone needs payload_len blocks."""
    sf = TARGET_SPREAD
    while sf > 1:
        zone_rows = blocks_y // sf
        # Rough capacity per zone
        if zone_rows >= 1 and total_blocks // sf >= payload_len:
            break
        sf -= 1
    if total_blocks < payload_len:
        raise ValueError(
            f"Image too small: need {payload_len} blocks, have {total_blocks}."
        )
    return sf


def embed_watermark(image_bytes: bytes, watermark_hex: str) -> bytes:
    """
    Embed a watermark into a PNG image using zone-interleaved multi-coefficient
    DCT + QIM.

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

    # -- Compute spread factor and zone-interleaved indices --
    spread_factor = _compute_spread_factor(len(payload), total_blocks, blocks_y)
    zone_indices = _zone_interleaved_indices(
        len(payload), total_blocks, blocks_x, blocks_y, spread_factor
    )

    # -- Embed each bit across zones x coefficients --
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
