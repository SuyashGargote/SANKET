import React, { useState } from 'react';
import { X, Download, ShieldCheck, Hash, User, AlertTriangle, ArrowRight, Check, Copy } from 'lucide-react';
import { api } from '../api/client';

export default function DocumentViewerModal({ isOpen, onClose, documentData, currentUser, onSimulateLeak }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !documentData) return null;

  const filename = documentData.output_path
    ? documentData.output_path.split(/[\\/]/).pop()
    : 'document.png';

  const watermarkId = documentData.watermark_id || '--';
  const ledgerBlock = documentData.ledger_block ?? '--';
  const attributedUser = documentData.user || currentUser;

  const copyWatermark = () => {
    navigator.clipboard.writeText(watermarkId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl panel rounded-2xl border border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 bg-slate-900 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Decrypted Secure Document
              </h3>
              <p className="text-xs text-slate-400">
                Opened by <strong className="text-white uppercase">{attributedUser}</strong> • Watermark applied automatically
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice Banner */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">
              Provenance Protection Active
            </span>
            <span>
              This file has been embedded with an imperceptible 128-bit DCT-QIM watermark bound specifically to <strong>{attributedUser.toUpperCase()}</strong>. Decryption has been signed and anchored to ledger block #{ledgerBlock}.
            </span>
          </div>
        </div>

        {/* Document Preview */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-center min-h-[220px]">
          <img
            src={api.getDownloadUrl('decrypted', filename)}
            alt="Decrypted Document"
            className="max-h-60 object-contain rounded border border-slate-800 shadow"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>

        {/* Watermark & Ledger Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Watermark ID:</span>
              <button
                type="button"
                onClick={copyWatermark}
                className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-white font-semibold truncate" title={watermarkId}>
              {watermarkId}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[11px] block">Ledger Verification:</span>
            <p className="text-emerald-400 font-semibold">
              Recorded in Block #{ledgerBlock} (Signed ✓)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
          <a
            href={api.getDownloadUrl('decrypted', filename)}
            download={filename}
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Copy</span>
          </a>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {onSimulateLeak && (
              <button
                type="button"
                onClick={() => {
                  onSimulateLeak(documentData.output_path || documentData.watermarked_image_path);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Leak & Test Detection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
