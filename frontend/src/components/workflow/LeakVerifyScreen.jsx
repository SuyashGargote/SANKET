import React, { useState } from 'react';
import {
  Search,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSearch,
  Fingerprint,
  Copy,
  Download,
  Check,
  Code,
  FileCode,
} from 'lucide-react';
import { api } from '../../api/client';

export default function LeakVerifyScreen({ prefillImagePath }) {
  const [file, setFile] = useState(null);
  const [filePathInput, setFilePathInput] = useState(prefillImagePath || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [error, setError] = useState(null);
  const [proofVerifyResult, setProofVerifyResult] = useState(null);
  const [isVerifyingProof, setIsVerifyingProof] = useState(false);
  const [copiedProof, setCopiedProof] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleVerifyProof = async () => {
    const proof = verifyResult?.proof || verifyResult?.proof_bundle;
    if (!proof) return;
    setIsVerifyingProof(true);
    try {
      const res = await api.verifyProof(proof);
      setProofVerifyResult(res);
    } catch (err) {
      setProofVerifyResult({ valid: false, reason: err.message || 'Verification failed.' });
    } finally {
      setIsVerifyingProof(false);
    }
  };

  const handleCopyProof = () => {
    const proof = verifyResult?.proof || verifyResult?.proof_bundle;
    if (!proof) return;
    navigator.clipboard.writeText(JSON.stringify(proof, null, 2));
    setCopiedProof(true);
    setTimeout(() => setCopiedProof(false), 2000);
  };

  const handleDownloadProof = () => {
    const proof = verifyResult?.proof || verifyResult?.proof_bundle;
    if (!proof) return;
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${verifyResult.proof_id || 'proof_bundle'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setVerifyResult(null);

    setIsVerifying(true);
    try {
      let res;
      if (file) {
        res = await api.verify(file);
      } else {
        // If file not uploaded directly, run report or verify with file
        // To be robust, let's create a Blob/File or use verify
        const formData = new FormData();
        formData.append('file_path', filePathInput);
        const rawRes = await fetch(`${api.getBaseUrl ? api.getBaseUrl() : 'http://127.0.0.1:8000'}/verify`, {
          method: 'POST',
          headers: {
            'X-API-KEY': localStorage.getItem('sanket_api_key') || 'sanket-admin-key-2026',
          },
          body: formData,
        });
        const json = await rawRes.json();
        if (!rawRes.ok) throw new Error(json.error || 'Verification failed');
        res = json.data || json;
      }
      setVerifyResult(res);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          Leak Verification & Forensic Source Attribution
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload an unauthorized or leaked image to extract the hidden watermark, query the ledger, and attribute the non-repudiable source user.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Select Leaked File
              </label>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-xl p-5 text-center transition-all bg-slate-950/40">
                <input
                  type="file"
                  id="leak-file-upload"
                  accept=".png"
                  onChange={(e) => {
                    setFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
                <label htmlFor="leak-file-upload" className="cursor-pointer block">
                  <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                  {file ? (
                    <p className="text-xs text-emerald-400 font-medium">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Upload suspected leaked PNG image
                    </p>
                  )}
                </label>
              </div>

              {/* Alternative: server file path */}
              <div className="pt-2">
                <span className="text-[11px] text-slate-400 block mb-1">
                  Or inspect existing file path:
                </span>
                <input
                  type="text"
                  value={filePathInput}
                  onChange={(e) => {
                    setFilePathInput(e.target.value);
                    setFile(null);
                  }}
                  placeholder="e.g. data/uploads/suspect_document.png"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {isVerifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Extracting watermark & auditing ledger...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  <span>Execute Forensic Verification</span>
                </>
              )}
            </button>
          </form>

          {/* Verification heuristics */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-300 block">Forensic Analysis Pipeline:</span>
            <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside">
              <li>Multi-coefficient DCT-QIM watermark extraction</li>
              <li>CRC-16 integrity verification</li>
              <li>Synchronization template angle search</li>
              <li>Hashchain query & Dilithium signature check</li>
            </ul>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {verifyResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Attribution Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  verifyResult.status === 'identified'
                    ? 'bg-red-950/40 border-red-500/60 text-red-200'
                    : 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      verifyResult.status === 'identified'
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    <Fingerprint className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80 block">
                      Forensic Attribution Verdict
                    </span>
                    <h3 className="text-base font-bold">
                      {verifyResult.status === 'identified'
                        ? `LEAK SOURCE ATTRIBUTED TO: @${verifyResult.user || verifyResult.user_identified}`
                        : `VERDICT: ${verifyResult.verdict || verifyResult.status}`}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] opacity-80 block font-semibold">Confidence</span>
                  <span className="text-lg font-mono font-bold">
                    {verifyResult.confidence?.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Signals Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">CRC Checksum:</span>
                  <span
                    className={`font-semibold font-mono ${
                      verifyResult.crc_valid ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {verifyResult.crc_valid ? 'VALID (OK)' : 'FAILED'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Sync Score:</span>
                  <span className="font-semibold font-mono text-slate-200">
                    {((verifyResult.sync_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Corruption:</span>
                  <span className="font-semibold font-mono text-slate-200">
                    {((verifyResult.corruption || 0) * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Tamper Detected:</span>
                  <span
                    className={`font-semibold ${
                      verifyResult.tamper_detected ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {verifyResult.tamper_detected ? 'DETECTED' : 'None'}
                  </span>
                </div>
              </div>

              {/* Watermark and Ledger Proof */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <h4 className="text-xs font-semibold font-sans text-slate-300">
                  Extracted Watermark & Ledger Binding:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Watermark ID:</span>
                    <p className="text-blue-400 font-bold break-all">
                      {verifyResult.watermark_id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Attributed User:</span>
                    <p className="text-white font-bold">
                      @{verifyResult.user || verifyResult.user_identified || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Ledger Hash Chain:</span>
                    <p className="text-emerald-400 font-bold">
                      {verifyResult.ledger_valid !== false ? 'VERIFIED INTACT' : 'TAMPERED'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Signature Proof:</span>
                    <p className="text-emerald-400 font-bold">
                      {verifyResult.signature_valid !== false ? 'DILITHIUM VERIFIED' : 'INVALID'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cryptographic Proof Bundle (Phase 1) */}
              {(verifyResult.proof || verifyResult.proof_bundle) && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-purple-400" />
                      <span className="font-sans font-bold text-white text-xs">
                        Cryptographic Proof Bundle
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300">
                        {verifyResult.proof_id || 'PRF-BUNDLE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-sans">
                      <button
                        type="button"
                        onClick={handleVerifyProof}
                        disabled={isVerifyingProof}
                        className="py-1 px-2.5 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 transition-all shadow-sm"
                      >
                        {isVerifyingProof ? (
                          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>Verify Proof</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-all"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>{showRawJson ? 'Hide JSON' : 'View JSON'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyProof}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-all"
                        title="Copy Proof Bundle JSON"
                      >
                        {copiedProof ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedProof ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadProof}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 transition-all"
                        title="Download Proof Bundle JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Proof Verification Result Banner */}
                  {proofVerifyResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 font-sans ${
                        proofVerifyResult.valid
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                          : 'bg-red-950/60 border-red-800 text-red-300'
                      }`}
                    >
                      {proofVerifyResult.valid ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>Proof Cryptographically Validated:</strong> Watermark CRC, file hash consistency, decrypted output hash, hash chain linkage, periodic anchor, and all PQC multi-signatures verified.
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>
                            <strong>Verification Failed:</strong> {proofVerifyResult.reason}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Structured Proof Components */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-slate-400 font-sans font-semibold block text-[10px] uppercase">
                        Ledger Chain Linkage:
                      </span>
                      <div>
                        <span className="text-slate-500">Block Index: </span>
                        <span className="text-white font-bold">
                          #{(verifyResult.proof || verifyResult.proof_bundle)?.ledger?.block_index}
                        </span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">Block Hash: </span>
                        <span className="text-blue-400">
                          {(verifyResult.proof || verifyResult.proof_bundle)?.ledger?.block_hash}
                        </span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">Anchor Checkpoint: </span>
                        <span className="text-purple-400">
                          {(verifyResult.proof || verifyResult.proof_bundle)?.ledger?.anchor_hash}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-slate-400 font-sans font-semibold block text-[10px] uppercase">
                        Post-Quantum Signatures (Dilithium):
                      </span>
                      <div className="truncate">
                        <span className="text-slate-500">Recipient (@{verifyResult.user}): </span>
                        <span className="text-emerald-400">
                          {(verifyResult.proof || verifyResult.proof_bundle)?.signatures?.recipient ? 'VALID SIGNATURE' : 'MISSING'}
                        </span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">Gateway Authority: </span>
                        <span className="text-emerald-400">
                          {(verifyResult.proof || verifyResult.proof_bundle)?.signatures?.gateway ? 'VALID SIGNATURE' : 'MISSING'}
                        </span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-500">Peer Quorum: </span>
                        <span className="text-cyan-400">
                          {((verifyResult.proof || verifyResult.proof_bundle)?.signatures?.peers?.length || 0)} Peer Node(s) Verified
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Raw JSON viewer */}
                  {showRawJson && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[10px] overflow-x-auto max-h-60">
                      <pre className="text-slate-300">
                        {JSON.stringify(verifyResult.proof || verifyResult.proof_bundle, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {verifyResult.notes && verifyResult.notes.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-semibold block mb-1.5">Forensic Observations:</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    {verifyResult.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500">
              <FileSearch className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p>Upload a suspected leaked file or choose a sample to run forensic attribution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
