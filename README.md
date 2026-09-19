# SANKET - PROVENANCE-BASED DIGITAL FORENSICS USING WATERMARKING AND DECENTRALIZED LEDGERS

**Phase 1 — Working Prototype**

A local, modular system that encrypts documents for multi-recipient distribution, embeds unique **DCT-domain invisible watermarks** on each decryption, logs events to a tamper-evident hash-chain ledger, and identifies the source of leaked files — even after JPEG compression, resizing, or noise.

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run full end-to-end demo
python main.py demo
```

---

## CLI Commands

### 1. Setup users (generate keys)
```bash
python main.py setup --users "alice,bob,charlie"
```

### 2. Encrypt a PNG file
```bash
python main.py encrypt --file path/to/image.png --recipients "alice,bob"
```

### 3. Decrypt as a user
```bash
python main.py decrypt --package data/encrypted/image --user alice
```

### 4. Verify a leaked file
```bash
python main.py verify --file path/to/leaked.png
```

### 5. View and verify ledger
```bash
python main.py ledger
```

### 6. Run full demo
```bash
python main.py demo
```

---

## Architecture

```
Original PNG
    |
    v
[AES-256-GCM Encryption] --> Encrypted Package (.enc + metadata)
    |                              |
    |    (per-recipient X25519     |
    |     key wrapping)            |
    v                              v
[Secure Decryption Pipeline]
    |
    |-- Decrypt (internal, raw bytes never exposed)
    |-- Generate watermark_id = SHA256(user_id + file_id + timestamp + nonce)
    |-- Embed watermark (DCT + QIM at mid-frequency coeff with 3x redundancy + CRC)
    |-- Sign record (Ed25519, covers all 5 fields)
    |-- Append to hash-chain ledger (with anchor + backup)
    |
    v
Watermarked PNG Output
```

**Verification Flow:**
```
Leaked PNG --> Extract Watermark --> Query Ledger --> Verify Signature --> Identified User
```

---

## Project Structure

```
ps237/
  config.py                   # Global paths and constants
  main.py                     # CLI entry point
  requirements.txt
  modules/
    crypto/
      encryption.py           # AES-256-GCM + X25519 key wrapping
      decryption.py           # Secure decrypt+watermark pipeline
      signature.py            # Ed25519 sign/verify
    watermark/
      embedder.py             # DCT + QIM frequency-domain embedding
      extractor.py            # DCT extraction with majority vote + CRC
    ledger/
      hashchain.py            # Append-only hash chain + anchor
    verification/
      verifier.py             # End-to-end leak attribution
  utils/
    helpers.py                # Validation, ID generation, CRC
  tests/
    demo.py                   # End-to-end demo
  data/
    keys/                     # Per-user keypairs
    encrypted/                # Encrypted packages
    decrypted/                # Watermarked outputs
    ledger/                   # Hash-chain + anchor + backup
```

---

## Phase 1 Scope

| Feature | Status |
|---|---|
| AES-256-GCM encryption | Done |
| Per-recipient key wrapping (X25519 ECDH) | Done |
| Secure decrypt pipeline (no raw bytes leak) | Done |
| Watermark ID with nonce (unique per session) | Done |
| **DCT + QIM frequency-domain embedding** | **Done** |
| Watermark redundancy (3x) | Done |
| CRC-16 checksum | Done |
| Majority-vote extraction | Done |
| Ed25519 signatures (all 5 fields) | Done |
| Hash-chain ledger with anchor | Done |
| Ledger backup | Done |
| Chain verification | Done |
| Leak attribution pipeline | Done |
| PNG-only file type restriction | Done |

---

## Watermark Robustness (DCT + QIM)

The watermark is embedded in **mid-frequency DCT coefficients** (position 3,1) using Quantization Index Modulation with delta=50. This makes it robust against common image transformations:

| Attack | Survives? | Confidence |
|---|---|---|
| JPEG compression Q90 | Yes | 100% |
| JPEG compression Q70 | Yes | 100% |
| JPEG compression Q50 | Yes | 100% |
| Resize 75% down + back up | Yes | 100% |
| Gaussian noise (sigma=3) | Yes | 100% |
| Gaussian noise (sigma=5) | Yes | 100% |
| Gaussian noise (sigma=10) | Yes | 100% |
| Pixel-level modification (200px) | Yes | 100% |

> **Why mid-frequency?** Low-frequency DCT coefficients carry visible image structure — modifying them causes distortion. High-frequency coefficients are discarded by JPEG compression. Mid-frequency (3,1) is the sweet spot: imperceptible to humans, resilient to compression.

---

## Dependencies

- `cryptography` -- AES-GCM, X25519, Ed25519, HKDF
- `Pillow` -- PNG image creation for tests
- `numpy` -- Numerical operations for DCT watermarking
- `opencv-python` -- DCT/IDCT transforms, image encoding/decoding
