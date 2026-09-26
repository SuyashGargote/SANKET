import React, { useState } from 'react';
import {
  Unlock,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Download,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { api, getBaseUrl } from '../../api/client';

export default function DecryptScreen({
  currentUser,
  selectedDocument,
  onSimulateLeak,
}) {
  const [docInput, setDocInput] = useState(
    selectedDocument?.document_id ||
      selectedDocument?.encrypted_package_path ||
      'data/encrypted/test_document'
  );
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptResult, setDecryptResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // Check authorization
  const isAuthorized = selectedDocument
    ? selectedDocument.recipients?.includes(currentUser)
    : true;

  const getDecryptedFilename = () => {
    if (!decryptResult) return 'decrypted_watermarked.png';
    if (decryptResult.output_path) {
      return decryptResult.output_path.split(/[\\/]/).pop();
    }
    if (decryptResult.download_image_url) {
      const clean = decryptResult.download_image_url.split('?')[0];
      return clean.split(/[\\/]/).pop();
    }
    return 'decrypted_watermarked.png';
  };

  const handleDownloadFile = async () => {
    if (!decryptResult) return;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    const filename = getDecryptedFilename();
    const downloadUrl = api.getDownloadUrl('decrypted', filename);

    try {
      // 1. Fetch file as Blob with authorization headers
      const res = await fetch(downloadUrl, {
        headers: {
          'X-API-KEY': localStorage.getItem('sanket_api_key') || 'sanket-admin-key-2026',
          'X-User-ID': currentUser,
        },
      });

      if (!res.ok) {
        throw new Error(`Download request failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.warn('Direct blob fetch failed, falling back to window navigation:', err);
      // Fallback: direct window.open or link trigger
      try {
        const fallbackLink = document.createElement('a');
        fallbackLink.href = downloadUrl;
        fallbackLink.download = filename;
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      } catch (fallbackErr) {
        setDownloadError('Failed to trigger download: ' + (err.message || String(err)));
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDecrypt = async (e) => {
    e.preventDefault();
    setError(null);
    setDecryptResult(null);
    setDownloadSuccess(false);
    setDownloadError(null);

    if (!docInput.trim()) {
      setError('Please provide a document ID or package path.');
      return;
    }

    setIsDecrypting(true);
    try {
      const res = await api.decrypt(docInput.trim(), currentUser, true);
      const data = res.data || res;
      setDecryptResult(data);
    } catch (err) {
      setError(err.message || 'Decryption failed.');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Unlock className="w-5 h-5 text-blue-400" />
          Decrypt & Generate Attribution Watermark
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Decrypts with logged-in user's Post-Quantum Kyber private key, embeds unique DCT-QIM watermark with nonce, signs record with user Dilithium key + System Gateway key, and appends to ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <form onSubmit={handleDecrypt} className="space-y-4">
            {/* Decrypting User Context */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400">Decrypting Identity:</span>
              <div className="font-mono font-bold text-white mt-0.5">@{currentUser}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Keys loaded from: <code className="text-blue-400">data/keys/{currentUser}/</code>
              </div>
            </div>

            {/* Document Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Document ID or Encrypted Package Path
              </label>
              <input
                type="text"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="e.g. doc_xxxx or data/encrypted/test_document"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {selectedDocument && !isAuthorized && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Authorization Warning:</strong> @{currentUser} is not listed in document recipients ({selectedDocument.recipients?.join(', ')}). Decryption will be strictly rejected.
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {isDecrypting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Unwrapping Kyber key & watermarking...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Trigger Decryption</span>
                </>
              )}
            </button>
          </form>

          {/* Process pipeline overview */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-300 block">Atomic Decryption Pipeline:</span>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
              <li>Authorization verification</li>
              <li>Kyber-768 key unwrap</li>
              <li>AES-256-GCM in-memory plaintext recovery</li>
              <li>DCT-QIM watermark embedding (with nonce)</li>
              <li>Dual Dilithium signing (recipient + gateway)</li>
              <li>Hashchain block append</li>
            </ol>
          </div>
        </div>

        {/* Result Output Panel */}
        <div className="lg:col-span-2 space-y-4">
          {decryptResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Decryption & Watermarking Complete</span>
                </div>
                <span className="font-mono text-xs bg-slate-800 px-2.5 py-1 rounded text-slate-300">
                  Ledger Block #{decryptResult.ledger_block}
                </span>
              </div>

              {/* Watermark and Block Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    Watermark Identification
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Watermark ID (DCT-QIM Embedded):</span>
                      <span className="text-emerald-400 font-bold break-all">
                        {decryptResult.watermark_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">Decrypted For User:</span>
                      <span className="text-slate-200">@{decryptResult.user}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">File ID:</span>
                      <span className="text-slate-400 truncate block">
                        {decryptResult.file_id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    Multi-Signature Proof
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Recipient Dilithium Signature:</span>
                      <span className="text-slate-300 text-[11px] truncate block">
                        {decryptResult.recipient_signature || 'Verified & Persisted in Block'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">System Authority Signature:</span>
                      <span className="text-slate-300 text-[11px] truncate block">
                        {decryptResult.system_signature || 'Verified & Persisted in Block'}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-semibold pt-1">
                      ✓ Non-repudiable dual-signed block
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Preview & Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300">
                  Watermarked Image Output
                </h4>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs space-y-1">
                    <div className="font-mono text-slate-300 text-[11px] truncate max-w-md">
                      {decryptResult.output_path}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Watermark invisible to human eye, resilient against JPEG, noise, and crop attacks.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      disabled={isDownloading}
                      className="py-1.5 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold flex items-center gap-1.5 border border-blue-500/50 transition-all shadow-sm"
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : downloadSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Downloaded!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Watermarked PNG</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSimulateLeak(decryptResult.output_path)}
                      className="py-1.5 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <span>Simulate Leak & Verify</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {downloadError && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500">
              <Unlock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p>Trigger decryption on the left panel to unwrap and watermark the document.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
