# SANKET — Post-Quantum Cryptographic Attribution & Distributed Provenance Platform

> **NIST-Standardized Post-Quantum Cryptography, Session-Bound Decryption Watermarking, Consensus-Validated Multi-Node Distributed Ledger & Verifiable Cryptographic Proof Bundles**  
> *Developed for Smart India Hackathon (SIH) — Problem Statement PS237*

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Distribution Dilemma in Broadcast Encryption
Sensitive documents are routinely distributed under a **broadcast-encrypt, individually-decrypt** paradigm: a sender encrypts a document once and distributes it to a group of authorized recipients, each of whom decrypts it independently using their own credentials.

Under this model:
- The decrypted document is visually and bitwise identical across all recipients.
- When an unauthorized leak occurs, **every recipient who possessed decryption capability is an equally plausible suspect**.
- Access logs maintained on centralized servers fail: privileged administrators can retroactively alter or erase log entries.
- Static watermarks applied prior to distribution fail because an identical watermark distributed to multiple recipients replicates the exact attribution problem it was intended to solve.

### 1.2 The SANKET Solution
**SANKET** resolves this challenge through an atomic, multi-stage cryptographic lifecycle:

$$\mathbf{Distribute} \longrightarrow \mathbf{Authorize} \longrightarrow \mathbf{Decrypt} \longrightarrow \mathbf{Attribute} \longrightarrow \mathbf{Verify}$$

