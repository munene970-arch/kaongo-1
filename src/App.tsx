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
import {
  DerivOAuthAccount,
  parseDerivOAuthInput,
  getStoredAccounts,
  saveStoredAccounts,
} from './utils/derivOAuth';
import { REGISTERED_DERIV_APP_ID, STING_REDIRECT_URI } from './config/deriv';

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>('terminal');

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const hashVal = tab === 'terminal' ? 'dashboard' : tab;
    if (window.location.hash !== `#${hashVal}`) {
      window.history.replaceState(null, '', `#${hashVal}`);
    }
  };

  // Sync tab from URL hash on mount & on hash change
  useEffect(() => {
    const syncTabFromHash = () => {
      const rawHash = window.location.hash.replace('#', '').toLowerCase();
      if (!rawHash) return;
      if (rawHash === 'dashboard' || rawHash === 'terminal' || rawHash === 'trade') {
        setActiveTabState('terminal');
      } else if (['dbot', 'botstore', 'scanner', 'copy', 'analyzer', 'copilot', 'tools'].includes(rawHash)) {
        setActiveTabState(rawHash);
      }
    };

    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);
  const [markets, setMarkets] = useState<MarketInfo[]>(INITIAL_MARKETS);
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>('R_75');
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [autoConfiguredBot, setAutoConfiguredBot] = useState<DBotStrategy | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<DerivOAuthAccount[]>(getStoredAccounts());
  const [pastedUrlInput, setPastedUrlInput] = useState('');
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: true,
    mode: 'DEMO_SIMULATED',
    appId: REGISTERED_DERIV_APP_ID,
    accountType: 'DEMO',
    balanceUsd: 10000.00,
    currency: 'USD',
  });

  const connectWithParsedAccounts = (accounts: DerivOAuthAccount[]) => {
    if (!accounts || accounts.length === 0) return;
    saveStoredAccounts(accounts);
    setAvailableAccounts(accounts);

    const targetAcc = accounts.find((a) => a.type === 'REAL') || accounts[0];
    if (targetAcc && targetAcc.token) {
      localStorage.setItem('deriv_token', targetAcc.token);
      setConnectionState((prev) => ({
        ...prev,
        token: targetAcc.token,
        isConnecting: true,
        authError: null,
        isAuthorized: false,
      }));
      derivWS.connect(connectionState.appId || REGISTERED_DERIV_APP_ID, targetAcc.token);
    }
  };

  // Clipboard Auto-Detection on window focus
  useEffect(() => {
    const handleWindowFocus = async () => {
      if (connectionState.isAuthorized) return;
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && (text.includes('token1=') || text.includes('acct1='))) {
            const parsed = parseDerivOAuthInput(text);
            if (parsed.length > 0) {
              connectWithParsedAccounts(parsed);
            }
          }
        }
      } catch (e) {
        // Clipboard access might be denied, safe to ignore
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [connectionState.isAuthorized]);

  // Connect Deriv WebSocket Service on Mount & Handle OAuth2 Callbacks
  useEffect(() => {
    // Track settled contract IDs to ensure sound plays exactly once per settlement
    const settledContractsSet = new Set<string>();

    const processOAuthAndConnect = async () => {
      const activeAppId = REGISTERED_DERIV_APP_ID;

      // Extract URL query and hash parameters returned by Deriv OAuth and log full redirect query
      console.log('[Deriv OAuth Return Handler] Full Search Query:', window.location.search, 'Full Hash:', window.location.hash);
      const fullUrlStr = window.location.search + ' ' + window.location.hash;
      const urlParams = new URLSearchParams(window.location.search + window.location.hash.replace('#', '?'));
      
      const returnedState = urlParams.get('state');
      const savedState = sessionStorage.getItem('deriv_oauth_state');
      if (returnedState && savedState && returnedState !== savedState) {
        console.warn('[Deriv OAuth] State mismatch detected:', { returnedState, savedState });
      } else if (returnedState && savedState && returnedState === savedState) {
        console.log('[Deriv OAuth] State verified successfully:', returnedState);
      }
      if (returnedState) {
        sessionStorage.removeItem('deriv_oauth_state');
      }

      const parsedAccounts = parseDerivOAuthInput(fullUrlStr);

      let activeToken = sessionStorage.getItem('deriv_token') || localStorage.getItem('deriv_token') || '';

      if (parsedAccounts.length > 0) {
        // Capture token server-side via /api/auth/capture-token
        try {
          console.log('[Deriv OAuth] Capturing token server-side via /api/auth/capture-token...');
          const serverRes = await fetch('/api/auth/capture-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accounts: parsedAccounts,
              rawUrl: window.location.href,
              state: returnedState,
              appId: activeAppId,
            }),
          });

          const serverData = await serverRes.json();
          if (serverData.success && serverData.capturedToken) {
            console.log('[Deriv OAuth] Token captured and verified server-side.');
            activeToken = serverData.capturedToken;
            if (Array.isArray(serverData.accounts) && serverData.accounts.length > 0) {
              saveStoredAccounts(serverData.accounts);
              setAvailableAccounts(serverData.accounts);
            }
          } else {
            saveStoredAccounts(parsedAccounts);
            setAvailableAccounts(parsedAccounts);
            const primaryAcc = parsedAccounts.find((a) => a.type === 'REAL') || parsedAccounts[0];
            if (primaryAcc && primaryAcc.token) activeToken = primaryAcc.token;
          }
        } catch (serverErr) {
          console.warn('[Deriv OAuth] Server capture endpoint fallback to client-parsed accounts:', serverErr);
          saveStoredAccounts(parsedAccounts);
          setAvailableAccounts(parsedAccounts);
          const primaryAcc = parsedAccounts.find((a) => a.type === 'REAL') || parsedAccounts[0];
          if (primaryAcc && primaryAcc.token) activeToken = primaryAcc.token;
        }

        if (activeToken) {
          sessionStorage.setItem('deriv_token', activeToken);
          localStorage.removeItem('deriv_token');
        }

        // Notify parent window if opened as popup
        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              {
                type: 'DERIV_OAUTH_SUCCESS',
                accounts: parsedAccounts,
                token: activeToken,
                appId: activeAppId,
              },
              '*'
            );
            window.close();
            return;
          } catch (e) {
            console.warn('[Deriv OAuth] Failed to postMessage to window opener:', e);
          }
        }

        // Clean URL parameters from browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Restore stored accounts if available
        const saved = getStoredAccounts();
        if (saved.length > 0) {
          setAvailableAccounts(saved);
        }
      }

      setConnectionState((prev) => ({
        ...prev,
        appId: activeAppId,
        token: activeToken,
        isConnecting: Boolean(activeToken),
      }));

      // Open WSS connection and call authorize with captured token
      derivWS.connect(activeAppId, activeToken);
    };

    processOAuthAndConnect();

    // Subscribe to contract state updates
    const handleContractUpdate = (updatedContract: ActiveContract) => {
      setActiveContracts((prev) => {
        const idx = prev.findIndex((c) => c.id === updatedContract.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...updatedContract };
          return clone;
        } else {
          return [{ ...updatedContract }, ...prev.slice(0, 25)];
        }
      });

      // Update balance & trigger settlement audio chime
      if (updatedContract.status === 'WON' || updatedContract.status === 'LOST') {
        if (!settledContractsSet.has(updatedContract.id)) {
          settledContractsSet.add(updatedContract.id);

          if (updatedContract.isWin || updatedContract.status === 'WON') {
            soundManager.playWinSound();
          } else {
            soundManager.playLossSound();
          }
        }

        if (updatedContract.isWin) {
          setConnectionState((cs) => ({
            ...cs,
            balanceUsd: parseFloat((cs.balanceUsd + updatedContract.potentialPayout).toFixed(2)),
          }));
        }
      }
    };

    // Subscribe to WebSocket Authorization Status
    const handleAuthStatus = (status: AuthStatus) => {
      setConnectionState((cs) => {
        if (status.isAuthorized) {
          return {
            ...cs,
            isAuthorized: true,
            loginid: status.loginid || cs.loginid,
            email: status.email || cs.email,
            balanceUsd: status.balance !== undefined ? status.balance : cs.balanceUsd,
            currency: status.currency || cs.currency || 'USD',
            accountType: status.isVirtual !== undefined ? (status.isVirtual ? 'DEMO' : 'REAL') : cs.accountType,
            authError: null,
            isConnecting: false,
          };
        } else {
          return {
            ...cs,
            isAuthorized: false,
            authError: status.error || 'Authorization failed. Please check your API token.',
            isConnecting: false,
          };
        }
      });
    };

    derivWS.subscribeContracts(handleContractUpdate);
    derivWS.subscribeAuth(handleAuthStatus);

    // Listen for OAuth completion message from popup window
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'DERIV_OAUTH_SUCCESS') {
        const { accounts, token, appId } = event.data;
        const cleanAppId = appId ? String(appId).trim() : REGISTERED_DERIV_APP_ID;
        const cleanToken = token ? String(token).trim() : '';

        if (Array.isArray(accounts) && accounts.length > 0) {
          saveStoredAccounts(accounts);
          setAvailableAccounts(accounts);
        }

        if (cleanToken) {
          localStorage.setItem('deriv_token', cleanToken);
          localStorage.setItem('deriv_app_id', cleanAppId);

          setConnectionState((prev) => ({
            ...prev,
            appId: cleanAppId,
            token: cleanToken,
            isConnecting: true,
            authError: null,
            isAuthorized: false,
          }));

          derivWS.connect(cleanAppId, cleanToken);
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);

    return () => {
      derivWS.unsubscribeContracts(handleContractUpdate);
      derivWS.unsubscribeAuth(handleAuthStatus);
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  // Sync WS mode indicator
  useEffect(() => {
    const interval = setInterval(() => {
      const isLive = derivWS.getIsLiveWs();
      setConnectionState((cs) => ({
        ...cs,
        mode: isLive ? 'DERIV_WEBSOCKET_LIVE' : 'DEMO_SIMULATED',
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectAccount = (selectedAccount: DerivOAuthAccount) => {
    if (!selectedAccount || !selectedAccount.token) return;

    const targetAppId = connectionState.appId || REGISTERED_DERIV_APP_ID;
    sessionStorage.setItem('deriv_token', selectedAccount.token);

    setConnectionState((prev) => ({
      ...prev,
      token: selectedAccount.token,
      isConnecting: true,
      authError: null,
      isAuthorized: false,
    }));

    derivWS.connect(targetAppId, selectedAccount.token);
  };

  const handleUpdateConnection = (appId: string, token: string) => {
    const cleanAppId = appId && appId.trim() ? appId.trim() : (connectionState.appId || REGISTERED_DERIV_APP_ID);
    const cleanToken = derivWS.sanitizeToken(token) || '';

    if (cleanToken) {
      sessionStorage.setItem('deriv_token', cleanToken);
      localStorage.setItem('deriv_app_id', cleanAppId);
      localStorage.removeItem('deriv_token');
    } else {
      sessionStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_token');
    }

    setConnectionState((prev) => ({
      ...prev,
      appId: cleanAppId,
      token: cleanToken,
      isConnecting: Boolean(cleanToken),
      authError: null,
      isAuthorized: false,
    }));

    derivWS.connect(cleanAppId, cleanToken);
  };

  const handleOAuthRedirect = () => {
    const cleanAppId = REGISTERED_DERIV_APP_ID;

    // Exact Redirect URL matching Sting app in Deriv dashboard: https://mboko-mboko1.vercel.app
    const targetRedirectUri = STING_REDIRECT_URI;

    // Generate unique state and save to sessionStorage for return verification
    const oauthState = 'state_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('deriv_oauth_state', oauthState);

    // Scopes: request 'trade' scope (omit 'read' per modern Deriv API permissions)
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(cleanAppId)}&l=EN&scope=trade&redirect_uri=${encodeURIComponent(targetRedirectUri)}&state=${encodeURIComponent(oauthState)}`;

    console.log('[Deriv OAuth Request] Navigating to OAuth URL:', oauthUrl, 'with redirect_uri:', targetRedirectUri);

    const isIframe = window.self !== window.top;

    if (isIframe) {
      window.open(oauthUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.href = oauthUrl;
  };

  const handleResetDemoBalance = () => {
    setConnectionState((prev) => ({
      ...prev,
      balanceUsd: 10000.00,
    }));
    alert('Demo balance successfully reset to $10,000.00 USD');
  };

  const handleUpdateBalance = (newBalance: number) => {
    setConnectionState((prev) => ({
      ...prev,
      balanceUsd: parseFloat(newBalance.toFixed(2)),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      
      {/* Top Header & Navigation Bar */}
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'terminal' && (
          <TradingTerminal
            markets={markets}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            balanceUsd={connectionState.balanceUsd}
            onUpdateBalance={handleUpdateBalance}
            activeContracts={activeContracts}
          />
        )}

        {activeTab === 'dbot' && (
          <DBotStudio
            markets={markets}
            balanceUsd={connectionState.balanceUsd}
            onUpdateBalance={handleUpdateBalance}
            activeBotOverride={autoConfiguredBot}
          />
        )}

        {activeTab === 'botstore' && (
          <BotStore
            markets={markets}
            onImportBotToStudio={(bot) => {
              setAutoConfiguredBot(bot);
              setActiveTab('dbot');
            }}
          />
        )}

        {activeTab === 'scanner' && (
          <MarketScanner
            markets={markets}
            onAutoConfigureBot={(strategy) => {
              setAutoConfiguredBot(strategy);
              setActiveTab('dbot');
            }}
          />
        )}

        {activeTab === 'copy' && (
          <CopyTradingHub balanceUsd={connectionState.balanceUsd} />
        )}

        {activeTab === 'analyzer' && (
          <MarketAnalyzer
            markets={markets}
            onSelectMarket={(sym) => {
              setSelectedSymbol(sym);
              setActiveTab('terminal');
            }}
          />
        )}

        {activeTab === 'copilot' && (
          <AICopilotPanel
            markets={markets}
            selectedSymbol={selectedSymbol}
            balanceUsd={connectionState.balanceUsd}
          />
        )}

        {activeTab === 'tools' && <RiskAndTools />}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <div>
            Deriv Ecosystem Third-Party Hub • Real-time Synthetics, DBot & Copy Trading
          </div>
          <div className="text-[11px] text-slate-600">
            Powered by Deriv Open API & Gemini 3.6 Flash
          </div>
        </div>
      </footer>
    </div>
  );
}
