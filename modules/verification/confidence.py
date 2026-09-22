"""
Confidence Scoring Engine — forensic-grade confidence from multiple signals.

Combines vote ratio, CRC validation, sync correlation, and corruption
metrics into a single 0–100 confidence score with a categorical verdict.

Scoring breakdown (max 100):
    Base:  vote_ratio × 60              (0 – 60)
    CRC:   +25 if valid                 (0 or 25)
    Sync:  +15 if strong, +8 moderate   (0, 8, or 15)
    Corruption: –10/–20/–25 penalty     (0 to –25)

Hard rejection rules:
    - vote_ratio < 0.60 → immediate REJECT
    - CRC invalid AND vote_ratio < 0.70 → REJECT (false positive guard)
"""


def compute_confidence(
    vote_ratio: float,
    crc_valid: bool,
    sync_score: float,
    corrupted_blocks_ratio: float,
) -> dict:
    """
    Compute forensic confidence score from multiple verification signals.

    Args:
        vote_ratio:             Inter-copy agreement ratio (0–1).
        crc_valid:              Whether CRC-16 checksum validated.
        sync_score:             Sync template match ratio (0–1).
        corrupted_blocks_ratio: Fraction of blocks below variance threshold (0–1).

    Returns:
        dict with:
            confidence: float (0–100)
            verdict:    "HIGH_CONFIDENCE" | "MEDIUM" | "LOW" | "REJECT"
            reasoning:  str (human-readable explanation of scoring)
    """
    reasons = []

    # ── Hard reject: extreme corruption ──────────────────────────
    # When >80% of blocks are corrupted (uniform fill, destroyed content),
    # the extractor defaults all bits to 0, producing artificially perfect
    # inter-copy agreement.  The vote_ratio is meaningless in this case.
    if corrupted_blocks_ratio > 0.80:
        reasons.append(
            f"Extreme corruption ({corrupted_blocks_ratio:.1%}) — "
            "extraction data unreliable"
        )
        return {
            "confidence": 0.0,
            "verdict": "REJECT",
            "reasoning": "; ".join(reasons),
        }

    # ── Hard reject: vote ratio below minimum ────────────────────
    if vote_ratio < 0.60:
        reasons.append(
            f"Vote ratio {vote_ratio:.1%} below minimum threshold (60%)"
        )
        return {
            "confidence": 0.0,
            "verdict": "REJECT",
            "reasoning": "; ".join(reasons),
        }

    # ── False positive guard ─────────────────────────────────────
    if not crc_valid and vote_ratio < 0.70:
        reasons.append(
            "CRC failed AND vote ratio below 70% — likely false positive"
        )
        return {
            "confidence": 0.0,
            "verdict": "REJECT",
            "reasoning": "; ".join(reasons),
        }

    # ── Base score from vote ratio (0–60) ────────────────────────
    base = vote_ratio * 60.0
    reasons.append(f"Base {base:.1f}/60 from vote ratio {vote_ratio:.1%}")

    # ── CRC boost (+25) ──────────────────────────────────────────
    if crc_valid:
        base += 25.0
        reasons.append("CRC valid: +25")
    else:
        reasons.append("CRC invalid: no boost")

    # ── Sync boost (up to +15) ───────────────────────────────────
    if sync_score >= 0.75:
        base += 15.0
        reasons.append(f"Strong sync ({sync_score:.1%}): +15")
    elif sync_score >= 0.60:
        base += 8.0
        reasons.append(f"Moderate sync ({sync_score:.1%}): +8")
    else:
        reasons.append(f"Weak sync ({sync_score:.1%}): +0")

    # ── Corruption penalty ───────────────────────────────────────
    if corrupted_blocks_ratio > 0.50:
        base -= 25.0
        reasons.append(f"Severe corruption ({corrupted_blocks_ratio:.1%}): -25")
    elif corrupted_blocks_ratio > 0.30:
        base -= 20.0
        reasons.append(f"High corruption ({corrupted_blocks_ratio:.1%}): -20")
    elif corrupted_blocks_ratio > 0.15:
        base -= 10.0
        reasons.append(f"Moderate corruption ({corrupted_blocks_ratio:.1%}): -10")
    else:
        reasons.append(f"Low corruption ({corrupted_blocks_ratio:.1%}): no penalty")

    # ── Clamp and classify ───────────────────────────────────────
    confidence = max(0.0, min(100.0, base))

    if confidence >= 80.0:
        verdict = "HIGH_CONFIDENCE"
    elif confidence >= 55.0:
        verdict = "MEDIUM"
    elif confidence >= 30.0:
        verdict = "LOW"
    else:
        verdict = "REJECT"

    return {
        "confidence": round(confidence, 1),
        "verdict": verdict,
        "reasoning": "; ".join(reasons),
    }
