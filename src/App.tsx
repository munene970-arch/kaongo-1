import React, { useState, useEffect } from 'react';
import { MarketSymbol, MarketInfo, ActiveContract, ConnectionState, DBotStrategy } from './types/deriv';
import { INITIAL_MARKETS } from './services/derivMarketsData';
import { derivWS, AuthStatus } from './services/derivWebSocket';
import { soundManager } from './utils/soundEffects';
import { HeaderBar } from './components/HeaderBar';
import { TradingTerminal } from './components/Terminal/TradingTerminal';
import { DBotStudio } from './components/BotStudio/DBotStudio';
import { BotStore } from './components/BotStudio/BotStore';
import { MarketScanner } from './components/Analyzer/MarketScanner';
import { CopyTradingHub } from './components/CopyTrading/CopyTradingHub';
import { MarketAnalyzer } from './components/Analyzer/MarketAnalyzer';
import { AICopilotPanel } from './components/Copilot/AICopilotPanel';
import { RiskAndTools } from './components/AccountTools/RiskAndTools';
import { DerivOAuthAccount, parseDerivOAuthInput, getStoredAccounts, saveStoredAccounts } from './utils/derivOAuth';
import { REGISTERED_DERIV_APP_ID, STING_REDIRECT_URI } from './config/deriv';

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>('terminal');
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const hashVal = tab === 'terminal' ? 'dashboard' : tab;
    if (window.location.hash !== `#${hashVal}`) window.history.replaceState(null, '', `#${hashVal}`);
  };

  useEffect(() => {
    const syncTabFromHash = () => {
      const rawHash = window.location.hash.replace('#', '').toLowerCase();
      if (!rawHash) return;
      if (rawHash === 'dashboard' || rawHash === 'terminal' || rawHash === 'trade') setActiveTabState('terminal');
      else if (['dbot', 'botstore', 'scanner', 'copy', 'analyzer', 'copilot', 'tools'].includes(rawHash)) setActiveTabState(rawHash);
    };
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  const [markets] = useState<MarketInfo[]>(INITIAL_MARKETS);
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>('R_75');
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [autoConfiguredBot, setAutoConfiguredBot] = useState<DBotStrategy | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<DerivOAuthAccount[]>(getStoredAccounts());
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    mode: 'DEMO_SIMULATED',
    appId: REGISTERED_DERIV_APP_ID,
    accountType: 'DEMO',
    balanceUsd: 0,
    currency: 'USD',
    isAuthorized: false,
    isConnecting: false,
    authError: null,
  });

  const connectWithToken = (appId: string, token: string) => {
    const cleanToken = derivWS.sanitizeToken(token);
    const cleanAppId = appId?.trim() || REGISTERED_DERIV_APP_ID;
    if (!cleanToken) {
      setConnectionState((prev) => ({ ...prev, isConnecting: false, isAuthorized: false, authError: 'Enter a valid Deriv API token.' }));
      return;
    }
    sessionStorage.setItem('deriv_token', cleanToken);
    localStorage.setItem('deriv_app_id', cleanAppId);
    setConnectionState((prev) => ({ ...prev, appId: cleanAppId, token: cleanToken, isConnecting: true, isAuthorized: false, authError: null }));
    derivWS.connect(cleanAppId, cleanToken);
  };

  const connectWithParsedAccounts = (accounts: DerivOAuthAccount[]) => {
    if (!accounts?.length) return;
    saveStoredAccounts(accounts);
    setAvailableAccounts(accounts);
    const targetAcc = accounts.find((a) => a.type === 'REAL') || accounts[0];
    if (targetAcc?.token) connectWithToken(REGISTERED_DERIV_APP_ID, targetAcc.token);
  };

  useEffect(() => {
    const handleWindowFocus = async () => {
      if (connectionState.isAuthorized) return;
      try {
        if (navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          if (text && (text.includes('token1=') || text.includes('acct1='))) connectWithParsedAccounts(parseDerivOAuthInput(text));
        }
      } catch (_) {}
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [connectionState.isAuthorized]);

  useEffect(() => {
    const settledContractsSet = new Set<string>();

    const processOAuthAndConnect = async () => {
      const activeAppId = REGISTERED_DERIV_APP_ID;
      const fullUrlStr = window.location.search + ' ' + window.location.hash;
      const urlParams = new URLSearchParams(window.location.search + window.location.hash.replace('#', '?'));
      const returnedState = urlParams.get('state');
      const savedState = sessionStorage.getItem('deriv_oauth_state');
      if (returnedState && savedState && returnedState !== savedState) console.warn('[Deriv OAuth] State mismatch detected.');
      if (returnedState) sessionStorage.removeItem('deriv_oauth_state');

      const parsedAccounts = parseDerivOAuthInput(fullUrlStr);
      let activeToken = sessionStorage.getItem('deriv_token') || localStorage.getItem('deriv_token') || '';

      if (parsedAccounts.length > 0) {
        try {
          const serverRes = await fetch('/api/auth/capture-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accounts: parsedAccounts, rawUrl: window.location.href, state: returnedState, appId: activeAppId }),
          });
          const serverData = await serverRes.json();
          if (serverData.success && serverData.capturedToken) {
            activeToken = serverData.capturedToken;
            if (Array.isArray(serverData.accounts) && serverData.accounts.length) {
              saveStoredAccounts(serverData.accounts);
              setAvailableAccounts(serverData.accounts);
            }
          } else {
            saveStoredAccounts(parsedAccounts);
            setAvailableAccounts(parsedAccounts);
            activeToken = (parsedAccounts.find((a) => a.type === 'REAL') || parsedAccounts[0])?.token || activeToken;
          }
        } catch (_) {
          saveStoredAccounts(parsedAccounts);
          setAvailableAccounts(parsedAccounts);
          activeToken = (parsedAccounts.find((a) => a.type === 'REAL') || parsedAccounts[0])?.token || activeToken;
        }

        if (activeToken) sessionStorage.setItem('deriv_token', activeToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (availableAccounts.length > 0) {
        setAvailableAccounts(getStoredAccounts());
      }

      setConnectionState((prev) => ({ ...prev, appId: activeAppId, token: activeToken, isConnecting: Boolean(activeToken) }));
      if (activeToken) derivWS.connect(activeAppId, activeToken);
    };

    processOAuthAndConnect();

    const handleContractUpdate = (updatedContract: ActiveContract) => {
      setActiveContracts((prev) => {
        const idx = prev.findIndex((c) => c.id === updatedContract.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...updatedContract };
          return clone;
        }
        return [{ ...updatedContract }, ...prev].slice(0, 26);
      });

      if (['WON', 'LOST', 'SOLD'].includes(updatedContract.status) && !settledContractsSet.has(updatedContract.id)) {
        settledContractsSet.add(updatedContract.id);
        if (updatedContract.isWin || updatedContract.status === 'WON') soundManager.playWinSound();
        else soundManager.playLossSound();
      }
    };

    const handleAuthStatus = (status: AuthStatus) => {
      setConnectionState((cs) => ({
        ...cs,
        isConnected: Boolean(status.isAuthorized),
        mode: status.isAuthorized ? 'DERIV_WEBSOCKET_LIVE' : 'DEMO_SIMULATED',
        isAuthorized: status.isAuthorized,
        isConnecting: false,
        loginid: status.loginid || cs.loginid,
        email: status.email || cs.email,
        balanceUsd: status.balance !== undefined ? status.balance : cs.balanceUsd,
        currency: status.currency || cs.currency || 'USD',
        accountType: status.isVirtual ? 'DEMO' : status.isVirtual === false ? 'REAL' : cs.accountType,
        scopes: status.scopes || cs.scopes,
        activeEndpoint: status.activeEndpoint || cs.activeEndpoint,
        authError: status.error || null,
      }));
    };

    derivWS.subscribeContracts(handleContractUpdate);
    derivWS.subscribeAuth(handleAuthStatus);

    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'DERIV_OAUTH_SUCCESS') return;
      const { accounts, token, appId } = event.data;
      if (Array.isArray(accounts) && accounts.length) {
        saveStoredAccounts(accounts);
        setAvailableAccounts(accounts);
      }
      if (token) connectWithToken(appId || REGISTERED_DERIV_APP_ID, token);
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      derivWS.unsubscribeContracts(handleContractUpdate);
      derivWS.unsubscribeAuth(handleAuthStatus);
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setConnectionState((cs) => ({
        ...cs,
        isConnected: derivWS.getIsLiveWs(),
        mode: derivWS.getIsLiveWs() ? 'DERIV_WEBSOCKET_LIVE' : 'DEMO_SIMULATED',
      }));
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSelectAccount = (account: DerivOAuthAccount) => {
    if (account?.token) connectWithToken(connectionState.appId || REGISTERED_DERIV_APP_ID, account.token);
  };

  const handleUpdateConnection = (appId: string, token: string) => {
    connectWithToken(appId || REGISTERED_DERIV_APP_ID, token);
  };

  const handleOAuthRedirect = () => {
    const oauthState = 'state_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('deriv_oauth_state', oauthState);
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(REGISTERED_DERIV_APP_ID)}&l=EN&scope=trade&redirect_uri=${encodeURIComponent(STING_REDIRECT_URI)}&state=${encodeURIComponent(oauthState)}`;
    window.location.href = oauthUrl;
  };

  const handleResetDemoBalance = () => {
    setConnectionState((prev) => ({ ...prev, balanceUsd: 10000, accountType: 'DEMO' }));
  };

  const handleUpdateBalance = (newBalance: number) => {
    if (!connectionState.isAuthorized) setConnectionState((prev) => ({ ...prev, balanceUsd: Number(newBalance.toFixed(2)) }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <HeaderBar
        connectionState={connectionState}
        onUpdateConnection={handleUpdateConnection}
        onOAuthRedirect={handleOAuthRedirect}
        onResetDemoBalance={handleResetDemoBalance}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableAccounts={availableAccounts}
        onSelectAccount={handleSelectAccount}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'terminal' && <TradingTerminal markets={markets} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} balanceUsd={connectionState.balanceUsd} onUpdateBalance={handleUpdateBalance} activeContracts={activeContracts} />}
        {activeTab === 'dbot' && <DBotStudio markets={markets} balanceUsd={connectionState.balanceUsd} onUpdateBalance={handleUpdateBalance} activeBotOverride={autoConfiguredBot} />}
        {activeTab === 'botstore' && <BotStore markets={markets} onImportBotToStudio={(bot) => { setAutoConfiguredBot(bot); setActiveTab('dbot'); }} />}
        {activeTab === 'scanner' && <MarketScanner markets={markets} onAutoConfigureBot={(strategy) => { setAutoConfiguredBot(strategy); setActiveTab('dbot'); }} />}
        {activeTab === 'copy' && <CopyTradingHub balanceUsd={connectionState.balanceUsd} />}
        {activeTab === 'analyzer' && <MarketAnalyzer markets={markets} onSelectMarket={(sym) => { setSelectedSymbol(sym); setActiveTab('terminal'); }} />}
        {activeTab === 'copilot' && <AICopilotPanel markets={markets} selectedSymbol={selectedSymbol} balanceUsd={connectionState.balanceUsd} />}
        {activeTab === 'tools' && <RiskAndTools />}
      </main>
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div>Deriv Ecosystem Third-Party Hub • Real-time Synthetics, DBot & Copy Trading</div>
          <div className="text-[11px] text-slate-600">Powered by Deriv Open API</div>
        </div>
      </footer>
    </div>
  );
}