"""
Forensic Report Generator — produces forensic-grade tamper analysis reports
with tamper type classification, severity scoring, and structured output.

Capabilities:
  - Full forensic verification (delegates to verification layer)
  - Tamper type classification via signal heuristics
  - Damage severity scoring
  - JSON report generation with file hash
  - Pretty CLI output

This module does NOT modify watermark, crypto, or ledger logic.
"""

import json
import os
from datetime import datetime, timezone

from config import REPORTS_DIR
from modules.verification.verifier import verify_leaked_file
from utils.helpers import generate_file_id


# ── Tamper Classification ────────────────────────────────────────────────────


def classify_tamper(
    sync_score: float,
    corruption: float,
    crc_valid: bool,
    vote_ratio: float,
    multi_signal_stable: bool,
    multi_signal_agreement: int,
) -> tuple[str, list[str]]:
    """
    Classify the type of tampering using signal heuristics.

    Heuristic rules:
      - High sync + high corruption              → cropping
      - High sync + low corruption + CRC fail     → compression (JPEG)
      - High sync + low corruption + vote drop     → noise
      - Low sync (< 0.60)                          → rotation / affine
      - Multiple indicators                        → combined attack

    Args:
        sync_score:             Sync template match ratio (0.0–1.0).
        corruption:             Fraction of corrupted blocks (0.0–1.0).
        crc_valid:              CRC-16 checksum validation result.
        vote_ratio:             Inter-copy agreement ratio (0.0–1.0).
        multi_signal_stable:    Whether all 3 extractions agree on watermark_id.
        multi_signal_agreement: Count of extractions matching primary (0–3).

    Returns:
        (tamper_type, details) where:
            tamper_type: "none" | "compression" | "noise" | "crop" |
                         "rotation" | "combined" | "unknown"
            details:     List of human-readable explanations.
    """
    types_detected = []
    details = []

    sync_high = sync_score >= 0.70
    sync_low = sync_score < 0.60
    corruption_high = corruption > 0.20
    corruption_moderate = 0.10 < corruption <= 0.20
    corruption_low = corruption <= 0.10
    vote_drop = vote_ratio < 0.95

    # ── Clean file (no tamper) ───────────────────────────────────
    if crc_valid and sync_high and corruption_low and multi_signal_stable:
        return "none", ["No tampering indicators detected"]

    # ── Rotation / geometric transform ───────────────────────────
    if sync_low:
        types_detected.append("rotation")
        details.append(
            f"Sync template degraded ({sync_score:.1%}) -- "
            "geometric misalignment suggests rotation or affine transform"
        )

    # ── Cropping ─────────────────────────────────────────────────
    if sync_high and corruption_high:
        types_detected.append("crop")
        details.append(
            f"High corruption ({corruption:.1%}) with intact sync -- "
            "large uniform-fill regions suggest cropping or content removal"
        )
    elif sync_high and corruption_moderate and crc_valid:
        types_detected.append("crop")
        details.append(
            f"Moderate corruption ({corruption:.1%}) with valid CRC -- "
            "minor cropping or localized damage detected"
        )

    # ── Compression (JPEG) ───────────────────────────────────────
    if sync_high and corruption_low and not crc_valid:
        types_detected.append("compression")
        details.append(
            "CRC failed with intact sync and low corruption -- "
            "DCT quantization artifacts suggest lossy re-compression (JPEG)"
        )

    # ── Noise ────────────────────────────────────────────────────
    if sync_high and corruption_low and crc_valid and vote_drop:
        types_detected.append("noise")
        details.append(
            f"Vote ratio dropped to {vote_ratio:.1%} with valid CRC -- "
            "random perturbation pattern suggests additive noise"
        )

    # ── Multi-signal instability (no other indicators) ───────────
    if not multi_signal_stable and not types_detected:
        types_detected.append("unknown")
        details.append(
            f"Multi-signal instability ({multi_signal_agreement}/3 agree) -- "
            "watermark fragile under minor perturbation, tamper type unclear"
        )

    # ── Determine final classification ───────────────────────────
    if not types_detected:
        return "unknown", ["Tampering detected but type could not be classified"]
    elif len(types_detected) == 1:
        return types_detected[0], details
    else:
        return "combined", details


# ── Severity Scoring ─────────────────────────────────────────────────────────


