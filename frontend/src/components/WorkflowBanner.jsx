import React from 'react';
import { Send, Inbox, Eye, AlertTriangle, ShieldCheck, ChevronRight, Play } from 'lucide-react';

export default function WorkflowBanner({ activeTab, onRunDemo }) {
  const steps = [
    { id: 'send', label: '1. Alice sends file', sub: 'AES-256 encrypted', icon: Send },
    { id: 'receive', label: '2. Bob receives', sub: 'In My Files', icon: Inbox },
    { id: 'open', label: '3. Bob opens file', sub: 'Watermark applied', icon: Eye },
    { id: 'leak', label: '4. File leaked', sub: 'Cropped or altered', icon: AlertTriangle },
    { id: 'detect', label: '5. Source identified', sub: 'Attributed to Bob', icon: ShieldCheck },
  ];

  // Map active tab to current step
  const getActiveStepIndex = () => {
    if (activeTab === 'send') return 0;
    if (activeTab === 'my-files') return 1;
    if (activeTab === 'leak') return 3;
    if (activeTab === 'ledger') return 4;
    return 0;
  };

  const activeIdx = getActiveStepIndex();

  return (
    <div className="panel rounded-xl p-3 sm:p-4 border border-slate-800 bg-slate-900/60 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Step Flow Indicator */}
        <div className="flex items-center overflow-x-auto pb-1 lg:pb-0 scrollbar-none space-x-1 sm:space-x-2">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            const isCurrent = idx === activeIdx;
            const isPast = idx < activeIdx;

            return (
              <React.Fragment key={st.id}>
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <div
                  className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : isPast
                      ? 'bg-slate-800/80 text-emerald-400'
                      : 'text-slate-400 bg-slate-900/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="block font-medium whitespace-nowrap leading-tight text-[11px] sm:text-xs">
                      {st.label}
                    </span>
                    <span className={`block text-[10px] whitespace-nowrap leading-tight ${isCurrent ? 'text-blue-100' : isPast ? 'text-emerald-500/80' : 'text-slate-500'}`}>
                      {st.sub}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* 1-Click Demo Button for Judges */}
        {onRunDemo && (
          <button
            type="button"
            onClick={onRunDemo}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm self-start lg:self-auto shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>1-Click Complete Flow Demo</span>
          </button>
        )}
      </div>
    </div>
  );
}
