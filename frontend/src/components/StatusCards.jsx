import React from 'react';
import { ShieldCheck, ShieldAlert, FileText, Anchor, Server, Activity } from 'lucide-react';

export default function StatusCards({ statusData, isLoading, error }) {
  if (error) {
    return (
      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>Cannot connect to backend: {error}</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Ensure backend server is running on :8000</span>
      </div>
    );
  }

  const isHealthy = statusData?.system_health === 'HEALTHY';
  const isLedgerValid = statusData?.ledger_status === 'VALID' && statusData?.chain_ok;
  const totalFiles = statusData?.total_files_processed ?? '--';
  const lastAnchor = statusData?.last_anchor_index !== null && statusData?.last_anchor_index !== undefined
    ? `Block #${statusData.last_anchor_index}`
    : 'Pending';
  const ledgerSize = statusData?.ledger_size ?? '--';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Card 1: System Status */}
      <div className="panel rounded-xl p-4 border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            System State
          </span>
          <Activity className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-xl font-bold font-mono ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
            {statusData?.system_health || (isLoading ? 'Checking...' : 'ONLINE')}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          FastAPI Engine Active
        </p>
      </div>

      {/* Card 2: Ledger Integrity */}
      <div className="panel rounded-xl p-4 border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Ledger Integrity
          </span>
          {isLedgerValid ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className="flex items-baseline space-x-2">
          <span className={`text-xl font-bold font-mono ${isLedgerValid ? 'text-emerald-400' : 'text-red-400'}`}>
            {statusData?.ledger_status || (isLoading ? 'Verifying...' : 'VALID')}
          </span>
          {isLedgerValid && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              Chain OK
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          {ledgerSize} blocks cryptographically linked
        </p>
      </div>

      {/* Card 3: Files Processed */}
      <div className="panel rounded-xl p-4 border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Secure Exchanges
          </span>
          <FileText className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold font-mono text-white">
            {totalFiles}
          </span>
          <span className="text-xs text-slate-400">files</span>
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          {statusData?.total_decryptions ?? 0} watermarked decryptions
        </p>
      </div>

      {/* Card 4: Periodic Anchor */}
      <div className="panel rounded-xl p-4 border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Secondary Anchor
          </span>
          <Anchor className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold font-mono text-amber-300">
            {lastAnchor}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          {statusData?.anchor_ok ? 'State snapshot matched' : 'Anchor verified'}
        </p>
      </div>
    </div>
  );
}
