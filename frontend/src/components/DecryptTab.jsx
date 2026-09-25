import React, { useState, useEffect } from 'react';
import {
  Unlock,
  User,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Hash,
  ShieldCheck,
  Copy,
  Check,
  FolderGit2,
  ArrowRight,
  Search,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';

export default function DecryptTab({
  initialPackagePath,
  onFileDecrypted,
  onNavigateVerify,
  currentUser = 'bob',
  onUserChange,
}) {
  const [packagePath, setPackagePath] = useState(
    initialPackagePath || 'data/encrypted/test_document'
  );
  const [user, setUser] = useState(currentUser || 'bob');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Shared packages and decrypted files for multi-user LAN workflow
  const [sharedPackages, setSharedPackages] = useState([]);
  const [sharedDecrypted, setSharedDecrypted] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  // Keep user in sync if parent changes currentUser
  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser]);

  // Keep packagePath in sync if parent changes initialPackagePath
  useEffect(() => {
    if (initialPackagePath) {
      setPackagePath(initialPackagePath);
    }
  }, [initialPackagePath]);

  const fetchSharedData = async () => {
    setLoadingShared(true);
    try {
      const [pkgs, decs] = await Promise.allSettled([
        api.getSharedPackages(),
        api.getSharedDecrypted(),
      ]);
      if (pkgs.status === 'fulfilled') {
        setSharedPackages(pkgs.value.packages || []);
      }
      if (decs.status === 'fulfilled') {
        setSharedDecrypted(decs.value.decrypted_files || []);
      }
    } catch (err) {
      console.warn('Failed to load shared packages:', err);
    } finally {
      setLoadingShared(false);
    }
  };

  useEffect(() => {
    fetchSharedData();
  }, []);

  const handleSelectUser = (selectedUser) => {
    setUser(selectedUser);
    if (onUserChange) {
      onUserChange(selectedUser);
    }
  };

  const handleDecrypt = async (e) => {
    if (e) e.preventDefault();
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
      fetchSharedData();
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

  const filename = result?.output_path
    ? result.output_path.split(/[\\/]/).pop()
    : null;

  return (
    <div className="space-y-6">
      {/* Top 2-Column: Decrypt Form & Output Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Form */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Unlock className="w-5 h-5 text-indigo-400" />
              <span>Secure Decryption & Watermarking</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Recipient un-wraps AES key with X25519 private key. Each decryption binds a unique DCT-QIM watermark & Ed25519 signature to the ledger.
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Encrypted Package Directory
                </label>
                <span className="text-[11px] font-mono text-cyan-400">
                  Path on server
                </span>
              </div>
              <input
                type="text"
                value={packagePath}
                onChange={(e) => setPackagePath(e.target.value)}
                placeholder="data/encrypted/test_document"
                className="w-full px-4 py-2.5 rounded-xl bg-cyber-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500">Quick presets:</span>
                <button
                  type="button"
                  onClick={() => setPackagePath('data/encrypted/test_document')}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  test_document
                </button>
                {sharedPackages.slice(0, 2).map((pkg) => (
                  <button
                    key={pkg.package_path}
                    type="button"
                    onClick={() => setPackagePath(pkg.package_path)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50 truncate max-w-[160px]"
                    title={pkg.package_name}
                  >
                    {pkg.package_name}
                  </button>
                ))}
              </div>
            </div>

            {/* User Selector (Alice vs Bob) */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Decrypting Identity (Operator / User)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectUser('alice')}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-medium text-sm transition-all ${
                    user === 'alice'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'bg-cyber-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${user === 'alice' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                  <User className="w-4 h-4" />
                  <span>Alice</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectUser('bob')}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center space-x-2 font-medium text-sm transition-all ${
                    user === 'bob'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-md shadow-purple-500/20'
                      : 'bg-cyber-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${user === 'bob' ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'}`} />
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
                  <span>Decrypting & Embedding Watermark...</span>
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
                        {copied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="p-2 rounded bg-cyber-950 text-indigo-300 break-all border border-slate-800 text-[11px]">
                      {result.watermark_id}
                    </p>
                  </div>

                  <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                    <span>Signed Ledger Block:</span>
                    <span className="text-white font-semibold">
                      Block #{result.ledger_block}
                    </span>
                  </div>
                </div>

                {/* Download and Verify Actions */}
                <div className="grid grid-cols-2 gap-2">
                  {filename && (
                    <a
                      href={api.getDownloadUrl('decrypted', filename)}
                      download={filename}
                      className="py-2.5 px-3 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Download className="w-4 h-4 text-indigo-400" />
                      <span>Download PNG</span>
                    </a>
                  )}

                  {onNavigateVerify && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateVerify(
                          result.output_path || result.watermarked_image_path
                        )
                      }
                      className="py-2.5 px-3 rounded-xl font-semibold text-xs text-cyan-200 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 transition-colors flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-950/50"
                    >
                      <Search className="w-4 h-4 text-cyan-400" />
                      <span>Verify Leaked Copy</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 space-y-2">
                <ImageIcon className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No decrypted output yet.</p>
                <p className="text-[11px] text-slate-600">
                  Select package below and click Decrypt.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
            <span>💡 Shared: Encrypted once by Alice, decrypted independently by Bob.</span>
          </div>
        </div>
      </div>

      {/* Shared Workflow: Shared Encrypted Packages Panel (Requirement 3) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/50">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Shared Packages on Network</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-800 text-slate-300">
                  {sharedPackages.length} packages
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Alice encrypts files on her device → automatically available for Bob to decrypt on any LAN device.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSharedData}
            disabled={loadingShared}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 self-start sm:self-auto disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loadingShared ? 'animate-spin' : ''}`} />
            <span>Refresh Shared Data</span>
          </button>
        </div>

        {sharedPackages.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
            No packages found. Use the Encrypt tab to distribute a document.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedPackages.map((pkg) => {
              const isSelected = packagePath === pkg.package_path;
              const isAuthorized =
                pkg.recipients && pkg.recipients.includes(user);

              return (
                <div
                  key={pkg.package_path}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                      : 'bg-cyber-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-xs font-mono font-bold text-white truncate"
                        title={pkg.package_name}
                      >
                        {pkg.package_name}
                      </span>
                      {isAuthorized ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0">
                          {user.toUpperCase()} AUTHORIZED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 shrink-0">
                          NOT IN RECIPIENTS
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      {pkg.package_path}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-slate-500">Recipients:</span>
                      {pkg.recipients && pkg.recipients.length > 0 ? (
                        pkg.recipients.map((r) => (
                          <span
                            key={r}
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                              r === user
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-700 font-bold'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {r}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPackagePath(pkg.package_path);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <span>{isSelected ? '✓ Selected' : 'Select for Decryption'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
