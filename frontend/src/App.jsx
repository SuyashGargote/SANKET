import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StatusCards from './components/StatusCards';
import EncryptTab from './components/EncryptTab';
import DecryptTab from './components/DecryptTab';
import VerifyTab from './components/VerifyTab';
import ReportTab from './components/ReportTab';
import LedgerTab from './components/LedgerTab';
import ArchitectureTab from './components/ArchitectureTab';
import DemoModal from './components/DemoModal';
import SettingsModal from './components/SettingsModal';
import { Lock, Unlock, Search, FileText, Server, Layers, Sparkles } from 'lucide-react';
import { api } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('verify'); // Default to Verify or Dashboard as requested
  const [statusData, setStatusData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active User Simulation (Alice vs Bob)
  const [currentUser, setCurrentUser] = useState('alice');

  // Modals
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Workflow shared state
  const [latestPackagePath, setLatestPackagePath] = useState('data/encrypted/test_document');
  const [latestDecryptedPath, setLatestDecryptedPath] = useState(null);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.getStatus();
      setStatusData(res);
      setIsOnline(true);
      setStatusError(null);
    } catch (err) {
      setIsOnline(false);
      setStatusError(err.message || 'Cannot connect to SANKET backend');
    } finally {
      setIsLoadingStatus(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'encrypt', label: '1. Encrypt', icon: Lock, badge: 'AES-GCM' },
    { id: 'decrypt', label: '2. Decrypt', icon: Unlock, badge: 'DCT-QIM' },
    { id: 'verify', label: '3. Verify Leak', icon: Search, badge: 'CORE', highlight: true },
    { id: 'report', label: '4. Forensic Report', icon: FileText, badge: 'Tamper AI' },
    { id: 'ledger', label: '5. Ledger & Anchors', icon: Server, badge: 'Hash-Chain' },
    { id: 'architecture', label: 'Architecture', icon: Layers, badge: 'Flow' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation & Brand Header */}
      <Header
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOnline={isOnline}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-Time System Status Cards */}
        <StatusCards
          statusData={statusData}
          isLoading={isLoadingStatus}
          error={statusError}
        />

        {/* Tab Navigation Bar */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center space-x-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyber-900 text-white border border-slate-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? tab.highlight
                        ? 'text-cyan-400 animate-pulse'
                        : 'text-cyan-400'
                      : 'text-slate-500'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono tracking-wider ${
                      tab.highlight
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Tab Panel */}
        <div className="py-2">
          {activeTab === 'encrypt' && (
            <EncryptTab
              currentUser={currentUser}
              onFileEncrypted={(pkgPath) => {
                setLatestPackagePath(pkgPath);
              }}
              onSelectPackageForDecrypt={(pkgPath) => {
                setLatestPackagePath(pkgPath);
                setActiveTab('decrypt');
              }}
            />
          )}

          {activeTab === 'decrypt' && (
            <DecryptTab
              currentUser={currentUser}
              onUserChange={setCurrentUser}
              initialPackagePath={latestPackagePath}
              onFileDecrypted={(imgPath) => {
                setLatestDecryptedPath(imgPath);
              }}
              onNavigateVerify={(imgPath) => {
                setLatestDecryptedPath(imgPath);
                setActiveTab('verify');
              }}
            />
          )}

          {activeTab === 'verify' && (
            <VerifyTab prefillImagePath={latestDecryptedPath} />
          )}

          {activeTab === 'report' && <ReportTab />}

          {activeTab === 'ledger' && <LedgerTab />}

          {activeTab === 'architecture' && <ArchitectureTab />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-cyber-950/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            SANKET — Cryptographic Attribution & Decryption Provenance Platform
          </p>
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <span>FastAPI Backend: :8000</span>
            <span>•</span>
            <span>React + Tailwind CSS Frontend</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={fetchStatus}
      />
    </div>
  );
}