def compute_severity(
    corruption: float,
    crc_valid: bool,
    multi_signal_agreement: int,
) -> str:
    """
    Compute damage severity from corruption level, CRC status, and
    multi-signal agreement.

    Point system:
        corruption > 30%             → +2 points
        corruption 15–30%            → +1 point
        CRC failed                   → +1 point
        multi-signal agreement < 2   → +2 points
        multi-signal agreement == 2  → +1 point

    Verdict:
        0 points  →  NONE
        1 point   →  LOW
        2–3 pts   →  MEDIUM
        4+ pts    →  HIGH

    Returns:
        "NONE" | "LOW" | "MEDIUM" | "HIGH"
    """
    points = 0

    if corruption > 0.30:
        points += 2
    elif corruption > 0.15:
        points += 1

    if not crc_valid:
        points += 1

    if multi_signal_agreement < 2:
        points += 2
    elif multi_signal_agreement < 3:
        points += 1

    if points == 0:
        return "NONE"
    elif points == 1:
        return "LOW"
    elif points <= 3:
        return "MEDIUM"
    else:
        return "HIGH"


# ── Report Generation ────────────────────────────────────────────────────────


def generate_report(
    file_path: str,
    output_dir: str | None = None,
) -> tuple[dict, str]:
    """
    Generate a complete forensic analysis report for a suspected leaked file.

    Pipeline:
      1. Run full forensic verification (multi-signal + confidence scoring)
      2. Compute file SHA-256 hash
      3. Classify tamper type from signal heuristics
      4. Compute damage severity
      5. Build structured report dict
      6. Save as indented JSON

    Args:
        file_path:  Path to the suspected leaked PNG file.
        output_dir: Directory for JSON output. Defaults to config.REPORTS_DIR.

    Returns:
        (report_dict, json_path) tuple.
    """
    if output_dir is None:
        output_dir = REPORTS_DIR
    os.makedirs(output_dir, exist_ok=True)

    # ── Step 1: Forensic verification ────────────────────────────
    vr = verify_leaked_file(file_path)

    # ── Step 2: File hash ────────────────────────────────────────
    file_hash = generate_file_id(file_path)

    # ── Step 3: Tamper classification ────────────────────────────
    tamper_type, tamper_details = classify_tamper(
        sync_score=vr["sync_score"],
        corruption=vr["corruption"],
        crc_valid=vr["crc_valid"],
        vote_ratio=vr["vote_ratio"],
        multi_signal_stable=vr["multi_signal_stable"],
        multi_signal_agreement=vr["multi_signal_agreement"],
    )

    # ── Step 4: Severity ─────────────────────────────────────────
    severity = compute_severity(
        corruption=vr["corruption"],
        crc_valid=vr["crc_valid"],
        multi_signal_agreement=vr["multi_signal_agreement"],
    )

    # ── Step 5: Sync strength label ──────────────────────────────
    if vr["sync_score"] >= 0.75:
        sync_strength = "Strong"
    elif vr["sync_score"] >= 0.50:
        sync_strength = "Moderate"
    else:
        sync_strength = "Weak"

    # ── Step 6: Build report ─────────────────────────────────────
    now = datetime.now(timezone.utc)
    report_id = f"RPT-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"

    report = {
        # ── Metadata ─────────────────────────────────────────────
        "report_id": report_id,
        "generated_at": now.isoformat(),
        "file_path": os.path.abspath(file_path),
        "file_hash": file_hash,

        # ── Attribution ──────────────────────────────────────────
        "user": vr.get("user") or "unknown",
        "watermark_id": vr.get("watermark_id"),
        "status": vr["status"],

        # ── Confidence ───────────────────────────────────────────
        "confidence": round(vr["confidence"], 1),
        "verdict": vr["verdict"],
        "reasoning": vr.get("reasoning", ""),

        # ── Signal analysis ──────────────────────────────────────
        "crc_valid": vr["crc_valid"],
        "vote_ratio": round(vr["vote_ratio"], 4),
        "sync_score": round(vr["sync_score"], 4),
        "sync_strength": sync_strength,
        "corruption_pct": round(vr["corruption"] * 100, 1),
        "multi_signal_agreement": vr["multi_signal_agreement"],
        "multi_signal_stable": vr["multi_signal_stable"],

        # ── Tamper analysis ──────────────────────────────────────
        "tamper_detected": vr["tamper_detected"],
        "tamper_type": tamper_type,
        "tamper_details": tamper_details,
        "severity": severity,

        # ── Ledger ───────────────────────────────────────────────
        "ledger_valid": vr.get("ledger_valid", False),
        "signature_valid": vr.get("signature_valid"),

        # ── Notes ────────────────────────────────────────────────
        "notes": vr.get("notes", []),
    }

    # Include ledger record details if available
    if vr.get("record"):
        report["ledger_record"] = {
            "index": vr["record"].get("index"),
            "timestamp": vr["record"].get("timestamp"),
            "nonce": vr["record"].get("nonce"),
        }

    # ── Step 7: Save JSON ────────────────────────────────────────
    json_filename = f"{report_id}.json"
    json_path = os.path.join(output_dir, json_filename)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    return report, json_path


