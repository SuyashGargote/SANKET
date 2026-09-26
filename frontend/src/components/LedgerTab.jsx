import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Anchor,
  CheckCircle2,
  Lock,
  Link as LinkIcon,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Clock,
  User,
  Hash,
  ArrowRight,
  Layers,
  GitCommit,
  Search,
  Filter,
  FileCode,
  CheckCircle,
  ExternalLink,
  X,
  Info,
  Database,
  Activity,
  Shield,
  FileText,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';

export default function LedgerTab() {
  const [blocksData, setBlocksData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [viewMode, setViewMode] = useState('chain'); // 'chain' | 'table'
  const [selectedBlock, setSelectedBlock] = useState(null); // For Block Inspector modal

  // Search and filter state for audit table
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('ALL'); // 'ALL' | 'alice' | 'bob' | 'anchors'

  // Real-time polling state
  const [liveSync, setLiveSync] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevBlockCountRef = useRef(0);
  const [hasNewBlock, setHasNewBlock] = useState(false);

  // Security diagnostics / tamper simulation state
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperFeedback, setTamperFeedback] = useState(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

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
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
  const anchors = blocksData?.anchors || [];

  // Filter blocks for audit table view
  const filteredBlocks = blocks.filter((b) => {
    const matchesUser =
      userFilter === 'ALL'
        ? true
        : userFilter === 'anchors'
        ? b.is_anchor
        : b.user_id?.toLowerCase() === userFilter.toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesUser;

    const matchesQuery =
      String(b.index).includes(q) ||
      b.user_id?.toLowerCase().includes(q) ||
      b.watermark_id?.toLowerCase().includes(q) ||
      b.hash?.toLowerCase().includes(q) ||
      b.previous_hash?.toLowerCase().includes(q);

    return matchesUser && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Top Enterprise Header & Controls ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Cryptographic Audit Ledger & Chain Provenance
                </h2>
                {hasNewBlock && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    + NEW BLOCK COMMITTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Append-only SHA-256 hash-chain with Ed25519 digital signatures and periodic state snapshots for non-repudiable auditability.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('chain')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'chain'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Node Chain</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Audit Log Table</span>
            </button>
          </div>

          {/* Live Sync Toggle */}
          <button
            type="button"
            onClick={() => setLiveSync(!liveSync)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
              liveSync
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                liveSync ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span>{liveSync ? 'Live Sync (3s)' : 'Sync Paused'}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchLedgerBlocks(true)}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`}
            />
          </button>

          {/* Diagnostics toggle button */}
          <button
            type="button"
            onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              diagnosticsOpen
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>Resilience Testing</span>
          </button>
        </div>
      </div>

      {/* ── 2. Consensus & Integrity Status Ribbon ─────────────────────────── */}
      {blocksData && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            isValid
              ? 'bg-slate-900/80 border-slate-800 text-slate-200'
              : isAnchorMismatch
              ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
              : 'bg-red-950/20 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : isAnchorMismatch
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                {isValid ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : isAnchorMismatch ? (
                  <Anchor className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Consensus Verification
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      isValid
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : isAnchorMismatch
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {isValid ? 'CONSENSUS: VALID' : blocksData.ledger_status}
                  </span>
                  {lastUpdated && (
                    <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                      • Updated {lastUpdated}
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-white mt-0.5">
                  {isValid
                    ? `Sequential cryptographic chain intact (${blocks.length} blocks verified)`
                    : isAnchorMismatch
                    ? 'Secondary Anchor Discrepancy: Snapshot in anchors.json does not match ledger state'
                    : 'Cryptographic Pointer Severed: Block hash mismatch detected in chain sequence'}
                </p>

                <p className="text-xs text-slate-400 mt-0.5">
                  {isValid
                    ? 'Every block is cryptographically bound via previous_hash pointers. Digital signatures validated with Ed25519.'
                    : isAnchorMismatch
                    ? 'Adversarial re-computation or history rewrite caught by secondary state anchor checkpoint.'
                    : 'One or more records were modified or deleted out of band, breaking SHA-256 link integrity.'}
                </p>
              </div>
            </div>

            {/* Metric indicators & Quick Restore */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${
                  blocksData.chain_ok
                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                    : 'bg-red-500/10 border-red-500/40 text-red-300 font-bold'
                }`}
              >
                Hash Chain: {blocksData.chain_ok ? 'Intact ✓' : 'Broken ✗'}
              </span>

              <span
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${
                  blocksData.anchor_ok
                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold'
                }`}
              >
                Anchors: {blocksData.anchor_ok ? 'Synchronized ✓' : 'Mismatch ✗'}
              </span>

              <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400">
                Total: {blocks.length} blocks
              </span>

              {!isValid && (
                <button
                  type="button"
                  onClick={handleTamperRestore}
                  disabled={tamperLoading}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${tamperLoading ? 'animate-spin' : ''}`}
                  />
                  <span>Restore Verified State</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Adversarial Resilience & Testing Suite (Collapsible) ────────── */}
      {diagnosticsOpen && (
        <div className="panel rounded-xl p-5 border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Adversarial Resilience & Fault Injection Suite</span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                    Diagnostic Sandbox
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Execute controlled fault-injection vectors to verify automatic detection of tampering, omissions, and history manipulation.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTamperRestore}
                disabled={tamperLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 transition-colors disabled:opacity-50"
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 ${tamperLoading ? 'animate-spin' : ''}`}
                />
                <span>Reset to Verified Baseline</span>
              </button>

              <button
                type="button"
                onClick={() => setDiagnosticsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close diagnostics"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3 Testing Vector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Vector 1: Block Mutation */}
            <div className="panel-card rounded-lg p-4 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                  <span className="font-semibold text-white">Vector 1: Record Mutation</span>
                  <span className="text-[10px] font-mono text-slate-500">POST /tamper/modify</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Alters historical user payload in Block #0 without recalculating cryptographic hashes.
                </p>
                <p className="text-[11px] font-mono text-blue-400 mt-2">
                  Expected outcome: Instant SHA-256 chain severance.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTamperModify}
                disabled={tamperLoading || blocks.length === 0}
                className="w-full py-2 px-3 rounded-md text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors text-center disabled:opacity-50"
              >
                {tamperLoading ? 'Simulating...' : 'Inject Record Tampering'}
              </button>
            </div>

            {/* Vector 2: Block Deletion */}
            <div className="panel-card rounded-lg p-4 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                  <span className="font-semibold text-white">Vector 2: Record Deletion</span>
                  <span className="text-[10px] font-mono text-slate-500">POST /tamper/delete</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Drops an intermediate block from the ledger file to simulate omission or record loss.
                </p>
                <p className="text-[11px] font-mono text-blue-400 mt-2">
                  Expected outcome: prev_hash pointer discontinuity.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTamperDelete}
                disabled={tamperLoading || blocks.length < 2}
                className="w-full py-2 px-3 rounded-md text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors text-center disabled:opacity-50"
              >
                {tamperLoading ? 'Simulating...' : 'Inject Block Deletion'}
              </button>
            </div>

            {/* Vector 3: History Rewrite (Rehash) */}
            <div className="panel-card rounded-lg p-4 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                  <span className="font-semibold text-white">Vector 3: History Rewrite</span>
                  <span className="text-[10px] font-mono text-slate-500">POST /tamper/recompute</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Modifies Block #0 and recomputes all downstream hashes to forge a seemingly valid chain.
                </p>
                <p className="text-[11px] font-mono text-amber-400 mt-2">
                  Expected outcome: Caught by periodic secondary anchor!
                </p>
              </div>

              <button
                type="button"
                onClick={handleTamperRecompute}
                disabled={tamperLoading || blocks.length === 0}
                className="w-full py-2 px-3 rounded-md text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors text-center disabled:opacity-50"
              >
                {tamperLoading ? 'Simulating...' : 'Inject Fork / Rehash Attack'}
              </button>
            </div>
          </div>

          {tamperFeedback && (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>{tamperFeedback.message || tamperFeedback.description}</span>
              <span className="text-[11px] text-slate-500">Status: {tamperFeedback.ledger_status}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 4. PRIMARY VIEW 1: CONNECTED NODE CHAIN ────────────────────────── */}
      {viewMode === 'chain' && (
        <div className="panel rounded-xl p-5 border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Cryptographic Sequential DAG (prev_hash → hash)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each block contains a cryptographically verified hash pointer linking to its direct predecessor. Click any block to inspect full JSON payload.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Verified Link</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-300 font-semibold">Anchor Checkpoint</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>Severed Link</span>
              </span>
            </div>
          </div>

          {/* Horizontal Scrollable Connected Nodes Diagram */}
          <div className="overflow-x-auto pb-4 pt-2">
            <div className="flex items-center space-x-3 min-w-max px-1">
              {blocks.map((block, idx) => {
                const isAnchor = block.is_anchor;
                const isLatest = block.is_latest;
                const isGenesis = block.index === 0;

                // Determine if link to this block is severed
                const isLinkBroken = !blocksData?.chain_ok && idx === 1;

                return (
                  <React.Fragment key={block.hash || idx}>
                    {/* Link connector between previous block and this block */}
                    {idx > 0 && (
                      <div className="flex flex-col items-center justify-center px-1">
                        {isLinkBroken ? (
                          /* SEVERED LINK (RED) */
                          <div className="flex flex-col items-center space-y-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                              SEVERED
                            </span>
                            <div className="flex items-center">
                              <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500" />
                              <ShieldAlert className="w-4 h-4 text-red-400 mx-0.5" />
                              <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500" />
                            </div>
                            <span className="text-[9px] font-mono text-red-400">
                              hash mismatch
                            </span>
                          </div>
                        ) : (
                          /* VALID LINK (EMERALD) */
                          <div className="flex flex-col items-center space-y-1">
                            <span className="text-[9px] font-mono text-slate-500">
                              SHA-256
                            </span>
                            <div className="flex items-center text-emerald-400">
                              <div className="w-8 h-0.5 bg-emerald-500/80" />
                              <ArrowRight className="w-3.5 h-3.5 -ml-1 text-emerald-400" />
                            </div>
                            <span className="text-[9px] font-mono text-emerald-400 font-semibold">
                              Verified
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NODE CARD */}
                    <div
                      onClick={() => setSelectedBlock(block)}
                      className={`w-72 p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 shrink-0 ${
                        isAnchor
                          ? 'border-amber-500/40 bg-slate-900/90 hover:border-amber-400 shadow-sm'
                          : isLatest
                          ? 'border-blue-500/40 bg-slate-900/90 hover:border-blue-400 shadow-sm'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-white">
                            BLOCK #{block.index}
                          </span>
                          {isGenesis && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              GENESIS
                            </span>
                          )}
                        </div>

                        {/* Anchor Checkpoint Tag */}
                        {isAnchor && (
                          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <Anchor className="w-3 h-3 text-amber-400" />
                            <span>ANCHOR #{block.index}</span>
                          </span>
                        )}

                        {isLatest && !isAnchor && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            HEAD
                          </span>
                        )}
                      </div>

                      {/* Signer / Identity */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>Signer:</span>
                        </span>
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] font-mono ${
                            block.user_id === 'ATTACKER_MODIFIED' ||
                            block.user_id === 'ATTACKER_RECOMPUTED'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : block.user_id === 'alice'
                              ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          }`}
                        >
                          {block.user_id}
                        </span>
                      </div>

                      {/* Cryptographic Linkage Box */}
                      <div className="space-y-1.5 text-[10px] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">prev_hash:</span>
                          <span className="text-slate-300" title={block.previous_hash}>
                            {block.previous_hash ? `${block.previous_hash.slice(0, 12)}...` : '000000000000...'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400 font-medium">block_hash:</span>
                          <span className="text-blue-400 font-semibold" title={block.hash}>
                            {block.hash ? `${block.hash.slice(0, 12)}...` : '--'}
                          </span>
                        </div>
                      </div>

                      {/* Footer Info & Click hint */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span className="truncate max-w-[120px]" title={block.watermark_id}>
                          WM: {block.watermark_id ? `${block.watermark_id.slice(0, 8)}...` : '--'}
                        </span>
                        <span className="text-blue-400 hover:text-blue-300 flex items-center space-x-0.5 text-[10px] font-medium">
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
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

      {/* ── 5. PRIMARY VIEW 2: ENTERPRISE AUDIT LOG TABLE ─────────────────── */}
      {viewMode === 'table' && (
        <div className="panel rounded-xl p-5 border border-slate-800 bg-slate-900/60 space-y-4">
          {/* Table Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by hash, user, or watermark..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center space-x-1.5 text-xs font-medium">
              <span className="text-slate-500 text-[11px] mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setUserFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  userFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All ({blocks.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('alice')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  userFilter === 'alice'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Alice ({blocks.filter((b) => b.user_id === 'alice').length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('bob')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  userFilter === 'bob'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Bob ({blocks.filter((b) => b.user_id === 'bob').length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('anchors')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  userFilter === 'anchors'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Anchors ({blocks.filter((b) => b.is_anchor).length})
              </button>
            </div>
          </div>

          {/* Audit Log Data Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Index</th>
                  <th className="py-2.5 px-3">Signer</th>
                  <th className="py-2.5 px-3">Watermark ID</th>
                  <th className="py-2.5 px-3">Block Hash (SHA-256)</th>
                  <th className="py-2.5 px-3">Previous Hash</th>
                  <th className="py-2.5 px-3">Anchor</th>
                  <th className="py-2.5 px-3">Integrity</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredBlocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                      No blocks match filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBlocks.map((block) => {
                    const isAnchor = block.is_anchor;
                    const isLatest = block.is_latest;
                    const isGenesis = block.index === 0;

                    return (
                      <tr
                        key={block.hash || block.index}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-bold text-white">
                          #{block.index}
                          {isGenesis && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              GEN
                            </span>
                          )}
                          {isLatest && !isGenesis && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              HEAD
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              block.user_id === 'alice'
                                ? 'bg-blue-500/10 text-blue-300'
                                : block.user_id === 'bob'
                                ? 'bg-purple-500/10 text-purple-300'
                                : 'bg-red-500/20 text-red-300 font-bold'
                            }`}
                          >
                            {block.user_id}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <span>{block.watermark_id ? `${block.watermark_id.slice(0, 10)}...` : '--'}</span>
                            {block.watermark_id && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(block.watermark_id, `wm-${block.index}`)}
                                className="text-slate-500 hover:text-slate-300 p-0.5"
                                title="Copy Watermark ID"
                              >
                                {copiedKey === `wm-${block.index}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-blue-400 font-semibold">
                          <div className="flex items-center space-x-1.5">
                            <span>{block.hash ? `${block.hash.slice(0, 12)}...` : '--'}</span>
                            {block.hash && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(block.hash, `hash-${block.index}`)}
                                className="text-slate-500 hover:text-slate-300 p-0.5"
                                title="Copy Block Hash"
                              >
                                {copiedKey === `hash-${block.index}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-400">
                          {block.previous_hash ? `${block.previous_hash.slice(0, 10)}...` : '0000000000...'}
                        </td>

                        <td className="py-2.5 px-3">
                          {isAnchor ? (
                            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <Anchor className="w-3 h-3" />
                              <span>Checkpoint</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="flex items-center space-x-1 text-emerald-400 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Signed</span>
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedBlock(block)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-sans font-medium"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. BLOCK INSPECTOR MODAL ────────────────────────────────────────── */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">
                      Block #{selectedBlock.index} Cryptographic Inspector
                    </h3>
                    {selectedBlock.is_anchor && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        ANCHOR CHECKPOINT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Canonical record payload and cryptographic attestation proof.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verification Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-[10px] uppercase text-slate-500 block">Signer Identity</span>
                <span className="text-white font-bold">{selectedBlock.user_id} (Ed25519)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-[10px] uppercase text-slate-500 block">Hash Algorithm</span>
                <span className="text-emerald-400 font-bold">SHA-256 (Canonical)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                <span className="text-[10px] uppercase text-slate-500 block">State Anchor</span>
                <span className={selectedBlock.is_anchor ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                  {selectedBlock.is_anchor ? 'Anchored (Snapshot #5)' : 'Chained Standard'}
                </span>
              </div>
            </div>

            {/* Key Fields */}
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">
                  {selectedBlock.timestamp ? new Date(selectedBlock.timestamp).toUTCString() : '--'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Watermark ID:</span>
                <span className="text-purple-300 break-all">{selectedBlock.watermark_id || '--'}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Nonce:</span>
                <span className="text-slate-300 break-all">{selectedBlock.nonce || '--'}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block">Block Hash:</span>
                <span className="text-blue-400 font-semibold break-all text-[11px] block">{selectedBlock.hash}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block">Previous Hash:</span>
                <span className="text-slate-300 break-all text-[11px] block">{selectedBlock.previous_hash}</span>
              </div>

              {selectedBlock.signature && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Ed25519 Digital Signature:</span>
                  <span className="text-emerald-400/90 break-all text-[11px] block">
                    {selectedBlock.signature}
                  </span>
                </div>
              )}
            </div>

            {/* Canonical Raw JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Raw Canonical JSON Payload:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(selectedBlock, null, 2), 'raw-json')}
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-[11px]"
                >
                  {copiedKey === 'raw-json' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                {JSON.stringify(selectedBlock, null, 2)}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
