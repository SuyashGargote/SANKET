import React, { useState, useEffect } from 'react';
import { Server, ShieldCheck, ShieldAlert, RefreshCw, Anchor, CheckCircle2, Lock, Link, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

export default function LedgerTab() {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLedger();
      setLedgerData(res);
    } catch (err) {
      setError(err.message || 'Failed to verify ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const isValid = ledgerData?.ledger_status === 'VALID' && ledgerData?.chain_ok;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <Server className="w-6 h-6 text-cyan-400" />
            <span>Anchored Hash-Chain Ledger Explorer</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident append-only ledger secured by SHA-256 hash chains, Ed25519 digital signatures, and periodic secondary anchors.
          </p>
        </div>

        <button
          onClick={fetchLedger}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-2 self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Audit Ledger</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Ledger Status Banner */}
      {ledgerData && (
        <div
          className={`p-6 rounded-2xl border-2 ${
            isValid
              ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-500/10'
          } space-y-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`p-3 rounded-2xl ${
                  isValid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {isValid ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Ledger Integrity State</span>
                <h3 className={`text-2xl font-black font-mono ${isValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {ledgerData.ledger_status}
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  ledgerData.chain_ok
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}
              >
                Chain Hash Linkage: {ledgerData.chain_ok ? 'VERIFIED' : 'TAMPERED'}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  ledgerData.anchor_ok
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-amber-950 text-amber-300 border-amber-700'
                }`}
              >
                Secondary Anchors: {ledgerData.anchor_ok ? 'VERIFIED' : 'MISMATCH'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-xl border border-white/5">
            {ledgerData.message}
          </p>
        </div>
      )}

      {/* Security Properties Explanation for Judges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 text-sm font-bold">
            <Link className="w-4 h-4" />
            <span>Cryptographic Linkage</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every block's hash incorporates the preceding block's hash. Modifying, deleting, or reordering any block breaks all downstream linkage.
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 text-sm font-bold">
            <Anchor className="w-4 h-4" />
            <span>Periodic Anchors</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every 5 blocks, a secondary state hash snapshot is written to <code>anchors.json</code>. If an attacker recomputes chain hashes, secondary anchors immediately detect the tampering!
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 text-sm font-bold">
            <Lock className="w-4 h-4" />
            <span>Non-Repudiation</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Decryption events are signed with the recipient's Ed25519 private key. The leaker cannot claim that an attacker or admin forged the record.
          </p>
        </div>
      </div>
    </div>
  );
}
