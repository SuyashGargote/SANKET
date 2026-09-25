import React, { useState } from 'react';
import {
  Upload,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  FileText,
  ArrowRight,
  Shield,
  Download,
} from 'lucide-react';
import { api } from '../api/client';

export default function SendFileTab({
  currentUser = 'alice',
  onFileSent,
  onNavigateMyFiles,
  onSelectUser,
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const otherUser = currentUser.toLowerCase() === 'alice' ? 'bob' : 'alice';
  const [recipients, setRecipients] = useState(otherUser);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to send.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Include current user in recipients so both can access if needed
      const fullRecipients = `${recipients},${currentUser}`;
      const res = await api.encrypt(file, fullRecipients, true);
      const payload = res.data || res;
      setResult(payload);
      if (onFileSent) {
        onFileSent(payload.package_path);
      }
    } catch (err) {
      setError(err.message || 'Failed to encrypt and send file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Send Secure File
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Files are automatically encrypted with AES-256-GCM. Each recipient receives a cryptographically watermarked copy upon opening.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Notification */}
      {result && (
        <div className="panel rounded-xl p-5 border border-emerald-500/30 bg-emerald-950/20 space-y-3">
          <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>File Encrypted & Sent Successfully!</span>
          </div>
          <p className="text-xs text-slate-300">
            Package has been securely dispatched to <strong className="text-white uppercase font-mono">{recipients}</strong>.
            The recipient will find it waiting in their <strong>Received Files</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onSelectUser && (
              <button
                type="button"
                onClick={() => {
                  onSelectUser(otherUser);
                  if (onNavigateMyFiles) onNavigateMyFiles();
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center space-x-1.5"
              >
                <span>Switch to {otherUser.toUpperCase()} to open & decrypt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onNavigateMyFiles && (
              <button
                type="button"
                onClick={onNavigateMyFiles}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
              >
                Go to My Files
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSend} className="panel rounded-2xl p-6 border border-slate-800 space-y-5">
        {/* Dropzone */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Upload Document (PNG)
          </label>
          <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-8 text-center transition-colors bg-slate-900/40">
            <input
              type="file"
              accept=".png"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <div className="p-3.5 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
                <Upload className="w-6 h-6" />
              </div>
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-white font-mono">{file.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Click to browse or drag & drop document
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports high-resolution PNG documents
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Recipient
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRecipients('bob')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                recipients === 'bob'
                  ? 'border-blue-500 bg-blue-600/10 text-white font-semibold shadow-sm'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="block text-sm font-semibold">Bob</span>
                <span className="block text-[11px] text-slate-500">bob@enterprise.internal</span>
              </div>
              <Users className="w-4 h-4 text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => setRecipients('alice')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                recipients === 'alice'
                  ? 'border-blue-500 bg-blue-600/10 text-white font-semibold shadow-sm'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="block text-sm font-semibold">Alice</span>
                <span className="block text-[11px] text-slate-500">alice@enterprise.internal</span>
              </div>
              <Users className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        </div>

        {/* Security Policy Information */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
            <Shield className="w-4 h-4 text-blue-500" />
            <span>Automatic Provenance Policy</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Upon download or viewing, SANKET will embed a non-removable DCT-QIM watermark tied to the recipient's key. If this file is subsequently photographed or screenshotted and leaked, attribution is guaranteed.
          </p>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !file}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Encrypting with AES-256-GCM...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Send Encrypted Document</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
