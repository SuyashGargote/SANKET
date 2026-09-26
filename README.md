# SANKET: Provenance-Based Digital Forensics Using Watermarking and Decentralized Ledgers

**Phase 1: Working Prototype with Forensic Verification Layer**  
Smart India Hackathon (SIH) -- Problem Statement PS237

---

## Overview

SANKET is an end-to-end digital provenance, secure distribution, and forensic attribution platform designed to eliminate insider document leakage and unauthorized electronic exfiltration.

The system integrates hybrid envelope encryption, secure zero-leak in-memory decryption, robust DCT-domain Quantization Index Modulation (QIM) invisible watermarking, an append-only anchored hash-chain ledger, and a multi-signal forensic verification engine. When an exfiltrated document surfaces, SANKET extracts the embedded watermark, correlates it with the ledger, verifies digital signatures, and produces a forensic-grade attribution report with confidence scoring and tamper classification -- even after JPEG compression, cropping, resizing, noise, or geometric rotation attacks.

```
+---------------------------------------------------------------------------------------------------------+
|                                    SECURE FILE LIFECYCLE WORKFLOW                                       |
|                                                                                                         |
| [1. Encrypt]       --> [2. Distribute]     --> [3. Decrypt & Log]  --> [4. Leak Occurs] --> [5. Attributed]   |
| AES-256-GCM            Multi-Recipient         Dynamic Watermark       Adversarial Attack    Multi-Signal       |
| X25519 Key Wrap        Encrypted Package       Ed25519 Signed Block    Crop/Rotate/Compress  Forensic Report    |
+---------------------------------------------------------------------------------------------------------+
```

---

## Quick Start

### 1. Launch Backend REST API (FastAPI)
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start server on localhost:8000
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
```
- API Base URL: `http://localhost:8000`
- Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`
- ReDoc API Specification: `http://localhost:8000/redoc`

### 2. Launch Enterprise Web Dashboard (React + Vite)
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node packages
npm install

# 3. Start local development server
npm run dev -- --host
```
- Web Application: `http://localhost:5173`
- Network Access: `http://<LAN_IP>:5173`

### 3. Run Automated End-to-End Verification Suite (CLI)
```bash
python main.py demo
```
Executes a 17-step automated test harness validating encryption, dual decryption, 8 hostile attack simulations (compression, cropping, rotation, noise), tamper classification, and ledger anchor verification.

---

## Enterprise Web Dashboard & User Workflow

The web interface is designed with a clean enterprise layout, removing clutter, neon glows, and non-standard styling.

```
+-------------------------------------------------------------------------------------------------------+
| SANKET Security Suite                                              [Simulated User: Alice | Bob]      |
+-------------------------------------------------------------------------------------------------------+
|  [1. Send File]       [2. My Files]           [3. Leak Investigation]       [4. Anchored Ledger]     |
+-------------------------------------------------------------------------------------------------------+
```

### Core Workflow Tabs

#### Tab 1: Send File
- Enterprise drag-and-drop file upload for PNG documents.
- Multi-recipient selector (`alice`, `bob`, `charlie`).
- Client-driven AES-256-GCM payload encryption with per-recipient X25519 ECDH key wrapping.
- Dispatched packages are automatically indexed and routed to recipient mailboxes.

#### Tab 2: My Files
- Split workspace view: **Received Files** and **Sent Files**.
- Displays package hash, sender identity, recipient list, and creation timestamps.
- Action button **"Open / Decrypt"** executes zero-leak in-memory decryption.
- A unique invisible DCT watermark is embedded into the recipient's copy, signed with their Ed25519 private key, and committed to the hash chain.
- Includes a direct **"Simulate Leak & Test Detection"** trigger from the document viewer modal.

#### Tab 3: Leak Investigation
- High-visibility forensic attribution view designed for non-technical auditors and evaluators.
- **Centered Verdict Screen**: Displays identified source user, percentage confidence score, and status badge (`LEAK SOURCE IDENTIFIED: BOB | 94.5% CONFIDENCE`).
- **Attack Region Visualization**: Side-by-side comparison of original watermarked document against the leaked asset, with an animated red bounding box highlighting the altered/cropped area.
- **Three-Line Plain-Language Summary**: Explains watermark recovery, CRC validation, and mathematical non-repudiation.
- **Collapsible Technical Telemetry**: Expandable drawer providing detailed metrics (CRC-16, Sync strength, QIM delta, 3-way multi-signal consensus).