1. **Single Logical Encryption with Post-Quantum Key Encapsulation**: Documents are encrypted once with symmetric authenticated encryption (**AES-256-GCM**). Ephemeral keys are individually encapsulated per recipient using NIST-standardized Post-Quantum KEM (**ML-KEM-768 / Kyber**).
2. **Strict Session-Bound Authorization Gatekeeper**: The API gateway verifies that the active session user matches the requested identity (`X-User-ID`) and is an authorized recipient before permitting cryptographic operations. Unauthorized attempts are rejected with `HTTP 403 Forbidden`.
3. **Dynamic Zero-Leak Forensic Watermarking at Moment of Decryption**: Plaintext is never written to disk in unwatermarked form. During in-memory decryption, a unique DCT-QIM watermark carrying recipient identity, file hash, timestamp, and a cryptographic session nonce is invisibly embedded into the raster.
4. **Mandatory User-Side Post-Quantum Signing**: Each recipient must sign the canonical decryption record using their **own private ML-DSA-65 (Dilithium)** signing key. Signing is strictly tied to the active session with zero key reuse across identities.
5. **Real Multi-Node Distributed Ledger (DLT)**: An immutable, peer-validated distributed ledger replaces simulated chains. Blocks are accepted only upon achieving consensus quorum: signed by **recipient + gateway authority + peer validator node(s)**. Each node maintains independent physical storage with zero shared directories.
6. **Cross-Node Anchor Verification & Tamper Detection**: Periodic secondary cumulative snapshot anchors detect history-rewrites and rehash attacks. Mismatches across peer nodes immediately flag the ledger as **`COMPROMISED`**.
7. **Cryptographically Verifiable Proof Bundles**: Forensic verification generates structured, self-contained JSON proof bundles verifying watermark CRC integrity, file hash, decrypted output hash, ledger linkage, anchor checkpoints, and all multi-party PQC signatures.
8. **100% Offline & Air-Gapped Operation**: Complete local cryptographic execution with zero dependencies on external cloud KMS or public blockchain networks.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph IdentityLayer ["1. Identity & Key Custody Layer (Air-Gapped / Offline)"]
        U_ALICE["Alice (Sender)"]
        U_BOB["Bob (Recipient)"]
        U_NODE_A["Node A (Local Node)"]
        U_NODE_B["Node B (Peer Validator)"]
        SYS_AUTH["SANKET Gateway Authority"]
        KEYSTORE[("Local Keystore: data/keys/{user_id}/<br/>• ML-KEM-768 (Kyber768 Keypair)<br/>• ML-DSA-65 (Dilithium3 Keypair)<br/>• Dual-Stack Ed25519 & X25519")]
        U_ALICE -.-> KEYSTORE
        U_BOB -.-> KEYSTORE
        U_NODE_A -.-> KEYSTORE
        U_NODE_B -.-> KEYSTORE
        SYS_AUTH -.-> KEYSTORE
    end

    subgraph DistributionLayer ["2. Distribution & Authorization Layer"]
        U_ALICE -->|"POST /send (file, recipients=[bob])"| REGISTRY[("SQLite Registry & Document Store<br/>data/sanket.db (WAL Mode)")]
        REGISTRY -->|"Single Encrypt (AES-256-GCM)"| PKG["Encrypted Package (data/encrypted/)<br/>• payload.enc (Single shared file)<br/>• metadata.json (Kyber-wrapped keys)"]
        PKG -.->|"Wrapped Key 1"| KEM_BOB["Kyber-768 CT (Bob PK)"]
        PKG -.->|"Wrapped Key 2"| KEM_ALICE["Kyber-768 CT (Alice PK)"]
    end

    subgraph DecryptionLayer ["3. Authorized Decrypt & Watermarking Layer"]
        U_BOB -->|"POST /decrypt (X-User-ID: bob)"| GATE{"Authorization & Session Gate:<br/>Is Bob ∈ recipients && session matches?"}
        GATE -->|"Unauthorized"| REJECT["Deny Access (HTTP 403 Forbidden)"]
        GATE -->|"Authorized"| UNWRAP["Kyber-768 Decapsulation (Bob SK) -> AES Key"]
        UNWRAP --> AES_DEC["In-Memory Plaintext Recovery (Zero Disk Leak)"]
        AES_DEC --> DCT_EMBED["DCT-QIM Watermark Embedder<br/>(user_id + file_id + timestamp + nonce + CRC-16)"]
        DCT_EMBED --> USER_SIGN["User-Side Signing Enforcement:<br/>Recipient Signs Decryption Event (Bob Dilithium SK)"]
        USER_SIGN --> GATEWAY_SIGN["Gateway Authority Signs Block Hash (System Dilithium SK)"]
    end

    subgraph DLTConsensus ["4. Multi-Node Distributed Ledger Consensus (Real Network)"]
        GATEWAY_SIGN --> CANDIDATE["Candidate Block Created Locally"]
        CANDIDATE -->|"POST /ledger/block/sign"| PEER_NODE["Peer Node (e.g. Node B :8001)<br/>• Validates candidate block<br/>• Signs block hash with Dilithium SK"]
        PEER_NODE -->|"Peer Dilithium Signature"| QUORUM{"Consensus Quorum Check:<br/>Recipient + Gateway + ≥1 Peer"}
        QUORUM -->|"Quorum Satisfied"| COMMIT["Commit Block to Local Ledger (ledger.json)"]
        COMMIT -->|"POST /ledger/block/receive"| BROADCAST["Broadcast Committed Block to All Peers"]
        COMMIT --> ANCHOR_CHECK{"Hit Interval (Every 5 Blocks)?"}
        ANCHOR_CHECK -->|"Yes"| ANCHOR_COMPUTE["Compute Snapshot Anchor<br/>Compare with Peers (anchors.json)<br/>Mismatch -> Mark COMPROMISED"]
    end

    subgraph ForensicLayer ["5. Forensic Verification & Proof Bundle Generation"]
        LEAK_FILE["Leaked / Attacked Document"] --> EXTRACTOR["Multi-Signal DCT-QIM Extractor<br/>(Original, Gaussian Blur, JPEG Q85)"]
        EXTRACTOR --> SYNC_ALIGN["Geometric Sync Recovery (±5.5° search)"]
        SYNC_ALIGN --> CONFIDENCE["Confidence Scoring Engine (0-100%)"]
        CONFIDENCE --> LEDGER_QUERY["Ledger Watermark Query (query_by_watermark)"]
        LEDGER_QUERY --> PROOF_GEN["Generate Proof Bundle JSON<br/>(CRC + hashes + ledger linkage + all PQC signatures)"]
        PROOF_GEN --> PROOF_VERIFY["Cryptographic Proof Verification Engine<br/>POST /proof/verify -> Court-Grade Evidence"]
    end
