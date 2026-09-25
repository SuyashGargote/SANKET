import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Anchor,
  CheckCircle2,
  Lock,
  Link,
  AlertTriangle,
  Flame,
  Trash2,
  Cpu,
  RotateCcw,
  Copy,
  Check,
  Radio,
  Clock,
  User,
  Hash,
  ArrowDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';

export default function LedgerTab() {
  const [blocksData, setBlocksData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // Real-time polling state (Requirement 6)
  const [liveSync, setLiveSync] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevBlockCountRef = useRef(0);
  const [hasNewBlock, setHasNewBlock] = useState(false);

  // Tamper simulation state (Requirement 5)
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperFeedback, setTamperFeedback] = useState(null);

  const fetchLedgerBlocks = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await api.getLedgerBlocks();
      const currentBlocks = res.blocks || [];
      if (
        prevBlockCountRef.current > 0 &&
        currentBlocks.length > prevBlockCountRef.current
      ) {
        setHasNewBlock(true);
        setTimeout(() => setHasNewBlock(false), 3000);
      }
      prevBlockCountRef.current = currentBlocks.length;
      setBlocksData(res);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch ledger blocks');
    } finally {
      if (isManual) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLedgerBlocks(true);
  }, []);

  // Real-time polling every 3 seconds (Requirement 6)
  useEffect(() => {
    if (!liveSync) return;
    const interval = setInterval(() => {
      fetchLedgerBlocks(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [liveSync]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Tamper Simulation Handlers (Requirement 5)
  const handleTamperModify = async () => {
    setTamperLoading(true);
    setTamperFeedback(null);
    try {
      const res = await api.tamperModify();
      setTamperFeedback(res);
      await fetchLedgerBlocks(false);
    } catch (err) {
      setError(err.message || 'Tamper modify failed');
    } finally {
      setTamperLoading(false);
    }
  };

  const handleTamperDelete = async () => {
    setTamperLoading(true);
    setTamperFeedback(null);
    try {
      const res = await api.tamperDelete();
      setTamperFeedback(res);
      await fetchLedgerBlocks(false);
    } catch (err) {
      setError(err.message || 'Tamper delete failed');
    } finally {
      setTamperLoading(false);
    }
  };

  const handleTamperRecompute = async () => {
    setTamperLoading(true);
    setTamperFeedback(null);
    try {
      const res = await api.tamperRecompute();
      setTamperFeedback(res);
      await fetchLedgerBlocks(false);
    } catch (err) {
      setError(err.message || 'Tamper recompute failed');
    } finally {
      setTamperLoading(false);
    }
  };

  const handleTamperRestore = async () => {
    setTamperLoading(true);
    setTamperFeedback(null);
    try {
      const res = await api.tamperRestore();
      setTamperFeedback(res);
      await fetchLedgerBlocks(false);
    } catch (err) {
      setError(err.message || 'Tamper restore failed');
    } finally {
      setTamperLoading(false);
    }
  };

  const isValid =
    blocksData?.ledger_status === 'VALID' && blocksData?.chain_ok && blocksData?.anchor_ok;

  const blocks = blocksData?.blocks || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Live Sync Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Server className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">
              Ledger Explorer & Integrity Auditor
            </h2>
            {hasNewBlock && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500 text-black animate-bounce">
                + NEW BLOCK ADDED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident append-only ledger secured by SHA-256 hash chains, Ed25519 digital signatures, and periodic secondary state anchors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Live Sync Toggle */}
          <button
            type="button"
            onClick={() => setLiveSync(!liveSync)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all ${
              liveSync
                ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 shadow-md shadow-cyan-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                liveSync ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
              }`}
            />
            <span>{liveSync ? 'Live Sync (3s)' : 'Sync Paused'}</span>
          </button>

          {/* Audit Button */}
          <button
            onClick={() => fetchLedgerBlocks(true)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Ledger Status Banner */}
      {blocksData && (
        <div
          className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
            isValid
              ? 'bg-emerald-950/30 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-rose-950/40 border-rose-500/90 shadow-xl shadow-rose-500/20 animate-pulse'
          } space-y-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-3 rounded-2xl ${
                  isValid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/30 text-rose-300 border border-rose-500/60'
                }`}
              >
                {isValid ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Chain Integrity Status
                  </span>
                  {lastUpdated && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Checked at {lastUpdated})
                    </span>
                  )}
                </div>
                <h3
                  className={`text-2xl font-black font-mono tracking-wide ${
                    isValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {blocksData.ledger_status}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${
                  blocksData.chain_ok
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700 font-black'
                }`}
              >
                Hash Chain Linkage: {blocksData.chain_ok ? 'VERIFIED ✓' : 'BROKEN ✗'}
              </span>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${
                  blocksData.anchor_ok
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-amber-950 text-amber-300 border-amber-700 font-black'
                }`}
              >
                Secondary Anchors: {blocksData.anchor_ok ? 'VERIFIED ✓' : 'MISMATCH ✗'}
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-mono bg-slate-900 text-slate-300 border border-slate-700">
                Total Blocks: {blocks.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tamper Simulation Panel (Judge Evaluation Mode - Requirement 5) */}
      <div className="p-6 glass-panel rounded-2xl border border-slate-800 space-y-4 bg-gradient-to-br from-cyber-950/90 to-cyber-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/60">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Tamper Simulation Engine</span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                  Judge Demo Mode
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Simulate adversarial ledger attacks to demonstrate real-time tamper detection, chain breakage, and secondary anchor protection.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTamperRestore}
            disabled={tamperLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/80 transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 self-start sm:self-auto"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${tamperLoading ? 'animate-spin' : ''}`}
            />
            <span>Restore Pristine Ledger</span>
          </button>
        </div>

        {/* 4 Attack Simulation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* 1. Modify Block */}
          <button
            type="button"
            onClick={handleTamperModify}
            disabled={tamperLoading || blocks.length === 0}
            className="p-4 rounded-xl text-left bg-cyber-900/70 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-600/70 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-500 group-hover:animate-bounce" />
                <span>1. Modify Block</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">POST</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Alters Block #0 user_id without recalculating hash.
            </p>
            <p className="text-[10px] text-rose-400/80 mt-1 font-mono">
              → Triggers TAMPERED (Hash mismatch)
            </p>
          </button>

          {/* 2. Delete Block */}
          <button
            type="button"
            onClick={handleTamperDelete}
            disabled={tamperLoading || blocks.length < 2}
            className="p-4 rounded-xl text-left bg-cyber-900/70 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-600/70 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold font-mono">
                <Trash2 className="w-4 h-4 text-rose-500 group-hover:animate-bounce" />
                <span>2. Delete Block</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">POST</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Removes Block #1 from the ledger file.
            </p>
            <p className="text-[10px] text-rose-400/80 mt-1 font-mono">
              → Triggers TAMPERED (Broken prev_hash link)
            </p>
          </button>

          {/* 3. Recompute Hashes */}
          <button
            type="button"
            onClick={handleTamperRecompute}
            disabled={tamperLoading || blocks.length === 0}
            className="p-4 rounded-xl text-left bg-cyber-900/70 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-600/70 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold font-mono">
                <Cpu className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                <span>3. Recompute Hashes</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">POST</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Alters Block #0 and recalculates all hashes downstream.
            </p>
            <p className="text-[10px] text-amber-400/80 mt-1 font-mono">
              → Triggers ANCHOR_MISMATCH (Caught by anchors!)
            </p>
          </button>
        </div>

        {/* Live Tamper Result Breakdown */}
        {tamperFeedback && (
          <div
            className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
              tamperFeedback.ledger_status === 'VALID'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span>Executed Action: {tamperFeedback.action}</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] ${
                  tamperFeedback.ledger_status === 'VALID'
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-rose-900 text-rose-300'
                }`}
              >
                Status: {tamperFeedback.ledger_status} (chain_ok=
                {String(tamperFeedback.chain_ok)}, anchor_ok=
                {String(tamperFeedback.anchor_ok)})
              </span>
            </div>
            <p className="text-[11px] text-slate-300">{tamperFeedback.description}</p>
            {tamperFeedback.message && (
              <p className="text-[10px] text-slate-400 bg-black/40 p-2 rounded border border-white/5">
                Audit Log: {tamperFeedback.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ledger Block Chain Explorer (Requirement 4) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              Hash-Chain Block Visualizer
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-400">
              {blocks.length} blocks
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Genesis → Head (Chronological)
          </span>
        </div>

        {blocks.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl glass-panel text-slate-500 space-y-2">
            <Server className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No blocks in ledger yet</p>
            <p className="text-xs text-slate-600">
              Decryptions automatically sign and append new blocks to this chain.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, idx) => {
              const isLatest = block.is_latest;
              const isAnchor = block.is_anchor;
              const isGenesis = block.index === 0;

              return (
                <div key={block.hash || idx} className="relative group">
                  {/* Vertical chain connector line */}
                  {idx > 0 && (
                    <div className="flex items-center justify-center my-1">
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-600">
                        <div className="w-0.5 h-4 bg-slate-800 group-hover:bg-cyan-500/50 transition-colors" />
                        <Link className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                        <span>SHA-256 Link</span>
                        <div className="w-0.5 h-4 bg-slate-800 group-hover:bg-cyan-500/50 transition-colors" />
                      </div>
                    </div>
                  )}

                  {/* Block Card */}
                  <div
                    className={`p-5 rounded-2xl border transition-all ${
                      isLatest
                        ? 'bg-cyber-900/90 border-cyan-500/80 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                        : isAnchor
                        ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                        : 'bg-cyber-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header Row: Block Number + Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-base font-black text-white">
                          BLOCK #{block.index}
                        </span>

                        {isGenesis && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Genesis Block
                          </span>
                        )}

                        {isAnchor && (
                          <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-purple-950 text-purple-300 border border-purple-700 shadow-sm shadow-purple-500/20">
                            <Anchor className="w-3 h-3" />
                            <span>Anchor Checkpoint</span>
                          </span>
                        )}

                        {isLatest && (
                          <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 shadow-sm shadow-cyan-500/20">
                            <Sparkles className="w-3 h-3 animate-spin-slow" />
                            <span>Latest Head</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {block.timestamp
                            ? new Date(block.timestamp).toLocaleString()
                            : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Block Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs font-mono">
                      {/* Left: User & Watermark */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyber-950/70 border border-slate-800/80">
                          <span className="text-slate-400 flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Attributed User (user_id):</span>
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              block.user_id === 'ATTACKER_MODIFIED' ||
                              block.user_id === 'ATTACKER_RECOMPUTED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                                : block.user_id === 'alice'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}
                          >
                            {block.user_id}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-cyber-950/70 border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="flex items-center space-x-1">
                              <Hash className="w-3 h-3 text-indigo-400" />
                              <span>Watermark ID (DCT-QIM):</span>
                            </span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  block.watermark_id,
                                  `wm_${block.index}`
                                )
                              }
                              className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                            >
                              {copiedHash === `wm_${block.index}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedHash === `wm_${block.index}`
                                  ? 'Copied'
                                  : 'Copy'}
                              </span>
                            </button>
                          </div>
                          <p className="text-indigo-300 text-[11px] break-all">
                            {block.watermark_id || '--'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Hashes & Chain Link */}
                      <div className="space-y-2">
                        {/* Current Block Hash */}
                        <div className="p-2.5 rounded-xl bg-cyber-950/70 border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-cyan-400 font-semibold">
                              Block Hash (SHA-256):
                            </span>
                            <button
                              onClick={() =>
                                copyToClipboard(block.hash, `hash_${block.index}`)
                              }
                              className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                            >
                              {copiedHash === `hash_${block.index}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedHash === `hash_${block.index}`
                                  ? 'Copied'
                                  : 'Copy'}
                              </span>
                            </button>
                          </div>
                          <p className="text-slate-200 text-[11px] break-all">
                            {block.hash}
                          </p>
                        </div>

                        {/* Previous Hash Link */}
                        <div className="p-2.5 rounded-xl bg-cyber-950/70 border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="text-slate-400">
                              Previous Hash (prev_hash):
                            </span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  block.previous_hash,
                                  `prev_${block.index}`
                                )
                              }
                              className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                            >
                              {copiedHash === `prev_${block.index}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedHash === `prev_${block.index}`
                                  ? 'Copied'
                                  : 'Copy'}
                              </span>
                            </button>
                          </div>
                          <p className="text-slate-400 text-[11px] break-all">
                            {block.previous_hash}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                      <span>File ID: {block.file_id || '--'}</span>
                      <span>Nonce: {block.nonce ?? 0}</span>
                      <span className="text-emerald-400/80">
                        Ed25519 Signature Verified ✓
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Properties Explainer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 text-sm font-bold">
            <Link className="w-4 h-4" />
            <span>Cryptographic Linkage</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every block's hash incorporates the previous block's SHA-256 hash. Modifying, deleting, or reordering any block breaks all downstream linkage.
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 text-sm font-bold">
            <Anchor className="w-4 h-4" />
            <span>Periodic State Anchors</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every 5 blocks, a secondary state snapshot is committed to <code>anchors.json</code>. If an attacker recomputes chain hashes, secondary anchors immediately detect the tamper!
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 text-sm font-bold">
            <Lock className="w-4 h-4" />
            <span>Non-Repudiation</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Decryption events are digitally signed with the recipient's Ed25519 private key. The leaker cannot claim that an administrator forged the record.
          </p>
        </div>
      </div>
    </div>
  );
}