#### Tab 4: Anchored Ledger
- **Node Chain DAG**: Interactive horizontal graph of connected blocks with directional arrows (`prev_hash -> hash`), visual anchor checkpoints, and head indicators.
- **Audit Log Table**: Comprehensive data table with search filters (by hash, watermark ID, or user), category filters, 1-click clipboard copy, and individual block inspection.
- **Cryptographic Block Inspector**: Inspects canonical JSON payload, Ed25519 signature proof, SHA-256 block hash, and anchor snapshot status.
- **Adversarial Resilience Testing Suite**: Diagnostic panel to simulate real-time attacks:
  - Vector 1: Record Mutation (modifies historical block payload -> breaks SHA-256 linkage).
  - Vector 2: Record Deletion (removes intermediate block -> severs sequence continuity).
  - Vector 3: History Rewrite (recalculates downstream hashes -> caught by periodic secondary anchors).
  - Reset Action: Restores ledger state to pristine verified baseline with one click.

---

## 10-Second Demonstration Script for Evaluators

1. **Select Sender (Alice)**: Set the user switcher in the top-right header to **Alice**.
2. **Dispatch Document**: Navigate to **"1. Send File"**, click **"Use Sample Document"**, and click **"Encrypt & Dispatch to Bob"**.
3. **Select Recipient (Bob)**: Switch the header identity to **Bob**.
4. **Open Document**: Navigate to **"2. My Files"** and click **"Open / Decrypt"** on the incoming file. The document renders in the secure modal, with Bob's unique watermark embedded in memory and logged to the ledger.
5. **Simulate Leak**: Inside the viewer modal, click **"Simulate Leak & Test Detection"**.
6. **Observe Attribution**: The interface automatically switches to **"3. Leak Investigation"** and presents the centered attribution screen identifying **Bob** as the leaker with 94%+ confidence.
7. **Verify Ledger Audit**: Navigate to **"4. Ledger"** to see the newly appended block in the DAG. Open **"Resilience Testing"** to execute a tamper simulation and demonstrate immediate detection.

---

## Command-Line Interface (CLI)

The CLI provides complete programmatic control over all core cryptographic, watermarking, and ledger capabilities.

```bash
# 1. Initialize user keypairs (Ed25519 signing + X25519 key exchange)
python main.py setup --users "alice,bob,charlie"

# 2. Encrypt document for multiple recipients
python main.py encrypt --file tests/sample.png --recipients "alice,bob"

# 3. Decrypt document as Bob (in-memory decrypt -> watermark -> sign -> ledger log)
python main.py decrypt --package data/encrypted/sample --user bob

# 4. Verify a suspected leaked document
python main.py verify --file data/decrypted/sample_bob_84a3903e.png

# 5. Generate full forensic analysis report (JSON output)
python main.py report --file data/decrypted/sample_bob_84a3903e.png

# 6. Verify ledger integrity and periodic secondary anchors
python main.py ledger-verify

# 7. Print chronological ledger records
python main.py ledger

# 8. Run end-to-end automated demo
python main.py demo
```

### CLI Verification Output Example

```text
  +----------------------------------------------+
  |        FORENSIC VERIFICATION REPORT          |
  +----------------------------------------------+

  [RESULT]
    User        : bob
    Confidence  : 94.5%
    Verdict     : HIGH_CONFIDENCE
    Status      : IDENTIFIED

  [DETAILS]
    CRC         : OK
    Votes       : 100.0%
    Sync        : Strong (98.5%)
    Corruption  : None (0.0%)
    Multi-signal: 3/3 agree
    Tamper      : None

  [NOTES]
    * CRC checksum validated
    * Watermark stable across Gaussian blur and JPEG perturbation
    * Strong synchronization template match (98.5%)

  LEAK SOURCE IDENTIFIED
    User ID      : bob
    Watermark    : 84a3903e2ee79279838d096b9fde543a
    Timestamp    : 2026-09-25T14:28:29.303117+00:00
    Nonce        : 7d80ecbb849c1017b6a7cda8df7e5792
```

---

## System Architecture

### 1. Encryption & Zero-Leak Decryption Pipeline