```

---

## 3. End-to-End Cryptographic Protocol Flow

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Sender)
    actor Bob as Bob (Recipient)
    participant Origin as Origin Node (Node A :8000)
    participant Peer as Peer Node (Node B :8001)
    participant LocalLedger as Node A Ledger (ledger.json)
    participant PeerLedger as Node B Ledger (ledger.json)
    actor Auditor as Forensic Auditor

    Note over Alice,Peer: Phase 0: Key Generation & Distribution
    Alice->>Origin: POST /send (file.png, recipients: ["bob"])
    Origin->>Origin: Encrypt once (AES-256-GCM) + Encapsulate key for Bob (ML-KEM-768)
    Origin-->>Alice: Document registered & encapsulated package saved (data/encrypted/)

    Note over Bob,Peer: Phase 3 & Phase 2: Decrypt, User-Side Sign & Multi-Node Consensus
    Bob->>Origin: POST /decrypt (package_path, user="bob", Header: X-User-ID: "bob")
    Origin->>Origin: Verify active session (Bob) and recipient authorization
    Origin->>Origin: Decapsulate AES key using Bob's Kyber Secret Key
    Origin->>Origin: In-memory DCT-QIM watermarking (unique session nonce + CRC-16)
    Origin->>Origin: User-side signing: Bob signs decryption event payload with Dilithium SK
    Origin->>Origin: Gateway authority signs block hash with System Dilithium SK
    Origin->>Origin: Assemble candidate block (index, data, prev_hash, recipient & gateway sigs)

    Note over Origin,Peer: Peer Consensus Quorum Flow
    Origin->>Peer: POST /ledger/block/sign (candidate block)
    Peer->>Peer: Validate block structure, hash, and recipient signature
    Peer->>Peer: Sign block hash with Node B Dilithium private key
    Peer-->>Origin: Return Node B signature & public key
    Origin->>Origin: Verify Node B signature and confirm quorum (3/3 signatures)
    Origin->>LocalLedger: Append committed block to Node A ledger.json
    Origin->>Peer: POST /ledger/block/receive (broadcast final committed block)
    Peer->>PeerLedger: Validate linkage & append to Node B ledger.json
    Origin-->>Bob: Watermarked image download URL + proof token

    Note over Bob,Auditor: Phase 1: Exfiltration, Forensic Attribution & Proof Verification
    Note over Bob,Auditor: Document leaks (adversary crops, compresses, or modifies the file)
    Auditor->>Origin: POST /verify (leaked_file.png)
    Origin->>Origin: Extract watermark across multi-signal perturbation channels
    Origin->>LocalLedger: Lookup watermark ID in ledger
    Origin->>Origin: Generate Proof Bundle JSON (PRF-xxxx)
    Origin-->>Auditor: Attribution Verdict (Bob identified, 100% match) + Proof Bundle JSON
    Auditor->>Origin: POST /proof/verify (proof_bundle)
    Origin->>Origin: Verify CRC, file hash, decrypted hash, hash chain linkage, anchor, and Dilithium signatures (Bob + System + Node B)
    Origin-->>Auditor: Cryptographically Validated: { valid: true, reason: "All checks passed" }
```

---

## 4. Technical Specifications & Cryptographic Stack

| Component | Standard / Technology | Implementation Details |
| :--- | :--- | :--- |
| **Post-Quantum Key Exchange** | NIST FIPS 203 (ML-KEM-768 / Kyber) | Ephemeral AES-256 key encapsulation; 1,184-byte PK, 2,400-byte SK, 1,088-byte CT |
| **Post-Quantum Digital Signatures** | NIST FIPS 204 (ML-DSA-65 / Dilithium) | Non-repudiation signing; 1,952-byte PK, 4,032-byte SK, 3,309-byte signature |
| **Dual-Stack Fallback** | RFC 8032 (Ed25519) & RFC 7748 (X25519) | Automatic backwards-compatibility fallback |
| **Symmetric Payload Cipher** | AES-256-GCM | Authenticated encryption with 96-bit random IV; single logical encryption |
| **Invisible Watermarking** | 2D DCT-QIM on Y-channel (YCbCr) | Mid-frequency coefficients `(2,2),(3,1),(1,3),(2,3)`; variance-adaptive $\Delta \in [38.0, 62.0]$ |
| **Payload Structure** | 144 bits (128-bit ID + 16-bit CRC) | Dual-zone spread-spectrum repetition, 24 votes/bit, dedicated `(4,2)` sync template |
| **Geometric Synchronization** | Angular Cross-Correlation Search | Dedicated periodic template in coefficient `(4,2)`; searches $[-5.5^\circ, +5.5^\circ]$ in $0.5^\circ$ steps |
| **Distributed Ledger Technology (DLT)** | Multi-Node Hash Chain with Consensus Quorum | Peer-to-peer HTTP network; independent physical ledgers per node; zero shared storage |
| **Consensus Quorum Rule** | Multi-Party Dilithium Quorum | Block accepted only with Recipient + Gateway Authority + $\ge 1$ Peer Node signatures |
| **Periodic Secondary Anchors** | Cumulative State Snapshot Anchors | Computed every 5 blocks: $\text{SHA256}(\text{ledger snapshot})$; peer-verified; mismatch $\rightarrow$ `COMPROMISED` |
| **Startup Chain Sync** | Longest Valid Chain Adoption | On startup (`@app.on_event("startup")`), queries peers via `GET /ledger/sync` and adopts longest valid chain |
| **Verifiable Proof Bundles** | Cryptographic JSON Proof Container | Binds forensic result, file hash, decrypted hash, ledger linkage, and all Dilithium signatures |
| **Relational Metadata Store** | Embedded SQLite3 with WAL Mode | Local ACID metadata storage (`data/sanket.db`) with zero race conditions across multi-device LAN |
| **Application Layer** | FastAPI + Uvicorn & React + Vite | Production REST API on Python 3.12; responsive glassmorphic dashboard on React |

