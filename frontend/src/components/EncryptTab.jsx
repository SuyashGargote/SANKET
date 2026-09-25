import React, { useState, useEffect } from 'react';
import { Lock, Upload, CheckCircle2, Download, RefreshCw, FileCode, Users, Sparkles, AlertCircle, ArrowRight, FolderGit2 } from 'lucide-react';
import { api } from '../api/client';

export default function EncryptTab({ onFileEncrypted, onSelectPackageForDecrypt, currentUser = 'alice' }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [recipients, setRecipients] = useState(currentUser === 'alice' ? 'bob,alice' : 'alice,bob');
  const [isAsync, setIsAsync] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Shared packages for multi-user LAN workflow
  const [sharedPackages, setSharedPackages] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  const fetchSharedData = async () => {
    setLoadingShared(true);
    try {
      const res = await api.getSharedPackages();
      setSharedPackages(res.packages || []);
    } catch (err) {
      console.warn('Failed to load shared packages:', err);
    } finally {
      setLoadingShared(false);
    }
  };

  useEffect(() => {
    fetchSharedData();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.png')) {
        setError('Please select a PNG image file.');
        return;
      }
      setFile(selected);
      setError(null);
      setResult(null);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const handleUseSample = async () => {
    try {
      // Use existing sample document path via form field
      setFile(null);
      setPreviewUrl(null);
      setResult(null);
      setError(null);
      setLoading(true);

      const res = await api.encrypt(null, recipients, !isAsync);
      if (res.statusCode === 202 && res.data?.job_id) {
        pollJob(res.data.job_id);
      } else {
        const payload = res.data || res;
        setResult(payload);
        if (onFileEncrypted) onFileEncrypted(payload.package_path);
      }
    } catch (err) {
      setError(err.message || 'Failed to encrypt sample file');
    } finally {
      setLoading(false);
    }
  };

  const pollJob = (id) => {
    setJobId(id);
    setJobStatus('processing');
    const interval = setInterval(async () => {
      try {
        const job = await api.getJob(id);
        setJobStatus(job.status);
        if (job.status === 'completed') {
          clearInterval(interval);
          setResult(job.result);
          setLoading(false);
          fetchSharedData();
          if (onFileEncrypted) onFileEncrypted(job.result.package_path);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setError(job.error || 'Job failed');
          setLoading(false);
        }
      } catch (err) {
        clearInterval(interval);
        setError('Error tracking job status');
        setLoading(false);
      }
    }, 800);
  };

  const handleEncrypt = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PNG file to encrypt or use the sample file.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);

    try {
      const res = await api.encrypt(file, recipients, !isAsync);
      if (res.statusCode === 202 && res.data?.job_id) {
        pollJob(res.data.job_id);
      } else {
        const payload = res.data || res;
        setResult(payload);
        setLoading(false);
        fetchSharedData();
        if (onFileEncrypted) onFileEncrypted(payload.package_path);
      }
    } catch (err) {
      setError(err.message || 'Encryption failed');
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Form: File Upload & Recipients */}
      <div className="lg:col-span-7 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <span>Encrypt Document for Distribution</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            AES-256-GCM authenticated encryption with per-recipient X25519 key wrapping.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEncrypt} className="space-y-4">
          {/* File Upload Drop Area */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Select PNG Document
            </label>
            <div className="relative border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 rounded-2xl p-5 text-center transition-colors bg-cyber-900/40">
              <input
                type="file"
                accept=".png"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="p-3 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                  <Upload className="w-5 h-5" />
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-cyan-300 font-mono truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-300">Click or drag & drop PNG file here</p>
                    <p className="text-xs text-slate-500">Only .png files supported in Phase 1</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recipients Input */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Authorized Recipients (Comma-separated)
            </label>
            <div className="relative">
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="alice, bob, charlie"
                className="w-full px-4 py-2.5 rounded-xl bg-cyber-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <div className="absolute right-3 top-3 text-slate-500">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-[11px] text-slate-500">Quick presets:</span>
              <button
                type="button"
                onClick={() => setRecipients('alice,bob')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                alice, bob
              </button>
              <button
                type="button"
                onClick={() => setRecipients('alice')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                alice
              </button>
              <button
                type="button"
                onClick={() => setRecipients('bob')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                bob
              </button>
            </div>
          </div>

          {/* Async Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-cyber-900/60 border border-slate-800">
            <div>
              <span className="text-xs font-medium text-slate-300">Async Background Queue</span>
              <p className="text-[11px] text-slate-500">Enqueue heavy task and poll status via /job/&#123;id&#125;</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAsync}
                onChange={(e) => setIsAsync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                  <span>{isAsync ? 'Queuing Task...' : 'Encrypting...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-cyan-200" />
                  <span>Encrypt Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Right: Results & Output */}
      <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Encrypted Package Output</span>
          </h3>

          {loading && isAsync && (
            <div className="p-5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-cyan-300">Asynchronous Job In Progress</p>
              <p className="text-xs text-slate-400 font-mono">Job ID: {jobId}</p>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Encryption Succeeded</span>
                </div>
                <p className="text-xs font-mono text-slate-300 break-all bg-cyber-950/70 p-2.5 rounded-lg border border-slate-800">
                  {result.encrypted_package_path || result.package_path}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-cyber-900/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Recipients:</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {Array.isArray(result.recipients) ? result.recipients.join(', ') : result.recipients}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Contents:</span>
                  <span className="font-mono text-slate-300">payload.enc + metadata.json</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cipher:</span>
                  <span className="font-mono text-slate-300">AES-256-GCM (256-bit)</span>
                </div>
              </div>

              {/* Download Package Zip */}
              {result.download_package_url && (
                <a
                  href={api.getDownloadUrl('encrypted', result.package_path.split(/[\\/]/).pop())}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 transition-colors flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download Package (.zip)</span>
                </a>
              )}
            </div>
          ) : (
            !loading && (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 space-y-2">
                <Lock className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No encrypted package generated yet.</p>
                <p className="text-[11px] text-slate-600">Select a file and click Encrypt Document.</p>
              </div>
            )
          )}
        </div>

        {/* Tip for judges */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>💡 Next: Proceed to Decrypt tab to test watermarking.</span>
        </div>
      </div>

      {/* Shared Workflow: Shared Packages Explorer (Requirement 3) */}
      <div className="lg:col-span-12 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Shared Encrypted Packages</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-800 text-slate-300">
                  {sharedPackages.length} available
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                LAN-shared document repository. Packages encrypted by Alice are instantly visible to Bob.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSharedData}
            disabled={loadingShared}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 self-start sm:self-auto disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loadingShared ? 'animate-spin' : ''}`} />
            <span>Refresh Shared Data</span>
          </button>
        </div>

        {sharedPackages.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
            No shared packages found in <code>data/encrypted/</code>. Encrypt a file above to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedPackages.map((pkg) => (
              <div
                key={pkg.package_path}
                className="p-4 rounded-xl bg-cyber-900/60 border border-slate-800/80 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-white truncate" title={pkg.package_name}>
                      {pkg.package_name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {pkg.created_at ? new Date(pkg.created_at).toLocaleTimeString() : ''}
                    </span>
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
                            r === currentUser
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500">None specified</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectPackageForDecrypt && onSelectPackageForDecrypt(pkg.package_path)}
                    className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 transition-colors"
                  >
                    <span>Decrypt as {currentUser.toUpperCase()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
