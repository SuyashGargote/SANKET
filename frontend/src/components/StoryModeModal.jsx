import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft,
  Lock,
  Unlock,
  ShieldAlert,
  Search,
  Server,
  Sparkles,
  CheckCircle2,
  Film,
  Zap,
} from 'lucide-react';
import FinalResultScreen from './FinalResultScreen';
import AttackVisualization from './AttackVisualization';
import SimplifiedExplanation from './SimplifiedExplanation';

export default function StoryModeModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalSteps = 5;

  // Auto-play timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < totalSteps) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [isOpen, isPlaying]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setIsPlaying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl glass-panel rounded-3xl border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 bg-cyber-950/95">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/25">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">
                  SANKET Interactive Story Mode
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700">
                  Judge Presentation Guide
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visual walkthrough explaining the 5 stages of cryptographic attribution
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Auto Play / Pause Toggle */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all ${
                isPlaying
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Auto-Play</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { num: 1, title: 'Alice Encrypts' },
            { num: 2, title: 'Bob Decrypts' },
            { num: 3, title: 'File Leaked' },
            { num: 4, title: 'Forensic Analysis' },
            { num: 5, title: 'Ledger Evidence' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                currentStep === s.num
                  ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                  : currentStep > s.num
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  : 'bg-cyber-900/40 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="block text-[10px] font-mono font-bold">
                Step 0{s.num}
              </span>
              <span className="block text-xs font-semibold truncate">
                {s.title}
              </span>
            </button>
          ))}
        </div>

        {/* Main Step Content Area */}
        <div className="min-h-[380px] flex flex-col justify-center">
          {/* STEP 1: Alice encrypts and shares file */}
          {currentStep === 1 && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="inline-flex p-4 rounded-3xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-400 shadow-xl shadow-cyan-500/10">
                <Lock className="w-12 h-12 animate-pulse" />
              </div>

              <div className="space-y-2 max-w-2xl mx-auto">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase tracking-widest">
                  Step 1 of 5
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white font-mono">
                  "Alice encrypts and shares file"
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Alice encrypts the sensitive document with military-grade <strong>AES-256-GCM</strong>.
                  Individual recipient access keys are securely wrapped using <strong>X25519 Elliptic Curve Cryptography</strong> so only authorized recipients (like Bob) can unlock it.
                </p>
              </div>

              {/* Graphic cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto pt-2 text-left font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-cyber-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase">Original File</span>
                  <p className="text-white font-bold truncate">test_document.png</p>
                  <p className="text-slate-400 text-[10px]">Restricted Document</p>
                </div>
                <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 space-y-1">
                  <span className="text-cyan-400 text-[10px] uppercase">Cipher Engine</span>
                  <p className="text-cyan-300 font-bold">AES-256-GCM</p>
                  <p className="text-slate-400 text-[10px]">X25519 Key Wrapping</p>
                </div>
                <div className="p-3.5 rounded-xl bg-cyber-900/70 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase">Recipients</span>
                  <p className="text-emerald-400 font-bold">Alice, Bob</p>
                  <p className="text-slate-400 text-[10px]">Encrypted Package Saved</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Bob receives a uniquely watermarked copy */}
          {currentStep === 2 && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="inline-flex p-4 rounded-3xl bg-purple-950/70 border border-purple-500/50 text-purple-400 shadow-xl shadow-purple-500/10">
                <Unlock className="w-12 h-12" />
              </div>

              <div className="space-y-2 max-w-2xl mx-auto">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 uppercase tracking-widest">
                  Step 2 of 5
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white font-mono">
                  "Bob receives a uniquely watermarked copy"
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  When Bob un-wraps the AES key, the raw decrypted bytes never leave memory unprotected. SANKET instantly embeds an <strong>imperceptible, unique 128-bit DCT-QIM watermark</strong> specifically tied to Bob, and digitally signs the event to the ledger.
                </p>
              </div>

              {/* Graphic cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-2 text-left font-mono text-xs">
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800 space-y-1.5">
                  <span className="text-cyan-400 text-[10px] uppercase font-bold">Alice's Copy</span>
                  <p className="text-slate-200">Watermark: <span className="text-cyan-300">88ae75...</span></p>
                  <p className="text-slate-400 text-[10px]">Signed on Ledger: Block #0</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800 space-y-1.5">
                  <span className="text-purple-400 text-[10px] uppercase font-bold">Bob's Copy</span>
                  <p className="text-slate-200">Watermark: <span className="text-purple-300">6426ad...</span></p>
                  <p className="text-slate-400 text-[10px]">Signed on Ledger: Block #1</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: File is leaked after tampering */}
          {currentStep === 3 && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="space-y-2 max-w-2xl mx-auto">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 uppercase tracking-widest">
                  Step 3 of 5
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white font-mono">
                  "File is leaked after tampering"
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  An insider leaks the confidential document, but first crops 15% of the image and applies gray fill tampering to eliminate visible traces.
                </p>
              </div>

              {/* Attack Visualization Component */}
              <div className="max-w-3xl mx-auto text-left">
                <AttackVisualization />
              </div>
            </div>
          )}

          {/* STEP 4: System analyzes and identifies source */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="inline-flex p-4 rounded-3xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-400 shadow-xl shadow-cyan-500/10">
                <Search className="w-12 h-12 animate-spin-slow" />
              </div>

              <div className="space-y-2 max-w-2xl mx-auto">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase tracking-widest">
                  Step 4 of 5
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white font-mono">
                  "System analyzes and identifies source"
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  The SANKET forensic engine scans the leaked file in the DCT frequency domain. Despite cropping and JPEG compression, the multi-coefficient redundant watermark survives with <strong>100% vote ratio</strong> and <strong>CRC validation</strong>!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto pt-2 text-left font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-cyber-900/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Extracted Watermark</span>
                  <span className="text-cyan-300 font-bold text-sm">88ae75...</span>
                </div>
                <div className="p-3.5 rounded-xl bg-cyber-900/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">CRC-16 Checksum</span>
                  <span className="text-emerald-400 font-bold text-sm">VALID ✓</span>
                </div>
                <div className="p-3.5 rounded-xl bg-cyber-900/80 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Confidence Score</span>
                  <span className="text-emerald-400 font-bold text-sm">88.5% (HIGH)</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Ledger confirms tamper evidence (Grand Finale) */}
          {currentStep === 5 && (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="space-y-2 max-w-2xl mx-auto">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-widest">
                  Step 5 of 5 • Final Verdict
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-white font-mono">
                  "Ledger confirms tamper evidence"
                </h2>
              </div>

              {/* The Dramatic Final Result Screen (Requirement 3 + 4 + 5) */}
              <div className="text-left">
                <FinalResultScreen
                  user="ALICE"
                  confidence={88.5}
                  status="VERIFIED"
                  watermarkId="88ae75ecf0e6496e95c10b429f5f0a1c"
                  ledgerBlock={0}
                  tamperType="Cropping & Gray Fill (40x40 Area)"
                  showAttack={false}
                  showExplanation={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-mono text-slate-400">
            Step {currentStep} of {totalSteps}
          </span>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-cyan-600/30 transition-all"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center space-x-1.5 px-6 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition-all"
            >
              <span>Done</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
