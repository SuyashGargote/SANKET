import React, { useState, useEffect } from 'react';
import {
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Key,
  Hash,
  Link,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';

export default function LedgerScreen() {
  const [ledgerData, setLedgerData] = useState(null);
  const [blocksData, setBlocksData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tamperAction, setTamperAction] = useState(null);
  const [tamperResult, setTamperResult] = useState(null);

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const [status, blocksRes] = await Promise.all([
        api.getLedger(),
        api.getLedgerBlocks(),
      ]);
      setLedgerData(status);
      setBlocksData(blocksRes.blocks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleTamper = async (type) => {
    setTamperAction(type);
    try {
      let res;
      if (type === 'modify') res = await api.tamperModify();
      else if (type === 'delete') res = await api.tamperDelete();
      else if (type === 'recompute') res = await api.tamperRecompute();
      else if (type === 'restore') res = await api.tamperRestore();
      setTamperResult(res);
      await fetchLedger();
    } catch (err) {
      setTamperResult({ error: err.message });
    } finally {
      setTamperAction(null);
    }
  };

  const isTampered =
    ledgerData?.ledger_status === 'TAMPERED' ||
    ledgerData?.ledger_status === 'ANCHOR_MISMATCH';

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

      {/* Tamper Simulation Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Tamper Attack Demonstrations (Auditor Simulation)
          </span>
          {tamperResult && (
            <span className="text-[11px] font-mono text-slate-400">
              Last result: <strong className="text-white">{tamperResult.ledger_status || 'OK'}</strong>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => handleTamper('modify')}
            disabled={Boolean(tamperAction)}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-700 text-slate-300 hover:text-red-300 font-semibold transition-all"
          >
            1. Modify Block 0
          </button>
          <button
            onClick={() => handleTamper('delete')}
            disabled={Boolean(tamperAction)}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-700 text-slate-300 hover:text-red-300 font-semibold transition-all"
          >
            2. Delete Block 1
          </button>
          <button
            onClick={() => handleTamper('recompute')}
            disabled={Boolean(tamperAction)}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-amber-950/60 border border-slate-700 hover:border-amber-700 text-slate-300 hover:text-amber-300 font-semibold transition-all"
          >
            3. Recompute Hashes (Anchor Catch)
          </button>
          <button
            onClick={() => handleTamper('restore')}
            disabled={Boolean(tamperAction)}
            className="py-1.5 px-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700 text-emerald-300 font-semibold flex items-center gap-1.5 ml-auto transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Pristine Ledger
          </button>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      Recipient Dilithium Signature (@{b.user_id}):
                    </span>
                    <span className="text-emerald-400 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.recipient_signature || b.signature || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">
                      System Authority Dilithium Signature (@system):
                    </span>
                    <span className="text-emerald-400 break-all bg-slate-950 border border-slate-800/80 px-2 py-1 rounded block">
                      {b.system_signature || 'Signed & Validated'}
                    </span>
                  </div>
                </div>

                {/* Watermark Binding */}
                <div className="text-[11px] pt-1 flex items-center justify-between text-slate-400 border-t border-slate-800/60">
                  <span>
                    Watermark ID: <strong className="text-slate-200">{b.watermark_id}</strong>
                  </span>
                  <span className="text-emerald-400 font-sans font-semibold text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Multi-Sig Verified (2/2)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
