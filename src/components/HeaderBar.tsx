import React, { useState } from 'react';
import { ConnectionState } from '../types/deriv';
import { DerivOAuthAccount } from '../utils/derivOAuth';
import { Shield, Zap, RefreshCw, Key, Wallet, SlidersHorizontal, Bot, Radar, Smartphone, Download } from 'lucide-react';
import { InstallAppModal } from './InstallAppModal';

interface HeaderBarProps {
  connectionState: ConnectionState;
  onUpdateConnection: (appId: string, token: string) => void;
  onOAuthRedirect?: (appId: string) => void;
  onResetDemoBalance: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  availableAccounts?: DerivOAuthAccount[];
  onSelectAccount?: (account: DerivOAuthAccount) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  connectionState,
  onResetDemoBalance,
  activeTab,
  setActiveTab,
  availableAccounts = [],
  onSelectAccount,
}) => {
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const navItems = [
    { id: 'terminal', label: 'Trading Terminal', icon: Zap },
    { id: 'dbot', label: 'DBot Studio', icon: SlidersHorizontal },
    { id: 'botstore', label: 'Bot Store', icon: Bot },
    { id: 'scanner', label: 'Market Scanner', icon: Radar },
    { id: 'copy', label: 'Copy Trading', icon: Shield },
    { id: 'analyzer', label: 'Market Analyzer', icon: RefreshCw },
    { id: 'copilot', label: 'AI Copilot', icon: Key },
    { id: 'tools', label: 'P2P & Risk Tools', icon: Wallet },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-red-900/30">
              d
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  DERIV
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-700/50 text-red-400">
                  HUB 3RD PARTY
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Synthetics, DBot Auto-Trader & Copy Engine
              </p>
            </div>
          </div>

          {/* Account Balance & Connection Status */}
          <div className="flex items-center space-x-3">
            
            {/* WS Connection Status Pill */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                connectionState.isAuthorized
                  ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300'
                  : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                connectionState.isAuthorized
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
              }`} />
              <span className="font-bold">
                {connectionState.isAuthorized
                  ? `Live: ${connectionState.loginid}`
                  : 'Demo Mode'}
              </span>
            </div>

            {/* Account Switcher Dropdown if accounts available */}
            {availableAccounts.length > 0 && onSelectAccount && (
              <div className="relative">
                <select
                  value={connectionState.token || ''}
                  onChange={(e) => {
                    const selected = availableAccounts.find((a) => a.token === e.target.value);
                    if (selected) onSelectAccount(selected);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-red-500 cursor-pointer max-w-[160px] truncate"
                >
                  {availableAccounts.map((acc, idx) => (
                    <option key={idx} value={acc.token} className="bg-slate-900 text-white font-mono">
                      {acc.type === 'REAL' ? '🟢 REAL' : '🔵 DEMO'}: {acc.account}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Balance Badge */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 space-x-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {connectionState.accountType} USD
                </div>
                <div className="font-mono font-bold text-sm text-emerald-400">
                  ${connectionState.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              
              {/* Reset Demo Button */}
              {connectionState.accountType === 'DEMO' && (
                <button
                  onClick={onResetDemoBalance}
                  title="Reset Demo Balance to $10,000"
                  className="ml-1 p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-md transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Install App PWA / Export Modal Trigger */}
            <button
              onClick={() => setShowInstallModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/40 transition-all border border-emerald-500/50"
              title="Download & Install Deriv Hub App"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline font-bold">Install & Export App</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation bar */}
        <div className="flex space-x-1 border-t border-slate-800/80 overflow-x-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Android Installation Modal */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-lg text-white">Install on Android Device</h3>
              </div>
              <button
                onClick={() => setShowAndroidModal(false)}
                className="text-slate-400 hover:text-white font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-sm">
                  <Download className="w-4 h-4" />
                  <span>Option 1: Install Instant Web App (Recommended)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  This app is fully configured as a Progressive Web App (PWA). You can install it on your Android phone with zero APK downloads:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400 font-medium pt-1">
                  <li>Open this app link in <strong className="text-white">Google Chrome on Android</strong>.</li>
                  <li>Tap the <strong className="text-white">Three Dots (⋮)</strong> menu in the top-right corner.</li>
                  <li>Tap <strong className="text-emerald-400 font-bold">"Install App"</strong> or <strong className="text-emerald-400 font-bold">"Add to Home screen"</strong>.</li>
                  <li>The app will install directly into your Android app drawer and launch like a native APK app!</li>
                </ol>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-extrabold text-sm">
                  <Download className="w-4 h-4" />
                  <span>Option 2: Build Native Android APK</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  If you want an <code className="text-emerald-400 font-mono">.apk</code> file to install directly or publish to Play Store:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-400 font-medium pt-1">
                  <li>Export source code via the <strong className="text-white">AI Studio Settings / Export</strong> menu.</li>
                  <li>Convert the React project to Android using <strong className="text-white">PWABuilder / Bubblewrap</strong> or <strong className="text-white">Capacitor</strong> (<code className="text-amber-300">npx cap add android</code>).</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAndroidModal(false)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Install App Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </header>
  );
};
