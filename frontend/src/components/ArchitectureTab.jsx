import React from 'react';
import { Lock, Unlock, Server, Search, ArrowRight, ShieldCheck, FileCheck, Hash, EyeOff, Layers, Cpu, CheckCircle2 } from 'lucide-react';

export default function ArchitectureTab() {
  const steps = [
    {
      num: '01',
      title: 'Encryption & Key Wrapping',
      icon: Lock,
      color: 'cyan',
      tech: 'AES-256-GCM + X25519 ECDH',
      summary: 'Sender encrypts document with one file key. Key is wrapped independently for each recipient via X25519 ECDH.',
      points: [
        'Each recipient gets a unique wrapped key in metadata.json',
        'Payload is authenticated with 96-bit AES-GCM tag',
        'Sender never touches or predicts watermarks',
      ],
    },
    {
      num: '02',
      title: 'Provenance Watermarking',
      icon: Unlock,
      color: 'indigo',
      tech: 'DCT-QIM + CRC-16 + Sync Template',
      summary: 'Raw decrypted bytes are NEVER released unwatermarked. During decryption, a unique watermark is permanently embedded.',
      points: [
        'Watermark ID = SHA256(user_id + file_id + timestamp + nonce)',
        'Embedded into DCT mid-frequency coefficients',
        'Sync template embedded for automatic rotation recovery',
      ],
    },
    {
      num: '03',
      title: 'Tamper-Evident Ledger',
      icon: Server,
      color: 'purple',
      tech: 'Hash-Chain + Ed25519 + Periodic Anchors',
      summary: 'Recipient cryptographically signs the decryption event with their Ed25519 private key, appended to hash-chain ledger.',
      points: [
        'Non-repudiation: user cannot deny decrypting file',
        'Hash-chain prevents block insertion or modification',
        'Periodic secondary anchors (every 5 blocks) catch recomputation attacks',
      ],
    },
    {
      num: '04',
      title: 'Forensic Attribution',
      icon: Search,
      color: 'emerald',
      tech: 'Multi-Signal Analysis + Heuristic Classifier',
      summary: 'When a leak surfaces, the engine extracts watermarks across 3 signal copies and calculates a mathematical confidence score.',
      points: [
        'Recovers from crop, noise, blur, compression, and rotation',
        'Heuristic classifier identifies exact tamper attack',
        'Produces mathematical confidence score (0-100%) and verdict',
      ],
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Introduction Banner */}
      <div className="text-center space-y-2 p-6 glass-panel rounded-3xl border border-slate-800">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase bg-cyan-950 text-cyan-400 border border-cyan-800">
          Core System Architecture
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          How SANKET Mathematical Attribution Works
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          A four-tier defensive pipeline guaranteeing that any confidential document leaked in the wild can be irrefutably traced to its exact recipient.
        </p>
      </div>

      {/* Visual Boxes-and-Arrows Workflow */}
      <div className="p-6 sm:p-8 glass-panel rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-xs font-mono uppercase font-bold tracking-widest text-slate-400 text-center">
          End-to-End Operational Lifecycle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {steps.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={i}
                className="relative p-5 rounded-2xl bg-cyber-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-black text-slate-500">{st.num}</span>
                    <div className="p-2 rounded-xl bg-slate-800/80 text-cyan-400 border border-slate-700">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white tracking-tight">{st.title}</h4>
                  <span className="text-[11px] font-mono text-cyan-400 block mt-0.5">{st.tech}</span>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{st.summary}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 space-y-1">
                  {st.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-start space-x-1.5 text-[11px] text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Properties Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <EyeOff className="w-4 h-4" />
            <span>Invisible & Inaudible</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            DCT-QIM alters only mid-frequency cosine coefficients. To the human eye, the image appears 100% indistinguishable from original plaintext.
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Cryptographic Proof</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every extraction is guarded by CRC-16 checksums and verified against signed Ed25519 blocks, preventing false accusations mathematically.
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
            <Layers className="w-4 h-4" />
            <span>Tamper Resilience</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Survives aggressive adversarial distortion: JPEG compression (Q50), cropping (up to 20%), Gaussian noise, rotation (±5° auto-recovery), and resizing.
          </p>
        </div>
      </div>
    </div>
  );
}