---

## 5. Detailed Breakdown of the Three Implementation Phases

### Phase 1: Cryptographic Proof Bundle Architecture

Implemented in [`modules/proof/proof_bundle.py`](file:///d:/SIH/ps237/modules/proof/proof_bundle.py).

#### Proof Bundle Structure
```json
{
  "watermark_id": "c33376d993ac6b52eff9d9b894224b43",
  "user_id": "alice",
  "timestamp": "2026-09-27T14:34:38.574901+00:00",
  "file_hash": "66ed6ed129e81faf67d4be3ed2349ceb2bdf4b6cf330bfc703720a6c4c3a89b6",
  "decrypted_hash": "a6d30edfea40d97eb97433b05361cc86a0e5290a0c21697c4cbba56adaf62110",
  "ledger": {
    "block_index": 0,
    "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "block_hash": "8f3b2591a38402db399b1ef0598823f66c1b3f9dc3cf200921434c76063ad46c",
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
    "confidence": 100.0,
    "verdict": "HIGH_CONFIDENCE"
  }
}
```

#### Cryptographic Verification Engine (`verify_proof_bundle`)
The verification engine strictly executes 6 mathematical validations:
1. **$V_1$ (Watermark Integrity)**: Validates `verification.crc_valid == true` (zero bit-flips).
2. **$V_2$ (File Hash Consistency)**: Validates 64-hex-character length and matches encrypted payload.
3. **$V_3$ (Decrypted Output Hash)**: Validates 64-hex-character length and confirms watermarked file hash.
4. **$V_4$ (Hash Chain Linkage)**: Verifies block index continuity, genesis 64 zeros requirement, and cross-checks hash chain continuity against the local immutable ledger (`_load_chain()`).
5. **$V_5$ (Anchor Checkpoint Validity)**: Validates 64-hex-character SHA-256 periodic anchor snapshot.
6. **$V_6$ (Multi-Party Signatures)**:
   - Recipient Dilithium signature over the canonical decryption event payload.
   - Gateway Authority Dilithium signature over the block hash.
   - Peer Node Dilithium signatures over the block hash, enforcing quorum ($\ge 1$ peer).

---

### Phase 2: Real Multi-Node Distributed Ledger

Implemented in [`modules/ledger/network.py`](file:///d:/SIH/ps237/modules/ledger/network.py) and [`modules/ledger/hashchain.py`](file:///d:/SIH/ps237/modules/ledger/hashchain.py).

#### Node Identity & Independent Storage
Configured via [`data/node_config.json`](file:///d:/SIH/ps237/data/node_config.json) or environment variables:
```json
{
  "node_id": "node_A",
  "port": 8000,
  "peers": [
    "http://127.0.0.1:8001"
  ]
}
```
Each node maintains its own Dilithium keypair in `data/keys/{node_id}/` and independent storage in `data/nodes/{node_id}/ledger/` (or `data/ledger/` for primary node). **No shared storage exists between nodes.**

#### Consensus Quorum & Block Flow
A block is accepted into the distributed ledger **only if signed by**:
- The recipient (using their private Dilithium key).
- The gateway authority (`system`).
- At least one peer validator node (`peers`).

$$\text{BlockAccepted}(B) \iff \text{Valid}(S_{\text{recipient}}) \land \text{Valid}(S_{\text{gateway}}) \land \exists p \in \text{Peers}: \text{Valid}(S_p)$$

**Decryption Block Flow**:
1. Origin node generates candidate block locally.
2. Origin node sends block to peers via HTTP `POST /ledger/block/sign`.
3. Each peer validates block hash and recipient signature, signs the block hash with its Dilithium key, and returns the signature.
4. Origin node verifies peer signatures, verifies quorum, and appends the block to its local ledger.
5. Origin node broadcasts the committed block to peers via HTTP `POST /ledger/block/receive`.
6. Peer nodes validate block linkage and consensus quorum, and commit to their independent ledgers.

#### Startup Ledger Synchronization
FastAPI startup lifecycle (`@app.on_event("startup")`):
1. Queries all configured peers via `GET /ledger/sync`.
2. Validates peer block chains and multi-signatures.
3. Automatically adopts the longest valid chain.

#### Periodic Anchor Verification
Every 5 blocks (`ANCHOR_INTERVAL = 5`):
1. Node computes snapshot anchor: $\text{SHA256}(\text{canonical}(\text{ledger snapshot}))$.
2. Node compares anchor against peer nodes via `GET /ledger/sync`.
3. Any mismatch triggers tamper isolation, marking the ledger status as **`COMPROMISED`**.

---

### Phase 3: User-Side Signing Enforcement

Implemented in [`modules/crypto/signature.py`](file:///d:/SIH/ps237/modules/crypto/signature.py) and [`modules/crypto/decryption.py`](file:///d:/SIH/ps237/modules/crypto/decryption.py).

1. **Mandatory Event Fields**:
   `sign_decryption_event(user_private_key, payload)` enforces that the signed payload contains:
   - `watermark_id`
   - `user_id`
   - `timestamp`
   - `file_hash`
   - `decrypted_hash`
   Missing any field raises a strict `ValueError`.

2. **Session Binding**:
   - `POST /decrypt` validates that the request session header `X-User-ID` matches the requested decrypting identity. Cross-identity decryption attempts are rejected with `HTTP 403 Forbidden`.
   - `decrypt_file(..., active_session_user=...)` strictly blocks signing under another identity.

3. **Key Uniqueness**:
   - `verify_key_uniqueness()` scans all Dilithium keys in `data/keys/` and confirms that no two users share public or private keys.

---

## 6. Complete REST API Reference

| Endpoint | Method | Description | Security / Headers |
| :--- | :--- | :--- | :--- |
| **System Info & Operations** | | | |
| `/` | `GET` | System information, version, and API capability overview | Public |
| `/status` | `GET` | Operational health, PQC status, and ledger status | `X-API-KEY` |
| `/job/{job_id}` | `GET` | Query background job status and result | `X-API-KEY` |
| `/audit/events` | `GET` | Audit trail events from SQLite database | `X-API-KEY` |
| **Authentication & Identity** | | | |
| `/auth/users` | `GET` | List registered identities and public keys | `X-API-KEY` |
| `/auth/login` | `POST` | Switch active identity session | `X-API-KEY` |
| `/auth/me` | `GET` | Get logged-in user profile & keys | `X-API-KEY`, `X-User-ID` |
| **Document Distribution** | | | |
| `/send` | `POST` | Single AES-GCM encryption + Kyber-768 key encapsulation | `X-API-KEY`, `X-User-ID` |
| `/inbox` | `GET` | List distributed documents for active user with permission badges | `X-API-KEY`, `X-User-ID` |
| `/documents` | `GET` | List all documents in repository registry | `X-API-KEY` |
| `/documents/{document_id}` | `GET` | Retrieve document metadata & recipients | `X-API-KEY` |
| `/encrypt` | `POST` | Core file encryption endpoint (sync or async background task) | `X-API-KEY` |
| **Decryption & Watermarking** | | | |
| `/decrypt` | `POST` | Kyber unwrap, DCT-QIM watermark, user Dilithium sign, ledger commit | `X-API-KEY`, `X-User-ID` |
| **Forensic Leak Attribution & Proof Bundles** | | | |
| `/verify` | `POST` | Watermark extraction, identity attribution & proof bundle generation | `X-API-KEY` |
| `/report` | `POST` | Multi-signal tamper analysis with distortion classification | `X-API-KEY` |
| `/proof/{proof_id}` | `GET` | Retrieve stored cryptographic proof bundle JSON | Optional API Key / Browser |
| `/proof/verify` | `POST` | Cryptographically verify proof bundle | `X-API-KEY` |
| **Distributed Multi-Node Ledger (DLT)** | | | |
| `/ledger` | `GET` | Verify local ledger integrity and secondary anchors | `X-API-KEY` |
| `/ledger/blocks` | `GET` | Retrieve blockchain blocks with anchor flags & nonces | `X-API-KEY` |
| `/ledger/peers` | `GET` | Get node identity, listening port, peer list, and Dilithium public key | `X-API-KEY` |
| `/ledger/sync` | `GET` | Fetch local chain and anchors for peer synchronization | `X-API-KEY` |
| `/ledger/sync` | `POST` | Trigger P2P synchronization with configured peer nodes | `X-API-KEY` |
| `/ledger/block/sign` | `POST` | Validate candidate block and sign block hash with node Dilithium SK | `X-API-KEY` |
| `/ledger/block/receive` | `POST` | Receive broadcast block, validate quorum, and append to local ledger | `X-API-KEY` |
| **Shared Workflows & Downloads** | | | |
| `/shared/packages` | `GET` | List all shared encrypted packages | `X-API-KEY` |
| `/shared/decrypted` | `GET` | List all shared watermarked outputs | `X-API-KEY` |
| `/download/decrypted/{filename}` | `GET` | Secure download of watermarked output file | Direct Link / `X-API-KEY` |
| `/download/report/{report_id}` | `GET` | Download forensic analysis JSON report | Direct Link / `X-API-KEY` |
| `/download/encrypted/{package_name}` | `GET` | Download encrypted package zip archive | Direct Link / `X-API-KEY` |
| **Administration** | | | |
| `/setup` | `POST` | Generate keys for user list | `X-API-KEY` |

---

## 7. Command Line Interface Reference (`main.py`)

The unified CLI provides 100% offline operational capabilities:

```bash
# 1. Initialize user keys
python main.py setup --users alice,bob,charlie

# 2. Distribute a document to recipients (Single logical encryption + Kyber wrapping)
python main.py send --file test.png --recipients bob,charlie --sender alice

# 3. View user inbox
python main.py inbox --user bob

# 4. Decrypt as authorized recipient
python main.py decrypt --package data/encrypted/pkg_xxx --user bob

# 5. Verify a leaked file
python main.py verify --file data/decrypted/test_bob_xxx.png

# 6. Generate forensic analysis report
python main.py report --file data/decrypted/test_bob_xxx.png

# 7. Show ledger contents
python main.py ledger

# 8. Verify ledger with cumulative anchor tamper detection
python main.py ledger-verify

# 9. Run complete end-to-end demo and robustness suite
python main.py demo
```

---

## 8. Frontend Workflow Dashboard

The frontend application ([`frontend/src/`](file:///d:/SIH/ps237/frontend/src/)) provides a modern, responsive glassmorphic dashboard:

1. **Identity & Authentication** ([`IdentityScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/IdentityScreen.jsx)): Persona switching (`@alice`, `@bob`, `@charlie`, `@system`), inspection of ML-DSA-65 and ML-KEM-768 public keys, session binding indicator.
2. **Send Document** ([`SendScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/SendScreen.jsx)): Upload file, select recipients, single logical encryption with Kyber key wrapping.
3. **Inbox** ([`InboxScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/InboxScreen.jsx)): Documents filtered by recipient with real-time access permission badges.
4. **Decrypt & Watermark** ([`DecryptScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/DecryptScreen.jsx)): Decrypt with Kyber secret key, dynamic DCT-QIM watermark embedding, user Dilithium signature, and multi-node consensus commit.
5. **Leak Verification & Proof Bundle Inspector** ([`LeakVerifyScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/LeakVerifyScreen.jsx)): Upload suspicious or tampered file, extract watermark, attribute leaker, inspect Cryptographic Proof Bundle, and trigger live cryptographic proof verification with court-grade evidence display.
6. **Distributed Ledger Explorer** ([`LedgerScreen.jsx`](file:///d:/SIH/ps237/frontend/src/components/workflow/LedgerScreen.jsx)): Distributed node network banner, P2P chain sync button, multi-party signature inspection (recipient + gateway + peer), anchor checkpoints, and SQLite audit events.
7. **System Settings Modal** ([`SettingsModal.jsx`](file:///d:/SIH/ps237/frontend/src/components/SettingsModal.jsx)): Manage API keys, server endpoint URL, and theme toggling.

---

## 9. Installation, Execution & Multi-Node Deployment

### Prerequisites
- Python 3.11+ or 3.12+ (64-bit)
- Node.js 18+ and npm
- Works 100% offline in air-gapped environments

### 1. Install Dependencies
```bash
# Python backend
pip install -r requirements.txt

# React frontend
cd frontend
npm install
cd ..
```

### 2. Single-Node Launch
```bash
# Terminal 1: Backend API
python -m uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend Dashboard
cd frontend
npx vite --host
```
- Web Dashboard: `http://localhost:5173`
- API & Docs: `http://localhost:8000/docs`
- Default API Key: `sanket-admin-key-2026`

### 3. Multi-Node Distributed Deployment (2 Physical Nodes on LAN / Local Ports)

#### On Windows PowerShell:
**Terminal 1 — Node A (Primary, Port 8000)**:
```powershell
$env:PORT="8000"; $env:NODE_ID="node_A"
python -m uvicorn api.server:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Node B (Peer Validator, Port 8001)**:
```powershell
$env:PORT="8001"; $env:NODE_ID="node_B"; $env:PEERS="http://127.0.0.1:8000"
python -m uvicorn api.server:app --host 0.0.0.0 --port 8001
```

#### On Linux / macOS / Bash:
**Terminal 1 — Node A (Primary, Port 8000)**:
```bash
PORT=8000 NODE_ID=node_A python -m uvicorn api.server:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Node B (Peer Validator, Port 8001)**:
```bash
PORT=8001 NODE_ID=node_B PEERS="http://127.0.0.1:8000" python -m uvicorn api.server:app --host 0.0.0.0 --port 8001
```

**Consensus Validation in Action**:
Any decryption performed on Node A automatically sends candidate blocks to Node B via HTTP `POST /ledger/block/sign`, collects Node B's Dilithium signature, verifies consensus quorum, commits locally, and broadcasts the finalized block to Node B via HTTP `POST /ledger/block/receive`.

---

## 10. Automated Test Suites & Benchmarks

### 1. Run Complete PQC, Proof Bundle & Multi-Node Unit Tests (17/17 Passing)
```bash
python -m unittest discover -s tests -p "test_*.py"
```
**Validates**:
- User-side Dilithium signing and session binding enforcement
- Key uniqueness across all identities
- Consensus quorum rule (recipient + gateway + peer)
- Independent ledgers per node (no shared storage)
- Proof bundle generation and full cryptographic verification
- Tamper detection across all proof fields and ledger attacks
- REST API endpoints for proofs and distributed ledger

### 2. Run 24-Step Adversarial Robustness Benchmark
```bash
python tests/demo.py
```
**Benchmark Highlights**:
- JPEG compression: Q90, Q70, Q50 (100% confidence, CRC valid)
- Additive Gaussian noise: $\sigma = 3, 5, 10$ (100% confidence)
- Cropping attacks: 10%, 20% area removed (93.1%–95.1% confidence)
- Rotation attacks: $-5^\circ, -3^\circ, -1^\circ, +5^\circ$ auto-recovered via synchronization template
- False positive rejection: 100% rejection on random noise, solid gray, and unrelated gradients
- Ledger tamper detection: block modification, deletion, and rehash attacks immediately detected and caught by secondary snapshot anchors

### 3. Build Production Frontend Bundle
```bash
cd frontend
npm run build
```
- **Result**: Built in 8.4s with 0 errors.

---

## 11. License & Attribution

Developed for the **Smart India Hackathon (SIH)** under **Problem Statement PS237**.  
Built with NIST-standardized Post-Quantum Cryptography algorithms (`ML-KEM-768`, `ML-DSA-65`).
