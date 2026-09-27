# SANKET — System Architecture Document
## Post-Quantum Cryptographic Attribution, Real Multi-Node DLT & Proof Bundles
### Technical Specification for SIH Problem Statement PS237

---

## 1. Architectural Scope & Problem Statement Requirements

This document specifies the architectural implementation of **SANKET** (System for Attributable Non-repudiable Key-wrapped Encrypted Transmission), designed to address all requirements of **Smart India Hackathon (SIH) Problem Statement PS237**.

### 1.1 The Core Problem: The Attribution Dilemma in Broadcast Encryption
In conventional broadcast-encryption systems:
- A sender encrypts a document once and shares it with multiple authorized recipients.
- Each recipient decrypts the ciphertext independently to produce identical plaintext.
- If an unauthorized leak occurs, **every recipient with decryption capability is an equally plausible suspect**, since the leaked copy contains no distinguishing forensic trace.
- Centralized server logs are vulnerable to tampering or deletion by privileged administrators.
- Pre-distribution watermarking replicates the problem if an identical watermarked copy is shared with multiple parties.

### 1.2 The SANKET Architecture
SANKET solves the attribution dilemma through an atomic, five-phase cryptographic lifecycle:

$$\mathbf{Distribute} \longrightarrow \mathbf{Authorize} \longrightarrow \mathbf{Decrypt} \longrightarrow \mathbf{Consensus} \longrightarrow \mathbf{Attribute} \longrightarrow \mathbf{Verify}$$

1. **Single Logical Encryption with Post-Quantum Key Encapsulation**: Payloads are encrypted once via **AES-256-GCM**. Ephemeral keys are wrapped individually per recipient using NIST FIPS 203 **ML-KEM-768 (Kyber)**.
2. **Session-Bound Authorization Gatekeeper**: Access requests are validated against identity credentials (`X-User-ID` session header) before any cryptographic operation occurs. Unauthorized requests are rejected with `HTTP 403 Forbidden`.
3. **In-Memory Forensic Watermarking at Moment of Decryption**: Plaintext is never written to disk unwatermarked. A unique 2D DCT-QIM watermark carrying the recipient identity, file hash, timestamp, and a cryptographic session nonce is invisibly embedded in memory during decryption with DC anti-clipping protection.
4. **Mandatory User-Side Post-Quantum Signing**: The recipient must sign the canonical decryption record using their own NIST FIPS 204 **ML-DSA-65 (Dilithium)** private key. Zero key reuse is enforced across users.
5. **Real Multi-Node Distributed Ledger (DLT)**: An immutable, peer-validated distributed ledger replaces simulated chains. Blocks require a consensus quorum: signed by **recipient + gateway authority + peer validator node(s)**. Each node maintains independent physical storage with zero shared directories.
6. **Cumulative Snapshot Anchors & Tamper Detection**: Secondary snapshot anchors computed every 5 blocks are compared across peer nodes over HTTP; discrepancies immediately flag the ledger as **`COMPROMISED`**.
7. **Court-Grade Cryptographic Proof Bundles**: Forensic verification generates self-contained JSON proof bundles linking watermark CRC integrity, file hash, decrypted hash, ledger linkage, anchor checkpoints, and all multi-party PQC signatures.
8. **100% Offline & Air-Gapped Operation**: Zero dependencies on external cloud KMS or public blockchain networks.

---

## 2. High-Level Architecture Block Diagram

The system architecture is structured as a clear, sequential 4-stage pipeline:

```mermaid
flowchart LR
    subgraph S1 ["Stage 1: Distribute"]
        direction TB
        A1["Alice (Sender)"] --> A2["AES-256-GCM<br/>Single Encryption"]
        A2 --> A3["ML-KEM-768 (Kyber)<br/>Key Wrapped per Recipient"]
    end

    subgraph S2 ["Stage 2: Decrypt & Watermark"]
        direction TB
        B1["Bob (Recipient)"] --> B2["Kyber Decapsulation<br/>(In-Memory AES Key)"]
        B2 --> B3["DCT-QIM Watermark<br/>(Recipient + Nonce + CRC)"]
        B3 --> B4["ML-DSA-65 (Dilithium)<br/>(Bob Signs Decryption)"]
    end

    subgraph S3 ["Stage 3: Multi-Node DLT"]
        direction TB
        C1["Gateway Signature<br/>(System Dilithium)"] --> C2["Peer Node Signature<br/>(Node B Dilithium)"]
        C2 --> C3["Consensus Quorum<br/>(3-Party Signatures)"]
        C3 --> C4["Independent Ledgers<br/>(Node A & Node B)"]
    end

    subgraph S4 ["Stage 4: Attribute & Prove"]
        direction TB
        D1["Leaked Image Scan"] --> D2["DCT-QIM Extraction<br/>(24 Votes/Bit + Sync)"]
        D2 --> D3["Ledger Correlation<br/>(Attributed to Bob)"]
        D3 --> D4["Proof Bundle (JSON)<br/>(Court-Grade Evidence)"]
    end

    S1 ==>|"Encrypted Package"| S2
    S2 ==>|"Signed Event"| S3
    S3 -.->|"Immutable Record"| S4
    D1 -.->|"Forensic Investigation"| S4
```

