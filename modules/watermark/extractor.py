"""
Watermark Extractor — Robust extraction with majority-vote across redundant copies.

Extraction process:
  1. Reconstruct the same pseudo-random pixel positions using the shared seed.
  2. Read LSB of Red channel at those positions.
  3. Split bits into WATERMARK_REDUNDANCY copies.
  4. Majority-vote across copies to tolerate minor corruption.
  5. Validate CRC checksum.
  6. Return watermark and confidence score.
"""

import hashlib
import io
import random

from PIL import Image

from config import WATERMARK_REDUNDANCY, WATERMARK_HEX_LENGTH, CHECKSUM_BITS
from utils.helpers import bits_to_watermark


def _get_pixel_positions(seed: str, num_positions: int, total_pixels: int) -> list[int]:
    """Same deterministic permutation as embedder."""
    rng = random.Random(seed)
    indices = list(range(total_pixels))
    rng.shuffle(indices)
    return indices[:num_positions]


def _majority_vote(copies: list[list[int]]) -> list[int]:
    """
    Bit-wise majority vote across multiple copies.
    Returns the consensus bit string.
    """
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
        watermark_id: str | None  — extracted hex watermark (None if failed)
        crc_valid: bool           — whether CRC checksum matched
        confidence: float         — agreement ratio across redundant copies (0.0–1.0)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    pixels = list(img.getdata())
    total_pixels = len(pixels)

    # Calculate payload size
    wm_bytes = WATERMARK_HEX_LENGTH // 2          # 16 bytes
    crc_bytes = CHECKSUM_BITS // 8                 # 2 bytes
    single_bits = (wm_bytes + crc_bytes) * 8       # 144 bits
    total_bits = single_bits * WATERMARK_REDUNDANCY

    if total_bits > total_pixels:
        return {"watermark_id": None, "crc_valid": False, "confidence": 0.0}

    # Reconstruct positions
    seed = hashlib.sha256(b"wm-embed-seed-v1").hexdigest()
    positions = _get_pixel_positions(seed, total_bits, total_pixels)

    # Read LSBs
    raw_bits = []
    for pos in positions:
        r, g, b, a = pixels[pos]
        raw_bits.append(r & 1)

    # Split into copies
    copies = []
    for c in range(WATERMARK_REDUNDANCY):
        start = c * single_bits
        end = start + single_bits
        copies.append(raw_bits[start:end])

    # Majority vote
    voted_bits = _majority_vote(copies)

    # Compute confidence: fraction of bit positions where all copies agree
    agreements = 0
    for i in range(single_bits):
        vals = [c[i] for c in copies]
        if all(v == voted_bits[i] for v in vals):
            agreements += 1
    confidence = agreements / single_bits

    # Decode
    watermark_hex, crc_valid = bits_to_watermark(voted_bits)

    return {
        "watermark_id": watermark_hex,
        "crc_valid": crc_valid,
        "confidence": round(confidence, 4),
    }
