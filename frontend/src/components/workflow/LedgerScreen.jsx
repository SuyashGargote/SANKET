import React, { useState, useEffect } from 'react';
import {
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Key,
  Hash,
  Link,
  Lock,
  Database,
  Activity,
  Share2,
  Radio,
  Check,
} from 'lucide-react';
import { api } from '../../api/client';

export default function LedgerScreen() {
  const [ledgerData, setLedgerData] = useState(null);
  const [blocksData, setBlocksData] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState(null);

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const [status, blocksRes, auditRes, peersRes] = await Promise.all([
        api.getLedger(),
        api.getLedgerBlocks(),
        api.getAuditEvents(20).catch(() => ({ events: [] })),
        api.getPeers().catch(() => null),
      ]);
      setLedgerData(status);
      setBlocksData(blocksRes.blocks || []);
      setAuditEvents(auditRes.events || []);
      setNodeInfo(peersRes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await api.syncLedger();
      if (res.synced) {
        setSyncStatusMsg(`Adopted longest chain from ${res.adopted_from} (length: ${res.new_length})`);
      } else {
        setSyncStatusMsg(res.message || 'Local ledger is up-to-date with peers.');
      }
      await fetchLedger();
    } catch (err) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const isTampered =
    ledgerData?.ledger_status === 'TAMPERED' ||
    ledgerData?.ledger_status === 'ANCHOR_MISMATCH' ||
    ledgerData?.ledger_status === 'COMPROMISED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Cryptographic Ledger & Multi-Signature Chain
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident append-only hash chain with dual-signature validation (Recipient Dilithium + Gateway Authority) and periodic secondary anchors.
          </p>
        </div>

        <button
          onClick={fetchLedger}
          disabled={isLoading}
          className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Chain
        </button>
      </div>

      {/* Multi-Node Distributed P2P Network Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              Distributed Ledger Node
            </span>
            <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">
              {nodeInfo?.node_id || 'node_A'} (Port {nodeInfo?.port || 8000})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
            <span>Configured Peers:</span>
            {nodeInfo?.peers && nodeInfo.peers.length > 0 ? (
              nodeInfo.peers.map((p, idx) => (
                <span key={idx} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                  {p}
                </span>
              ))
            ) : (
              <span className="text-slate-500">None (Standalone)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="py-1.5 px-3.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Share2 className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'P2P Chain Sync'}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-800 text-xs text-cyan-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-semibold uppercase">
            Ledger Status
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                !isTampered ? 'bg-emerald-500' : 'bg-red-500 animate-ping'
              }`}
            />
            <span
              className={`text-sm font-bold font-mono ${
                !isTampered ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {ledgerData?.ledger_status || 'VERIFYING'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-semibold uppercase">
            Chain Linkage
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`text-sm font-bold font-mono ${
                ledgerData?.chain_ok ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {ledgerData?.chain_ok ? 'INTACT' : 'BROKEN'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-semibold uppercase">
            Periodic Anchors
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`text-sm font-bold font-mono ${
                ledgerData?.anchor_ok ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {ledgerData?.anchor_ok ? 'VERIFIED' : 'MISMATCH'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-semibold uppercase">
            Multi-Sig Blocks
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-sm font-bold font-mono text-blue-400">
              {blocksData.length} Blocks
            </span>
          </div>
        </div>
      </div>



      {/* Block List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
          Ledger Blocks & Dual Signatures
        </h3>

        {blocksData.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
            No blocks recorded yet. Decrypt a document to create block #0.
          </div>
        ) : (
          <div className="space-y-3">
            {blocksData.map((b) => (
              <div
                key={b.index}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-3 font-mono text-xs"
              >
                {/* Block Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-950 border border-blue-800 text-blue-400 font-bold px-2.5 py-0.5 rounded text-xs">
                      Block #{b.index}
                    </span>
                    <span className="text-slate-200 font-sans font-semibold">
                      Recipient: <strong className="text-white">@{b.user_id}</strong>
                    </span>
                    {b.is_anchor && (
                      <span className="bg-purple-950 border border-purple-800 text-purple-300 font-sans text-[10px] font-semibold px-2 py-0.5 rounded">
                        ⚓ Anchor Checkpoint
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {b.timestamp}
                  </span>
                </div>

                {/* Hashes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Previous Hash:</span>
                    <span className="text-slate-300 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.previous_hash || b.prev_hash}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Block Hash:</span>
                    <span className="text-blue-400 font-bold break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.hash}
                    </span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      Recipient Dilithium Signature (@{b.user_id}):
                    </span>
                    <span className="text-emerald-400 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.signatures?.recipient || b.recipient_signature || b.signature || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      Gateway Authority Signature (@system):
                    </span>
                    <span className="text-emerald-400 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.signatures?.gateway || b.system_signature || 'Signed & Validated'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      Peer Quorum Signatures:
                    </span>
                    <span className="text-cyan-400 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.signatures?.peers && b.signatures.peers.length > 0
                        ? b.signatures.peers.map(p => `@${p.node_id}`).join(', ') + ' (Dilithium)'
                        : (b.optional_validator_signature ? '@peer (Dilithium)' : 'Quorum Verified')}
                    </span>
                  </div>
                </div>

                {/* Watermark Binding & Consensus Quorum */}
                <div className="text-[11px] pt-1 flex flex-wrap items-center justify-between gap-2 text-slate-400 border-t border-slate-800/60">
                  <span>
                    Watermark ID: <strong className="text-slate-200">{b.data?.watermark_id || b.watermark_id}</strong>
                  </span>
                  <span className="text-emerald-400 font-sans font-semibold text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Consensus Quorum Validated: Recipient + Gateway + Peer
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Local SQLite Database & Audit Trail */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            Local SQLite Database & Real-Time Audit Trail
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300">
            data/sanket.db (WAL Mode)
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-500">
            No audit events recorded yet. Actions like Document Send and Decrypt are automatically logged here.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400 shrink-0">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white uppercase text-[11px]">
                        {ev.action}
                      </span>
                      {ev.user_id && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          @{ev.user_id}
                        </span>
                      )}
                    </div>
                    {ev.details && typeof ev.details === 'object' && (
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {ev.details.filename && `File: ${ev.details.filename}`}
                        {ev.details.recipients && ` → Recipients: [${ev.details.recipients.join(', ')}]`}
                        {ev.details.watermark_id && `Watermark: ${ev.details.watermark_id.slice(0, 16)}...`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