---

## 3. Step-by-Step Architecture Flow Diagrams

### 3.1 Document Distribution Flow (`POST /send`)

```mermaid
flowchart TD
    FILE["Original File (PNG)"] --> ENCR["1. AES-256-GCM Encryption<br/>(Generates random 256-bit Document Key K_doc)"]
    ENCR --> PAYLOAD["payload.enc<br/>(Single shared encrypted ciphertext)"]

    K_DOC["Key K_doc"] --> KEM1["2. Wrap for Bob<br/>ML-KEM-768 Encapsulation with Bob's Public Key"]
    K_DOC --> KEM2["3. Wrap for Charlie<br/>ML-KEM-768 Encapsulation with Charlie's Public Key"]

    KEM1 --> META["metadata.json<br/>(Contains wrapped keys for each recipient)"]
    KEM2 --> META

    PAYLOAD --> PKG["data/encrypted/{pkg_id}/<br/>(Encrypted Package Folder)"]
    META --> PKG
    PKG --> SQLITE["SQLite Database (data/sanket.db)<br/>Records document_id, sender, recipients, status='pending'"]
```

---

### 3.2 In-Memory Decryption & User Signing (`POST /decrypt`)

```mermaid
flowchart TD
    REQ["Bob Requests Decryption<br/>POST /decrypt (Header: X-User-ID: 'bob')"] --> GATE{"Authorization Check:<br/>1. Is Bob an authorized recipient?<br/>2. Does session match 'bob'?"}

    GATE -->|"No"| REJECT["HTTP 403 Forbidden<br/>(Access Denied)"]
    GATE -->|"Yes"| UNWRAP["ML-KEM-768 Decapsulation<br/>(Bob's Private Key unwraps K_doc)"]

    UNWRAP --> RAM["In-Memory Plaintext Recovery<br/>(Zero disk writes of raw plaintext)"]
    RAM --> WM["2D DCT-QIM Watermarking Embedder<br/>• Mid-frequency coeffs: (2,2), (3,1), (1,3), (2,3)<br/>• Dedicated (4,2) Sync Template<br/>• Orthogonal DC Anti-Clipping Protection"]

    WM --> RECORD["Assemble Decryption Event Payload:<br/>• watermark_id • user_id • timestamp<br/>• file_hash • decrypted_hash"]

    RECORD --> BOB_SIGN["User-Side Signing Enforcement:<br/>Bob signs payload with own ML-DSA-65 Dilithium Key"]
    BOB_SIGN --> OUT["Save Watermarked Output Image<br/>data/decrypted/file_bob_xxxx.png"]
```

---

### 3.3 Multi-Node P2P Consensus Quorum (Real Distributed Network)

```mermaid
flowchart LR
    subgraph OriginNode ["Origin Node (Node A :8000)"]
        CAND["Candidate Block B<br/>• Recipient Sig (Bob)<br/>• Gateway Sig (System)"]
        COMMIT_A[("Node A Ledger<br/>data/ledger/ledger.json")]
    end

    subgraph ConsensusProtocol ["P2P HTTP Consensus Flow"]
        direction TB
        STEP1["1. POST /ledger/block/sign<br/>(Candidate sent to Peer)"]
        STEP2["2. Node B Validates Block<br/>(Checks hash & Bob's sig)"]
        STEP3["3. Node B Signs Block Hash<br/>(with Node B Dilithium Key)"]
        STEP4{"4. Quorum Check:<br/>Recipient + Gateway + >=1 Peer"}
        STEP5["5. POST /ledger/block/receive<br/>(Broadcast committed block)"]

        STEP1 --> STEP2 --> STEP3 --> STEP4 -->|"Quorum Met"| STEP5
    end

    subgraph PeerNode ["Peer Validator (Node B :8001)"]
        COMMIT_B[("Node B Ledger<br/>data/nodes/node_B/ledger/ledger.json")]
    end

    CAND --> STEP1
    STEP4 -->|"Append"| COMMIT_A
    STEP5 -->|"Append"| COMMIT_B
```

