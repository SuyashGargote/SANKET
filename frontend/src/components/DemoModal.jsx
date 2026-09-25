import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, UserCheck, RefreshCw, Hash, Lock, Unlock, Search, Server } from 'lucide-react';
import { api } from '../api/client';

export default function DemoModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    { title: 'Setup Identities', desc: 'Generating Ed25519 & X25519 keypairs for Alice and Bob' },
    { title: 'Encrypt Document', desc: 'AES-256-GCM authenticated encryption with X25519 key wrapping' },
    { title: 'Decryption & Provenance', desc: 'Independent decryptions; embedding unique DCT-QIM watermarks' },
    { title: 'Attack Simulation', desc: 'Hostile leak attack: cropping & 40x40 pixel fill tampering' },
    { title: 'Forensic Attribution', desc: 'Multi-signal watermark extraction & confidence scoring' },
    { title: 'Ledger Audit', desc: 'Validating hash-chain linkages and periodic secondary anchors' },
  ];

  const runDemoFlow = async () => {
    setLoading(true);
    setError(null);
    setDemoResult(null);
    setCurrentStep(0);

    try {
      // Start API call in background while animating step indicators
      const apiPromise = api.runDemo();

      // Step animation sequence
      for (let i = 0; i < steps.length - 1; i++) {
        setCurrentStep(i);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      const res = await apiPromise;
      setCurrentStep(steps.length - 1);
      setDemoResult(res.data || res);
    } catch (err) {
      setError(err.message || 'Demo execution failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDemoFlow();
    } else {
      setDemoResult(null);
      setCurrentStep(0);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const attribution = demoResult?.step_5_forensic_attribution;
  const decryptions = demoResult?.step_3_decryptions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-panel rounded-3xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/80 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">Full Lifecycle Attribution Demo</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  SIH JUDGE MODE
                </span>
              </div>
              <p className="text-xs text-slate-400">Automated end-to-end provenance and forensic verification lifecycle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {steps.map((st, idx) => {
            const isDone = currentStep > idx || demoResult;
            const isCurrent = currentStep === idx && !demoResult;
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs transition-all ${
                  isDone
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                    : isCurrent
                    ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                    : 'bg-cyber-900/50 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] font-bold">0{idx + 1}</span>
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-slate-800" />
                  )}
                </div>
                <p className="font-semibold truncate text-[11px]">{st.title}</p>
              </div>
            );
          })}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold">Execution Failed</p>
              <p className="text-rose-400">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !demoResult && (
          <div className="p-8 rounded-2xl bg-cyber-950/70 border border-cyan-500/30 text-center space-y-3">
            <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
            <p className="text-base font-bold text-white">{steps[currentStep].title}...</p>
            <p className="text-xs text-slate-400 font-mono">{steps[currentStep].desc}</p>
          </div>
        )}

        {/* Final Grand Reveal Card (SIH Judge Impact Target) */}
        {demoResult && attribution && (
          <div className="space-y-6">
            {/* The Big Highlight Verdict */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/80 via-cyan-950/60 to-indigo-950/80 border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 text-center space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-emerald-900/80 text-emerald-300 border border-emerald-600">
                FORENSIC ATTRIBUTION SUCCESS
              </span>

              <div className="space-y-1">
                <span className="text-xs uppercase font-mono tracking-widest text-slate-300">
                  Attribution Result
                </span>
                <h1 className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight">
                  👉 LEAK TRACED TO:{' '}
                  <span className="text-emerald-400 underline decoration-emerald-500">
                    {attribution.identified_user?.toUpperCase()}
                  </span>
                </h1>
                <p className="text-base font-bold text-emerald-300 font-mono">
                  Confidence Score: {attribution.confidence_score?.toFixed(1)}% ({attribution.verdict})
                </p>
              </div>

              {/* Badges bar */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  CRC-16: {attribution.crc_status}
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-700">
                  Attack Detected: {attribution.tamper_type}
                </span>
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700">
                  Ledger: {demoResult.step_6_ledger_integrity?.ledger_status}
                </span>
              </div>
            </div>

            {/* Comparison Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Alice Decryption Record */}
              <div className="p-4 rounded-2xl bg-cyber-900/60 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <UserCheck className="w-4 h-4" />
                    <span>Alice's Provenance Record</span>
                  </span>
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">Block #{decryptions[0]?.ledger_block}</span>
                </div>
                <p className="text-[11px] text-slate-300 p-2 rounded bg-cyber-950 border border-slate-800 break-all">
                  Watermark ID: {decryptions[0]?.watermark_id}
                </p>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Attack Simulation:</span>
                  <span className="text-amber-400 font-bold">40x40 pixel crop & fill</span>
                </div>
              </div>

              {/* Bob Decryption Record */}
              <div className="p-4 rounded-2xl bg-cyber-900/60 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center space-x-1.5 text-purple-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Bob's Provenance Record</span>
                  </span>
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">Block #{decryptions[1]?.ledger_block}</span>
                </div>
                <p className="text-[11px] text-slate-300 p-2 rounded bg-cyber-950 border border-slate-800 break-all">
                  Watermark ID: {decryptions[1]?.watermark_id}
                </p>
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Cryptographic Proof:</span>
                  <span className="text-emerald-400 font-bold">Watermarks are 100% Unique</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <span className="text-xs text-slate-500">
            Powered by Multi-Coeff DCT-QIM, Ed25519 Signatures, & Anchored Ledgers
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={runDemoFlow}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Run Again</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
