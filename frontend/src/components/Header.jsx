import React from 'react';
import { Shield, Settings, RefreshCw, ExternalLink, Play, User } from 'lucide-react';
import { getApiKey, getBaseUrl } from '../api/client';

export default function Header({
  onOpenDemo,
  onOpenSettings,
  isOnline,
  onRefresh,
  isRefreshing,
  currentUser = 'alice',
  onSelectUser,
}) {
  const baseUrl = getBaseUrl();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Product Title */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white font-mono">
                  SANKET
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                  DLP File Sharing
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Secure Document Distribution & Forensic Attribution
              </p>
            </div>
          </div>

          {/* Center: Simulated User Identity Switcher (Alice / Bob) */}
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-[11px] font-medium text-slate-400 px-2 hidden sm:inline flex items-center space-x-1">
              <User className="w-3 h-3 text-slate-500" />
              <span>Simulated User:</span>
            </span>
            <button
              type="button"
              onClick={() => onSelectUser && onSelectUser('alice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentUser === 'alice'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Alice</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectUser && onSelectUser('bob')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentUser === 'bob'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Bob</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2.5">
            {/* System Status Pill */}
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-[11px] font-mono">{isOnline ? 'API Connected' : 'Offline'}</span>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh System"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={onOpenSettings}
              title="Connection Settings"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* 1-Click Demo Button for Judges */}
            <button
              type="button"
              onClick={onOpenDemo}
              className="flex items-center space-x-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Full Demo</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