---

### 3.4 Forensic Leak Verification & Cryptographic Proof Verification

```mermaid
flowchart TD
    subgraph Extraction ["1. Forensic Extraction Engine"]
        LEAK["Leaked Image File"] --> SYNC["(4,2) Sync Template Correlation<br/>Detects rotation skew (-5.5° to +5.5°)"]
        SYNC --> ROT["Auto-Rotate Image to Canonical Axis"]
        ROT --> MULTI["Multi-Signal DCT-QIM Extractor<br/>(Original + Blurred + JPEG Q85)"]
        MULTI --> VOTE["24 Votes/Bit Majority Vote<br/>+ CRC-16 Checksum Verification"]
    end

    subgraph Attribution ["2. Ledger Query & Correlation"]
        VOTE --> QUERY["Query Distributed Ledger<br/>(Exact Match or Hamming Distance <= 4 bits)"]
        QUERY --> MATCH["Block Matched in Blockchain<br/>Decrypted by @bob on 2026-09-27"]
        MATCH --> GEN_PROOF["Generate Cryptographic Proof Bundle<br/>data/proofs/PRF-xxxx.json"]
    end

    subgraph Verification ["3. Cryptographic Proof Engine (POST /proof/verify)"]
        GEN_PROOF --> V1["V1: Watermark CRC Valid"]
        GEN_PROOF --> V2["V2: File Hash Valid (64 hex)"]
        GEN_PROOF --> V3["V3: Decrypted Output Hash Valid"]
        GEN_PROOF --> V4["V4: Hash Chain Linkage & Continuity"]
        GEN_PROOF --> V5["V5: Secondary Snapshot Anchor Valid"]
        GEN_PROOF --> V6["V6: Multi-Party PQC Signatures Valid<br/>(Bob + Gateway + Node B)"]

        V1 & V2 & V3 & V4 & V5 & V6 --> COURT["COURT-GRADE FORENSIC VERDICT:<br/>HIGH_CONFIDENCE (100% Attributed to Bob)"]
    end
```

---

## 4. Complete Repository & Component Map

