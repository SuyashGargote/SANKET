# SANKET — Provenance-Based Digital Forensics Using Watermarking and Decentralized Ledgers

**Phase 1 — Working Prototype with Forensic Verification Layer**

A local, modular system that encrypts documents for multi-recipient distribution, embeds unique **DCT-domain invisible watermarks** on each decryption, logs events to a tamper-evident hash-chain ledger, and identifies the source of leaked files with **forensic-grade confidence scoring** — even after JPEG compression, cropping, rotation, resizing, or noise attacks.

---

## Quick Start

### 1. Start Backend API Server
```bash
# Install Python dependencies
pip install -r requirements.txt

# Launch FastAPI server (Port 8000)
uvicorn api.server:app --reload
```
- Interactive Swagger UI: 👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

### 2. Start Frontend Web Dashboard
```bash
# Navigate to frontend and start Vite dev server
cd frontend
npm install
npm run dev
```
- Interactive Web Dashboard: 👉 **[http://localhost:5173](http://localhost:5173)**

### 3. Run Full CLI Demo (Terminal)
```bash
python main.py demo
```

---

## 🖥️ Enterprise Web Dashboard & User Workflow

SANKET features a modern, clean enterprise UI modeled after secure enterprise workspaces (ProtonDrive / Box DLP):

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. Alice Sends ➔ 2. Bob Receives ➔ 3. Bob Opens (Watermarked) ➔ 4. Leak Occurs ➔ 5. Source Detected │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Workflow Architecture & 4 Core Tabs:
* **Tab 1: Send File** — AES-256-GCM payload encryption with per-recipient X25519 ECDH key encapsulation.
* **Tab 2: My Files** — Split view for **Received Files** and **Sent Files**.
  * View sender, recipients, timestamps, and package hashes.
  * Click **"Open / Decrypt"** to unlock in a secure document modal.
  * Automatically embeds recipient-unique invisible DCT watermark + signs audit block into ledger.
  * Direct **"Simulate Leak & Test Detection"** one-click trigger.
* **Tab 3: Leak Investigation** — Forensic-grade attribution designed for maximum clarity:
  * **Big Centered Result Screen**: Immediate verdict banner: `LEAK SOURCE IDENTIFIED: BOB (94.5% CONFIDENCE)`.
  * **Side-by-Side Attack Visualization**: Clear before/after comparison with a pulsating red bounding box highlighting the exact tampered region.
  * **Plain-English Explanation**: 3 concise bullet points explaining watermark extraction, CRC validation, and mathematical non-repudiation.
  * **Deep Telemetry Drawer**: Expandable panel for technical auditors (CRC-16, Sync strength, QIM delta, Multi-signal 3/3 consensus).
* **Tab 4: Anchored Ledger** — Interactive node graph:
  * Rendered blockchain-style blocks with `prev_hash ➔ hash` arrows.
  * Color coded: **Green** for valid blocks, **Gold** for anchor checkpoints (every 5 blocks), **Red** for broken chain.
  * Includes a **Tamper Simulator** button to demonstrate instant tamper detection and anchor mismatch warnings.

### 2. 10-Second Judge Demonstration Flow:
1. **Switch user to Alice** (top-right header switcher).
2. Go to **"Send File"** ➔ click **"Use Sample Document"** ➔ click **"Encrypt & Dispatch to Bob"**.
3. **Switch user to Bob** (header switcher).
4. Go to **"My Files"** ➔ click **"Open / Decrypt"** on the received document.
5. In the Document Viewer modal, click **"Simulate Leak & Test Detection"**.
6. Observe the **Big Centered Verdict Screen** with 94%+ confidence identifying **Bob** as the leaker!

---

## CLI Commands

### 1. Setup users (generate keys)
```bash
python main.py setup --users "alice,bob,charlie"
```
Generates **Ed25519** (signing) and **X25519** (key exchange) keypairs per user in `data/keys/<user>/`.

### 2. Encrypt a PNG file
```bash
python main.py encrypt --file path/to/image.png --recipients "alice,bob"
```
Produces an encrypted package in `data/encrypted/` containing `payload.enc` + `metadata.json` (per-recipient wrapped keys).

### 3. Decrypt as a user
```bash
python main.py decrypt --package data/encrypted/image --user alice
```
Decrypts → generates unique watermark → embeds watermark → signs record → appends to ledger → saves watermarked PNG.

### 4. Verify a leaked file (forensic report)
```bash
python main.py verify --file path/to/leaked.png
```

**Example output:**
```
  ┌──────────────────────────────────────────────┐
  │       FORENSIC VERIFICATION REPORT           │
  └──────────────────────────────────────────────┘

  [RESULT]
    User        : alice
    Confidence  : 81.0%
    Verdict     : HIGH_CONFIDENCE
    Status      : IDENTIFIED

  [DETAILS]
    CRC         : OK
    Votes       : 100.0%
    Sync        : Strong (100.0%)
    Corruption  : None (0.0%)
    Multi-signal: 3/3 agree
    Tamper      : None

  [NOTES]
    • CRC checksum validated
    • Watermark stable across blur and JPEG perturbation
    • Strong sync template (100.0%)

  🔍 LEAK SOURCE IDENTIFIED
    User ID      : alice
    Watermark    : 770ff17a35990295548c8abf72477343
    Timestamp    : 2026-09-22T15:23:47.123456+00:00
    Nonce        : 45d3673d3245ea22...
```

### 5. Generate forensic analysis report
```bash
python main.py report --file path/to/leaked.png
```
Generates a full forensic report with tamper classification and severity scoring. Saves JSON to `data/reports/` and prints to console.

**Example output:**
```
  ========================================================
                  FORENSIC ANALYSIS REPORT
  ========================================================

  Report ID  : RPT-20260923-175639
  File       : test_document_alice_d048875a.png
  File Hash  : b836608bc6bd9bdb...
  Generated  : 2026-09-23T17:56:39+00:00

  -- ATTRIBUTION ---------------------------------------
    User         : alice
    Watermark    : d048875ab8454e97359f722e1a32055e
    Confidence   : 81.0%
    Verdict      : HIGH_CONFIDENCE
    Status       : IDENTIFIED

  -- SIGNAL ANALYSIS ------------------------------------
    CRC          : OK
    Vote Ratio   : 100.0%
    Sync         : Strong (100.0%)
    Corruption   : 22.7%
    Multi-signal : 2/3 agree

  -- TAMPER ANALYSIS ------------------------------------
    Detected     : YES
    Type         : Crop
    Severity     : MEDIUM
    > High corruption (22.7%) with intact sync ...

  -- LEDGER ---------------------------------------------
    Chain Valid  : YES
    Signature    : VALID
    Block #      : 2
    Timestamp    : 2026-09-23T17:53:25+00:00

  -- NOTES ----------------------------------------------
    * CRC checksum validated
    * Moderate corruption: 22.7% of blocks affected
    * Strong sync template (100.0%)

  ========================================================

  [SAVED] Report: data/reports/RPT-20260923-175639.json
```

### 6. View and verify ledger
```bash
python main.py ledger
```

### 7. Run full demo
```bash
python main.py demo
```

---

## REST API Layer (Production-Ready)

SANKET exposes a high-performance, asynchronous REST API built with **FastAPI** for integration into external web dashboards, investigation tools, and enterprise workflows.

### Start the API Server
```bash
uvicorn api.server:app --reload
```
- **Interactive Swagger UI**: 👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**
- **ReDoc API Spec**: 👉 **[http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)**

---

### Authentication & Rate Limiting

- **API Key Header**: `X-API-KEY: <key>` (or query parameter `?api_key=<key>`)
- **Default Keys**: `sanket-admin-key-2026`, `sih-judge-key-2026`, `sanket-dev-key`
- **Rate Limit**: 120 requests/minute per client IP (sliding window with `Retry-After` header)
- **Traceability**: Unique `X-Request-ID` attached to all logs and response headers
- **Audit Logs**: Stored in `data/logs/performance.log` and `data/logs/requests.jsonl`

---

### API Endpoints

| Method | Endpoint | Description | Input | Output |
|---|---|---|---|---|
| `POST` | `/demo-run` | **1-Click Full SIH Judge Demo** | *None* | Complete 6-stage lifecycle JSON |
| `GET` | `/status` | **System Health & Metrics Dashboard** | *None* | Ledger size, health, decryptions, files |
| `POST` | `/encrypt` | Encrypt PNG for recipients (Async/Sync) | `file`, `recipients`, `?sync=true` | `job_id` (async) or `package_path` |
| `POST` | `/decrypt` | Decrypt as user & watermark (Async/Sync) | `package_path`, `user`, `?sync=true` | `job_id` (async) or `watermarked_path` |
| `POST` | `/verify` | Verify leaked file & identify user | `file` (PNG upload) | `user`, `confidence`, `crc_status` |
| `POST` | `/report` | Generate forensic report (Async/Sync) | `file` (PNG upload), `?sync=true` | `job_id` (async) or full forensic JSON |
| `GET` | `/job/{job_id}` | Check status and result of async job | `job_id` | Status (`processing`/`completed`), result |
| `GET` | `/ledger` | Verify hash-chain & periodic anchors | *None* | `ledger_status`, `chain_ok`, `anchor_ok` |
| `GET` | `/download/decrypted/{file}` | Secure download of watermarked image | `filename` | Image binary (`image/png`) |
| `GET` | `/download/report/{id}` | Secure download of forensic report JSON | `report_id` | Report JSON (`application/json`) |
| `GET` | `/download/encrypted/{pkg}` | Secure download of encrypted package | `package_name` | Package zip archive (`application/zip`) |

---

### How Attribution Works (Simple Explanation)

1. **Decryption Provenance**: Plaintext bytes are NEVER saved to disk or returned to the user unwatermarked. During decryption, a unique 128-bit watermark ID is deterministically generated from `SHA256(user_id + file_id + timestamp + nonce)` and embedded directly into the DCT domain of the image.
2. **Ed25519 Non-Repudiation**: The decrypting user's private key signs `{watermark_id, user_id, file_id, timestamp, nonce}`, and this record is cryptographically sealed into an append-only hash-chain ledger.
3. **Multi-Signal Forensic Extraction**: When a suspected leak surfaces, the verification engine extracts the watermark under multiple signal transformations (original, Gaussian blur, JPEG Q85).
4. **Resilience & Tamper Classification**:
   - **Sync Template**: Recovers from image rotation and affine attacks.
   - **CRC-16 Checksum**: Mathematically confirms bitstring integrity without false positives.
   - **Heuristic Classifier**: Pinpoints whether the image was cropped, compressed, or corrupted.
5. **Confidence Score**: Combines vote consensus (60%), CRC validity (+25%), sync score (+15%), and corruption penalties to output a forensic decision (`HIGH_CONFIDENCE`, `MEDIUM`, `LOW`, `REJECT`).

---

### End-to-End Demo Flow (`POST /demo-run`)

Clicking **Execute** on `POST /demo-run` runs an automated 6-step lifecycle:
```
[Step 1: Setup Users]        --> Generates Ed25519 & X25519 keys for Alice and Bob
[Step 2: Key-Wrapped Encrypt] --> Encrypts PNG via AES-256-GCM + X25519 ECDH
[Step 3: Dual Decryption]    --> Alice and Bob decrypt independently; unique watermarks embedded
[Step 4: Tamper Attack]      --> Simulates hostile crop & fill attack on Alice's file
[Step 5: Forensic Analysis]  --> Verifies attacked file, confirms Alice as source (80%+ confidence)
[Step 6: Ledger Audit]       --> Validates hash-chain integrity & periodic anchors
```

---

### Code Examples

#### cURL
```bash
# 1. Run 1-Click Judge Demo
curl -X POST "http://127.0.0.1:8000/demo-run" \
  -H "X-API-KEY: sanket-admin-key-2026"

# 2. Check System Dashboard
curl -X GET "http://127.0.0.1:8000/status" \
  -H "X-API-KEY: sanket-admin-key-2026"

# 3. Encrypt a File (Synchronous mode)
curl -X POST "http://127.0.0.1:8000/encrypt?sync=true" \
  -H "X-API-KEY: sanket-admin-key-2026" \
  -F "file=@data/test_document.png" \
  -F "recipients=alice,bob"

# 4. Decrypt as Alice
curl -X POST "http://127.0.0.1:8000/decrypt?sync=true" \
  -H "X-API-KEY: sanket-admin-key-2026" \
  -H "Content-Type: application/json" \
  -d '{"package_path": "data/encrypted/test_document", "user": "alice"}'

# 5. Verify Leaked File
curl -X POST "http://127.0.0.1:8000/verify" \
  -H "X-API-KEY: sanket-admin-key-2026" \
  -F "file=@data/decrypted/test_document_alice_758e9fe9.png"
```

#### Python
```python
import requests

BASE = "http://127.0.0.1:8000"
HEADERS = {"X-API-KEY": "sanket-admin-key-2026"}

# 1. Run 1-Click Judge Demo
demo_res = requests.post(f"{BASE}/demo-run", headers=HEADERS).json()
attribution = demo_res["data"]["step_5_forensic_attribution"]
print("Identified Leaker:", attribution["identified_user"])
print("Confidence Score:", attribution["confidence_score"], "%")

# 2. Check System Status
status = requests.get(f"{BASE}/status", headers=HEADERS).json()
print("System Health   :", status["data"]["system_health"])
print("Ledger Size     :", status["data"]["ledger_size"])
```

---

## System Architecture

### Encryption & Decryption Pipeline

```
Original PNG
    │
    ▼
┌─────────────────────────────────┐
│  AES-256-GCM Encryption        │
│  Per-recipient X25519 ECDH      │
│  key wrapping (HKDF-SHA256)     │
└───────────┬─────────────────────┘
            │
            ▼
    Encrypted Package
    (payload.enc + metadata.json)
            │
            ▼
┌─────────────────────────────────┐
│  Secure Decryption Pipeline     │
│                                 │
│  1. Decrypt (raw bytes NEVER    │
│     returned to caller)         │
│  2. Generate watermark_id =     │
│     SHA256(user+file+time+nonce)│
│  3. Embed watermark (DCT+QIM)  │
│  4. Sign record (Ed25519)       │
│  5. Append to hash-chain ledger │
└───────────┬─────────────────────┘
            │
            ▼
    Watermarked PNG Output
```

### Forensic Verification Pipeline

```
Leaked PNG
    │
    ▼
┌─────────────────────────────────┐
│  Multi-Signal Extraction        │
│  1. Extract from original       │
│  2. Extract from blurred copy   │
│  3. Extract from JPEG Q85 copy  │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  Signal Analysis                │
│  • Sync template scoring        │
│  • Block corruption ratio       │
│  • Multi-signal stability       │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  Confidence Scoring Engine      │
│  Base  = vote_ratio × 60  /60  │
│  CRC   = +25 if valid     /25  │
│  Sync  = +15 if strong    /15  │
│  Corruption = -10 to -25       │
│  ─────────────────────────      │
│  Score = 0–100                  │
│  Verdict = HIGH / MED / LOW /   │
│            REJECT               │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  Ledger Lookup + Signature      │
│  Verification (Ed25519)         │
└───────────┬─────────────────────┘
            │
            ▼
    Forensic Tamper Analysis Report
```

---

## Project Structure

```
ps237/
├── config.py                          # Global paths, constants, security & retention config
├── main.py                            # CLI entry point (8 commands)
├── requirements.txt                   # Python dependencies (FastAPI, cryptography, etc.)
│
├── api/                               # Production REST API layer
│   ├── server.py                      # FastAPI server with 11 endpoints + Swagger docs
│   ├── security.py                    # API Key auth & in-memory sliding-window rate limiter
│   ├── jobs.py                        # Thread-safe background task queue & job manager
│   └── cleanup.py                     # Automatic file retention & directory cleanup
│
├── modules/
│   ├── crypto/
│   │   ├── encryption.py              # AES-256-GCM encrypt + X25519 key wrapping
│   │   ├── decryption.py              # Secure decrypt -> watermark -> sign -> log pipeline
│   │   └── signature.py               # Ed25519 keypair generation, signing, verification
│   │
│   ├── watermark/
│   │   ├── embedder.py                # Multi-coeff DCT + QIM embedding + sync template
│   │   └── extractor.py               # Zone-interleaved extraction + rotation recovery
│   │
│   ├── ledger/
│   │   └── hashchain.py               # Append-only hash chain + anchor + backup
│   │
│   ├── verification/
│   │   ├── verifier.py                # Forensic verification orchestrator
│   │   ├── confidence.py              # Confidence scoring engine (0-100)
│   │   └── forensic.py                # Multi-signal extraction + signal analysis
│   │
│   └── forensics/
│       └── report.py                  # Report generator + tamper classification + severity
│
├── utils/
│   └── helpers.py                     # File validation, ID generation, CRC-16
│
├── tests/
│   └── demo.py                        # End-to-end CLI demo (24 test steps)
│
└── data/
    ├── keys/                          # Per-user keypairs (Ed25519 + X25519)
    ├── encrypted/                     # Encrypted packages (.enc + metadata.json)
    ├── decrypted/                     # Watermarked output PNGs
    ├── ledger/                        # ledger.json + anchor.json + anchors.json
    ├── reports/                       # Forensic JSON reports (RPT-*.json)
    ├── uploads/                       # Temporary API upload storage
    └── logs/                          # performance.log + requests.jsonl
```


---

## Cryptographic Components

### Encryption Layer
| Component | Algorithm | Detail |
|-----------|-----------|--------|
| File encryption | AES-256-GCM | 256-bit key, 96-bit nonce, authenticated encryption |
| Key exchange | X25519 ECDH | Ephemeral keypair per recipient per file |
| Key derivation | HKDF-SHA256 | Derives 256-bit wrapping key from ECDH shared secret |
| Key wrapping | AES-256-GCM | File key encrypted per-recipient under derived wrapping key |

### Signature Layer
| Component | Algorithm | Detail |
|-----------|-----------|--------|
| Record signing | Ed25519 | Signs canonical JSON of 5 fields: watermark_id, user_id, file_id, timestamp, nonce |
| Verification | Ed25519 | Verifies signature against user's public key |

### Ledger
| Component | Detail |
|-----------|--------|
| Structure | Append-only hash chain (SHA-256 block linkage) |
| Anchor | Independent file storing latest block hash + chain length |
| Backup | Full ledger copy updated on every write |
| Verification | Full chain integrity check (hash linkage + anchor consistency) |

---

## Watermark Engine

### Embedding Architecture

The watermark uses **multi-coefficient DCT + Quantization Index Modulation (QIM)** with zone-interleaved spread-spectrum and a synchronization template.

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Block size | 8×8 pixels | Standard DCT block |
| Watermark coefficients | (2,2), (3,1), (1,3), (2,3) | 4 mid-frequency DCT positions per block |
| Spread factor | 2 zones | Each bit embedded in 2 spatially separated zones |
| Redundancy | 3× | Entire watermark repeated 3 times |
| **Votes per bit** | **24** | 4 coefficients × 2 zones × 3 copies |
| QIM delta | 38–62 (adaptive) | Varies with block variance for imperceptibility |
| Sync coefficient | (4,2) | Separate from watermark; used for rotation recovery |
| Sync delta | 80 | Strong QIM for robust sync detection |
| Sync pattern | 4×4 periodic binary | Deterministic pattern for angle search |
| Payload | 128-bit watermark + 16-bit CRC | 144 bits total per copy |

### Extraction & Recovery

| Feature | Detail |
|---------|--------|
| Majority voting | Per-bit voting across all 24 votes, then cross-copy voting |
| CRC-16 validation | CCITT checksum validates extracted watermark integrity |
| Corruption detection | Blocks with variance < 15 are skipped (gray fill, rotation borders) |
| Rotation recovery | Try-and-verify across ±5.5° at 0.25° resolution using sync template |
| Sync pre-filter | Quick sync correlation rejects unlikely rotation candidates |

---

## Forensic Verification Layer

### Confidence Scoring Engine

The system produces a **0–100 confidence score** with a categorical verdict instead of binary match/no-match.

**Scoring formula:**

| Signal | Contribution | Range |
|--------|-------------|-------|
| Vote ratio (inter-copy agreement) | Base = ratio × 60 | 0 – 60 |
| CRC-16 checksum | +25 if valid | 0 or 25 |
| Sync template correlation | +15 if ≥ 75%, +8 if ≥ 60% | 0, 8, or 15 |
| Corruption (low-variance blocks) | -10 / -20 / -25 penalty | 0 to -25 |

**Hard rejection rules (false positive protection):**
- Vote ratio < 60% → immediate `REJECT`
- CRC invalid AND vote ratio < 70% → `REJECT` (false positive guard)
- Corruption > 80% → `REJECT` (all-zero default detection)

**Verdict thresholds:**

| Score | Verdict |
|-------|---------|
| ≥ 80 | `HIGH_CONFIDENCE` |
| ≥ 55 | `MEDIUM` |
| ≥ 30 | `LOW` |
| < 30 | `REJECT` |

### Multi-Signal Verification

Instead of a single extraction, the system runs watermark extraction on **three versions** of the image:

1. **Original** — primary extraction
2. **Gaussian blurred** (kernel 3×3, σ=0.8) — tests watermark stability
3. **JPEG Q85 re-compressed** — simulates common re-encoding

If the same watermark_id appears in all three → **strong confidence**.  
If mismatch → **confidence downgraded** (effective vote_ratio × 0.85 penalty).

### Tamper Analysis Report

Every verification returns a structured forensic report:

```json
{
  "report_id": "RPT-20260923-175639",
  "generated_at": "2026-09-23T17:56:39.447545+00:00",
  "file_path": "D:\\SIH\\ps237\\data\\decrypted\\test_document_alice.png",
  "file_hash": "b836608bc6bd9bdb2fccbe34f795e368...",
  "user": "alice",
  "watermark_id": "d048875ab8454e97359f722e1a32055e",
  "status": "identified",
  "confidence": 81.0,
  "verdict": "HIGH_CONFIDENCE",
  "reasoning": "Base 51.0/60 from vote ratio 85.0%; CRC valid: +25; Strong sync: +15; Moderate corruption: -10",
  "crc_valid": true,
  "vote_ratio": 1.0,
  "sync_score": 1.0,
  "sync_strength": "Strong",
  "corruption_pct": 22.7,
  "multi_signal_agreement": 2,
  "multi_signal_stable": false,
  "tamper_detected": true,
  "tamper_type": "crop",
  "tamper_details": [
    "High corruption (22.7%) with intact sync -- large uniform-fill regions suggest cropping"
  ],
  "severity": "MEDIUM",
  "ledger_valid": true,
  "signature_valid": true,
  "notes": [
    "CRC checksum validated",
    "Moderate corruption: 22.7% of blocks affected",
    "Multi-signal instability: 2/3 extractions agree",
    "Strong sync template (100.0%)"
  ],
  "ledger_record": {
    "index": 2,
    "timestamp": "2026-09-23T17:53:25.284157+00:00",
    "nonce": "d31452b17f329e94cb5d79fc1c2cdfb2"
  }
}
```

---

## Robustness Test Results (from demo)

### Attacks that survive ✅

| Attack | Confidence | CRC |
|--------|-----------|-----|
| JPEG Q90 | 100% agreement | ✅ Valid |
| JPEG Q70 | 100% agreement | ✅ Valid |
| JPEG Q50 | 100% agreement | ✅ Valid |
| Resize 75% down + back up | 100% agreement | ✅ Valid |
| Gaussian noise σ=3 | 100% agreement | ✅ Valid |
| Gaussian noise σ=5 | 100% agreement | ✅ Valid |
| Gaussian noise σ=10 | 100% agreement | ✅ Valid |
| Gaussian noise σ=15 | 99.3% agreement | ✅ Valid |
| Pixel modification (200px) | Identified | ✅ Valid |
| Crop 10% (gray fill) | 94.4% agreement | ✅ Valid |
| Crop 20% (gray fill) | 90.3% agreement | ✅ Valid |
| Multi-cycle JPEG Q70 ×2 | 100% agreement | ✅ Valid |
| Multi-cycle JPEG Q70 ×3 | 100% agreement | ✅ Valid |
| Crop 10% + JPEG Q70 | 95.1% agreement | ✅ Valid |
| Crop 10% + Noise σ=5 | 96.5% agreement | ✅ Valid |
| Rotation +1° / +3° / +5° | 87–90% agreement | ✅ Valid |

### Attacks that fail ❌

| Attack | Reason |
|--------|--------|
| Crop 30% | Too many watermark blocks destroyed |
| Rotation (some negative angles) | Interpolation asymmetry in recovery |
| Rotate +5° + JPEG Q70 | Combined geometric + lossy too aggressive |

### False positive rejection ✅

| Input | Verdict | Confidence |
|-------|---------|-----------|
| Random noise image | REJECT | 0.0% |
| Solid gray image | REJECT | 0.0% |
| Unrelated gradient image | REJECT | 0.0% |

---

## Feature Status

| Feature | Status |
|---------|--------|
| AES-256-GCM file encryption | ✅ Done |
| Per-recipient X25519 ECDH key wrapping | ✅ Done |
| HKDF-SHA256 key derivation | ✅ Done |
| Secure decrypt pipeline (raw bytes never exposed) | ✅ Done |
| Watermark ID with nonce (unique per session) | ✅ Done |
| Multi-coefficient DCT + QIM embedding (4 coefficients) | ✅ Done |
| Zone-interleaved spread-spectrum (2 zones) | ✅ Done |
| Watermark redundancy (3×, 24 votes/bit) | ✅ Done |
| CRC-16 CCITT checksum | ✅ Done |
| Synchronization template (rotation recovery) | ✅ Done |
| Adaptive QIM delta (38–62, variance-based) | ✅ Done |
| Majority-vote extraction | ✅ Done |
| Corruption-aware extraction (variance filtering) | ✅ Done |
| Try-and-verify rotation recovery (±5.5°) | ✅ Done |
| Ed25519 signatures (canonical 5-field signing) | ✅ Done |
| Hash-chain ledger with anchor + backup | ✅ Done |
| Chain integrity verification | ✅ Done |
| **Forensic confidence scoring (0-100)** | ✅ Done |
| **Multi-signal verification (3-way stability check)** | ✅ Done |
| **False positive protection (hard rejection rules)** | ✅ Done |
| **Tamper analysis report generation** | ✅ Done |
| **Tamper type classification (crop/compression/noise/rotation)** | ✅ Done |
| **Severity scoring (NONE/LOW/MEDIUM/HIGH)** | ✅ Done |
| **JSON forensic report output** | ✅ Done |
| **CLI `report` command** | ✅ Done |
| **FastAPI REST API with Async Job Worker** | ✅ Done |
| **API Key Authentication & IP Rate Limiting** | ✅ Done |
| **Tamper-Proof Anchored Ledger (`anchors.json`)** | ✅ Done |
| **Enterprise Web Dashboard (Vite + React + Tailwind)** | ✅ Done |
| **"My Files" Workflow (Received & Sent tabs)** | ✅ Done |
| **Big Centered Leak Verdict Screen** | ✅ Done |
| **Side-by-Side Tamper Region Bounding Box** | ✅ Done |
| **Interactive Node Graph Ledger Visualizer** | ✅ Done |
| **LAN Multi-User Perspective Switcher (Alice/Bob)** | ✅ Done |
| PNG-only file type restriction | ✅ Phase 1 |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `cryptography` | ≥ 41.0.0 | AES-GCM, X25519, Ed25519, HKDF |
| `Pillow` | ≥ 10.0.0 | PNG image creation for tests |
| `numpy` | ≥ 1.24.0 | Numerical operations, DCT watermarking |
| `opencv-python` | ≥ 4.8.0 | DCT/IDCT transforms, image encoding/decoding, rotation |

---

## How It Works (Technical Detail)

### Why mid-frequency DCT?

Low-frequency DCT coefficients carry visible image structure — modifying them causes distortion. High-frequency coefficients are discarded by JPEG compression. Mid-frequency positions `(2,2), (3,1), (1,3), (2,3)` are the sweet spot: **imperceptible to humans, resilient to compression**.

### Why QIM over additive watermarking?

Quantization Index Modulation embeds bits by **quantizing** coefficients to specific grid points, not by adding a fixed signal. This provides:
- **Deterministic extraction** — no need for the original image
- **Controlled distortion** — bounded by `delta/2`
- **JPEG resilience** — quantization grid survives re-quantization if QIM delta > JPEG step

### Why multi-signal verification?

A single extraction can produce false positives under heavy attack. By running extraction on three versions of the image (original, blurred, JPEG'd) and requiring agreement, the system filters out:
- Spurious watermark matches from noise
- Fragile extractions that collapse under minor perturbation
- Random CRC collisions

---

## Known Limitations (Phase 1)

- PNG-only (no JPEG, PDF, or video support)
- Minimum image size ~128×128 (needs sufficient 8×8 blocks)
- Rotation recovery limited to ±5.5° at 0.25° resolution
- No 90°/180°/270° rotation handling
- Local-only ledger (no remote/blockchain anchoring)
- No collusion resistance (Tardos codes planned for Phase 2)
- Private keys stored unencrypted on disk

---

## License

This project is part of the SIH (Smart India Hackathon) problem statement PS237.
