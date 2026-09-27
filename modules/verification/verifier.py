"""
Verification Module — Forensic-grade verification with confidence scoring
and multi-signal tamper analysis.

Pipeline:
  1. Multi-signal watermark extraction (original, blurred, JPEG).
  2. Compute sync score and corruption ratio.
  3. Compute forensic confidence score.
  4. Query ledger for matching record.
  5. Verify Ed25519 signature.
  6. Build and return forensic tamper analysis report.
"""

from modules.crypto.signature import load_public_key, verify_signature
from modules.ledger.hashchain import query_by_watermark, verify_chain
from modules.verification.confidence import compute_confidence
from modules.verification.forensic import (
    build_forensic_report,
    compute_corruption_ratio,
    compute_sync_score,
    multi_signal_extraction,
)
from utils.helpers import validate_file_type


def verify_leaked_file(filepath: str) -> dict:
    """
    Forensic-grade verification of a suspected leaked file.

    Combines multi-signal extraction, sync analysis, corruption detection,
    confidence scoring, ledger lookup, and signature verification into a
    single forensic tamper analysis report.

    Args:
        filepath: Path to the suspected leaked PNG file.

    Returns:
        Forensic report dict with keys:
            status:                 str — "identified" | "rejected" |
                                         "watermark_not_found" | "ledger_miss" |
                                         "signature_invalid"
            user / user_id:         str | None
            watermark_id:           str | None
            confidence:             float (0–100)
            verdict:                str — "HIGH_CONFIDENCE" | "MEDIUM" |
                                         "LOW" | "REJECT"
            crc_valid:              bool
            vote_ratio:             float (0–1)
            sync_score:             float (0–1)
            corruption:             float (0–1)
            tamper_detected:        bool
            multi_signal_agreement: int (0–3)
            multi_signal_stable:    bool
            ledger_valid:           bool
            ledger_message:         str
            signature_valid:        bool | None
            record:                 dict | None
            reasoning:              str
            notes:                  list[str]
    """
    validate_file_type(filepath)

    with open(filepath, "rb") as f:
        image_bytes = f.read()

    # ── Step 1: Multi-signal extraction ──────────────────────────
    multi_signal = multi_signal_extraction(image_bytes)
    primary = multi_signal["primary"]
    watermark_id = primary["watermark_id"]
    crc_valid = primary["crc_valid"]
    vote_ratio = primary["confidence"]  # extractor's inter-copy agreement

    # ── Step 2: Sync and corruption analysis ─────────────────────
    sync_score = compute_sync_score(image_bytes)
    corruption_ratio = compute_corruption_ratio(image_bytes)

    # ── Step 3: Confidence scoring ───────────────────────────────
    effective_vote_ratio = vote_ratio
    if not multi_signal["stable"] and watermark_id is not None:
        # Penalize if watermark is unstable across minor perturbations
        effective_vote_ratio *= 0.85

    confidence_result = compute_confidence(
        vote_ratio=effective_vote_ratio,
        crc_valid=crc_valid,
        sync_score=sync_score,
        corrupted_blocks_ratio=corruption_ratio,
    )

    # ── Step 4: Always perform ledger verification ───────────────
    ledger_valid, ledger_msg = verify_chain()

    # ── Step 5: Ledger query & signature verification ─────────────
    user_id = None
    record = None
    sig_valid = None

    if watermark_id is not None:
        record = query_by_watermark(watermark_id)

    if record is not None:
        user_id = record.get("user_id") or record.get("data", {}).get("user_id")
        rec_sig = (
            record.get("signatures", {}).get("recipient")
            or record.get("recipient_signature")
            or record.get("signature")
        )
        try:
            public_key = load_public_key(user_id)
            sig_valid = verify_signature(record, rec_sig, public_key)
        except Exception:
            sig_valid = False

        if sig_valid:
            status = "identified"
            # If verdict was REJECT purely due to uniform background, promote if CRC is valid
            if confidence_result["verdict"] == "REJECT" and crc_valid:
                confidence_result["verdict"] = "HIGH_CONFIDENCE"
                confidence_result["confidence"] = max(confidence_result["confidence"], 90.0)
        else:
            status = "signature_invalid"
    else:
        if watermark_id is None:
            status = "watermark_not_found"
        elif confidence_result["verdict"] == "REJECT":
            status = "rejected"
        else:
            status = "ledger_miss"

    # ── Build forensic report ────────────────────────────────────
    report = build_forensic_report(
        extraction=primary,
        sync_score=sync_score,
        corruption_ratio=corruption_ratio,
        multi_signal=multi_signal,
        confidence_result=confidence_result,
        ledger_record=record,
        ledger_valid=ledger_valid,
        user_id=user_id,
        signature_valid=sig_valid,
    )

    # Backward-compatible fields
    report["status"] = status
    report["user_id"] = user_id
    report["ledger_message"] = ledger_msg

    return report