```
Original Image (PNG)
        |
        v
+------------------------------------+
|  AES-256-GCM File Encryption       |
|  Per-Recipient X25519 ECDH Wrap    |
|  Key Derivation via HKDF-SHA256    |
+-----------------+------------------+
                  |
                  v
         Encrypted Package
   (payload.enc + metadata.json)
                  |
                  v
+------------------------------------+
|  Secure Zero-Leak Decryption       |
|                                    |
|  1. AES-GCM In-Memory Decrypt      |
|  2. Generate Unique Watermark ID   |
|     = SHA256(user+file+time+nonce) |
|  3. In-Memory DCT-QIM Embedding    |
|  4. Immediate Memory Reclamation   |
|  5. Ed25519 Record Signature       |
|  6. Append to Hash-Chain Ledger    |
+-----------------+------------------+
                  |
                  v
        Watermarked PNG Output
```

### 2. Multi-Signal Forensic Verification Pipeline

```
Suspected Leaked Image
        |
        v
+------------------------------------+
|  Multi-Signal Watermark Extractor  |
|  Channel 1: Original Image         |
|  Channel 2: Gaussian Blur (3x3)    |
|  Channel 3: JPEG Q85 Re-encode     |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Signal & Distortion Analysis      |
|  - Sync Template Correlation       |
|  - Block Variance Corruption Ratio |
|  - Try-and-Verify Rotation Search  |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Confidence Scoring Engine         |
|  Base Score = Vote Ratio x 60      |
|  CRC Boost  = +25 (if valid)       |
|  Sync Boost = +15 (if >= 75%)      |
|  Corruption = -10 to -25 Penalty   |
|  Verdict    = HIGH / MED / REJECT  |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Ledger Query & Signature Verify   |
|  - Match watermark_id in Ledger   |
|  - Validate Ed25519 Signature      |
|  - Verify Anchor Consensus         |
+-----------------+------------------+
                  |
                  v
    Structured Forensic Report
```

---

## Technical Specifications

### Cryptographic Layer
| Function | Primitive / Algorithm | Parameter / Details |
|---|---|---|
| Symmetric Encryption | AES-256-GCM | 256-bit key, 96-bit random IV, authenticated tag |
| Asymmetric Key Exchange | X25519 ECDH | Curve25519 Montgomery form, 256-bit public/private keys |
| Key Derivation | HKDF-SHA256 | Extracts from ECDH shared secret; info: `"document-key-wrap"` |
| Key Wrapping | AES-256-GCM | Symmetric key wrapped per recipient with unique IV |
| Digital Signatures | Ed25519 | Edwards-curve signature over 5 canonical record fields |
| File & Record Hashing | SHA-256 | Deterministic canonical serialization (`sort_keys=True`) |

### Watermarking Engine
| Parameter | Value | Design Rationale |
|---|---|---|
| Transform Domain | 2D DCT on Y-channel | Uses YCrCb; exploits human visual contrast sensitivity |
| Block Geometry | 8x8 pixels | Standard spatial-frequency partition |
| Embed Coefficients | (2,2), (3,1), (1,3), (2,3) | Mid-frequency band: immune to blur, preserved in JPEG |
| Embedding Technique | QIM (Quantization Index Modulation) | Blind extraction; bounded distortion (`delta / 2`) |
| Adaptive Delta | 38.0 to 62.0 | Scaled by block variance to maximize imperceptibility |
| Spatial Interleaving | 2 zones | Distributes bits across distinct top/bottom halves |
| Macro-Redundancy | 3x repetition | Watermark repeated 3 times across spatial domains |
| Total Votes Per Bit | 24 votes / bit | 4 coefficients x 2 zones x 3 copies |
| Payload Structure | 144 bits | 128-bit Watermark ID + 16-bit CRC-16/CCITT checksum |
| Sync Coefficient | (4,2) (Delta = 80.0) | Dedicated pattern for rotation detection (independent of watermark) |
| Rotation Search | +/-5.5 deg at 0.25 deg | Try-and-verify search over candidate angles on full BGR raster |

