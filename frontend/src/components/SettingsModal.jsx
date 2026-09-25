import React, { useState } from 'react';
import { X, Settings, Key, Globe, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getApiKey, getBaseUrl, setApiKey, setBaseUrl, api } from '../api/client';

export default function SettingsModal({ isOpen, onClose, onSaved }) {
  const [url, setUrl] = useState(getBaseUrl());
  const [key, setKey] = useState(getApiKey());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setBaseUrl(url);
    setApiKey(key);
    if (onSaved) onSaved();
    onClose();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setBaseUrl(url);
      setApiKey(key);
      const res = await api.getStatus();
      setTestResult({ success: true, message: `Connected! Health: ${res.system_health || 'HEALTHY'}` });
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md glass-panel rounded-3xl border border-slate-800 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Connection Settings</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>FastAPI Backend URL</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.X.X:8000"
              className="w-full px-3.5 py-2 rounded-xl bg-cyber-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500">Presets:</span>
              <button
                type="button"
                onClick={() => setUrl('http://127.0.0.1:8000')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                127.0.0.1:8000
              </button>
              {typeof window !== 'undefined' && window.location.hostname && (
                <button
                  type="button"
                  onClick={() => setUrl(`http://${window.location.hostname}:8000`)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900"
                >
                  Use {window.location.hostname}:8000 (LAN)
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              For LAN multi-device demo (phones/laptops), set this to your server's Wi-Fi IP (e.g. http://192.168.1.X:8000).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>API Authentication Key (X-API-KEY)</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sanket-admin-key-2026"
              className="w-full px-3.5 py-2 rounded-xl bg-cyber-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-[10px] text-slate-500">Preset keys:</span>
              <button
                type="button"
                onClick={() => setKey('sanket-admin-key-2026')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                admin-key
              </button>
              <button
                type="button"
                onClick={() => setKey('sih-judge-key-2026')}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                judge-key
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Test Ping</span>
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-600/20"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
