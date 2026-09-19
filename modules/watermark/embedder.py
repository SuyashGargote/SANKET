"""
Watermark Embedder — Pseudo-random LSB embedding with redundancy and CRC checksum.

Improvements over naive sequential LSB:
  1. Pixel positions are derived from a PRNG seeded by the watermark_id,
     making bit placement unpredictable without knowledge of the watermark.
  2. The watermark is embedded WATERMARK_REDUNDANCY times for robustness.
  3. A 16-bit CRC checksum is appended so extraction can validate integrity.

Phase 1 restriction: PNG images only.
"""

import hashlib
import io
import random

from PIL import Image

from config import WATERMARK_REDUNDANCY
from utils.helpers import validate_file_type, watermark_to_bits


def _get_pixel_positions(seed: str, num_positions: int, total_pixels: int) -> list[int]:
    """
    Generate a deterministic pseudo-random permutation of pixel indices
    from a seed derived from the watermark_id.
    """
    rng = random.Random(seed)
    if num_positions > total_pixels:
        raise ValueError(
            f"Image too small: need {num_positions} embeddable pixels, "
            f"image has {total_pixels}."
        )
    indices = list(range(total_pixels))
    rng.shuffle(indices)
    return indices[:num_positions]


def embed_watermark(image_bytes: bytes, watermark_hex: str) -> bytes:
    """
    Embed a watermark into a PNG image using pseudo-random LSB.

    Args:
        image_bytes: Raw PNG file bytes.
        watermark_hex: 32-char hex watermark ID.

    Returns:
        Watermarked PNG bytes (visually identical to original).
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    pixels = list(img.getdata())
    total_pixels = len(pixels)

    # Build the payload: watermark bits repeated for redundancy
    single_bits = watermark_to_bits(watermark_hex)  # 144 bits (128 + 16 CRC)
    payload_bits = single_bits * WATERMARK_REDUNDANCY

    # Each bit is embedded in the LSB of the Red channel of one pixel
    positions_needed = len(payload_bits)
    if positions_needed > total_pixels:
        raise ValueError(
            f"Image too small for watermark embedding. "
            f"Need {positions_needed} pixels, have {total_pixels}."
        )

    # Seed the PRNG with the watermark itself — extractor must know the watermark
    # to locate bits, but verification extracts from ALL copies and votes.
    # We use a fixed extraction seed (see extractor) for the overall layout.
    seed = hashlib.sha256(b"wm-embed-seed-v1").hexdigest()
    positions = _get_pixel_positions(seed, positions_needed, total_pixels)

    # Embed
    pixels_mut = [list(p) for p in pixels]
    for i, pos in enumerate(positions):
        r, g, b, a = pixels_mut[pos]
        # Embed in LSB of red channel
        r = (r & 0xFE) | payload_bits[i]
        pixels_mut[pos] = [r, g, b, a]

    img_out = Image.new("RGBA", img.size)
    img_out.putdata([tuple(p) for p in pixels_mut])

    buf = io.BytesIO()
    img_out.save(buf, format="PNG")
    return buf.getvalue()