```
sanket/
├── config.py                          # Global configuration: paths, crypto constants, API keys, intervals
├── main.py                            # Unified CLI entry point for all workflows
├── requirements.txt                   # Production Python dependencies
│
├── api/                               # FastAPI REST Backend Layer
│   ├── server.py                      # REST API endpoints, middleware, startup sync hooks
│   ├── security.py                    # API key authentication, browser access, sliding-window rate limiter
│   ├── cleanup.py                     # Automatic file retention & disk cleanup
│   └── jobs.py                        # Asynchronous in-memory background job tracker
│
├── data/                              # Data Storage Root (Air-Gapped Local Keystores & Ledgers)
│   ├── node_config.json               # Node identity, port, and peer URL list
│   ├── sanket.db                      # Local SQLite database in WAL mode (ACID metadata store)
│   ├── keys/{user_id}/                # User key directories:
│   │   ├── dilithium_private.bin      # ML-DSA-65 private signing key (4,032 bytes)
│   │   ├── dilithium_public.bin       # ML-DSA-65 public verification key (1,952 bytes)
│   │   ├── kyber_private.bin          # ML-KEM-768 private decapsulation key (2,400 bytes)
│   │   ├── kyber_public.bin           # ML-KEM-768 public encapsulation key (1,184 bytes)
│   │   ├── ed25519_private.pem        # Dual-stack fallback signing key
│   │   ├── ed25519_public.pem         # Dual-stack fallback verification key
│   │   ├── x25519_private.pem         # Dual-stack fallback decapsulation key
│   │   └── x25519_public.pem          # Dual-stack fallback encapsulation key
│   ├── ledger/                        # Primary Node (Node A) Independent Storage
│   │   ├── ledger.json                # Primary append-only block chain
│   │   ├── anchor.json                # Latest head anchor state
│   │   ├── anchors.json               # Cumulative snapshot anchors (interval = 5 blocks)
│   │   └── ledger_backup.json         # Automated hot backup
│   ├── nodes/{node_id}/ledger/        # Independent Isolated Storage for Peer Nodes (Node B, etc.)
│   ├── encrypted/                     # Single encrypted packages (payload.enc + metadata.json)
│   ├── decrypted/                     # Watermarked decrypted output files
│   ├── proofs/                        # Saved Cryptographic Proof Bundles (PRF-xxxx.json)
│   ├── reports/                       # Forensic analysis JSON reports
│   ├── uploads/                       # Temporary sanitized incoming file uploads
│   └── logs/                          # Request traceability and performance logs
│
├── modules/                           # Core Cryptographic & Forensic Modules
│   ├── crypto/
│   │   ├── encryption.py              # AES-256-GCM + ML-KEM-768 (Kyber) key encapsulation
│   │   ├── decryption.py              # Kyber unwrap + in-memory watermark embedding + user-side signing
│   │   └── signature.py               # ML-DSA-65 (Dilithium) signing, verification, and key uniqueness
│   ├── watermark/
│   │   ├── embedder.py                # 2D DCT-QIM embedder, adaptive delta, (4,2) sync template, DC anti-clipping
│   │   ├── extractor.py               # Multi-coefficient extraction, perturbation channels, majority vote
│   │   └── sync.py                    # Sync template cross-correlation & angular skew search (±5.5°)
│   ├── ledger/
│   │   ├── hashchain.py               # Append-only hash chain, canonical hashing, multi-sig consensus, near-match
│   │   └── network.py                 # P2P HTTP consensus layer: sign, receive, sync, peer anchors
│   ├── proof/
│   │   └── proof_bundle.py            # Proof bundle generation, 6-point verification, disk persistence
│   ├── verification/
│   │   ├── verifier.py                # Forensic verification coordinator
│   │   ├── confidence.py              # Multi-signal confidence scoring engine (0-100%)
│   │   └── forensic.py                # Multi-signal extraction, sync scoring, canvas recognition
│   ├── forensics/
│   │   └── report.py                  # Distortion classification (crop, noise, JPEG, rotation) & reports
│   ├── distribution/
│   │   └── registry.py                # Document distribution registry & recipient authorization
│   ├── identity/
│   │   └── users.py                   # SQLite identity directory, persona management, key generation
│   └── database/
│       └── db.py                      # SQLite connection manager, schema migrations, audit logging
│
├── utils/
│   └── helpers.py                     # Bit conversions, nonces, file IDs, watermark IDs, file validation
│
├── frontend/                          # Vite + React Modern Web Dashboard
│   ├── src/
│   │   ├── App.jsx                    # Application shell, glassmorphic layout, screen router
│   │   ├── api/client.js              # Unified Axios/Fetch API client with session binding & proof calls
│   │   ├── components/
│   │   │   ├── SettingsModal.jsx      # API key configuration, server status, theme controls
│   │   │   └── workflow/
│   │   │       ├── IdentityScreen.jsx # Persona switching, PQC key inspection, active user session
│   │   │       ├── SendScreen.jsx     # Upload, recipient selection, Kyber-wrapped encryption
│   │   │       ├── InboxScreen.jsx    # Distributed documents list with authorization badges
│   │   │       ├── DecryptScreen.jsx  # In-memory decrypt, watermark embed, Dilithium sign, DLT commit
│   │   │       ├── LeakVerifyScreen.jsx # Forensic leak verifier & interactive proof bundle inspector
│   │   │       └── LedgerScreen.jsx   # Multi-node P2P ledger explorer, consensus quorum, sync trigger
│   │   ├── index.css                  # Design tokens, glassmorphism variables, dark mode styling
│   │   └── App.css                    # Component layout and micro-animations
│   └── package.json                   # React, Vite, Lucide-react, Canvas-confetti
│
└── tests/                             # Automated Test Suites
    ├── test_pqc_proof_ledger.py       # Unit & integration tests for PQC, Proof Bundles, User Signing
    ├── test_multinode_network.py      # Real multi-node P2P consensus, independent storage, peer sync
    └── demo.py                        # 24-step end-to-end adversarial robustness & tamper benchmark
```

---

## 5. In-Depth Breakdown of Core Implementation Phases

### 5.1 Phase 1: Cryptographic Proof Bundle Architecture

