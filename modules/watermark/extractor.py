"""
Watermark Extractor -- DCT-based extraction with majority vote and CRC validation.

Extraction process:
  1. Convert image to YCrCb, extract Y channel.
  2. Pad to block-size multiples (same padding as embedder).
  3. Reconstruct the same pseudo-random block permutation.
  4. For each block: apply 2D DCT, read mid-frequency coefficient,
     decode bit via QIM (check parity of quantized value).
  5. Split recovered bits into WATERMARK_REDUNDANCY copies.
  6. Majority-vote across copies to tolerate corruption.
  7. Validate CRC-16 checksum.
  8. Return watermark_id, crc_valid, and confidence score.
"""

import hashlib

import cv2
import numpy as np

from config import CHECKSUM_BITS, WATERMARK_HEX_LENGTH, WATERMARK_REDUNDANCY
from utils.helpers import bits_to_watermark

# -- Must match embedder constants exactly --
EMBED_POS = (3, 1)
QIM_DELTA = 50.0
BLOCK_SIZE = 8
_BLOCK_SEED = int(hashlib.sha256(b"dct-embed-seed-v2").hexdigest()[:8], 16)


def _get_block_indices(num_needed: int, total_blocks: int) -> list[int]:
    """Same deterministic permutation as embedder."""
    if num_needed > total_blocks:
        return []   # Image too small -- return empty, caller handles gracefully
    rng = np.random.RandomState(_BLOCK_SEED)
    indices = np.arange(total_blocks)
    rng.shuffle(indices)
    return indices[:num_needed].tolist()


def _qim_extract(coeff: float, delta: float = QIM_DELTA) -> int:
    """Decode one bit from a DCT coefficient via QIM."""
    q = int(np.round(coeff / delta))
    return int(q % 2)


def _majority_vote(copies: list[list[int]]) -> list[int]:
    """Bit-wise majority vote across redundant copies."""
    num_bits = len(copies[0])
    result = []
    for i in range(num_bits):
        ones = sum(c[i] for c in copies)
        result.append(1 if ones > len(copies) // 2 else 0)
    return result


def extract_watermark(image_bytes: bytes) -> dict:
    """
    Extract watermark from a PNG image.

    Returns dict with:
        watermark_id: str | None  -- extracted hex watermark (None if failed)
        crc_valid: bool           -- whether CRC checksum matched
        confidence: float         -- agreement ratio across redundant copies (0.0-1.0)
    """
    # -- Decode image --
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    # -- Handle channels --
    if len(img.shape) == 3 and img.shape[2] == 4:
        bgr = img[:, :, :3]
    elif len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else:
        bgr = img

    # -- Convert to YCrCb, extract Y channel --
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0].astype(np.float64)

    h, w = y_channel.shape

    # -- Pad to multiple of BLOCK_SIZE (same as embedder) --
    pad_h = (BLOCK_SIZE - h % BLOCK_SIZE) % BLOCK_SIZE
    pad_w = (BLOCK_SIZE - w % BLOCK_SIZE) % BLOCK_SIZE
    if pad_h or pad_w:
        y_channel = np.pad(y_channel, ((0, pad_h), (0, pad_w)), mode="reflect")

    ph, pw = y_channel.shape
    blocks_y, blocks_x = ph // BLOCK_SIZE, pw // BLOCK_SIZE
    total_blocks = blocks_y * blocks_x

    # -- Calculate payload size --
    wm_bytes = WATERMARK_HEX_LENGTH // 2          # 16 bytes
    crc_bytes = CHECKSUM_BITS // 8                 # 2 bytes
    single_bits = (wm_bytes + crc_bytes) * 8       # 144 bits
    total_bits = single_bits * WATERMARK_REDUNDANCY  # 432 bits

    # -- Get block indices --
    block_indices = _get_block_indices(total_bits, total_blocks)
    if not block_indices:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    # -- Read bits from DCT coefficients --
    u, v = EMBED_POS
    raw_bits = []
    for bidx in block_indices:
        by = bidx // blocks_x
        bx = bidx % blocks_x
        r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

        block = y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()
        dct_block = cv2.dct(block)

        raw_bits.append(_qim_extract(dct_block[u, v]))

    # -- Split into redundant copies --
    copies = []
    for c in range(WATERMARK_REDUNDANCY):
        start = c * single_bits
        end = start + single_bits
        copies.append(raw_bits[start:end])

    # -- Majority vote --
    voted_bits = _majority_vote(copies)

    # -- Compute confidence: fraction of positions where ALL copies agree --
    agreements = 0
    for i in range(single_bits):
        vals = [c[i] for c in copies]
        if all(v == voted_bits[i] for v in vals):
            agreements += 1
    confidence = agreements / single_bits

    # -- Decode watermark + validate CRC --
    watermark_hex, crc_valid = bits_to_watermark(voted_bits)

    return {
        "watermark_id": watermark_hex,
        "crc_valid": crc_valid,
        "confidence": round(confidence, 4),
    }
