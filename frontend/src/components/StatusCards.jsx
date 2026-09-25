import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, FileText, Anchor, Clock, Server, HardDrive } from 'lucide-react';

export default function StatusCards({ statusData, isLoading, error }) {
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>Cannot connect to backend: {error}</span>
        </div>
        <span className="text-xs font-mono text-rose-400">Check if FastAPI is running on port 8000</span>
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
  const uptime = statusData?.uptime_seconds ? `${Math.floor(statusData.uptime_seconds / 60)}m ${Math.floor(statusData.uptime_seconds % 60)}s` : '--';

  return (
    <div className="space-y-4">
      {/* 4 Main Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: System Status */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              System Health
            </span>
            <div className={`p-2 rounded-xl ${isHealthy ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'}`}>
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-2xl font-bold tracking-tight font-mono ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {statusData?.system_health || (isLoading ? 'Checking...' : 'UNKNOWN')}
            </span>
          </div>
          <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Uptime: <strong className="text-slate-300 font-mono">{uptime}</strong></span>
          </div>
        </div>

        {/* Card 2: Ledger Health */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Ledger Integrity
            </span>
            <div className={`p-2 rounded-xl ${isLedgerValid ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'}`}>
              {isLedgerValid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-2xl font-bold tracking-tight font-mono ${isLedgerValid ? 'text-cyan-400' : 'text-rose-400'}`}>
              {statusData?.ledger_status || (isLoading ? 'Verifying...' : 'OFFLINE')}
            </span>
            {isLedgerValid && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                Chain OK
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-400">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>Blocks: <strong className="text-slate-300 font-mono">{ledgerSize} sealed</strong></span>
          </div>
        </div>

        {/* Card 3: Files Processed */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Files Processed
            </span>
            <div className="p-2 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/40">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold tracking-tight text-white font-mono">
              {totalFiles}
            </span>
            <span className="text-xs text-slate-400">total artifacts</span>
          </div>
          <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Decrypted: <strong className="text-slate-300 font-mono">{statusData?.total_decryptions ?? 0}</strong>
            </span>
          </div>
        </div>

        {/* Card 4: Last Anchor Block Index */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Last Anchor Index
            </span>
            <div className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Anchor className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-bold tracking-tight text-amber-400 font-mono">
              {lastAnchor}
            </span>
          </div>
          <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>
              Status: <strong className="text-slate-300 font-mono">{statusData?.anchor_ok ? 'Anchors Intact' : 'No Mismatch'}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
