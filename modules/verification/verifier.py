"""
Verification Module — Identify the source of a leaked file.

Pipeline:
  1. Extract watermark from the leaked file.
  2. Validate CRC checksum.
  3. Query ledger for matching record.
  4. Verify the Ed25519 signature on the record.
  5. Return attribution result.
"""

from modules.crypto.signature import load_public_key, verify_signature
from modules.ledger.hashchain import query_by_watermark, verify_chain
from modules.watermark.extractor import extract_watermark
from utils.helpers import validate_file_type


def verify_leaked_file(filepath: str) -> dict:
    """
    Given a suspected leaked file, extract the watermark and identify the user.

    Args:
        filepath: Path to the leaked PNG file.

    Returns:
        dict with:
            status: str            — "identified" | "watermark_not_found" | "ledger_miss" | "signature_invalid"
            watermark_id: str|None
            crc_valid: bool
            confidence: float
            user_id: str|None
            record: dict|None
            ledger_valid: bool
            ledger_message: str
    """
    # Validate file type
    validate_file_type(filepath)

    # Read image bytes
    with open(filepath, "rb") as f:
        image_bytes = f.read()

    # Step 1: Extract watermark
    extraction = extract_watermark(image_bytes)
    watermark_id = extraction["watermark_id"]
    crc_valid = extraction["crc_valid"]
    confidence = extraction["confidence"]

    result = {
        "status":         "watermark_not_found",
        "watermark_id":   watermark_id,
        "crc_valid":      crc_valid,
        "confidence":     confidence,
        "user_id":        None,
        "record":         None,
        "ledger_valid":   False,
        "ledger_message": "",
    }

    if watermark_id is None:
        return result

    # Step 2: Verify ledger integrity
    ledger_valid, ledger_msg = verify_chain()
    result["ledger_valid"] = ledger_valid
    result["ledger_message"] = ledger_msg

    # Step 3: Query ledger
    record = query_by_watermark(watermark_id)
    if record is None:
        result["status"] = "ledger_miss"
        return result

    result["record"] = record
    result["user_id"] = record["user_id"]

    # Step 4: Verify signature
    try:
        public_key = load_public_key(record["user_id"])
        sig_valid = verify_signature(record, record["signature"], public_key)
    except Exception:
        sig_valid = False

    if not sig_valid:
        result["status"] = "signature_invalid"
        return result

    result["status"] = "identified"
    return result
