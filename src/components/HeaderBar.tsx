import React, { useEffect, useState } from 'react';
import { ConnectionState } from '../types/deriv';
import { DerivOAuthAccount } from '../utils/derivOAuth';
import { Shield, Zap, RefreshCw, Key, Wallet, SlidersHorizontal, Bot, Radar, Download, Link2, LogOut } from 'lucide-react';
import { InstallAppModal } from './InstallAppModal';

interface HeaderBarProps {
  connectionState: ConnectionState;
  derivNickname?: string;
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
  derivNickname,
  onUpdateConnection,
  onOAuthRedirect,
  onResetDemoBalance,
  activeTab,
  setActiveTab,
  availableAccounts = [],
  onSelectAccount,
}) => {
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [token, setToken] = useState(connectionState.token || '');
  const [appId, setAppId] = useState(connectionState.appId || '');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => setToken(connectionState.token || ''), [connectionState.token]);
  useEffect(() => setAppId(connectionState.appId || ''), [connectionState.appId]);

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

  const handleConnect = () => onUpdateConnection(appId, token);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 py-3">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-red-900/30">d</div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight">DERIV</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-700/50 text-red-400">HUB</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Live WebSocket Trading Terminal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${connectionState.isAuthorized ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300' : 'bg-slate-800/90 border-slate-700/80 text-slate-300'}`}>
              <span className={`w-2 h-2 rounded-full ${connectionState.isAuthorized ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>
  {connectionState.isAuthorized
    ? `LIVE ${connectionState.loginid || ''}${derivNickname ? ` • ${derivNickname}` : ''}`
    : connectionState.isConnecting
      ? 'CONNECTING…'
      : 'NOT CONNECTED'}
</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl p-1">
              <input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="App ID"
                className="w-28 bg-transparent px-2 py-1.5 text-[11px] font-mono text-slate-300 outline-none"
                aria-label="Deriv App ID"
              />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder="Deriv API token"
                className="w-40 sm:w-56 bg-transparent px-2 py-1.5 text-[11px] font-mono text-white outline-none"
                aria-label="Deriv API token"
                autoComplete="off"
              />
              <button onClick={() => setShowToken((v) => !v)} className="px-2 py-1.5 text-[10px] text-slate-400 hover:text-white" title={showToken ? 'Hide token' : 'Show token'}>{showToken ? 'HIDE' : 'SHOW'}</button>
              <button onClick={handleConnect} disabled={!token.trim() || connectionState.isConnecting} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-extrabold rounded-lg flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Connect
              </button>
            </div>

            {availableAccounts.length > 0 && onSelectAccount && (
              <select
                value={connectionState.token || ''}
                onChange={(e) => { const account = availableAccounts.find((a) => a.token === e.target.value); if (account) onSelectAccount(account); }}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-emerald-300 font-mono max-w-[150px]"
              >
                {availableAccounts.map((acc, idx) => <option key={idx} value={acc.token}>{acc.type === 'REAL' ? 'REAL' : 'DEMO'}: {acc.account}</option>)}
              </select>
            )}

            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 space-x-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">{connectionState.accountType} {connectionState.currency}</div>
                <div className="font-mono font-bold text-sm text-emerald-400">{connectionState.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              {connectionState.accountType === 'DEMO' && <button onClick={onResetDemoBalance} title="Reset demo balance" className="p-1 text-slate-400 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>}
            </div>

            {onOAuthRedirect && <button onClick={() => onOAuthRedirect(connectionState.appId)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-xl">Deriv OAuth</button>}
            <button onClick={() => setShowInstallModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"><Download className="w-4 h-4" /> Install</button>
          </div>
        </div>

        {connectionState.authError && <div className="mb-2 px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium break-words">{connectionState.authError}</div>}

        <div className="flex space-x-1 border-t border-slate-800/80 overflow-x-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeTab === item.id ? 'bg-red-600 text-white shadow-md shadow-red-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></button>;
          })}
        </div>
      </div>
      <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </header>
  );
};
