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

    # ── Step 4: Determine status ─────────────────────────────────
    status = "watermark_not_found"
    user_id = None
    record = None
    ledger_valid = False
    ledger_msg = ""
    sig_valid = None

    if watermark_id is None or confidence_result["verdict"] == "REJECT":
        status = (
            "watermark_not_found" if watermark_id is None else "rejected"
        )
    else:
        # ── Step 5: Ledger verification ──────────────────────────
        ledger_valid, ledger_msg = verify_chain()

        # ── Step 6: Ledger query ─────────────────────────────────
        record = query_by_watermark(watermark_id)
        if record is None:
            status = "ledger_miss"
        else:
            user_id = record["user_id"]

            # ── Step 7: Signature verification ───────────────────
            try:
                public_key = load_public_key(record["user_id"])
                sig_valid = verify_signature(
                    record, record["signature"], public_key
                )
            except Exception:
                sig_valid = False

            if not sig_valid:
                status = "signature_invalid"
            else:
                status = "identified"

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