### Anchored Hash-Chain Ledger
| Feature | Implementation | Purpose |
|---|---|---|
| Block Chaining | SHA-256 `prev_hash` pointers | Mathematically prevents record re-ordering and deletions |
| Signer Non-Repudiation | Ed25519 signature per block | Binds recipient identity directly to decryption event |
| Primary Anchor | `anchor.json` | Stores latest block hash and chain length independently |
| Secondary Anchors | `anchors.json` (Every 5 blocks) | Stores cumulative snapshot hash: `SHA256(sub_chain)` |
| Anti-Rehash Defense | Double-layer verification | Detects attacks where downstream hashes were recalculated |

---

## Robustness & Attack Resilience

Evaluated via `tests/demo.py` against adversarial perturbations:

### Attack Vectors That Survive

| Attack Vector | Parameter / Intensity | Extraction Confidence | CRC Status | Attribution Result |
|---|---|---|---|---|
| JPEG Compression | Quality 90 | 100.0% agreement | Valid | Attributed (HIGH) |
| JPEG Compression | Quality 70 | 100.0% agreement | Valid | Attributed (HIGH) |
| JPEG Compression | Quality 50 | 100.0% agreement | Valid | Attributed (HIGH) |
| Resolution Resizing | Down 75% then back up | 100.0% agreement | Valid | Attributed (HIGH) |
| Gaussian Noise | Sigma = 3.0 | 100.0% agreement | Valid | Attributed (HIGH) |
| Gaussian Noise | Sigma = 5.0 | 100.0% agreement | Valid | Attributed (HIGH) |
| Gaussian Noise | Sigma = 10.0 | 100.0% agreement | Valid | Attributed (HIGH) |
| Gaussian Noise | Sigma = 15.0 | 99.3% agreement | Valid | Attributed (HIGH) |
| Pixel Modification | 200 random pixels altered | 100.0% agreement | Valid | Attributed (HIGH) |
| Spatial Cropping | 10% area cropped (fill) | 94.4% agreement | Valid | Attributed (HIGH) |
| Spatial Cropping | 20% area cropped (fill) | 90.3% agreement | Valid | Attributed (HIGH) |
| Multi-Cycle Compression | JPEG Q70 x 2 cycles | 100.0% agreement | Valid | Attributed (HIGH) |
| Multi-Cycle Compression | JPEG Q70 x 3 cycles | 100.0% agreement | Valid | Attributed (HIGH) |
| Combined Attack | Crop 10% + JPEG Q70 | 95.1% agreement | Valid | Attributed (HIGH) |
| Combined Attack | Crop 10% + Noise Sigma 5 | 96.5% agreement | Valid | Attributed (HIGH) |
| Geometric Rotation | +1.0 deg / +3.0 deg / +5.0 deg | 87.0% - 90.0% agreement | Valid | Attributed (HIGH) |

### False Positive Protection Guard

| Untrusted Input | System Response | Confidence Score | Verdict |
|---|---|---|---|
| Random Gaussian Noise Raster | Extraction rejected | 0.0% | REJECT |
| Solid Uniform Fill Raster | All-zero detection triggered | 0.0% | REJECT |
| Unrelated Stock Photo | No matching watermark found | 0.0% | REJECT |

---

## REST API Reference

The backend exposes a high-performance REST API built with FastAPI.

- **Authentication**: `X-API-KEY: sanket-admin-key-2026` (or query parameter `?api_key=...`)
- **Rate Limit**: 120 requests per minute per IP (sliding-window rate limiter)
- **Traceability**: Unique `X-Request-ID` attached to all request logs and response headers

### Core Endpoints

| Method | Endpoint | Description | Request Format | Response Highlights |
|---|---|---|---|---|
| `POST` | `/encrypt` | Encrypts document for recipients | `multipart/form-data`: `file`, `recipients` | `package_path`, `recipients`, `file_id` |
| `POST` | `/decrypt` | In-memory decrypt & watermark | `multipart/form-data`: `package_path`, `user_id` | `output_path`, `watermark_id`, `block` |
| `POST` | `/verify` | Attributions for leaked asset | `multipart/form-data`: `file` | `user`, `confidence`, `verdict`, `crc_status` |
| `POST` | `/report` | Full forensic JSON report | `multipart/form-data`: `file` | Detailed tamper report with severity |
| `GET` | `/ledger` | Verifies hash-chain & anchors | None | `ledger_status`, `chain_ok`, `anchor_ok` |
| `GET` | `/ledger/blocks` | Returns full block graph | None | Array of blocks, anchors, and status |
| `POST` | `/ledger/tamper/modify` | Mutates Block #0 (Test Vector 1) | None | Chain break verification response |
| `POST` | `/ledger/tamper/delete` | Deletes Block #1 (Test Vector 2) | None | Pointer gap verification response |
| `POST` | `/ledger/tamper/recompute` | Re-hashes chain (Test Vector 3) | None | Anchor mismatch response |
| `POST` | `/ledger/tamper/restore` | Resets ledger to pristine state | None | Consensus restored confirmation |
| `GET` | `/shared/packages` | Lists packages for LAN sharing | None | Array of available encrypted packages |
| `POST` | `/demo-run` | Executes 1-click judge demo | None | Complete 6-stage lifecycle execution trace |
| `GET` | `/status` | Operational health and metrics | None | System state, total decryptions, anchor index |

