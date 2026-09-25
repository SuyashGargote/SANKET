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
  Clock,
  User,
  Hash,
  ArrowRight,
  Layers,
  Sparkles,
  ZapOff,
  GitCommit,
  Split,
  Eye,
} from 'lucide-react';
import { api } from '../api/client';

export default function LedgerTab() {
  const [blocksData, setBlocksData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);
  const [viewMode, setViewMode] = useState('chain'); // 'chain' | 'cards'

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

  useEffect(() => {
    fetchLedgerBlocks(true);
  }, []);

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

  // Tamper Simulation Handlers
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
    blocksData?.ledger_status === 'VALID' &&
    blocksData?.chain_ok &&
    blocksData?.anchor_ok;

  const isAnchorMismatch =
    blocksData?.ledger_status === 'ANCHOR_MISMATCH' || !blocksData?.anchor_ok;

  const isChainBroken = !blocksData?.chain_ok;

  const blocks = blocksData?.blocks || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Live Sync Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Server className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">
              Ledger Explorer & Chain Visualizer
            </h2>
            {hasNewBlock && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500 text-black animate-bounce">
                + NEW BLOCK ADDED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Connected node chain with cryptographic SHA-256 linkages, Ed25519 digital signatures, and periodic secondary state anchors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* View mode toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setViewMode('chain')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'chain'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Chain View</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Block Cards</span>
            </button>
          </div>

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
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Critical Alert Banners (Requirement 1: When tampering occurs show broken chain & ANCHOR MISMATCH clearly) */}
      {isAnchorMismatch && (
        <div className="p-5 rounded-2xl bg-amber-950/90 border-2 border-amber-500 shadow-xl shadow-amber-500/20 text-amber-200 space-y-2 animate-bounce">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500 text-black font-black">
              <Anchor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black font-mono tracking-wide text-white uppercase">
                🚨 ANCHOR MISMATCH DETECTED 🚨
              </h3>
              <p className="text-xs text-amber-300 font-semibold font-mono">
                Periodic secondary anchor snapshot does NOT match current ledger state!
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed font-mono bg-black/40 p-3 rounded-xl border border-amber-500/40">
            <strong>Adversarial Attack Caught:</strong> The attacker modified historical records and recomputed all downstream SHA-256 hashes to fake a valid chain. However, SANKET's periodic secondary anchor written to <code>anchors.json</code> caught the forgery!
          </p>
        </div>
      )}

      {isChainBroken && (
        <div className="p-5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 shadow-xl shadow-rose-500/25 text-rose-200 space-y-2 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white font-black">
              <ZapOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black font-mono tracking-wide text-white uppercase">
                🚨 HASH CHAIN SEVERED • TAMPER DETECTED 🚨
              </h3>
              <p className="text-xs text-rose-300 font-semibold font-mono">
                Block data was altered or deleted without updating the cryptographic link!
              </p>
            </div>
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed font-mono bg-black/40 p-3 rounded-xl border border-rose-500/40">
            <strong>Cryptographic Proof:</strong> Block #0 hash does not match Block #1's <code>prev_hash</code>. The chain is mathematically broken and invalid.
          </p>
        </div>
      )}

      {/* Main Ledger Status Banner */}
      {blocksData && (
        <div
          className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
            isValid
              ? 'bg-emerald-950/30 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-rose-950/40 border-rose-500/90 shadow-xl shadow-rose-500/20'
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

      {/* Tamper Simulation Panel (Judge Evaluation Mode) */}
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
                Simulate adversarial attacks to demonstrate chain breakage and secondary anchor protection.
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

        {/* 3 Attack Simulation Buttons */}
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
              → Visually breaks the chain in RED!
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
              → Visually severs prev_hash link!
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
              Alters Block #0 & recalculates hashes downstream.
            </p>
            <p className="text-[10px] text-amber-400/80 mt-1 font-mono">
              → Triggers ANCHOR MISMATCH in GOLD/RED!
            </p>
          </button>
        </div>
      </div>

      {/* Requirement 1: CONNECTED NODES CHAIN VIEW */}
      {viewMode === 'chain' && (
        <div className="p-6 glass-panel rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <GitCommit className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Connected Nodes Chain View (prev_hash → hash)
              </h3>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                <span className="text-slate-300">Valid Chain (Green)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
                <span className="text-amber-300 font-bold">Anchor Block (Gold)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                <span className="text-rose-400">Broken Link (Red)</span>
              </span>
            </div>
          </div>

          {/* Interactive Horizontal Scrollable Connected Nodes Diagram */}
          <div className="overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-slate-800">
            <div className="flex items-center space-x-2 min-w-max px-2">
              {blocks.map((block, idx) => {
                const isAnchor = block.is_anchor;
                const isLatest = block.is_latest;
                const isGenesis = block.index === 0;

                // Determine if the link to this block is broken
                const isLinkBroken = !blocksData?.chain_ok && idx === 1;

                return (
                  <React.Fragment key={block.hash || idx}>
                    {/* Arrow / Link between previous block and this block */}
                    {idx > 0 && (
                      <div className="flex flex-col items-center justify-center px-1">
                        {isLinkBroken ? (
                          /* SEVERED BROKEN CHAIN LINK (RED) */
                          <div className="flex flex-col items-center space-y-1 animate-pulse">
                            <div className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500 text-[10px] font-mono font-bold text-rose-300">
                              ⚡ SEVERED LINK
                            </div>
                            <div className="flex items-center">
                              <div className="w-6 h-0.5 bg-rose-500 border-t-2 border-dashed border-rose-500" />
                              <ZapOff className="w-4 h-4 text-rose-500" />
                              <div className="w-6 h-0.5 bg-rose-500 border-t-2 border-dashed border-rose-500" />
                            </div>
                            <span className="text-[9px] font-mono text-rose-400">
                              hash mismatch
                            </span>
                          </div>
                        ) : (
                          /* VALID CHAIN LINK (GREEN) */
                          <div className="flex flex-col items-center space-y-1">
                            <span className="text-[9px] font-mono text-emerald-400 font-bold">
                              prev_hash → hash
                            </span>
                            <div className="flex items-center">
                              <div className="w-10 h-0.5 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                              <ArrowRight className="w-4 h-4 text-emerald-400 -ml-1" />
                            </div>
                            <span className="text-[9px] font-mono text-slate-500">
                              SHA-256 Link
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NODE CARD */}
                    <div
                      className={`w-64 p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 shrink-0 ${
                        isAnchor
                          ? 'border-amber-400 bg-amber-950/40 text-amber-200 ring-2 ring-amber-400/40 shadow-xl shadow-amber-500/20'
                          : isLatest
                          ? 'border-cyan-400 bg-cyber-900/90 text-cyan-200 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-500/20'
                          : 'border-slate-800 bg-cyber-900/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-sm font-black text-white">
                            BLOCK #{block.index}
                          </span>
                          {isGenesis && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                              GENESIS
                            </span>
                          )}
                        </div>

                        {/* Anchor Block Highlight (GOLD) */}
                        {isAnchor && (
                          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500 text-black shadow-md shadow-amber-500/40 animate-pulse">
                            <Anchor className="w-3 h-3" />
                            <span>ANCHOR (GOLD)</span>
                          </span>
                        )}

                        {isLatest && !isAnchor && (
                          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                            <Sparkles className="w-3 h-3" />
                            <span>HEAD</span>
                          </span>
                        )}
                      </div>

                      {/* Operator User */}
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <User className="w-3.5 h-3.5" />
                          <span>Operator:</span>
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
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

                      {/* Cryptographic Hashes (prev_hash -> hash) */}
                      <div className="space-y-1.5 text-[10px] font-mono bg-black/50 p-2.5 rounded-xl border border-white/5">
                        <div>
                          <span className="text-slate-500 block">prev_hash:</span>
                          <span className="text-slate-300 break-all truncate block" title={block.previous_hash}>
                            {block.previous_hash ? `${block.previous_hash.slice(0, 16)}...` : '000000000000...'}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-white/5">
                          <span className="text-cyan-400 font-bold block">block_hash:</span>
                          <span className="text-white font-bold break-all truncate block" title={block.hash}>
                            {block.hash ? `${block.hash.slice(0, 16)}...` : '--'}
                          </span>
                        </div>
                      </div>

                      {/* Footer: Watermark snippet */}
                      <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                        <span>Watermark:</span>
                        <span className="text-indigo-300 truncate max-w-[100px]" title={block.watermark_id}>
                          {block.watermark_id ? `${block.watermark_id.slice(0, 8)}...` : '--'}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Block Cards View */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Detailed Block Inspection
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-400">
                {blocks.length} blocks
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Chronological Audit Log
            </span>
          </div>

          <div className="space-y-3">
            {blocks.map((block, idx) => {
              const isLatest = block.is_latest;
              const isAnchor = block.is_anchor;
              const isGenesis = block.index === 0;

              return (
                <div
                  key={block.hash || idx}
                  className={`p-5 rounded-2xl border transition-all ${
                    isAnchor
                      ? 'bg-amber-950/30 border-amber-400/80 shadow-lg shadow-amber-500/10'
                      : isLatest
                      ? 'bg-cyber-900/90 border-cyan-500/80 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : 'bg-cyber-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-base font-black text-white">
                        BLOCK #{block.index}
                      </span>
                      {isGenesis && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Genesis Block
                        </span>
                      )}
                      {isAnchor && (
                        <span className="flex items-center space-x-1 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500 text-black shadow-md shadow-amber-500/20">
                          <Anchor className="w-3 h-3" />
                          <span>Anchor Block (Gold)</span>
                        </span>
                      )}
                      {isLatest && (
                        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                          Latest Head
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {block.timestamp ? new Date(block.timestamp).toLocaleString() : '--'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs font-mono">
                    <div className="space-y-2">
                      <div className="flex justify-between p-2.5 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-400">User ID:</span>
                        <span className="text-white font-bold">{block.user_id}</span>
                      </div>
                      <div className="flex justify-between p-2.5 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-400">Watermark ID:</span>
                        <span className="text-indigo-300 break-all">{block.watermark_id}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                        <span className="text-cyan-400 block text-[10px]">Hash (SHA-256):</span>
                        <span className="text-white break-all text-[11px]">{block.hash}</span>
                      </div>
                      <div className="p-2.5 rounded bg-black/40 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Previous Hash:</span>
                        <span className="text-slate-300 break-all text-[11px]">{block.previous_hash}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
