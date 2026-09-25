import React, { useState } from 'react';
import { Unlock, User, Download, CheckCircle2, AlertCircle, RefreshCw, Image as ImageIcon, Hash, ShieldCheck, Copy, Check } from 'lucide-react';
import { api } from '../api/client';

export default function DecryptTab({ initialPackagePath, onFileDecrypted }) {
  const [packagePath, setPackagePath] = useState(initialPackagePath || 'data/encrypted/test_document');
  const [user, setUser] = useState('alice');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!packagePath || !user) {
      setError('Please provide package path and select a user.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.decrypt(packagePath, user, true);
      const payload = res.data || res;
      setResult(payload);
      if (onFileDecrypted) {
        onFileDecrypted(payload.output_path || payload.watermarked_image_path);
      }
    } catch (err) {
      setError(err.message || 'Decryption failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filename = result?.output_path ? result.output_path.split(/[\\/]/).pop() : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Input Form */}
      <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Unlock className="w-5 h-5 text-indigo-400" />
            <span>Secure Decryption & Watermarking</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Raw decrypted bytes are strictly protected. Each decryption automatically embeds a unique DCT-QIM watermark.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleDecrypt} className="space-y-4">
          {/* Package Path */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Encrypted Package Directory
            </label>
            <input
              type="text"
              value={packagePath}
              onChange={(e) => setPackagePath(e.target.value)}
              placeholder="data/encrypted/test_document"
              className="w-full px-4 py-2.5 rounded-xl bg-cyber-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-[11px] text-slate-500">Quick presets:</span>
              <button
                type="button"
                onClick={() => setPackagePath('data/encrypted/test_document')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                test_document
              </button>
            </div>
          </div>

          {/* User Selector */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Decrypting Identity (User)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUser('alice')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-medium text-sm transition-all ${
                  user === 'alice'
                    ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/20'
                    : 'bg-cyber-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Alice</span>
              </button>
              <button
                type="button"
                onClick={() => setUser('bob')}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-medium text-sm transition-all ${
                  user === 'bob'
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-md shadow-purple-500/20'
                    : 'bg-cyber-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Bob</span>
              </button>
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                <span>Decrypting & Watermarking...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-indigo-200" />
                <span>Decrypt as {user.toUpperCase()}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Output: Watermarked Image Preview & Ledger Record */}
      <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            <span>Watermarked Output Preview</span>
          </h3>

          {result ? (
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Decrypted & Attributed to {result.user.toUpperCase()}</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-300">
                  Block #{result.ledger_block ?? '--'}
                </span>
              </div>

              {/* Watermarked Image Display */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-cyber-950/80 flex items-center justify-center p-4">
                <img
                  src={api.getDownloadUrl('decrypted', filename)}
                  alt="Watermarked Output"
                  className="max-h-56 object-contain rounded-lg shadow-lg border border-slate-800"
                  onError={(e) => {
                    // Fallback to placeholder if not loaded immediately
                    e.target.style.display = 'none';
                  }}
                />
              </div>

              {/* Watermark Details Card */}
              <div className="p-3.5 rounded-xl bg-cyber-900/60 border border-slate-800 space-y-2.5 text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span className="flex items-center space-x-1">
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>Watermark ID (128-bit DCT-QIM):</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(result.watermark_id)}
                      className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="p-2 rounded bg-cyber-950 text-indigo-300 break-all border border-slate-800 text-[11px]">
                    {result.watermark_id}
                  </p>
                </div>

                <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                  <span>Signed Ledger Block:</span>
                  <span className="text-white font-semibold">Block #{result.ledger_block}</span>
                </div>
              </div>

              {/* Download Image Button */}
              {filename && (
                <a
                  href={api.getDownloadUrl('decrypted', filename)}
                  download={filename}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4 text-indigo-400" />
                  <span>Download Watermarked PNG</span>
                </a>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 space-y-2">
              <ImageIcon className="w-8 h-8 text-slate-600" />
              <p className="text-xs">No decrypted output yet.</p>
              <p className="text-[11px] text-slate-600">Select user and package, then click Decrypt.</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>💡 Next: Test leak verification in the Verify tab.</span>
        </div>
      </div>
    </div>
  );
}