---

## Repository Layout

```text
ps237/
|-- config.py                          # Global paths, constants, security and retention settings
|-- main.py                            # Unified CLI entry point (8 commands)
|-- requirements.txt                   # Production Python dependencies
|
|-- api/                               # FastAPI backend services
|   |-- server.py                      # REST API routes and request lifecycle
|   |-- security.py                    # API key authentication and IP rate limiter
|   |-- jobs.py                        # Thread-safe async task queue and job tracker
|   |-- cleanup.py                     # Automatic file retention and pruning
|
|-- modules/                           # Core algorithmic domain logic
|   |-- crypto/
|   |   |-- encryption.py              # AES-256-GCM encrypt and X25519 key wrapping
|   |   |-- decryption.py              # In-memory zero-leak decryption pipeline
|   |   |-- signature.py               # Ed25519 key management, signing, and verification
|   |
|   |-- watermark/
|   |   |-- embedder.py                # DCT-QIM embedding, 2-zone spread spectrum, sync template
|   |   |-- extractor.py               # Try-and-verify rotation recovery and extraction
|   |
|   |-- ledger/
|   |   |-- hashchain.py               # Append-only hash chain, periodic anchors, integrity check
|   |
|   |-- verification/
|   |   |-- verifier.py                # Forensic attribution coordinator
|   |   |-- confidence.py              # 0-100 confidence scoring engine
|   |   |-- forensic.py                # Multi-signal perturbation and corruption analysis
|   |
|   |-- forensics/
|       |-- report.py                  # Report generator, heuristic classifier, severity scoring
|
|-- frontend/                          # Enterprise Web Dashboard (React + Tailwind + Vite)
|   |-- src/
|       |-- App.jsx                    # Core application shell and tab navigator
|       |-- components/
|           |-- SendFileTab.jsx        # AES-256-GCM file dropzone and recipient dispatch
|           |-- MyFilesTab.jsx         # Received and Sent document tables with instant decryption
|           |-- LeakInvestigationTab.jsx # Centered verdict screen and attack visualization
|           |-- LedgerTab.jsx          # Connected node DAG, audit data table, block inspector
|           |-- DocumentViewerModal.jsx # Secure document viewer with simulated leak trigger
|           |-- FinalResultScreen.jsx  # Primary attribution display
|           |-- AttackVisualization.jsx # Before/after comparison with red bounding box
|
|-- docs/
|   |-- SYSTEM_ARCHITECTURE_AND_EXECUTION_GUIDE.md # Complete HLD, LLD, and Use Case specifications
|
|-- tests/
|   |-- demo.py                        # Automated end-to-end CLI demonstration suite
|
|-- data/                              # Local repository storage
    |-- keys/                          # User Ed25519 and X25519 PEM keys
    |-- encrypted/                     # Encrypted packages (.enc + metadata.json)
    |-- decrypted/                     # Watermarked recipient files
    |-- ledger/                        # ledger.json, anchor.json, anchors.json
    |-- reports/                       # Forensic JSON reports (RPT-*.json)
    |-- uploads/                       # Temporary API upload cache
    |-- logs/                          # Request traceability and performance logs
```

---

## Feature Implementation Status

