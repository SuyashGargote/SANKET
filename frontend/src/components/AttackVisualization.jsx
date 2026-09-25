import React from 'react';
import { Image as ImageIcon, AlertTriangle, ShieldCheck, Zap, Crosshair } from 'lucide-react';
import { api } from '../api/client';

export default function AttackVisualization({
  beforeImageUrl,
  afterImageUrl,
  attackType = 'Cropping / Tamper (40x40 Area)',
  tamperCoords = { top: '15%', left: '15%', width: '32%', height: '32%' },
  className = '',
}) {
  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-slate-800 bg-cyber-950/80 space-y-4 ${className}`}
    >
      {/* Header with Attack Type Label */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white font-mono">
              Attack & Tamper Visualization
            </h4>
            <p className="text-[11px] text-slate-400">
              Hostile tampering simulated to destroy forensic watermark evidence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-400">Attack Type:</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-700 shadow-sm shadow-rose-500/20">
            {attackType}
          </span>
        </div>
      </div>

      {/* Side-by-side Before / After comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Original Watermarked Image */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>BEFORE: Original Watermarked</span>
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
              Pristine
            </span>
          </div>

          <div className="relative rounded-xl border border-slate-800 bg-cyber-900/50 aspect-video flex items-center justify-center overflow-hidden p-3 group">
            {beforeImageUrl ? (
              <img
                src={beforeImageUrl}
                alt="Original Watermarked"
                className="max-h-full object-contain rounded shadow"
              />
            ) : (
              <div className="relative w-full h-full rounded bg-gradient-to-br from-slate-900 to-cyber-950 border border-slate-800 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-cyan-400 font-bold">CONFIDENTIAL DOC</span>
                  <span className="text-emerald-400">✓ DCT-QIM Embedded</span>
                </div>
                <div className="space-y-1.5 text-center">
                  <p className="font-mono text-lg font-black text-slate-300 tracking-wider">
                    SANKET RESTRICTED
                  </p>
                  <p className="text-[10px] font-mono text-cyan-400/80">
                    Encrypted for Alice & Bob • AES-256-GCM
                  </p>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>Block #0: Alice</span>
                  <span>Watermark: 88ae75...</span>
                </div>
              </div>
            )}

            {/* Subtle watermark grid indicator */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
          </div>
          <p className="text-[11px] text-slate-400 text-center font-mono">
            Contains invisible 128-bit DCT-QIM watermark in mid-frequency coefficients
          </p>
        </div>

        {/* Right: Leaked & Tampered Image */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center space-x-1.5 text-rose-400 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>AFTER: Leaked with Hostile Tamper</span>
            </span>
            <span className="text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800 font-bold">
              Altered
            </span>
          </div>

          <div className="relative rounded-xl border border-rose-900/60 bg-cyber-900/50 aspect-video flex items-center justify-center overflow-hidden p-3">
            {afterImageUrl ? (
              <img
                src={afterImageUrl}
                alt="Tampered Image"
                className="max-h-full object-contain rounded shadow"
              />
            ) : (
              <div className="relative w-full h-full rounded bg-gradient-to-br from-slate-900 to-cyber-950 border border-slate-800 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500 line-through">CONFIDENTIAL DOC</span>
                  <span className="text-rose-400 font-bold">⚠️ Tampered Copy</span>
                </div>
                <div className="space-y-1.5 text-center">
                  <p className="font-mono text-lg font-black text-slate-300 tracking-wider">
                    SANKET RESTRICTED
                  </p>
                  <p className="text-[10px] font-mono text-rose-400">
                    Leaked via untrusted channel
                  </p>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>Compression: Q70</span>
                  <span>Crop: 15%</span>
                </div>
              </div>
            )}

            {/* Highlighted Tampered Region Bounding Box */}
            <div
              style={{
                top: tamperCoords.top,
                left: tamperCoords.left,
                width: tamperCoords.width,
                height: tamperCoords.height,
              }}
              className="absolute border-2 border-rose-500 bg-rose-500/25 rounded shadow-lg shadow-rose-500/40 animate-pulse flex flex-col items-center justify-center"
            >
              <div className="absolute -top-3 -left-3 p-1 rounded-full bg-rose-600 text-white shadow">
                <Crosshair className="w-3 h-3" />
              </div>
              <span className="px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono font-bold text-rose-300 border border-rose-500/60 text-center tracking-tight">
                Tampered Region
              </span>
            </div>
          </div>
          <p className="text-[11px] text-rose-300/90 text-center font-mono font-semibold">
            Tampered area cropped & filled with gray; watermark survived through redundancy!
          </p>
        </div>
      </div>
    </div>
  );
}
