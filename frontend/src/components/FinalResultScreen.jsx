import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Award,
  Hash,
  UserCheck,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react';
import AttackVisualization from './AttackVisualization';
import SimplifiedExplanation from './SimplifiedExplanation';

export default function FinalResultScreen({
  user = 'ALICE',
  confidence = 88.5,
  status = 'VERIFIED',
  watermarkId = '88ae75ecf0e6496e95c10b429f5f0a1c',
  ledgerBlock = 0,
  tamperType = 'Cropping / Tamper (40x40 pixel fill)',
  beforeImageUrl,
  afterImageUrl,
  showAttack = true,
  showExplanation = true,
  className = '',
}) {
  const isAlice = user?.toLowerCase() === 'alice';
  const numericConfidence = typeof confidence === 'number' ? confidence : parseFloat(confidence) || 88.5;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dramatic Grand Reveal Card */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-950/90 via-cyan-950/70 to-indigo-950/90 p-6 sm:p-10 shadow-2xl shadow-emerald-500/30 text-center space-y-6">
        {/* Glowing backdrop halo */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Court-Admissible Forensic Seal */}
        <div className="relative inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-900/90 border border-emerald-500/80 text-emerald-300 text-xs font-mono font-bold tracking-widest uppercase shadow-lg shadow-emerald-500/20">
          <Award className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>FORENSIC ATTRIBUTION REPORT • COURT-ADMISSIBLE</span>
        </div>

        {/* Large Text: LEAK SOURCE IDENTIFIED */}
        <div className="relative space-y-2">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-mono tracking-tight uppercase drop-shadow-md">
            🚨 LEAK SOURCE IDENTIFIED 🚨
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-mono">
            Cryptographic attribution unequivocally proves the leak originated from the decryptor below.
          </p>
        </div>

        {/* 3 Core Highlight Pillars: User, Confidence, Status */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto pt-2">
          {/* Pillar 1: User */}
          <div className="p-5 rounded-2xl bg-black/60 border border-emerald-500/50 shadow-xl flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-transform">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Identified User
            </span>
            <div className="flex items-center space-x-2">
              <span className={`w-3.5 h-3.5 rounded-full ${isAlice ? 'bg-cyan-400' : 'bg-purple-400'} animate-ping`} />
              <h2 className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-emerald-400 uppercase">
                {user}
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700">
              Attributed Operator
            </span>
          </div>

          {/* Pillar 2: Confidence */}
          <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/50 shadow-xl flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-transform">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Forensic Confidence
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl sm:text-4xl font-black font-mono text-cyan-300">
                {numericConfidence.toFixed(1)}%
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700">
              HIGH CONFIDENCE
            </span>
          </div>

          {/* Pillar 3: Status */}
          <div className="p-5 rounded-2xl bg-black/60 border border-amber-500/50 shadow-xl flex flex-col items-center justify-center space-y-2 transform hover:scale-105 transition-transform">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Attestation State
            </span>
            <div className="flex items-center space-x-1.5 text-amber-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                {status}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-700">
              Anchored on Ledger
            </span>
          </div>
        </div>

        {/* Cryptographic Badges Bar */}
        <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2 text-xs font-mono">
          <span className="px-3 py-1 rounded-xl bg-slate-900/90 text-slate-300 border border-slate-700 flex items-center space-x-1.5">
            <Hash className="w-3.5 h-3.5 text-cyan-400" />
            <span>Watermark ID: {watermarkId.slice(0, 16)}...</span>
          </span>
          <span className="px-3 py-1 rounded-xl bg-slate-900/90 text-slate-300 border border-slate-700 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Signed in Block #{ledgerBlock}</span>
          </span>
          <span className="px-3 py-1 rounded-xl bg-slate-900/90 text-amber-300 border border-amber-700/60 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Attack: {tamperType}</span>
          </span>
        </div>
      </div>

      {/* Attack Visualization Side-by-Side (Requirement 4) */}
      {showAttack && (
        <AttackVisualization
          beforeImageUrl={beforeImageUrl}
          afterImageUrl={afterImageUrl}
          attackType={tamperType}
        />
      )}

      {/* Simplified Explanation 3-Line Panel (Requirement 5) */}
      {showExplanation && <SimplifiedExplanation />}
    </div>
  );
}
