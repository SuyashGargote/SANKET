import React, { useState } from 'react';
import { Send, Upload, FileCheck, Users, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

export default function SendScreen({
  currentUser,
  users,
  onDocumentSent,
  onNavigateInbox,
}) {
  const [file, setFile] = useState(null);
  const [useSample, setUseSample] = useState(true);
  const [selectedRecipients, setSelectedRecipients] = useState(['bob']);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const toggleRecipient = (uid) => {
    setSelectedRecipients((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (selectedRecipients.length === 0) {
      setError('Please select at least one recipient.');
      return;
    }

    if (!useSample && !file) {
      setError('Please select a PNG file to upload or enable the sample document.');
      return;
    }

    setIsSending(true);
    try {
      let res;
      if (useSample) {
        res = await api.sendDocument(
          null,
          selectedRecipients,
          currentUser,
          'data/test_document.png'
        );
      } else {
        res = await api.sendDocument(file, selectedRecipients, currentUser);
      }
      setResult(res);
      if (onDocumentSent) {
        onDocumentSent(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to distribute document');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-400" />
          Send & Distribute Document
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Distribute document with single logical encryption. The AES-256-GCM ciphertext is shared once, and the file key is encapsulated for each selected recipient using Post-Quantum Kyber (ML-KEM-768).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <form onSubmit={handleSend} className="space-y-5">
            {/* Sender Identity Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-xs">
                <span className="text-slate-400">Authenticated Sender:</span>
                <span className="ml-2 font-mono font-bold text-white">@{currentUser}</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                Identity Bound
              </span>
            </div>

            {/* Document Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                1. Select Document (PNG only)
              </label>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSample}
                    onChange={(e) => {
                      setUseSample(e.target.checked);
                      if (e.target.checked) setFile(null);
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Use standard classified brief (<code className="text-blue-400">test_document.png</code>)</span>
                </label>
              </div>

              {!useSample && (
                <div className="border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-xl p-6 text-center transition-all bg-slate-950/40">
                  <input
                    type="file"
                    id="file-upload"
                    accept=".png"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    {file ? (
                      <p className="text-xs text-emerald-400 font-medium">
                        Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Click to upload or drag & drop PNG file
                      </p>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Recipient Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>2. Select Authorized Recipients</span>
                <span className="text-[11px] text-slate-400">
                  {selectedRecipients.length} selected
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {users
                  .filter((u) => u.user_id !== 'system')
                  .map((u) => {
                    const isChecked = selectedRecipients.includes(u.user_id);
                    return (
                      <div
                        key={u.user_id}
                        onClick={() => toggleRecipient(u.user_id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'bg-blue-950/40 border-blue-500/60 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">
                            {u.name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            @{u.user_id}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 pointer-events-none"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Encrypting once & registering distribution...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Distribute Document to Selected Recipients</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Status / Output Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Cryptographic Guarantees
            </h3>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-slate-200">1. Single Encrypted File</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  No duplicate storage per user. File is encrypted once with AES-256-GCM.
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-slate-200">2. Post-Quantum KEM</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  ML-KEM-768 encapsulates file key individually for each recipient's public key.
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="font-semibold text-slate-200">3. Registry Authorization</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Only explicitly listed recipients can view and attempt decryption.
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Document Distributed Successfully</span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[11px]">Document ID:</span>
                  <div className="text-blue-400 font-bold">{result.document_id}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Recipients:</span>
                  <div className="text-slate-200">{result.recipients?.join(', ')}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Package Path:</span>
                  <div className="text-slate-300 text-[11px] truncate">{result.encrypted_package_path}</div>
                </div>
              </div>

              <button
                onClick={onNavigateInbox}
                className="w-full mt-2 py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all"
              >
                View in Inbox →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
