import React from 'react';
import { ShieldCheck, Fingerprint, RefreshCw, FileCheck2 } from 'lucide-react';

export default function SimplifiedExplanation({ className = '' }) {
  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-cyan-500/30 bg-gradient-to-br from-cyber-950/90 to-cyber-900/60 shadow-lg shadow-cyan-950/30 ${className}`}
    >
      <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-800/80">
        <div className="p-1.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
          <FileCheck2 className="w-4 h-4" />
        </div>
        <h4 className="text-sm font-bold font-mono tracking-wider text-white uppercase">
          How we proved it
        </h4>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400 ml-auto">
          3-Point Forensic Attestation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Line 1 */}
        <div className="flex items-start space-x-3 p-3 rounded-xl bg-cyber-900/50 border border-slate-800">
          <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 shrink-0">
            <Fingerprint className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white font-mono">
              1. Unique watermark per user
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Each recipient receives a mathematically distinct 128-bit DCT-QIM watermark bound to their cryptographic key.
            </p>
          </div>
        </div>

        {/* Line 2 */}
        <div className="flex items-start space-x-3 p-3 rounded-xl bg-cyber-900/50 border border-slate-800">
          <div className="p-2 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/50 shrink-0">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white font-mono">
              2. Survives tampering
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Multi-coefficient redundant embedding survives hostile cropping, compression, noise, and resizing attacks.
            </p>
          </div>
        </div>

        {/* Line 3 */}
        <div className="flex items-start space-x-3 p-3 rounded-xl bg-cyber-900/50 border border-slate-800">
          <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white font-mono">
              3. Verified using forensic signals + ledger
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Multi-signal confidence engine cross-references the anchored hash chain to establish court-admissible non-repudiation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
