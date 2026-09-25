"""
api/server.py — Production-Grade REST API for Cryptographic Attribution & Provenance.

Features:
  - API Key Authentication (X-API-KEY header / query param)
  - In-memory rate limiting per client IP
  - Asynchronous background tasks for heavy endpoints (/encrypt, /decrypt, /report)
  - Job status tracking (GET /job/{job_id})
  - Secure file download endpoints (/download/decrypted, /download/report, /download/encrypted)
  - Operations dashboard & system health (GET /status)
  - 1-Click SIH Judge Demo Flow (POST /demo-run)
  - Standardized JSON responses with HTTP status codes
  - Request traceability (X-Request-ID) and performance logging (data/logs/)
  - Automated file retention and cleanup
"""

import io
import json
import os
import shutil
import sys
import time
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import (
    BackgroundTasks,
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    Security,
    UploadFile,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from api.cleanup import run_auto_cleanup
from api.jobs import job_manager
from api.security import rate_limiter, verify_api_key
from config import (
    DATA_DIR,
    DECRYPTED_DIR,
    ENCRYPTED_DIR,
    LOGS_DIR,
    REPORTS_DIR,
    UPLOADS_DIR,
)
from modules.crypto.decryption import decrypt_file
from modules.crypto.encryption import encrypt_file
from modules.forensics.report import generate_report
from modules.ledger.hashchain import get_all_records, verify_ledger_with_anchors
from modules.verification.verifier import verify_leaked_file

# Track server start time
SERVER_START_TIME = time.time()


# ── FastAPI App Configuration ────────────────────────────────────────────────

app = FastAPI(
    title="SANKET — Cryptographic Attribution & Provenance API",
    description=(
        "Production-grade REST API providing key-wrapped AES-256-GCM document encryption, "
        "DCT-QIM invisible watermarking, tamper-evident hash-chain ledger, and automated "
        "forensic tamper analysis with confidence scoring."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Response & Error Formatting ──────────────────────────────────────────────

def make_response(data: Any = None, error: Any = None, success: Optional[bool] = None) -> dict:
    """Format standardized API response and maintain backward compatibility."""
    if success is None:
        success = error is None

    resp = {
        "success": success,
        "data": data,
        "error": error,
    }
    # Backward compatibility: flatten dict keys to top-level if not conflicting
    if isinstance(data, dict):
        for k, v in data.items():
            if k not in resp:
                resp[k] = v
    return resp


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    headers = getattr(exc, "headers", None) or {}
    return JSONResponse(
        status_code=exc.status_code,
        content=make_response(data=None, error=exc.detail, success=False),
        headers=headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg") if errors else "Validation error"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=make_response(data=None, error=f"Validation error: {msg}", success=False),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=make_response(data=None, error=f"Internal server error: {str(exc)}", success=False),
    )


# ── Middleware: Rate Limiting & Performance Logging ──────────────────────────

def log_request_performance(entry: dict):
    """Write performance and request trace logs to data/logs/."""
    os.makedirs(LOGS_DIR, exist_ok=True)
    perf_path = os.path.join(LOGS_DIR, "performance.log")
    jsonl_path = os.path.join(LOGS_DIR, "requests.jsonl")

    try:
        with open(jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass

    try:
        line = (
            f"[{entry['timestamp']}] {entry['method']} {entry['endpoint']} -> "
            f"{entry['status_code']} | time: {entry['processing_time_ms']}ms | "
            f"size: {entry['file_size_bytes']}B | req: {entry['request_id']}\n"
        )
        with open(perf_path, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass


@app.middleware("http")
async def performance_and_security_middleware(request: Request, call_next):
    # 1. Unique Request ID
    req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    start_time = time.perf_counter()

    # 2. Rate Limiting Check (exempt docs and static paths)
    client_ip = request.client.host if request.client else "127.0.0.1"
    exempt_paths = {"/docs", "/redoc", "/openapi.json", "/"}
    if request.url.path not in exempt_paths:
        allowed, retry_after = rate_limiter.check(client_ip)
        if not allowed:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            log_request_performance({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": req_id,
                "client_ip": client_ip,
                "method": request.method,
                "endpoint": request.url.path,
                "status_code": 429,
                "processing_time_ms": duration_ms,
                "file_size_bytes": 0,
            })
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=make_response(
                    data=None,
                    error=f"Rate limit exceeded ({rate_limiter.limit} req/min). Retry after {retry_after}s.",
                    success=False,
                ),
                headers={"Retry-After": str(retry_after), "X-Request-ID": req_id},
            )

    # 3. Measure content size
    content_length = request.headers.get("content-length")
    file_size_bytes = int(content_length) if content_length and content_length.isdigit() else 0

    # 4. Process Request
    response = await call_next(request)

    # 5. Measure duration & attach headers
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Process-Time"] = f"{duration_ms}ms"

    # 6. Log performance
    log_request_performance({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": req_id,
        "client_ip": client_ip,
        "method": request.method,
        "endpoint": request.url.path,
        "status_code": response.status_code,
        "processing_time_ms": duration_ms,
        "file_size_bytes": file_size_bytes,
    })

    return response


# ── File Helpers & Security ──────────────────────────────────────────────────

def is_valid_upload(obj) -> bool:
    """Return True if obj is an uploaded file with a filename."""
    return hasattr(obj, "filename") and bool(obj.filename)


async def save_uploaded_file(file: UploadFile) -> str:
    """Save an uploaded file to data/uploads/ with sanitization and retention check."""
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

    # Run auto cleanup
    run_auto_cleanup()

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


def secure_resolve_download(base_dir: str, filename: str) -> str:
    """Resolve a file path for download with strict path traversal prevention."""
    clean_name = os.path.basename(filename)
    target = os.path.abspath(os.path.join(base_dir, clean_name))
    base_abs = os.path.abspath(base_dir)

    # Prevent directory escape
    if not target.startswith(base_abs) or not os.path.exists(target):
        raise HTTPException(status_code=404, detail=f"Requested resource '{filename}' not found.")
    return target


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


# ── Background Task Workers ──────────────────────────────────────────────────

def async_encrypt_worker(job_id: str, target_path: str, recipient_list: list[str]):
    try:
        pkg_dir = encrypt_file(target_path, recipient_list)
        run_auto_cleanup()
        pkg_name = os.path.basename(pkg_dir)
        job_manager.complete_job(job_id, {
            "status": "success",
            "encrypted_package_path": pkg_dir,
            "package_path": pkg_dir,
            "recipients": recipient_list,
            "original_file": target_path,
            "download_package_url": f"/download/encrypted/{pkg_name}",
        })
    except Exception as e:
        job_manager.fail_job(job_id, str(e))


def async_decrypt_worker(job_id: str, resolved_pkg: str, user_id: str):
    try:
        res = decrypt_file(resolved_pkg, user_id)
        run_auto_cleanup()
        filename = os.path.basename(res["output_path"])
        job_manager.complete_job(job_id, {
            "status": "success",
            "watermarked_image_path": res["output_path"],
            "output_path": res["output_path"],
            "watermark_id": res["watermark_id"],
            "file_id": res["file_id"],
            "user": user_id,
            "ledger_block": res["block"]["index"],
            "download_image_url": f"/download/decrypted/{filename}",
        })
    except Exception as e:
        job_manager.fail_job(job_id, str(e))


def async_report_worker(job_id: str, target_path: str):
    try:
        report, json_path = generate_report(target_path)
        run_auto_cleanup()
        report["saved_json_path"] = json_path
        report_id = report.get("report_id") or os.path.splitext(os.path.basename(json_path))[0]
        report["download_report_url"] = f"/download/report/{report_id}"
        job_manager.complete_job(job_id, report)
    except Exception as e:
        job_manager.fail_job(job_id, str(e))


# ── Public / Welcome Endpoint ────────────────────────────────────────────────

@app.get("/", summary="System Info and API Overview", tags=["Information"])
def root():
    return make_response({
        "system": "Cryptographic Attribution & Decryption Provenance API",
        "status": "online",
        "version": "2.0.0",
        "docs_url": "/docs",
        "auth_instructions": (
            "Authenticate protected endpoints using header 'X-API-KEY: sanket-admin-key-2026' "
            "or '?api_key=sanket-admin-key-2026'. Click 'Authorize' in Swagger UI."
        ),
        "endpoints": {
            "POST /demo-run": "1-Click automated full lifecycle demonstration (SIH Judge Mode)",
            "GET /status": "System dashboard, health, ledger metrics, and operations stats",
            "POST /encrypt": "Encrypt PNG file for recipients (Async / Sync)",
            "POST /decrypt": "Decrypt package as user & embed watermark (Async / Sync)",
            "POST /verify": "Verify leaked file and identify source user",
            "POST /report": "Generate full forensic tamper analysis report (Async / Sync)",
            "GET /job/{job_id}": "Check status and fetch result of background jobs",
            "GET /ledger": "Verify hash-chain and anchor integrity",
            "GET /download/decrypted/{filename}": "Download watermarked image",
            "GET /download/report/{report_id}": "Download forensic JSON report",
            "GET /download/encrypted/{package}": "Download encrypted package archive (.zip)",
        },
    })


# ── Endpoint: Dashboard & System Health ──────────────────────────────────────

@app.get("/status", summary="System Health and Operations Dashboard", tags=["Operations"])
def get_system_status(api_key: str = Depends(verify_api_key)):
    """Return comprehensive system health, ledger metrics, and file counts."""
    ledger_records = get_all_records()
    ledger_size = len(ledger_records)
    total_decryptions = ledger_size

    total_reports = 0
    if os.path.exists(REPORTS_DIR):
        total_reports = len([f for f in os.listdir(REPORTS_DIR) if f.endswith(".json")])

    uploads_count = len(os.listdir(UPLOADS_DIR)) if os.path.exists(UPLOADS_DIR) else 0
    encrypted_count = len(os.listdir(ENCRYPTED_DIR)) if os.path.exists(ENCRYPTED_DIR) else 0
    decrypted_count = len(os.listdir(DECRYPTED_DIR)) if os.path.exists(DECRYPTED_DIR) else 0
    total_files_processed = uploads_count + encrypted_count + decrypted_count

    anchors_file = os.path.join(DATA_DIR, "ledger", "anchors.json")
    last_anchor_index = None
    if os.path.exists(anchors_file):
        try:
            with open(anchors_file, "r") as f:
                anchors_data = json.load(f)
                if anchors_data:
                    last_anchor_index = anchors_data[-1].get("block_index")
        except Exception:
            pass

    verify_res = verify_ledger_with_anchors()
    health_status = "HEALTHY" if verify_res["ledger_status"] == "VALID" else "DEGRADED"

    uptime_sec = round(time.time() - SERVER_START_TIME, 1)

    status_data = {
        "system_health": health_status,
        "total_files_processed": total_files_processed,
        "total_decryptions": total_decryptions,
        "total_reports_generated": total_reports,
        "ledger_size": ledger_size,
        "last_anchor_index": last_anchor_index,
        "ledger_status": verify_res["ledger_status"],
        "chain_ok": verify_res["chain_ok"],
        "anchor_ok": verify_res["anchor_ok"],
        "uptime_seconds": uptime_sec,
        "job_stats": job_manager.stats(),
        "storage": {
            "uploads": uploads_count,
            "encrypted_packages": encrypted_count,
            "decrypted_images": decrypted_count,
            "reports": total_reports,
        },
    }
    return make_response(status_data)


# ── Endpoint: Job Status & Result ────────────────────────────────────────────

@app.get("/job/{job_id}", summary="Get background job status and result", tags=["Operations"])
def get_job_status(job_id: str, api_key: str = Depends(verify_api_key)):
    """Fetch status and outputs of an asynchronous background job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return make_response(job)


# ── Endpoint 1: Encrypt File (Async / Sync) ──────────────────────────────────

@app.post(
    "/encrypt",
    summary="Encrypt a PNG file for specified recipients",
    description="Encrypts a PNG file with AES-256-GCM and wraps key with X25519. Supports async processing (default) or sync execution.",
    tags=["Core Pipeline"],
)
async def encrypt_endpoint(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None, description="PNG file to upload and encrypt"),
    recipients: str = Form(..., description="Comma-separated recipient user IDs (e.g. 'alice,bob')"),
    file_path: Optional[str] = Form(None, description="Path to existing PNG file on server (alternative to upload)"),
    sync: bool = Query(False, description="If True, execute synchronously and return immediately"),
    api_key: str = Depends(verify_api_key),
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

    # Synchronous mode
    if sync:
        try:
            pkg_dir = encrypt_file(target_path, recipient_list)
            run_auto_cleanup()
            pkg_name = os.path.basename(pkg_dir)
            result_data = {
                "status": "success",
                "encrypted_package_path": pkg_dir,
                "package_path": pkg_dir,
                "recipients": recipient_list,
                "original_file": target_path,
                "download_package_url": f"/download/encrypted/{pkg_name}",
            }
            return make_response(result_data)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Encryption error: {str(e)}")

    # Asynchronous background job
    job_id = job_manager.create_job(
        task_type="encrypt",
        metadata={"file": target_path, "recipients": recipient_list},
    )
    background_tasks.add_task(async_encrypt_worker, job_id, target_path, recipient_list)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=make_response(
            data={
                "job_id": job_id,
                "status": "processing",
                "task_type": "encrypt",
                "check_status_url": f"/job/{job_id}",
                "recipients": recipient_list,
            }
        ),
    )


# ── Endpoint 2: Decrypt File (Async / Sync) ──────────────────────────────────

@app.post(
    "/decrypt",
    summary="Decrypt an encrypted package as a user",
    description="Decrypts package, generates unique watermark ID, embeds via DCT-QIM, signs record, and logs to ledger.",
    tags=["Core Pipeline"],
)
async def decrypt_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    req: Optional[DecryptRequest] = Body(None),
    package_path: Optional[str] = Query(None, description="Path to encrypted package directory"),
    user: Optional[str] = Query(None, description="User ID decrypting the file"),
    sync: bool = Query(False, description="If True, execute synchronously and return immediately"),
    api_key: str = Depends(verify_api_key),
):
    pkg = package_path if isinstance(package_path, str) else None
    usr = user if isinstance(user, str) else None
    if isinstance(req, DecryptRequest):
        pkg = req.package_path or req.package or pkg
        usr = req.user or req.user_id or usr

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

    # Synchronous mode
    if sync:
        try:
            res = decrypt_file(resolved_pkg, str(usr))
            run_auto_cleanup()
            filename = os.path.basename(res["output_path"])
            result_data = {
                "status": "success",
                "watermarked_image_path": res["output_path"],
                "output_path": res["output_path"],
                "watermark_id": res["watermark_id"],
                "file_id": res["file_id"],
                "user": str(usr),
                "ledger_block": res["block"]["index"],
                "download_image_url": f"/download/decrypted/{filename}",
            }
            return make_response(result_data)
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Asynchronous background job
    job_id = job_manager.create_job(
        task_type="decrypt",
        metadata={"package": resolved_pkg, "user": str(usr)},
    )
    background_tasks.add_task(async_decrypt_worker, job_id, resolved_pkg, str(usr))

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=make_response(
            data={
                "job_id": job_id,
                "status": "processing",
                "task_type": "decrypt",
                "user": str(usr),
                "check_status_url": f"/job/{job_id}",
            }
        ),
    )


# ── Endpoint 3: Verify File ──────────────────────────────────────────────────

@app.post(
    "/verify",
    summary="Verify a leaked PNG file and identify the source user",
    description="Extracts embedded watermark using multi-signal analysis, checks CRC, computes confidence score, and queries ledger.",
    tags=["Forensics & Verification"],
)
async def verify_endpoint(
    file: Optional[UploadFile] = File(None, description="Suspected leaked PNG file to upload and verify"),
    file_path: Optional[str] = Form(None, description="Path to existing leaked PNG file on server (alternative to upload)"),
    api_key: str = Depends(verify_api_key),
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

    result_data = {
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
    return make_response(result_data)


# ── Endpoint 4: Forensic Report (Async / Sync) ───────────────────────────────

@app.post(
    "/report",
    summary="Generate a forensic tamper analysis report",
    description="Performs multi-signal analysis, classifies tamper heuristics (crop, noise, compression, rotation), computes severity, and outputs a forensic JSON report.",
    tags=["Forensics & Verification"],
)
async def report_endpoint(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None, description="Suspected leaked PNG file to upload and analyze"),
    file_path: Optional[str] = Form(None, description="Path to existing leaked PNG file on server (alternative to upload)"),
    sync: bool = Query(False, description="If True, execute synchronously and return immediately"),
    api_key: str = Depends(verify_api_key),
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

    # Synchronous mode
    if sync:
        try:
            report, json_path = generate_report(target_path)
            run_auto_cleanup()
            report["saved_json_path"] = json_path
            report_id = report.get("report_id") or os.path.splitext(os.path.basename(json_path))[0]
            report["download_report_url"] = f"/download/report/{report_id}"
            return make_response(report)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Asynchronous background job
    job_id = job_manager.create_job(
        task_type="report",
        metadata={"file": target_path},
    )
    background_tasks.add_task(async_report_worker, job_id, target_path)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=make_response(
            data={
                "job_id": job_id,
                "status": "processing",
                "task_type": "report",
                "check_status_url": f"/job/{job_id}",
            }
        ),
    )


# ── Endpoint 5: Ledger Verify ────────────────────────────────────────────────

@app.get(
    "/ledger",
    summary="Verify ledger integrity and check periodic anchors",
    description="Verifies cryptographic hash-chain linkages and periodic secondary anchors to detect tampering or rollbacks.",
    tags=["Ledger & Governance"],
)
def ledger_endpoint(api_key: str = Depends(verify_api_key)):
    try:
        res = verify_ledger_with_anchors()
        chain = get_all_records()
        result_data = {
            "ledger_status": res["ledger_status"],
            "chain_ok": res["chain_ok"],
            "anchor_ok": res["anchor_ok"],
            "message": res["message"],
            "total_blocks": len(chain),
        }
        return make_response(result_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ledger verification failed: {str(e)}",
        )


# ── Download Endpoints ───────────────────────────────────────────────────────

@app.get(
    "/download/decrypted/{filename}",
    summary="Download watermarked decrypted image",
    tags=["Downloads"],
)
def download_decrypted_image(filename: str, api_key: str = Depends(verify_api_key)):
    """Securely download a watermarked image."""
    filepath = secure_resolve_download(DECRYPTED_DIR, filename)
    clean_name = os.path.basename(filepath)
    return FileResponse(filepath, media_type="image/png", filename=clean_name)


@app.get(
    "/download/report/{report_id}",
    summary="Download forensic analysis report JSON",
    tags=["Downloads"],
)
def download_forensic_report(report_id: str, api_key: str = Depends(verify_api_key)):
    """Securely download a generated forensic report JSON."""
    fname = report_id if report_id.endswith(".json") else f"{report_id}.json"
    filepath = secure_resolve_download(REPORTS_DIR, fname)
    clean_name = os.path.basename(filepath)
    return FileResponse(filepath, media_type="application/json", filename=clean_name)


@app.get(
    "/download/encrypted/{package_name}",
    summary="Download encrypted package as zip archive",
    tags=["Downloads"],
)
def download_encrypted_package(package_name: str, api_key: str = Depends(verify_api_key)):
    """Securely package and stream an encrypted package folder as a .zip."""
    clean_pkg = os.path.basename(package_name)
    pkg_dir = os.path.abspath(os.path.join(ENCRYPTED_DIR, clean_pkg))
    base_abs = os.path.abspath(ENCRYPTED_DIR)

    if not pkg_dir.startswith(base_abs) or not os.path.isdir(pkg_dir):
        raise HTTPException(
            status_code=404,
            detail=f"Encrypted package '{package_name}' not found.",
        )

    # Create zip archive in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(pkg_dir):
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, pkg_dir)
                z.write(full_path, arcname)

    zip_buffer.seek(0)
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{clean_pkg}.zip"'},
    )


# ── SIH Demo Mode Endpoint ───────────────────────────────────────────────────

@app.post(
    "/demo-run",
    summary="Run automated end-to-end provenance demonstration (SIH Judge Mode)",
    description=(
        "Executes a complete 6-stage lifecycle in one click: 1) Sets up test users, "
        "2) Encrypts document with key wrapping, 3) Decrypts & embeds watermarks for Alice & Bob, "
        "4) Simulates a crop/tamper leak attack, 5) Generates forensic attribution report, "
        "6) Verifies anchored hash-chain ledger integrity."
    ),
    tags=["Demonstration"],
)
async def demo_run(api_key: str = Depends(verify_api_key)):
    """
    Automated end-to-end demonstration for evaluators and judges.
    Executes full flow and returns all outputs in a single structured JSON response.
    """
    from PIL import Image, ImageDraw
    from modules.crypto.encryption import generate_x25519_keypair
    from modules.crypto.signature import generate_keypair

    # 1. Setup users
    demo_users = ["alice", "bob"]
    for u in demo_users:
        generate_keypair(u)
        generate_x25519_keypair(u)

    # 2. Sample file check / creation
    sample_file = os.path.join(DATA_DIR, "test_document.png")
    if not os.path.exists(sample_file):
        img = Image.new("RGBA", (256, 256), color=(240, 240, 245, 255))
        d = ImageDraw.Draw(img)
        d.text((30, 110), "SANKET CONFIDENTIAL", fill=(30, 30, 80, 255))
        img.save(sample_file)

    # 3. Encrypt for recipients
    pkg_dir = encrypt_file(sample_file, demo_users)

    # 4. Decrypt for Alice and Bob
    res_alice = decrypt_file(pkg_dir, "alice")
    res_bob = decrypt_file(pkg_dir, "bob")

    # 5. Simulate Attack: Leak Alice's file with crop/tamper
    alice_img = Image.open(res_alice["output_path"]).convert("RGBA")
    attacked_img = alice_img.copy()
    pixels = attacked_img.load()
    # In-place fill a 40x40 square with gray
    for x in range(30, 70):
        for y in range(30, 70):
            pixels[x, y] = (128, 128, 128, 255)

    attacked_path = os.path.join(UPLOADS_DIR, "demo_attacked_alice.png")
    attacked_img.save(attacked_path)

    # 6. Run Forensic Report on attacked file
    report_attacked, json_path_attacked = generate_report(attacked_path)

    # 7. Ledger verification
    ledger_status = verify_ledger_with_anchors()

    # Automatic cleanup
    run_auto_cleanup()

    demo_data = {
        "status": "DEMO_COMPLETED_SUCCESSFULLY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "step_1_users_created": demo_users,
        "step_2_encrypted_package": {
            "source_file": sample_file,
            "package_path": pkg_dir,
            "recipients": demo_users,
            "cipher": "AES-256-GCM + X25519 Key Wrapping",
        },
        "step_3_decryptions": [
            {
                "user": "alice",
                "watermark_id": res_alice["watermark_id"],
                "watermarked_image": res_alice["output_path"],
                "ledger_block": res_alice["block"]["index"],
            },
            {
                "user": "bob",
                "watermark_id": res_bob["watermark_id"],
                "watermarked_image": res_bob["output_path"],
                "ledger_block": res_bob["block"]["index"],
            },
        ],
        "step_4_attack_simulation": {
            "leaked_by": "alice",
            "attack_type": "Cropping / Tamper (40x40 pixel block fill)",
            "attacked_file": attacked_path,
        },
        "step_5_forensic_attribution": {
            "identified_user": report_attacked["user"],
            "attribution_success": report_attacked["user"] == "alice",
            "confidence_score": report_attacked["confidence"],
            "verdict": report_attacked["verdict"],
            "crc_status": "OK" if report_attacked["crc_valid"] else "FAILED",
            "tamper_detected": report_attacked["tamper_detected"],
            "tamper_type": report_attacked["tamper_type"],
            "sync_score": report_attacked["sync_score"],
            "corruption_pct": report_attacked["corruption_pct"],
            "report_id": report_attacked["report_id"],
            "saved_report": json_path_attacked,
        },
        "step_6_ledger_integrity": {
            "chain_ok": ledger_status["chain_ok"],
            "anchor_ok": ledger_status["anchor_ok"],
            "ledger_status": ledger_status["ledger_status"],
            "total_blocks": len(get_all_records()),
        },
    }
    return make_response(demo_data)


# ── Admin Helper: Setup Users ────────────────────────────────────────────────

@app.post(
    "/setup",
    summary="Generate keys for users",
    description="Generates Ed25519 signing keys and X25519 key exchange keys for a list of users.",
    tags=["Administration"],
)
def setup_endpoint(req: SetupRequest, api_key: str = Depends(verify_api_key)):
    from modules.crypto.encryption import generate_x25519_keypair
    from modules.crypto.signature import generate_keypair

    created = []
    for uid in req.users:
        generate_keypair(uid)
        generate_x25519_keypair(uid)
        created.append(uid)
    return make_response({"status": "success", "users_setup": created})
