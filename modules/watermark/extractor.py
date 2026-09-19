"""
Watermark Extractor -- Zone-interleaved multi-coefficient extraction with
multi-level voting.

Voting hierarchy:
  Level 1 (intra-bit):  For each payload bit, collect votes from
      spread_factor zones x NUM_COEFFS coefficients = 8 votes.
      Majority-vote -> 1 recovered bit per payload position.

  Level 2 (inter-copy): For each watermark+CRC bit, majority-vote
      across WATERMARK_REDUNDANCY copies = 3 votes.

Total votes per final watermark bit: 8 x 3 = 24.
Tolerates up to 45% vote corruption per bit.
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


def _zone_interleaved_indices(
    payload_len: int,
    total_blocks: int,
    blocks_x: int,
    blocks_y: int,
    spread_factor: int,
) -> list[list[int]]:
    """Same zone-interleaving as embedder."""
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
            return []  # Can't fit -- caller handles gracefully

    return [zone_blocks[z][:payload_len] for z in range(spread_factor)]


def _adaptive_delta(block: np.ndarray) -> float:
    variance = float(np.var(block))
    scale = min(variance / VARIANCE_THRESHOLD, 1.0)
    return QIM_DELTA_MIN + scale * (QIM_DELTA_MAX - QIM_DELTA_MIN)


def _qim_extract(coeff: float, delta: float) -> int:
    q = int(np.round(coeff / delta))
    return int(q % 2)


def _compute_spread_factor(payload_len: int, total_blocks: int, blocks_y: int) -> int:
    sf = TARGET_SPREAD
    while sf > 1:
        zone_rows = blocks_y // sf
        if zone_rows >= 1 and total_blocks // sf >= payload_len:
            break
        sf -= 1
    if total_blocks < payload_len:
        return 0
    return sf


def _majority_vote(copies: list[list[int]]) -> list[int]:
    num_bits = len(copies[0])
    result = []
    for i in range(num_bits):
        ones = sum(c[i] for c in copies)
        result.append(1 if ones > len(copies) // 2 else 0)
    return result


def extract_watermark(image_bytes: bytes) -> dict:
    """
    Extract watermark from a PNG image using zone-interleaved multi-level voting.

    Returns dict with:
        watermark_id: str | None
        crc_valid: bool
        confidence: float  (0.0-1.0)
    """
    buf = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
    if img is None:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    if len(img.shape) == 3 and img.shape[2] == 4:
        bgr = img[:, :, :3]
    elif len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else:
        bgr = img

    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0].astype(np.float64)
    h, w = y_channel.shape

    pad_h = (BLOCK_SIZE - h % BLOCK_SIZE) % BLOCK_SIZE
    pad_w = (BLOCK_SIZE - w % BLOCK_SIZE) % BLOCK_SIZE
    if pad_h or pad_w:
        y_channel = np.pad(y_channel, ((0, pad_h), (0, pad_w)), mode="reflect")

    ph, pw = y_channel.shape
    blocks_y, blocks_x = ph // BLOCK_SIZE, pw // BLOCK_SIZE
    total_blocks = blocks_y * blocks_x

    # -- Payload dimensions --
    wm_bytes = WATERMARK_HEX_LENGTH // 2
    crc_bytes = CHECKSUM_BITS // 8
    single_bits = (wm_bytes + crc_bytes) * 8       # 144
    total_payload = single_bits * WATERMARK_REDUNDANCY  # 432

    spread_factor = _compute_spread_factor(total_payload, total_blocks, blocks_y)
    if spread_factor == 0:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    zone_indices = _zone_interleaved_indices(
        total_payload, total_blocks, blocks_x, blocks_y, spread_factor
    )
    if not zone_indices:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    # -- Level 1: Intra-bit voting (zones x coefficients) --
    payload_bits = []
    for bit_idx in range(total_payload):
        votes = []
        for z in range(spread_factor):
            bidx = zone_indices[z][bit_idx]
            by = bidx // blocks_x
            bx = bidx % blocks_x
            r0, c0 = by * BLOCK_SIZE, bx * BLOCK_SIZE

            block = y_channel[r0 : r0 + BLOCK_SIZE, c0 : c0 + BLOCK_SIZE].copy()
            delta = _adaptive_delta(block)
            dct_block = cv2.dct(block)

            for u, v in EMBED_COEFFICIENTS:
                votes.append(_qim_extract(dct_block[u, v], delta))

        ones = sum(votes)
        payload_bits.append(1 if ones > len(votes) // 2 else 0)

    # -- Level 2: Inter-copy majority vote --
    copies = []
    for c in range(WATERMARK_REDUNDANCY):
        start = c * single_bits
        end = start + single_bits
        copies.append(payload_bits[start:end])

    voted_bits = _majority_vote(copies)

    # -- Confidence: fraction of bits where ALL copies agree --
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