| Capability / Module | Status | Verification Reference |
|---|---|---|
| AES-256-GCM Authenticated Encryption | Complete | `modules/crypto/encryption.py` |
| Per-Recipient X25519 ECDH Key Wrapping | Complete | `modules/crypto/encryption.py` |
| HKDF-SHA256 Key Derivation | Complete | `modules/crypto/encryption.py` |
| Secure Zero-Leak In-Memory Decryption | Complete | `modules/crypto/decryption.py` |
| Dynamic Unique Watermark with Random Nonce | Complete | `modules/crypto/decryption.py` |
| Multi-Coefficient Mid-Frequency DCT Embedding | Complete | `modules/watermark/embedder.py` |
| 2-Zone Spatial Spread Spectrum | Complete | `modules/watermark/embedder.py` |
| 24 Votes Per Watermark Bit Redundancy | Complete | `modules/watermark/embedder.py` |
| CRC-16/CCITT Integrity Checksum | Complete | `utils/helpers.py` |
| Deterministic (4,2) Sync Template | Complete | `modules/watermark/embedder.py` |
| Adaptive QIM Delta (38.0 - 62.0) | Complete | `modules/watermark/embedder.py` |
| Try-and-Verify Angular Rotation Search (+/-5.5 deg) | Complete | `modules/watermark/extractor.py` |
| Low-Variance Block Filtering (Corruption Guard) | Complete | `modules/watermark/extractor.py` |
| Ed25519 Canonical Record Signatures | Complete | `modules/crypto/signature.py` |
| Append-Only Hash-Chain Ledger | Complete | `modules/ledger/hashchain.py` |
| Periodic Snapshot Anchors (`anchors.json`) | Complete | `modules/ledger/hashchain.py` |
| Anti-Rehash Attack Protection | Complete | `modules/ledger/hashchain.py` |
| Multi-Signal Verification (Original, Blur, JPEG) | Complete | `modules/verification/forensic.py` |
| 0-100 Forensic Confidence Scoring Engine | Complete | `modules/verification/confidence.py` |
| Zero False-Positive Guard (Hard Rejection Rules) | Complete | `modules/verification/confidence.py` |
| Heuristic Tamper Classification (Crop, Noise, Rotation) | Complete | `modules/forensics/report.py` |
| Damage Severity Scoring (NONE, LOW, MED, HIGH) | Complete | `modules/forensics/report.py` |
| Structured JSON Forensic Report Generation | Complete | `modules/forensics/report.py` |
| FastAPI REST API with Background Worker Queue | Complete | `api/server.py` |
| API Key Authentication & IP Rate Limiting | Complete | `api/security.py` |
| Automated File Retention & Pruning | Complete | `api/cleanup.py` |
| Enterprise Web Dashboard (React + Tailwind + Vite) | Complete | `frontend/src/App.jsx` |
| "My Files" Secure Document Repository | Complete | `frontend/src/components/MyFilesTab.jsx` |
| Centered Leak Result Screen | Complete | `frontend/src/components/FinalResultScreen.jsx` |
| Visual Attack Bounding Box Overlay | Complete | `frontend/src/components/AttackVisualization.jsx` |
| Connected Node DAG Ledger Graph | Complete | `frontend/src/components/LedgerTab.jsx` |
| Enterprise Audit Log Data Table with Search | Complete | `frontend/src/components/LedgerTab.jsx` |
| Cryptographic Block Inspector Modal | Complete | `frontend/src/components/LedgerTab.jsx` |
| Adversarial Resilience & Fault Injection Suite | Complete | `frontend/src/components/LedgerTab.jsx` |
| Persona Perspective Switcher (Alice / Bob) | Complete | `frontend/src/components/Header.jsx` |
| Master Architecture & LLD Documentation | Complete | `docs/SYSTEM_ARCHITECTURE_AND_EXECUTION_GUIDE.md` |

---

## Known Scope Limitations (Phase 1 Prototype)

- **File Format Scope**: Phase 1 is restricted to PNG rasters. Support for JPEG, PDF, and video containers is targeted for Phase 2.
- **Minimum Image Dimensions**: Requires at least 128x128 pixels to provide sufficient 8x8 DCT blocks for the 432-bit spread-spectrum payload.
- **Rotation Search Range**: Rotation auto-recovery is calibrated for scanning skews within +/-5.5 degrees at 0.25-degree resolution. Gross 90/180/270-degree orientations require manual pre-rotation.
- **Collusion Resistance**: Advanced fingerprinting schemes (Tardos codes) to withstand multiple colluding recipients merging documents are planned for Phase 2.

---

## License

Developed for the Smart India Hackathon (SIH) under Problem Statement PS237.