# ── Pretty CLI Output ────────────────────────────────────────────────────────


def print_report(report: dict) -> None:
    """
    Pretty-print a forensic analysis report to the console.

    Sections:
      - Header (report ID, file, hash, timestamp)
      - Attribution (user, watermark, confidence, verdict)
      - Signal Analysis (CRC, votes, sync, corruption, multi-signal)
      - Tamper Analysis (detected, type, severity, details)
      - Ledger (chain validity, signature, block info)
      - Notes (human-readable observations)
    """
    W = 56  # report width

    print()
    print(f"  {'=' * W}")
    print(f"  {'FORENSIC ANALYSIS REPORT':^{W}}")
    print(f"  {'=' * W}")

    # -- Header -------------------------------------------------------
    print(f"\n  Report ID  : {report['report_id']}")
    print(f"  File       : {os.path.basename(report['file_path'])}")
    print(f"  File Hash  : {report['file_hash'][:16]}...")
    print(f"  Generated  : {report['generated_at']}")

    # -- Attribution ---------------------------------------------------
    print(f"\n  -- ATTRIBUTION {'-' * (W - 17)}")
    user_display = report["user"] if report["user"] != "unknown" else "N/A"
    print(f"    User         : {user_display}")
    if report.get("watermark_id"):
        print(f"    Watermark    : {report['watermark_id']}")
    print(f"    Confidence   : {report['confidence']:.1f}%")
    print(f"    Verdict      : {report['verdict']}")
    print(f"    Status       : {report['status'].upper()}")

    # -- Signal Analysis -----------------------------------------------
    print(f"\n  -- SIGNAL ANALYSIS {'-' * (W - 20)}")
    crc_label = "OK" if report["crc_valid"] else "FAILED"
    print(f"    CRC          : {crc_label}")
    print(f"    Vote Ratio   : {report['vote_ratio']:.1%}")
    print(f"    Sync         : {report['sync_strength']} ({report['sync_score']:.1%})")
    print(f"    Corruption   : {report['corruption_pct']:.1f}%")
    print(f"    Multi-signal : {report['multi_signal_agreement']}/3 agree")

    # -- Tamper Analysis -----------------------------------------------
    print(f"\n  -- TAMPER ANALYSIS {'-' * (W - 20)}")
    tamper_label = "YES" if report["tamper_detected"] else "NO"
    print(f"    Detected     : {tamper_label}")
    type_label = report["tamper_type"].replace("_", " ").title()
    print(f"    Type         : {type_label}")
    print(f"    Severity     : {report['severity']}")
    if report.get("tamper_details"):
        for detail in report["tamper_details"]:
            print(f"    > {detail}")

    # -- Ledger --------------------------------------------------------
    print(f"\n  -- LEDGER {'-' * (W - 11)}")
    chain_label = "YES" if report.get("ledger_valid") else "NO"
    sig_label = "VALID" if report.get("signature_valid") else "N/A"
    print(f"    Chain Valid  : {chain_label}")
    print(f"    Signature    : {sig_label}")
    if report.get("ledger_record"):
        rec = report["ledger_record"]
        print(f"    Block #      : {rec.get('index', 'N/A')}")
        print(f"    Timestamp    : {rec.get('timestamp', 'N/A')}")

    # -- Notes ---------------------------------------------------------
    if report.get("notes"):
        print(f"\n  -- NOTES {'-' * (W - 10)}")
        for note in report["notes"]:
            print(f"    * {note}")

    print(f"\n  {'=' * W}")
