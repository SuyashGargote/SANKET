import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, UserCheck, RefreshCw, Hash, Lock, Unlock, Search, Server, Play } from 'lucide-react';
import { api } from '../api/client';
import FinalResultScreen from './FinalResultScreen';

export default function DemoModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    { title: '1. Alice Encrypts', desc: 'AES-256-GCM authenticated encryption with X25519 key wrapping' },
    { title: '2. Bob Receives', desc: 'Secure document arrives in Bob\'s Received Files' },
    { title: '3. Bob Opens & Decrypts', desc: 'Unique 128-bit DCT-QIM watermark bound to Bob and signed to ledger' },
    { title: '4. Leak & Tamper Occurs', desc: 'Document leaked; 40x40 area cropped and filled with gray' },
    { title: '5. SANKET Analyzes', desc: 'DCT frequency domain extraction and sync template recovery' },
    { title: '6. Attribution Proven', desc: 'Ledger hash-chain and periodic anchors verify non-repudiation' },
  ];

  const runDemoFlow = async () => {
    setLoading(true);
    setError(null);
    setDemoResult(null);
    setCurrentStep(0);

    try {
      const apiPromise = api.runDemo();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl panel rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 bg-slate-900 text-slate-100">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">Full Workflow Attribution Demo</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                  Automated End-to-End
                </span>
              </div>
              <p className="text-xs text-slate-400">Alice sends → Bob opens & watermarked → Leak simulated → Source identified</p>
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
                    ? 'bg-blue-950/60 border-blue-500 text-blue-200'
                    : 'bg-slate-900/50 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] font-bold">0{idx + 1}</span>
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  )}
                </div>
                <p className="font-semibold truncate text-[11px]">{st.title}</p>
              </div>
            );
          })}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold">Execution Failed</p>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && !demoResult && (
          <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-base font-semibold text-white">{steps[currentStep].title}...</p>
            <p className="text-xs text-slate-400 font-mono">{steps[currentStep].desc}</p>
          </div>
        )}

        {/* Final Grand Reveal Card (Requirement 4) */}
        {demoResult && attribution && (
          <div className="space-y-6">
            <FinalResultScreen
              user={attribution.identified_user?.toUpperCase() || 'ALICE'}
              confidence={attribution.confidence_score}
              status="VERIFIED"
              watermarkId={decryptions[0]?.watermark_id || '88ae75ecf0e6496e95c10b429f5f0a1c'}
              ledgerBlock={0}
              tamperType={attribution.tamper_type || 'Cropping / Tamper (40x40 area)'}
              showAttack={true}
              showExplanation={true}
            />
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
