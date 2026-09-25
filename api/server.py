"""
api/server.py — FastAPI REST API for the Cryptographic Attribution System.

Exposes endpoints for:
  - POST /encrypt  : Encrypt a PNG file for specified recipients
  - POST /decrypt  : Decrypt an encrypted package as an authorized user
  - POST /verify   : Verify a leaked file and identify the source user
  - POST /report   : Generate a forensic-grade tamper analysis report
  - GET  /ledger   : Verify ledger chain integrity and anchor status
"""

import os
import shutil
import sys
from typing import Optional

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import Body, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import DATA_DIR, ENCRYPTED_DIR, UPLOADS_DIR
from modules.crypto.decryption import decrypt_file
from modules.crypto.encryption import encrypt_file
from modules.forensics.report import generate_report
from modules.ledger.hashchain import get_all_records, verify_ledger_with_anchors
from modules.verification.verifier import verify_leaked_file


# ── FastAPI App Configuration ────────────────────────────────────────────────

app = FastAPI(
    title="Cryptographic Attribution & Decryption Provenance API",
    description=(
        "Forensic-grade Cryptographic Attribution System providing AES-256-GCM "
        "encryption with X25519 key wrapping, DCT-QIM watermarking, tamper-evident "
        "anchored ledger, and automated forensic tamper analysis."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for external web integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper Functions ─────────────────────────────────────────────────────────

async def save_uploaded_file(file: UploadFile) -> str:
    """Save an uploaded file to data/uploads/ and return its absolute path."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Missing file or filename in upload.")

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    clean_filename = os.path.basename(file.filename)
    ext = os.path.splitext(clean_filename)[1].lower()
    if ext != ".png":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PNG files are supported.",
        )

    save_path = os.path.join(UPLOADS_DIR, clean_filename)
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    return os.path.abspath(save_path)


def resolve_file_path(path_str: str) -> str:
    """Resolve a file path string to an existing absolute path."""
    path_str = path_str.strip().strip("'\"")
    if os.path.isfile(path_str):
        return os.path.abspath(path_str)
    cand1 = os.path.join(PROJECT_ROOT, path_str)
    if os.path.isfile(cand1):
        return os.path.abspath(cand1)
    cand2 = os.path.join(DATA_DIR, path_str)
    if os.path.isfile(cand2):
        return os.path.abspath(cand2)
    raise HTTPException(status_code=404, detail=f"File not found: '{path_str}'")


def resolve_package_dir(path_str: str) -> str:
    """Resolve an encrypted package directory."""
    path_str = path_str.strip().strip("'\"")
    if os.path.isdir(path_str):
        return os.path.abspath(path_str)
    cand1 = os.path.join(PROJECT_ROOT, path_str)
    if os.path.isdir(cand1):
        return os.path.abspath(cand1)
    cand2 = os.path.join(ENCRYPTED_DIR, path_str)
    if os.path.isdir(cand2):
        return os.path.abspath(cand2)
    if os.path.isfile(path_str):
        parent = os.path.dirname(os.path.abspath(path_str))
        if os.path.isfile(os.path.join(parent, "payload.enc")):
            return parent
    raise HTTPException(
        status_code=404,
        detail=f"Encrypted package directory not found: '{path_str}'",
    )


def is_valid_upload(obj) -> bool:
    """Return True if obj is an uploaded file with a filename."""
    return hasattr(obj, "filename") and bool(obj.filename)


# ── Pydantic Request Models ──────────────────────────────────────────────────

class DecryptRequest(BaseModel):
    package_path: Optional[str] = Field(
        default="data/encrypted/test_document",
        description="Path to encrypted package directory (e.g. 'data/encrypted/test_document')",
    )
    package: Optional[str] = Field(None, description="Alias for package_path")
    user: Optional[str] = Field(
        default="alice",
        description="User ID decrypting the file (e.g. 'alice')",
    )
    user_id: Optional[str] = Field(None, description="Alias for user")

    model_config = {
        "json_schema_extra": {
            "example": {
                "package_path": "data/encrypted/test_document",
                "user": "alice",
            }
        }
    }


class SetupRequest(BaseModel):
    users: list[str] = Field(
        default=["alice", "bob"],
        description="List of user IDs to generate keys for",
    )


# ── Root / Health ────────────────────────────────────────────────────────────

@app.get("/", summary="System Info and API Overview")
def root():
    return {
        "system": "Cryptographic Attribution & Decryption Provenance API",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "POST /encrypt": "Encrypt a PNG file for specified recipients",
            "POST /decrypt": "Decrypt package as authorized user and embed watermark",
            "POST /verify": "Verify leaked file and identify source user",
            "POST /report": "Generate full forensic tamper analysis JSON report",
            "GET /ledger": "Verify hash-chain and anchor integrity",
        },
    }


# ── Endpoint 1: Encrypt File ─────────────────────────────────────────────────

@app.post(
    "/encrypt",
    summary="Encrypt a PNG file for specified recipients",
    description="Encrypts a PNG file with AES-256-GCM and wraps the file key for each recipient using X25519 ECDH.",
)
async def encrypt_endpoint(
    file: Optional[UploadFile] = File(None, description="PNG file to upload and encrypt"),
    recipients: str = Form(..., description="Comma-separated recipient user IDs (e.g. 'alice,bob')"),
    file_path: Optional[str] = Form(None, description="Path to existing PNG file on server (alternative to upload)"),
):
    if is_valid_upload(file):
        target_path = await save_uploaded_file(file)
    elif isinstance(file_path, str) and file_path.strip():
        target_path = resolve_file_path(file_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either a PNG 'file' upload or 'file_path' must be provided.",
        )

    recipient_str = recipients if isinstance(recipients, str) else ""
    recipient_list = [r.strip() for r in recipient_str.split(",") if r.strip()]
    if not recipient_list:
        raise HTTPException(
            status_code=400,
            detail="At least one recipient user ID must be provided.",
        )

    try:
        pkg_dir = encrypt_file(target_path, recipient_list)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption error: {str(e)}")

    return {
        "status": "success",
        "encrypted_package_path": pkg_dir,
        "package_path": pkg_dir,
        "recipients": recipient_list,
        "original_file": target_path,
    }


# ── Endpoint 2: Decrypt File ─────────────────────────────────────────────────

@app.post(
    "/decrypt",
    summary="Decrypt an encrypted package as a user",
    description="Decrypts package, generates unique watermark ID, embeds via DCT-QIM, signs record, and logs to ledger.",
)
async def decrypt_endpoint(
    request: Request,
    req: Optional[DecryptRequest] = Body(None),
    package_path: Optional[str] = Query(None, description="Path to encrypted package directory"),
    user: Optional[str] = Query(None, description="User ID decrypting the file"),
):
    pkg = package_path if isinstance(package_path, str) else None
    usr = user if isinstance(user, str) else None
    if isinstance(req, DecryptRequest):
        pkg = req.package_path or req.package or pkg
        usr = req.user or req.user_id or usr

    # Also check form data if client submitted as form-data
    if not pkg or not usr:
        if request and hasattr(request, "headers"):
            content_type = request.headers.get("content-type", "")
            if "form" in content_type:
                form = await request.form()
                pkg = form.get("package_path") or form.get("package") or pkg
                usr = form.get("user") or form.get("user_id") or usr

    if not pkg or not usr:
        raise HTTPException(
            status_code=400,
            detail="Both 'package_path' (or 'package') and 'user' (or 'user_id') are required.",
        )

    resolved_pkg = resolve_package_dir(str(pkg))

    try:
        res = decrypt_file(resolved_pkg, str(usr))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "watermarked_image_path": res["output_path"],
        "output_path": res["output_path"],
        "watermark_id": res["watermark_id"],
        "file_id": res["file_id"],
        "user": str(usr),
        "ledger_block": res["block"]["index"],
    }


# ── Endpoint 3: Verify File ──────────────────────────────────────────────────

@app.post(
    "/verify",
    summary="Verify a leaked PNG file and identify the source user",
    description="Extracts embedded watermark using multi-signal analysis, checks CRC, computes confidence score, and queries ledger.",
)
async def verify_endpoint(
    file: Optional[UploadFile] = File(None, description="Suspected leaked PNG file to upload and verify"),
    file_path: Optional[str] = Form(None, description="Path to existing leaked PNG file on server (alternative to upload)"),
):
    if is_valid_upload(file):
        target_path = await save_uploaded_file(file)
    elif isinstance(file_path, str) and file_path.strip():
        target_path = resolve_file_path(file_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either a PNG 'file' upload or 'file_path' must be provided.",
        )

    try:
        res = verify_leaked_file(target_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    identified_user = res.get("user") or res.get("user_id")
    crc_ok = bool(res.get("crc_valid"))

    return {
        "status": res["status"],
        "user": identified_user,
        "user_identified": identified_user,
        "confidence": res.get("confidence", 0.0),
        "crc_status": "OK" if crc_ok else "FAILED",
        "crc_valid": crc_ok,
        "verdict": res.get("verdict"),
        "tamper_detected": res.get("tamper_detected"),
        "watermark_id": res.get("watermark_id"),
        "vote_ratio": res.get("vote_ratio"),
        "sync_score": res.get("sync_score"),
        "corruption": res.get("corruption"),
        "multi_signal_agreement": res.get("multi_signal_agreement"),
        "ledger_valid": res.get("ledger_valid"),
        "signature_valid": res.get("signature_valid"),
        "notes": res.get("notes", []),
        "reasoning": res.get("reasoning", ""),
        "verified_file": target_path,
    }


# ── Endpoint 4: Forensic Report ──────────────────────────────────────────────

@app.post(
    "/report",
    summary="Generate a forensic tamper analysis report",
    description="Performs multi-signal analysis, classifies tamper heuristics (crop, noise, compression, rotation), computes severity, and outputs a forensic JSON report.",
)
async def report_endpoint(
    file: Optional[UploadFile] = File(None, description="Suspected leaked PNG file to upload and analyze"),
    file_path: Optional[str] = Form(None, description="Path to existing leaked PNG file on server (alternative to upload)"),
):
    if is_valid_upload(file):
        target_path = await save_uploaded_file(file)
    elif isinstance(file_path, str) and file_path.strip():
        target_path = resolve_file_path(file_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either a PNG 'file' upload or 'file_path' must be provided.",
        )

    try:
        report, json_path = generate_report(target_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    report["saved_json_path"] = json_path
    return report




# ── Endpoint 5: Ledger Verify ────────────────────────────────────────────────

@app.get(
    "/ledger",
    summary="Verify ledger integrity and check periodic anchors",
    description="Verifies cryptographic hash-chain linkages and periodic secondary anchors to detect tampering or rollbacks.",
)
def ledger_endpoint():
    try:
        res = verify_ledger_with_anchors()
        chain = get_all_records()
        return {
            "ledger_status": res["ledger_status"],
            "chain_ok": res["chain_ok"],
            "anchor_ok": res["anchor_ok"],
            "message": res["message"],
            "total_blocks": len(chain),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ledger verification failed: {str(e)}",
        )


# ── Admin Helper: Setup Users ────────────────────────────────────────────────

@app.post(
    "/setup",
    summary="Generate keys for users",
    description="Generates Ed25519 signing keys and X25519 key exchange keys for a list of users.",
    tags=["Administration"],
)
def setup_endpoint(req: SetupRequest):
    from modules.crypto.encryption import generate_x25519_keypair
    from modules.crypto.signature import generate_keypair

    created = []
    for uid in req.users:
        generate_keypair(uid)
        generate_x25519_keypair(uid)
        created.append(uid)
    return {"status": "success", "users_setup": created}
