import React, { useState } from 'react';
import { Shield, Sparkles, Settings, RefreshCw, Key, ExternalLink } from 'lucide-react';
import { getApiKey, getBaseUrl } from '../api/client';

export default function Header({ onOpenDemo, onOpenSettings, isOnline, onRefresh, isRefreshing, currentUser = 'alice', onSelectUser }) {
  const currentKey = getApiKey();
  const baseUrl = getBaseUrl();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-cyber-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/25 border border-cyan-400/30">
              <Shield className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping opacity-75" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-lg font-black tracking-wider text-white">
                  SANKET
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                  v2.0 PROD
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden xl:block">
                Provenance-Based Digital Forensics & Attribution Platform
              </p>
            </div>
          </div>

          {/* User Selector: Alice vs Bob (Requirement 2) */}
          <div className="flex items-center space-x-1.5 p-1 rounded-2xl bg-cyber-900/90 border border-slate-800 shadow-inner">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 hidden sm:inline">
              Operator:
            </span>
            <button
              onClick={() => onSelectUser && onSelectUser('alice')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                currentUser === 'alice'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
              <span>Alice</span>
            </button>
            <button
              onClick={() => onSelectUser && onSelectUser('bob')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all ${
                currentUser === 'bob'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-300 animate-pulse" />
              <span>Bob</span>
            </button>
          </div>

          {/* Center: System Status & Dynamic LAN IP Pill */}
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyber-900/90 border border-slate-800 text-xs shrink-0">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-300 font-mono text-[11px]">
              API: {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400/80 font-mono text-[11px] truncate max-w-[160px]" title={baseUrl}>
              {baseUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh status"
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Swagger Docs Link */}
            <a
              href={`${baseUrl}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Settings button */}
            <button
              onClick={onOpenSettings}
              title="API Configuration"
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors border border-slate-800/80"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Big 1-Click Demo Button */}
            <button
              onClick={onOpenDemo}
              className="relative group flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 border border-cyan-400/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-spin-slow group-hover:rotate-12 transition-transform" />
              <span>Run Full Demo</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] uppercase font-mono tracking-wider rounded bg-white/20">
                Judges
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
