import React, { useState } from 'react';
import { FileText, Upload, Download, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, Activity, BarChart3, Layers, Sliders } from 'lucide-react';
import { api } from '../api/client';

export default function ReportTab() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'json'

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.png')) {
        setError('Please upload a PNG file.');
        return;
      }
      setFile(selected);
      setError(null);
      setReport(null);
    }
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image file to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await api.generateReport(file, true);
      const payload = res.data || res;
      setReport(payload);
    } catch (err) {
      setError(err.message || 'Report generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
        return 'bg-rose-950 text-rose-300 border-rose-700';
      case 'MEDIUM':
        return 'bg-amber-950 text-amber-300 border-amber-700';
      case 'LOW':
        return 'bg-cyan-950 text-cyan-300 border-cyan-700';
      case 'NONE':
      default:
        return 'bg-emerald-950 text-emerald-300 border-emerald-700';
    }
  };

  const getTamperTypeBadge = (tamperType) => {
    switch (tamperType?.toLowerCase()) {
      case 'crop':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'noise':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'compression':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'rotation':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      case 'none':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const reportId = report?.report_id || 'RPT-FORENSIC';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-purple-400" />
            <span>Forensic Tamper Analysis Report</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deep forensic breakdown of signal distortions, tamper heuristics classification, and damage severity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input upload */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Submit Image for Analysis
          </h3>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div className="relative border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-2xl p-6 text-center transition-colors bg-cyber-900/50">
              <input
                type="file"
                accept=".png"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="p-3.5 rounded-2xl bg-purple-950/70 text-purple-400 border border-purple-800/50">
                  <Upload className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-purple-300 font-mono truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-300">Select PNG to investigate</p>
                    <p className="text-xs text-slate-500">Heuristics: crop, noise, compression, rotation</p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/25"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Computing Forensic Metrics...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-purple-200" />
                  <span>Generate Forensic Report</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Forensic Report Cards & Signal Breakdown */}
        <div className="lg:col-span-8 glass-panel rounded-2xl p-6 border border-slate-800">
          {report ? (
            <div className="space-y-6">
              {/* Report Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                      Report ID:
                    </span>
                    <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {report.report_id}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{report.generated_at}</span>
                </div>

                {/* View toggles & Download Button */}
                <div className="flex items-center space-x-2">
                  <div className="flex rounded-lg bg-cyber-900 border border-slate-800 p-0.5 text-xs font-medium">
                    <button
                      onClick={() => setActiveTab('summary')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        activeTab === 'summary' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Metrics
                    </button>
                    <button
                      onClick={() => setActiveTab('json')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        activeTab === 'json' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      JSON
                    </button>
                  </div>

                  <a
                    href={api.getDownloadUrl('report', report.report_id)}
                    download={`${report.report_id}.json`}
                    className="p-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 transition-colors flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>Download JSON</span>
                  </a>
                </div>
              </div>

              {activeTab === 'summary' ? (
                <div className="space-y-6">
                  {/* Tamper Classification & Severity Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-cyber-900/60 border border-slate-800 text-center">
                      <span className="text-xs uppercase text-slate-400 font-mono tracking-wider block mb-1">
                        Tamper Classification
                      </span>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${getTamperTypeBadge(
                          report.tamper_type
                        )}`}
                      >
                        {report.tamper_type || 'Unknown'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-cyber-900/60 border border-slate-800 text-center">
                      <span className="text-xs uppercase text-slate-400 font-mono tracking-wider block mb-1">
                        Damage Severity
                      </span>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${getSeverityBadge(
                          report.severity
                        )}`}
                      >
                        {report.severity || 'NONE'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-cyber-900/60 border border-slate-800 text-center">
                      <span className="text-xs uppercase text-slate-400 font-mono tracking-wider block mb-1">
                        Attributed User
                      </span>
                      <span className="text-base font-mono font-black text-cyan-400 uppercase">
                        {report.user || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>

                  {/* Signal Breakdown with Progress Bars */}
                  <div className="p-5 rounded-2xl bg-cyber-900/50 border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-purple-400" />
                      <span>Forensic Signal Breakdown</span>
                    </h4>

                    {/* Progress Bar 1: Vote Agreement */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Inter-Copy Consensus (Votes):</span>
                        <span className="text-emerald-400 font-bold">
                          {report.vote_ratio !== undefined ? `${(report.vote_ratio * 100).toFixed(1)}%` : '--'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (report.vote_ratio || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress Bar 2: Sync Template Strength */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Sync Template Strength:</span>
                        <span className="text-cyan-400 font-bold">
                          {report.sync_score !== undefined ? `${(report.sync_score * 100).toFixed(1)}%` : '--'} (
                          {report.sync_strength || 'N/A'})
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (report.sync_score || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Progress Bar 3: Block Corruption */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Damaged / Corrupted Blocks:</span>
                        <span
                          className={`font-bold ${
                            (report.corruption_pct || 0) > 25 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {report.corruption_pct !== undefined ? `${report.corruption_pct.toFixed(1)}%` : '--'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (report.corruption_pct || 0) > 25 ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, report.corruption_pct || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tamper Details / Human Explanation */}
                  {report.tamper_details && report.tamper_details.length > 0 && (
                    <div className="p-4 rounded-xl bg-cyber-950/80 border border-slate-800 space-y-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Heuristic Classifier Observations:
                      </span>
                      <ul className="space-y-1">
                        {report.tamper_details.map((detail, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                            <span className="text-purple-400">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* JSON Viewer */
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-cyber-950 p-4">
                  <pre className="text-xs font-mono text-cyan-300 overflow-x-auto max-h-96 leading-relaxed">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-600" />
              <p className="text-xs">No forensic report generated yet.</p>
              <p className="text-[11px] text-slate-600">Select an image on the left and click Generate Forensic Report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
