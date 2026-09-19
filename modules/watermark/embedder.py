"""
Watermark Embedder -- DCT-based frequency domain embedding using QIM.

Technique: Quantization Index Modulation (QIM)
  1. Convert image to YCrCb, work on Y (luminance) channel only.
  2. Split Y channel into 8x8 blocks (same block size JPEG uses).
  3. Apply 2D DCT to each block.
  4. Select mid-frequency coefficient at position (3,1) -- zig-zag index ~11.
  5. Embed one watermark bit per block using QIM:
       - Quantize coefficient to nearest even multiple of delta for bit 0
       - Quantize coefficient to nearest odd  multiple of delta for bit 1
  6. Apply inverse DCT to reconstruct the modified Y channel.

Why mid-frequency (3,1)?
  - Low-frequency coefficients (DC, near-DC): modifications cause visible distortion.
  - High-frequency coefficients: easily destroyed by JPEG compression / filtering.
  - Mid-frequency (3,1) is a sweet spot -- survives JPEG Q50+ with minimal visual impact.

QIM delta = 50:
  - JPEG quantization table at (3,1) for Q50 = 17, max error ~8.5
  - QIM decision boundary = delta/2 = 25, well above 8.5 -- survives Q50.
  - Max pixel change from embedding ~ delta/4 ~ 12.5 -- barely visible.

Redundancy + CRC from Phase 1 are preserved.
"""

import hashlib

import cv2
import numpy as np

from config import WATERMARK_REDUNDANCY
from utils.helpers import watermark_to_bits

# -- DCT Embedding Parameters --------------------------------------------------
EMBED_POS = (3, 1)     # Mid-frequency DCT coefficient position
QIM_DELTA = 50.0        # Quantization step size
BLOCK_SIZE = 8          # Standard DCT block size
# Fixed seed for pseudo-random block selection (shared with extractor)
_BLOCK_SEED = int(hashlib.sha256(b"dct-embed-seed-v2").hexdigest()[:8], 16)


def _get_block_indices(num_needed: int, total_blocks: int) -> list[int]:
    """Deterministic pseudo-random block index permutation."""
    if num_needed > total_blocks:
        raise ValueError(
            f"Image too small: need {num_needed} DCT blocks, "
            f"image provides {total_blocks}."
        )
    rng = np.random.RandomState(_BLOCK_SEED)
    indices = np.arange(total_blocks)
    rng.shuffle(indices)
    return indices[:num_needed].tolist()


def _qim_embed(coeff: float, bit: int, delta: float = QIM_DELTA) -> float:
    """
    Quantization Index Modulation -- embed one bit.
    Quantizes 'coeff' to the nearest multiple of 'delta' whose
    integer quotient has the same parity as 'bit'.
    """
    q = int(np.round(coeff / delta))
    if q % 2 != bit:
        q_lo, q_hi = q - 1, q + 1
        if abs(q_lo * delta - coeff) <= abs(q_hi * delta - coeff):
            q = q_lo
        else:
            q = q_hi
    return float(q * delta)


def embed_watermark(image_bytes: bytes, watermark_hex: str) -> bytes:
    """
    Embed a watermark into a PNG image using DCT-domain QIM.

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

    # -- Separate alpha channel if present --
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

    # -- Convert to YCrCb, extract Y channel as float64 --
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0].astype(np.float64)

    h, w = y_channel.shape

    # -- Pad to multiple of BLOCK_SIZE --
    pad_h = (BLOCK_SIZE - h % BLOCK_SIZE) % BLOCK_SIZE
    pad_w = (BLOCK_SIZE - w % BLOCK_SIZE) % BLOCK_SIZE
    if pad_h or pad_w:
        y_channel = np.pad(y_channel, ((0, pad_h), (0, pad_w)), mode="reflect")

    ph, pw = y_channel.shape
    blocks_y, blocks_x = ph // BLOCK_SIZE, pw // BLOCK_SIZE
    total_blocks = blocks_y * blocks_x

    # -- Build payload: watermark bits with CRC, repeated for redundancy --
    single_bits = watermark_to_bits(watermark_hex)       # 144 bits (128 + 16 CRC)
    payload = single_bits * WATERMARK_REDUNDANCY          # 432 bits total

    # -- Select pseudo-random block positions --
    block_indices = _get_block_indices(len(payload), total_blocks)

    # -- Embed each bit via DCT + QIM --
    u, v = EMBED_POS
    for i, bidx in enumerate(block_indices):
        by = bidx // blocks_x
        bx = bidx % blocks_x
        r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

        block = y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()
        dct_block = cv2.dct(block)

        dct_block[u, v] = _qim_embed(dct_block[u, v], payload[i])

        y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE] = cv2.idct(dct_block)

    # -- Remove padding --
    y_channel = y_channel[:h, :w]

    # -- Reconstruct image --
    ycrcb[:, :, 0] = np.clip(np.round(y_channel), 0, 255).astype(np.uint8)
    bgr_out = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    if has_alpha:
        img_out = np.dstack([bgr_out, alpha])
    else:
        img_out = bgr_out

    # -- Encode as PNG --
    success, encoded = cv2.imencode(".png", img_out)
    if not success:
        raise RuntimeError("Failed to encode watermarked image as PNG.")
    return encoded.tobytes()