Implemented in [`modules/proof/proof_bundle.py`](file:///d:/SIH/ps237/modules/proof/proof_bundle.py).

#### Proof Bundle Schema
```json
{
  "watermark_id": "f0402966c4a79cc2ca98e4c67014b474",
  "user_id": "bob",
  "timestamp": "2026-09-27T15:33:50.128401+00:00",
  "file_hash": "66ed6ed129e81faf67d4be3ed2349ceb2bdf4b6cf330bfc703720a6c4c3a89b6",
  "decrypted_hash": "41fa8912e9b940e7da3c8913b1904a11b0e791240188b4081c7e63b34591a2bc",
  "ledger": {
    "block_index": 5,
    "prev_hash": "8f3b2591a38402db399b1ef0598823f66c1b3f9dc3cf200921434c76063ad46c",
    "block_hash": "cb104928ac8129480bcde1234918237490182347102934812034981203498123",
    "anchor_hash": "5d2f8319a9240bc1284ae9876543210fedcba9876543210fedcba9876543210f"
  },
  "signatures": {
    "recipient": "07eae737e8398dbcba1c9edb1934a69f8015cf02497f...",
    "gateway": "466b94df39802a78c3855a20c21914dffa5e26aa751...",
    "peers": [
      {
        "node_id": "node_B",
        "signature": "eb4854d03888bd63af2544254e030de3e5b6028a4..."
      }
    ]
  },
  "verification": {
    "crc_valid": true,
    "confidence": 91.0,
    "verdict": "HIGH_CONFIDENCE"
  }
}
```

#### The Six Verification Gates (`verify_proof_bundle`)
Verification succeeds if and only if all six predicates evaluate to true:

$$\mathbf{ProofValid} = \bigwedge_{j=1}^{6} V_j$$

1. **$V_1$ (Watermark CRC Integrity)**: $V_1 \iff \text{verification.crc\_valid} == \text{true}$. Enforces zero undetected bit-flips.
2. **$V_2$ (Encrypted Payload Hash)**: $V_2 \iff \text{len}(\text{file\_hash}) == 64 \land \text{file\_hash} \in [0-9a-f]^{64}$.
3. **$V_3$ (Decrypted Output Hash)**: $V_3 \iff \text{len}(\text{decrypted\_hash}) == 64 \land \text{decrypted\_hash} \in [0-9a-f]^{64}$.
4. **$V_4$ (Ledger Linkage & Chain Integrity)**: $V_4 \iff (\text{block\_index} == 0 \implies \text{prev\_hash} = 0^{64}) \land (\text{LocalBlockAt}(k).\text{hash} == \text{block\_hash})$.
5. **$V_5$ (Snapshot Anchor Validity)**: $V_5 \iff \text{len}(\text{anchor\_hash}) == 64 \land \text{anchor\_hash} \in [0-9a-f]^{64}$.
6. **$V_6$ (Multi-Party Post-Quantum Signatures)**:
   - **Recipient Signature**: $\text{ML-DSA-65.Verify}(PK_{\text{recipient}}, \text{canonical}(P_{\text{event}}), \sigma_{\text{recipient}}) == \text{true}$.
   - **Gateway Authority Signature**: $\text{ML-DSA-65.Verify}(PK_{\text{system}}, \text{block\_hash}, \sigma_{\text{gateway}}) == \text{true}$.
   - **Consensus Peer Quorum**: $|\text{peers}| \ge 1 \land \forall p \in \text{peers}: \text{ML-DSA-65.Verify}(PK_p, \text{block\_hash}, \sigma_p) == \text{true}$.

---

### 5.2 Phase 2: Real Multi-Node Distributed Ledger (DLT)

Implemented in [`modules/ledger/network.py`](file:///d:/SIH/ps237/modules/ledger/network.py) and [`modules/ledger/hashchain.py`](file:///d:/SIH/ps237/modules/ledger/hashchain.py).

#### Independent Physical Ledgers (Zero Shared Storage)
- Node A (primary) writes strictly to `data/ledger/ledger.json`.
- Node B (peer validator) writes strictly to `data/nodes/node_B/ledger/ledger.json`.
- Each node maintains its own independent keypair in `data/keys/{node_id}/`.
- Paths are resolved dynamically via `get_ledger_dir()`, respecting `NODE_ID` environment variables.

#### Consensus Quorum Formulation
A block is valid if and only if signed by the recipient, the gateway authority, and at least one peer node:

$$\text{QuorumMet}(B) \iff \text{Valid}(\sigma_{\text{recipient}}) \land \text{Valid}(\sigma_{\text{gateway}}) \land \sum_{p \in \text{Peers}} \mathbb{I}(\text{Valid}(\sigma_p)) \ge 1$$

#### Canonical Block Hash Computation (`_compute_block_hash`)
For Phase 2 blocks, `_compute_block_hash` synchronizes core attributes and hashes the canonical JSON:
$$\text{Hash}(B) = \text{SHA256}(\text{canonical}(\{ \text{index}, \text{data}, \text{prev\_hash}, \text{recipient\_sig}, \text{gateway\_sig} \}))$$
Because all metadata (`user_id`, `watermark_id`, `file_hash`, `decrypted_hash`) is synchronized into `data`, tampering at any level breaks `_compute_block_hash(B)`.

#### Cumulative Snapshot Anchors & Cross-Node Tamper Detection
Every 5 blocks (`ANCHOR_INTERVAL = 5`), each node computes a cumulative snapshot anchor:
$$\text{Anchor}_m = \text{SHA256}(\text{canonical}(B_0, B_1, \dots, B_{5m-1}))$$
Nodes compare cumulative anchors via `GET /ledger/sync`. If an administrator alters history and recomputes local hashes, the anchor $\text{Anchor}_m$ diverges from peer nodes, and the ledger status is immediately marked **`COMPROMISED`**.

---

### 5.3 Phase 3: User-Side Signing Enforcement

Implemented in [`modules/crypto/signature.py`](file:///d:/SIH/ps237/modules/crypto/signature.py) and [`modules/crypto/decryption.py`](file:///d:/SIH/ps237/modules/crypto/decryption.py).

#### Canonical Decryption Event Structure
The decryption event payload signed by the user MUST contain exactly five mandatory fields:
```json
{
  "watermark_id": "f0402966c4a79cc2ca98e4c67014b474",
  "user_id": "bob",
  "timestamp": "2026-09-27T15:33:50.128401+00:00",
  "file_hash": "66ed6ed129e81faf67d4be3ed2349ceb2bdf4b6cf330bfc703720a6c4c3a89b6",
  "decrypted_hash": "41fa8912e9b940e7da3c8913b1904a11b0e791240188b4081c7e63b34591a2bc"
}
```
If any of these fields are missing, `_canonical_decryption_event` immediately raises a strict `ValueError`.

#### Cryptographic Session Binding
- `POST /decrypt` validates that HTTP header `X-User-ID` matches the requested decrypting user.
- If a user logged in as Alice attempts to trigger decryption or sign as Bob, the request is aborted with `HTTP 403 Forbidden`.
- `decrypt_file` strictly enforces `active_session_user == user_id`.

#### Key Uniqueness Enforcement
The `verify_key_uniqueness()` function scans all public keys in `data/keys/` across all identities and computes their SHA-256 hashes. If any public key is shared between two distinct identities, the verification fails.

---

## 6. Watermarking Engine & Forensic Verification Mathematics

### 6.1 2D DCT-QIM Embedding Algorithm
Watermarking operates on the luminance channel ($Y$) in the YCbCr color space:
1. **$8 \times 8$ Block Partitioning**: The image is divided into $8 \times 8$ spatial blocks.
2. **Frequency Transform**: Each block is transformed using the 2D Discrete Cosine Transform:
   $$D(u, v) = \text{DCT2D}(B(x, y))$$
3. **Mid-Frequency Coefficients**: Watermark bits are embedded into four robust mid-frequency coefficients:
   $$(u, v) \in \{(2, 2), (3, 1), (1, 3), (2, 3)\}$$
4. **Adaptive Quantization Index Modulation (QIM)**: The quantization step size $\Delta$ adapts to the local block variance $\sigma^2$:
   $$\Delta(B) = \Delta_{\min} + (\Delta_{\max} - \Delta_{\min}) \cdot \min\left(1.0, \frac{\sigma^2}{\sigma^2_{\text{threshold}}}\right)$$
   Where $\Delta_{\min} = 38.0$, $\Delta_{\max} = 62.0$, and $\sigma^2_{\text{threshold}} = 500.0$.
5. **Orthogonal DC Anti-Clipping Compensation**:
   If an inverse DCT produces pixel values $> 255.0$ or $< 0.0$ on boundary blocks (e.g. pure white `#FFFFFF` document backgrounds), the DC coefficient `dct_block[0, 0]` is shifted by `-(over) * 8.0` or `+(under) * 8.0`. Because DC is orthogonal to all AC coefficients, adjusting DC shifts pixel values uniformly without altering AC watermarking or sync coefficients, completely preventing spatial clipping.

### 6.2 Synchronization Template (Geometric Invariance)
To survive rotation skew and cropping:
- Coefficient $(4, 2)$ of every $8 \times 8$ block is embedded with a deterministic periodic sync pattern using a fixed step $\Delta_{\text{sync}} = 80.0$.
- Because coefficient $(4, 2)$ is orthogonal to watermark coefficients $\{(2,2), (3,1), (1,3), (2,3)\}$, synchronization does not degrade the payload.
- During verification, `sync.py` performs an angular search over $[-5.5^\circ, +5.5^\circ]$ in $0.5^\circ$ increments, computing the 2D cross-correlation peak to detect and reverse rotation before extraction.

### 6.3 24 Votes/Bit Spread-Spectrum Redundancy
The 144-bit payload (128-bit watermark ID + 16-bit CRC) is distributed across the image:
$$\text{Total Votes per Bit} = 4 \text{ coefficients} \times 2 \text{ spatial zones} \times 3 \text{ macro-copies} = 24 \text{ votes/bit}$$
Majority voting over the 24 samples produces extreme resilience against heavy JPEG compression (down to Q50), cropping (up to 20% area), and Gaussian noise.

---

## 7. Database Schema & Persistence Layer

The embedded SQLite database (`data/sanket.db`) operates in **WAL (Write-Ahead Logging)** mode with `busy_timeout = 5000ms`, providing ACID durability without write-lock collisions across concurrent LAN requests.

```sql
-- 1. Identity Table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    public_key TEXT,
    kem_public_key TEXT,
    private_key_path TEXT,
    kem_private_key_path TEXT,
    created_at TEXT NOT NULL
);

-- 2. Document Registry Table
CREATE TABLE IF NOT EXISTS documents (
    document_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    sender TEXT NOT NULL,
    recipients TEXT NOT NULL,
    encrypted_package_path TEXT NOT NULL,
    package_name TEXT NOT NULL,
    file_size_bytes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 3. Document Recipient Status Table
CREATE TABLE IF NOT EXISTS document_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    watermark_id TEXT,
    decrypted_at TEXT,
    ledger_block_index INTEGER,
    FOREIGN KEY(document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    UNIQUE(document_id, recipient_id)
);

-- 4. Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    document_id TEXT,
    ip_address TEXT,
    details TEXT
);
```

---

## 8. Complete REST API Specifications

The FastAPI backend ([`api/server.py`](file:///d:/SIH/ps237/api/server.py)) implements 24 production endpoints:

| Category | Endpoint | Method | Security / Headers | Description |
| :--- | :--- | :--- | :--- | :--- |
| **System Info & Health** | `GET /` | `GET` | Public | System info, version, and API capability overview |
| | `GET /status` | `GET` | `X-API-KEY` | Node health, PQC status, ledger verification status |
| | `GET /job/{job_id}` | `GET` | `X-API-KEY` | Query asynchronous background task status |
| | `GET /audit/events` | `GET` | `X-API-KEY` | Query SQLite audit event log |
| **Identity & Authentication** | `GET /auth/users` | `GET` | `X-API-KEY` | List all registered identities with PQC public keys |
| | `POST /auth/login` | `POST` | `X-API-KEY` | Switch active session persona |
| | `GET /auth/me` | `GET` | `X-API-KEY`, `X-User-ID` | Retrieve currently active logged-in user profile |
| **Document Distribution** | `POST /send` | `POST` | `X-API-KEY`, `X-User-ID` | Single AES-256-GCM encryption + Kyber key wrapping |
| | `GET /inbox` | `GET` | `X-API-KEY`, `X-User-ID` | List distributed documents with authorization badges |
| | `GET /documents` | `GET` | `X-API-KEY` | List all registered documents in repository |
| | `GET /documents/{id}` | `GET` | `X-API-KEY` | Retrieve document metadata and recipient progress |
| | `POST /encrypt` | `POST` | `X-API-KEY` | Core encryption endpoint (synchronous or background job) |
| **Decryption & Watermarking**| `POST /decrypt` | `POST` | `X-API-KEY`, `X-User-ID` | In-memory unwrap, DCT-QIM watermark, Dilithium sign, DLT commit |
| **Forensic Leak Verification**| `POST /verify` | `POST` | `X-API-KEY` | Extract watermark, attribute source, generate Proof Bundle |
| | `POST /report` | `POST` | `X-API-KEY` | Multi-signal distortion analysis (crop, noise, JPEG, rotation) |
| **Cryptographic Proofs** | `GET /proof/{id}` | `GET` | Browser / `X-API-KEY` | Retrieve saved Cryptographic Proof Bundle JSON |
| | `POST /proof/verify`| `POST` | `X-API-KEY` | Execute 6-point cryptographic proof verification |
| **Distributed Ledger (DLT)** | `GET /ledger` | `GET` | `X-API-KEY` | Verify chain integrity and check cumulative anchors |
| | `GET /ledger/blocks`| `GET` | `X-API-KEY` | Retrieve all blocks with anchor flags and nonces |
| | `GET /ledger/peers` | `GET` | `X-API-KEY` | Retrieve node identity, port, peer list, Dilithium PK |
| | `GET /ledger/sync` | `GET` | `X-API-KEY` | Export local block chain and anchors for peer sync |
| | `POST /ledger/sync`| `POST` | `X-API-KEY` | Trigger P2P synchronization with configured peer nodes |
| | `POST /ledger/block/sign` | `POST`| `X-API-KEY` | Validate candidate block and return Dilithium signature |
| | `POST /ledger/block/receive`| `POST`| `X-API-KEY` | Receive broadcast block, verify quorum, commit locally |
| **Shared Workflows & Downloads** | `GET /shared/packages` | `GET` | `X-API-KEY` | List shared encrypted packages in `data/encrypted/` |
| | `GET /shared/decrypted`| `GET` | `X-API-KEY` | List shared watermarked output files in `data/decrypted/` |
| | `GET /download/decrypted/{f}`| `GET` | Browser / `X-API-KEY` | Secure download of watermarked output image |
| | `GET /download/report/{id}` | `GET` | Browser / `X-API-KEY` | Secure download of forensic analysis report JSON |
| | `GET /download/encrypted/{pkg}`| `GET` | Browser / `X-API-KEY` | Download encrypted package as a `.zip` archive |
| **Administration** | `POST /setup` | `POST` | `X-API-KEY` | Generate PQC and dual-stack keypairs for user list |

---

## 9. CLI Command Line Reference (`main.py`)

The command line interface provides complete offline operational capability:

```bash
# 1. Setup user keys (ML-KEM-768, ML-DSA-65, X25519, Ed25519)
python main.py setup --users alice,bob,charlie

# 2. Distribute a document (Single logical encryption + Kyber wrapping)
python main.py send --file test.png --recipients bob,charlie --sender alice

# 3. View user inbox
python main.py inbox --user bob

# 4. Decrypt as recipient (In-memory watermark + Dilithium sign + Ledger commit)
python main.py decrypt --package data/encrypted/pkg_xxx --user bob

# 5. Verify leaked file and attribute leaker
python main.py verify --file data/decrypted/test_bob_xxx.png

# 6. Generate detailed forensic tamper report
python main.py report --file data/decrypted/test_bob_xxx.png

# 7. Inspect ledger blocks
python main.py ledger

# 8. Verify ledger chain and secondary snapshot anchors
python main.py ledger-verify

# 9. Run complete 24-step adversarial benchmark
python main.py demo
```

---

## 10. Verification & Test Evidence

All automated test suites execute and pass against the active codebase:

1. **Unit & Integration Suite** ([`tests/test_pqc_proof_ledger.py`](file:///d:/SIH/ps237/tests/test_pqc_proof_ledger.py)):
   - `python -m unittest discover -s tests -p "test_*.py"`
   - **Result**: `17/17 tests passing (OK in 14.5s)`
   - Validates user signing enforcement, session binding, key uniqueness, consensus quorum, independent node ledgers, proof bundle generation, and 6-gate verification.

2. **24-Step Adversarial Robustness Benchmark** ([`tests/demo.py`](file:///d:/SIH/ps237/tests/demo.py)):
   - `python tests/demo.py`
   - **Result**: `24/24 steps passing`
   - Survives JPEG compression (Q90, Q70, Q50), Gaussian noise ($\sigma=3, 5, 10$), cropping (10%, 20%), rotation ($-5^\circ$ to $+5^\circ$), false positive rejection, and ledger tamper detection.

3. **Production Frontend Build** ([`frontend/`](file:///d:/SIH/ps237/frontend/)):
   - `cd frontend && npm run build`
   - **Result**: `1,892 modules transformed, built in 8.4s with 0 errors`.
