import React, { useState, useEffect } from 'react';
import { MarketSymbol, MarketInfo, ActiveContract, ConnectionState, DBotStrategy } from './types/deriv';
import { INITIAL_MARKETS } from './services/derivMarketsData';
import { derivWS, AuthStatus } from './services/derivWebSocket';
import { soundManager } from './utils/soundEffects';
import { HeaderBar } from './components/HeaderBar';
import { TradingTerminal } from './components/Terminal/TradingTerminal';
import { DoubleRepeatBot } from './components/Terminal/DoubleRepeatBot';
import { DBotStudio } from './components/BotStudio/DBotStudio';
import { BotStore } from './components/BotStudio/BotStore';
import { MarketScanner } from './components/Analyzer/MarketScanner';
import { CopyTradingHub } from './components/CopyTrading/CopyTradingHub';
import { MarketAnalyzer } from './components/Analyzer/MarketAnalyzer';
import { AICopilotPanel } from './components/Copilot/AICopilotPanel';
import { RiskAndTools } from './components/AccountTools/RiskAndTools';
import { DerivOAuthAccount, parseDerivOAuthInput, getStoredAccounts, saveStoredAccounts } from './utils/derivOAuth';
import { REGISTERED_DERIV_APP_ID, STING_REDIRECT_URI, DERIV_OAUTH_SCOPE } from './config/deriv';

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>('terminal');
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const hashVal = tab === 'terminal' ? 'dashboard' : tab;
    if (window.location.hash !== `#${hashVal}`) window.history.replaceState(null, '', `#${hashVal}`);
  };
  useEffect(() => {
    const sync = () => { const h = window.location.hash.replace('#', '').toLowerCase(); if (!h) return; if (['dashboard','terminal','trade'].includes(h)) setActiveTabState('terminal'); else if (['dbot','botstore','scanner','copy','analyzer','copilot','tools'].includes(h)) setActiveTabState(h); };
    sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);

  const [markets] = useState<MarketInfo[]>(INITIAL_MARKETS);
  const [derivNickname, setDerivNickname] = useState<string>('');
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>('R_75');
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [autoConfiguredBot, setAutoConfiguredBot] = useState<DBotStrategy | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<DerivOAuthAccount[]>(getStoredAccounts());
  const [connectionState, setConnectionState] = useState<ConnectionState>({ isConnected:false, mode:'DEMO_SIMULATED', appId:REGISTERED_DERIV_APP_ID, accountType:'DEMO', balanceUsd:0, currency:'USD', isAuthorized:false, isConnecting:false, authError:null });

  const connectWithToken = (appId: string, token: string) => {
    const cleanToken = derivWS.sanitizeToken(token);
    const cleanAppId = appId?.trim() || REGISTERED_DERIV_APP_ID;
    if (!cleanToken) { setConnectionState(p => ({...p,isConnecting:false,isAuthorized:false,authError:'Enter a valid Deriv API token.'})); return; }
    sessionStorage.setItem('deriv_token', cleanToken); localStorage.setItem('deriv_token', cleanToken); localStorage.setItem('deriv_app_id', cleanAppId);
    setConnectionState(p => ({...p,appId:cleanAppId,token:cleanToken,isConnecting:true,isAuthorized:false,authError:null}));
    derivWS.connect(cleanAppId, cleanToken);
  };
  const connectWithParsedAccounts = (accounts: DerivOAuthAccount[]) => { if (!accounts?.length) return; saveStoredAccounts(accounts); setAvailableAccounts(accounts); const a=accounts.find(x=>x.type==='REAL')||accounts[0]; if(a?.token) connectWithToken(REGISTERED_DERIV_APP_ID,a.token); };

  useEffect(() => {
    const settled = new Set<string>();
    const contractListener=(c:ActiveContract)=>{ setActiveContracts(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]={...c};return n;}return [{...c},...p].slice(0,26);}); if(['WON','LOST','SOLD'].includes(c.status)&&!settled.has(c.id)){settled.add(c.id);if(c.isWin||c.status==='WON')soundManager.playWinSound();else soundManager.playLossSound();} };
    const authListener=(s:AuthStatus)=>{
  setConnectionState(cs=>({...cs,isConnected:Boolean(s.isAuthorized),mode:s.isAuthorized?'DERIV_WEBSOCKET_LIVE':'DEMO_SIMULATED',isAuthorized:s.isAuthorized,isConnecting:false,loginid:s.loginid||cs.loginid,email:s.email||cs.email,balanceUsd:s.balance!==undefined?s.balance:cs.balanceUsd,currency:s.currency||cs.currency||'USD',accountType:s.isVirtual?'DEMO':s.isVirtual===false?'REAL':cs.accountType,scopes:s.scopes||cs.scopes,activeEndpoint:s.activeEndpoint||cs.activeEndpoint,authError:s.error||null}));

  if (s.isAuthorized) {
    fetch('/.netlify/functions/account-nickname', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.text();

        if (!response.ok) {
          throw new Error(body || `Nickname request failed (${response.status})`);
        }

        try {
          return JSON.parse(body);
        } catch {
          return { nickname: body };
        }
      })
      .then((data) => {
        const nickname =
          typeof data?.nickname === 'string'
            ? data.nickname.trim()
            : '';

        if (nickname) {
          setDerivNickname(nickname);
        }
      })
      .catch((error) => {
        console.warn(
          '[Deriv nickname] Request failed; trading connection remains unaffected.',
          error
        );
        setDerivNickname('');
      });
  } else {
    setDerivNickname('');
  }
};
    derivWS.subscribeContracts(contractListener); derivWS.subscribeAuth(authListener);

    const oauthMessage=(e:MessageEvent)=>{if(e.data?.type!=='DERIV_OAUTH_SUCCESS')return;const {accounts,token,appId}=e.data;if(Array.isArray(accounts)&&accounts.length){saveStoredAccounts(accounts);setAvailableAccounts(accounts);}if(token)connectWithToken(appId||REGISTERED_DERIV_APP_ID,token);};
    window.addEventListener('message',oauthMessage);

    const processAuth=async()=>{
      const search=window.location.search||''; const hash=window.location.hash||''; const full=`${search} ${hash}`; const params=new URLSearchParams(search);
      const returnedState=params.get('state'); const savedState=sessionStorage.getItem('deriv_oauth_state'); if(returnedState&&savedState&&returnedState!==savedState)console.warn('[Deriv OAuth] State mismatch'); if(returnedState)sessionStorage.removeItem('deriv_oauth_state');
      const parsed=parseDerivOAuthInput(full); let token=sessionStorage.getItem('deriv_token')||localStorage.getItem('deriv_token')||'';
      if(parsed.length){saveStoredAccounts(parsed);setAvailableAccounts(parsed);token=(parsed.find(a=>a.type==='REAL')||parsed[0])?.token||token;}
      setConnectionState(p=>({...p,appId:REGISTERED_DERIV_APP_ID,token,isConnecting:Boolean(token)}));
      if(token)derivWS.connect(REGISTERED_DERIV_APP_ID,token);
      if(parsed.length||returnedState)window.history.replaceState({},document.title,window.location.pathname);
    };
    processAuth();
    return()=>{derivWS.unsubscribeContracts(contractListener);derivWS.unsubscribeAuth(authListener);window.removeEventListener('message',oauthMessage);};
  }, []);

  useEffect(()=>{const i=window.setInterval(()=>setConnectionState(cs=>({...cs,isConnected:derivWS.getIsLiveWs(),mode:derivWS.getIsLiveWs()?'DERIV_WEBSOCKET_LIVE':'DEMO_SIMULATED'})),2000);return()=>window.clearInterval(i);},[]);
  const handleSelectAccount=(a:DerivOAuthAccount)=>{if(a?.token)connectWithToken(connectionState.appId||REGISTERED_DERIV_APP_ID,a.token);};
  const handleOAuthRedirect=()=>{const state='state_'+Math.random().toString(36).slice(2,11)+'_'+Date.now().toString(36);sessionStorage.setItem('deriv_oauth_state',state);const url=`https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(REGISTERED_DERIV_APP_ID)}&l=EN&scope=${encodeURIComponent(DERIV_OAUTH_SCOPE)}&redirect_uri=${encodeURIComponent(STING_REDIRECT_URI)}&state=${encodeURIComponent(state)}`;window.location.assign(url);};
  const handleResetDemoBalance=()=>setConnectionState(p=>({...p,balanceUsd:10000,accountType:'DEMO'}));
  const handleUpdateBalance=(n:number)=>{if(!connectionState.isAuthorized)setConnectionState(p=>({...p,balanceUsd:Number(n.toFixed(2))}));};

  return <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-red-600 selection:text-white"><HeaderBar connectionState={connectionState} onUpdateConnection={(id,t)=>connectWithToken(id||REGISTERED_DERIV_APP_ID,t)} onOAuthRedirect={handleOAuthRedirect} onResetDemoBalance={handleResetDemoBalance} activeTab={activeTab} setActiveTab={setActiveTab} availableAccounts={availableAccounts} onSelectAccount={handleSelectAccount}/><main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">{activeTab==='terminal'&&<><DoubleRepeatBot symbol={selectedSymbol} balance={connectionState.balanceUsd}/><TradingTerminal markets={markets} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} balanceUsd={connectionState.balanceUsd} onUpdateBalance={handleUpdateBalance} activeContracts={activeContracts}/></>}{activeTab==='dbot'&&<DBotStudio markets={markets} balanceUsd={connectionState.balanceUsd} onUpdateBalance={handleUpdateBalance} activeBotOverride={autoConfiguredBot}/>} {activeTab==='botstore'&&<BotStore markets={markets} onImportBotToStudio={b=>{setAutoConfiguredBot(b);setActiveTab('dbot');}}/>}{activeTab==='scanner'&&<MarketScanner markets={markets} onAutoConfigureBot={b=>{setAutoConfiguredBot(b);setActiveTab('dbot');}}/>}{activeTab==='copy'&&<CopyTradingHub balanceUsd={connectionState.balanceUsd}/>} {activeTab==='analyzer'&&<MarketAnalyzer markets={markets} onSelectMarket={s=>{setSelectedSymbol(s);setActiveTab('terminal');}}/>}{activeTab==='copilot'&&<AICopilotPanel markets={markets} selectedSymbol={selectedSymbol} balanceUsd={connectionState.balanceUsd}/>} {activeTab==='tools'&&<RiskAndTools/>}</main><footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500"><div>Deriv Ecosystem Third-Party Hub • Real-time Synthetics, DBot & Copy Trading</div></footer></div>;
}
