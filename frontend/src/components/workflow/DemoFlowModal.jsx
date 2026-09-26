import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Fingerprint,
  Server,
  Lock,
  Unlock,
  Send,
  FileCheck,
  UserCheck,
} from 'lucide-react';
import { api } from '../../api/client';

export default function DemoFlowModal({ isOpen, onClose, onRefreshData }) {
  const [isRunning, setIsRunning] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleRunFlow = async () => {
    setIsRunning(true);
    setError(null);
    setDemoData(null);
    try {
      const data = await api.runDemoFlow();
      setDemoData(data);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setError(err.message || 'Demo flow execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const stepIcons = [
    UserCheck,
    Send,
    UserCheck,
    Unlock,
    AlertCircle,
    FileCheck,
    Fingerprint,
    Server,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-400" />
              SANKET 8-Stage Demonstration Flow (Part 7)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribute → Authorize → Decrypt → Attribute → Verify with Identity & Post-Quantum Multi-Sig Guarantees
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Action Callout */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-white text-sm">
                1-Click Complete Provenance Lifecycle
              </div>
              <p className="text-slate-300 text-xs mt-0.5 max-w-xl">
                Executes the full required demonstration flow: Alice distributes to Bob via Kyber-768 encapsulation, Bob authorizes and decrypts with unique DCT-QIM watermark and dual Dilithium signatures, simulates leak tamper, and verifies forensic attribution.
              </p>
            </div>
            <button
              onClick={handleRunFlow}
              disabled={isRunning}
              className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 transition-all shrink-0 shadow-md shadow-blue-500/20"
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Executing 8 Stages...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run 8-Stage Flow</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stepper Display */}
          {demoData?.steps ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Execution Stages Result
                </span>
                <span className="font-semibold text-emerald-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Flow Completed with 100% Attribution
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {demoData.steps.map((st, idx) => {
                  const Icon = stepIcons[idx] || CheckCircle2;
                  const isAttribution = st.step === 7;
                  const isProof = st.step === 8;

                  return (
                    <div
                      key={st.step}
                      className={`p-4 rounded-xl border space-y-2 transition-all ${
                        isAttribution
                          ? 'bg-red-950/30 border-red-500/60'
                          : isProof
                          ? 'bg-emerald-950/30 border-emerald-500/60'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                            {st.step}
                          </div>
                          <span className="font-semibold text-slate-200">
                            {st.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                          {st.status}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 space-y-1 pl-8">
                        {st.user && (
                          <div>
                            User: <strong className="text-white">@{st.user}</strong> ({st.role || st.name})
                          </div>
                        )}
                        {st.document_id && (
                          <div>
                            Doc ID: <strong className="text-blue-400">{st.document_id}</strong>
                          </div>
                        )}
                        {st.encryption && (
                          <div>
                            Cipher: <span className="text-slate-300">{st.encryption}</span>
                          </div>
                        )}
                        {st.watermark_id && (
                          <div>
                            Watermark: <span className="text-emerald-400">{st.watermark_id}</span>
                          </div>
                        )}
                        {st.identified_user && (
                          <div className="text-red-300 font-bold">
                            Source: @{st.identified_user} (Conf: {st.confidence}%, {st.verdict})
                          </div>
                        )}
                        {st.recipient_dilithium_signature && (
                          <div>
                            Recipient Sig: <span className="text-emerald-400 truncate">{st.recipient_dilithium_signature}</span>
                          </div>
                        )}
                        {st.system_authority_signature && (
                          <div>
                            System Sig: <span className="text-emerald-400 truncate">{st.system_authority_signature}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !isRunning && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Play className="w-10 h-10 mx-auto text-slate-700" />
              <p>Click "Run 8-Stage Flow" above to simulate the entire lifecycle.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>Non-repudiable provenance verified via Post-Quantum Dilithium + Kyber</span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
