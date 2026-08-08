import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { REGISTERED_DERIV_APP_ID } from '../config/deriv';

export type TickListener = (tick: Tick) => void;
export type ContractListener = (contract: ActiveContract) => void;

export interface AuthStatus {
  isAuthorized: boolean;
  loginid?: string;
  email?: string;
  balance?: number;
  currency?: string;
  isVirtual?: boolean;
  scopes?: string[];
  error?: string | null;
  appId?: string;
  activeEndpoint?: string;
  pingMs?: number;
}

export type AuthListener = (status: AuthStatus) => void;

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private appId: string = REGISTERED_DERIV_APP_ID;
  private token: string | null = null;
  private isConnected: boolean = false;
  private isLiveWs: boolean = false;
  private pendingProposalBuys: Map<string, any> = new Map();
  private tickListeners: Map<MarketSymbol, Set<TickListener>> = new Map();
  private activeContracts: Map<string, ActiveContract> = new Map();
  private contractListeners: Set<ContractListener> = new Set();
  private authListeners: Set<AuthListener> = new Set();
  private activeSubscriptions: Set<MarketSymbol> = new Set();

  // Synthetic price state for simulated fallback ticks
  private currentPrices: Record<MarketSymbol, number> = {
    'R_10': 6812.20,
    'R_25': 24100.50,
    'R_50': 51200.80,
    'R_75': 845230.45,
    'R_100': 42109.80,
    '1HZ10V': 8910.20,
    '1HZ25V': 19840.10,
    '1HZ50V': 38210.40,
    '1HZ75V': 124580.12,
    '1HZ100V': 78400.30,
    '1HZ150V': 154200.00,
    '1HZ250V': 289500.00,
    'CRASH1000': 6210.30,
    'CRASH500': 4320.10,
    'CRASH300': 2850.20,
    'BOOM1000': 11450.60,
    'BOOM500': 9810.75,
    'BOOM300': 5410.30,
    'STEPINDEX': 8920.40,
    'JUMP10': 3410.50,
    'JUMP25': 6200.80,
    'JUMP50': 12400.10,
    'JUMP75': 28900.50,
    'JUMP100': 48500.00,
    'RDBEAR': 3210.40,
    'RDBULL': 14890.20,
  };

  private simIntervals: Map<MarketSymbol, number> = new Map();
  private activeContractsInterval: number | null = null;

  // Symbol mappings for Deriv WS API variants (e.g. R_75 <-> 1HZ75V)
  private symbolFallbackMap: Record<string, string> = {
    'R_10': '1HZ10V',
    '1HZ10V': 'R_10',
    'R_25': '1HZ25V',
    '1HZ25V': 'R_25',
    'R_50': '1HZ50V',
    '1HZ50V': 'R_50',
    'R_75': '1HZ75V',
    '1HZ75V': 'R_75',
    'R_100': '1HZ100V',
    '1HZ100V': 'R_100',
  };

  private realToRequestedSym: Map<string, MarketSymbol> = new Map();
  private failedLiveSymbols: Set<string> = new Set();

  constructor() {
    this.startContractTicker();
  }

  public subscribeAuth(callback: AuthListener) {
    this.authListeners.add(callback);
  }

  public unsubscribeAuth(callback: AuthListener) {
    this.authListeners.delete(callback);
  }

  private notifyAuthListeners(status: AuthStatus) {
    this.authListeners.forEach((cb) => cb(status));
  }

  private endpoints = [
    'wss://ws.derivws.com/websockets/v3?app_id=',
    'wss://ws.binaryws.com/websockets/v3?app_id=',
    'wss://ws.derivapp.com/websockets/v3?app_id=',
    'wss://blue.derivws.com/websockets/v3?app_id=',
    'wss://red.derivws.com/websockets/v3?app_id=',
  ];

  private activeEndpointUrl: string = 'wss://ws.derivws.com/websockets/v3';

  public getActiveEndpoint(): string {
    return this.activeEndpointUrl;
  }

  public sanitizeToken(rawToken?: string | null): string | null {
    if (!rawToken) return null;
    let clean = rawToken.trim();
    // Strip "Bearer " or "Bearer" prefix case-insensitively
    clean = clean.replace(/^bearer\s+/i, '');
    // Strip single quotes, double quotes, spaces, tabs, newlines, carriage returns
    clean = clean.replace(/['"\r\n\t\s]/g, '');
    return clean || null;
  }

  public connect(appId: string = REGISTERED_DERIV_APP_ID, rawToken?: string) {
    this.appId = appId && appId.trim() ? appId.trim() : REGISTERED_DERIV_APP_ID;
    this.token = this.sanitizeToken(rawToken);

    this.attemptEndpointConnect(0);
  }

  private hasTriedAppIdFallback = false;

  private attemptEndpointConnect(index: number) {
    if (index >= this.endpoints.length) {
      console.warn('[Deriv WS] All WebSocket endpoints exhausted or failed.');

      // If a custom App ID failed on all endpoints, fallback to standard official Deriv App ID
      if (this.appId !== REGISTERED_DERIV_APP_ID && !this.hasTriedAppIdFallback) {
        console.warn(`[Deriv WS] Custom App ID '${this.appId}' connection failed. Falling back to default App ID '${REGISTERED_DERIV_APP_ID}'...`);
        this.hasTriedAppIdFallback = true;
        this.appId = REGISTERED_DERIV_APP_ID;
        this.attemptEndpointConnect(0);
        return;
      }

      if (this.token) {
        this.notifyAuthListeners({
          isAuthorized: false,
          error: `Unable to connect to Deriv servers using App ID '${this.appId}'. Verify your App ID on api.deriv.com or check your internet connection.`,
          appId: this.appId,
        });
      }
      this.isLiveWs = false;
      this.startSimulatedTicksForAll();
      return;
    }

    const endpointBase = this.endpoints[index];
    this.activeEndpointUrl = endpointBase.split('?')[0];
    const wsUrl = `${endpointBase}${encodeURIComponent(this.appId)}`;
    console.log(`[Deriv WS] Connecting to (${index + 1}/${this.endpoints.length}): ${wsUrl}`);

    try {
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        try {
          this.ws.close();
        } catch (e) {}
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[Deriv WS] Connected successfully to ${wsUrl}`);
        this.isConnected = true;
        this.isLiveWs = true;

        if (this.token) {
          console.log(`[Deriv WS] Authorizing with token on Deriv-App-ID '${this.appId}'...`);
          this.ws?.send(JSON.stringify({ authorize: this.token }));
        }

        // Re-subscribe active markets
        this.activeSubscriptions.forEach((sym) => {
          this.subscribeRealTicks(sym);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWsMessage(data);
        } catch (e) {
          console.error('[Deriv WS] Message parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[Deriv WS] Connection error on ${wsUrl}, trying fallback endpoint...`, err);
        if (!this.isConnected) {
          this.attemptEndpointConnect(index + 1);
        }
      };

      this.ws.onclose = () => {
        console.log('[Deriv WS] Connection closed.');
        this.isConnected = false;
        this.isLiveWs = false;
        this.startSimulatedTicksForAll();
      };
    } catch (e) {
      console.warn(`[Deriv WS] Failed to initialize ${wsUrl}, trying next...`, e);
      this.attemptEndpointConnect(index + 1);
    }
  }

  public getIsLiveWs(): boolean {
    return this.isLiveWs;
  }

  private cachedEmail: string | undefined = undefined;
  private cachedLoginId: string | undefined = undefined;
  private cachedCurrency: string = 'USD';
  private cachedIsVirtual: boolean = false;

  private handleWsMessage(data: any) {
    if (data.msg_type === 'authorize') {
      if (data.error) {
        console.warn('[Deriv WS] Authorize error:', data.error);
        
        // If authorization fails on a custom App ID, attempt fallback to default REGISTERED_DERIV_APP_ID (340mh9Kwzb9IINrqS379p)
        if (this.appId !== REGISTERED_DERIV_APP_ID && !this.hasTriedAppIdFallback) {
          console.warn(`[Deriv WS] Authorization failed on custom App ID '${this.appId}' (${data.error.code}: ${data.error.message}). Retrying with Sting App ID '${REGISTERED_DERIV_APP_ID}'...`);
          this.hasTriedAppIdFallback = true;
          this.connect(REGISTERED_DERIV_APP_ID, this.token || undefined);
          return;
        }

        this.notifyAuthListeners({
          isAuthorized: false,
          error: data.error.message || 'Authorization failed. Please check your API token.',
          appId: this.appId,
        });
      } else if (data.authorize) {
        console.log('[Deriv WS] Authorized successfully:', data.authorize.loginid);
        const authData = data.authorize;
        const rawScopes = authData.scopes;
        const scopesArray: string[] = Array.isArray(rawScopes) 
          ? rawScopes 
          : (rawScopes && typeof rawScopes === 'object' ? Object.keys(rawScopes) : ['read', 'trade']);

        if (authData.email) {
          this.cachedEmail = authData.email;
        }
        if (authData.loginid) {
          this.cachedLoginId = authData.loginid;
        }
        if (authData.currency) {
          this.cachedCurrency = authData.currency;
        }
        this.cachedIsVirtual = Boolean(authData.is_virtual);

        this.notifyAuthListeners({
          isAuthorized: true,
          loginid: authData.loginid,
          email: this.cachedEmail,
          balance: typeof authData.balance === 'number' ? authData.balance : parseFloat(authData.balance) || 0,
          currency: authData.currency || 'USD',
          isVirtual: Boolean(authData.is_virtual),
          scopes: scopesArray,
          appId: this.appId,
          activeEndpoint: this.activeEndpointUrl,
          error: null,
        });

        // Request user profile & account settings to auto-detect email if not in authorize payload
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ get_settings: 1 }));
        }

        // Request real-time balance subscription from Deriv
        this.ws?.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }
    } else if (data.msg_type === 'get_settings' || data.get_settings) {
      if (data.get_settings && data.get_settings.email) {
        const detectedEmail = data.get_settings.email;
        console.log('[Deriv WS] Auto-detected account email via get_settings:', detectedEmail);
        this.cachedEmail = detectedEmail;
        this.notifyAuthListeners({
          isAuthorized: true,
          loginid: this.cachedLoginId,
          email: detectedEmail,
          currency: this.cachedCurrency,
          isVirtual: this.cachedIsVirtual,
          appId: this.appId,
          activeEndpoint: this.activeEndpointUrl,
          error: null,
        });
      }
    } else if (data.msg_type === 'balance') {
      if (data.balance) {
        const liveBal = typeof data.balance.balance === 'number' 
          ? data.balance.balance 
          : parseFloat(data.balance.balance) || 0;
        console.log(`[Deriv WS] Live balance update received: $${liveBal}`);
        this.notifyAuthListeners({
          isAuthorized: true,
          loginid: data.balance.loginid || this.cachedLoginId,
          email: this.cachedEmail,
          balance: liveBal,
          currency: data.balance.currency || this.cachedCurrency || 'USD',
          isVirtual: this.cachedIsVirtual,
          appId: this.appId,
          activeEndpoint: this.activeEndpointUrl,
          error: null,
        });
      }
    } else if (data.msg_type === 'proposal') {
      if (data.error) {
        console.warn('[Deriv WS] Proposal API Error:', data.error);
      } else if (data.proposal) {
        const propId = data.proposal.id;
        const passthroughId = data.echo_req?.passthrough?.client_contract_id;
        if (passthroughId && this.pendingProposalBuys.has(passthroughId)) {
          const reqStake = data.echo_req?.amount || 10;
          this.ws?.send(JSON.stringify({
            buy: propId,
            price: reqStake,
            passthrough: { client_contract_id: passthroughId }
          }));
          this.pendingProposalBuys.delete(passthroughId);
        }
      }
    } else if (data.msg_type === 'buy') {
      if (data.error) {
        console.warn('[Deriv WS] Buy API Error:', data.error);
      } else if (data.buy) {
        const liveContractId = data.buy.contract_id;
        this.ws?.send(JSON.stringify({
          proposal_open_contract: 1,
          contract_id: liveContractId,
          subscribe: 1
        }));
      }
    } else if (data.msg_type === 'proposal_open_contract') {
      if (data.proposal_open_contract) {
        this.handleProposalOpenContractUpdate(data.proposal_open_contract);
      }
    } else if (data.error) {
      console.warn('[Deriv WS] Received API Error:', data.error);
      if (data.echo_req && data.echo_req.authorize) {
        this.notifyAuthListeners({
          isAuthorized: false,
          error: data.error.message || 'Invalid API Token or App ID mismatch.',
          appId: this.appId,
        });
      }

      // Handle InvalidSymbol errors gracefully
      if (data.error.code === 'InvalidSymbol' || data.error.message?.includes('invalid')) {
        const failedSym = (data.echo_req?.ticks || data.echo_req?.forget) as MarketSymbol;
        if (failedSym) {
          console.warn(`[Deriv WS] Symbol '${failedSym}' not recognized by endpoint. Attempting fallback...`);
          this.failedLiveSymbols.add(failedSym);
          
          const altSym = this.symbolFallbackMap[failedSym];
          if (altSym && !this.failedLiveSymbols.has(altSym) && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`[Deriv WS] Trying alternative symbol '${altSym}' for '${failedSym}'`);
            this.realToRequestedSym.set(altSym, failedSym);
            this.ws.send(JSON.stringify({ ticks: altSym }));
          } else {
            console.log(`[Deriv WS] Starting simulated ticks fallback for '${failedSym}'`);
            this.ensureSimulatedTicks(failedSym);
          }
        }
      }
    }

    if (data.msg_type === 'tick' && data.tick) {
      const rawSym = data.tick.symbol;
      const sym = (this.realToRequestedSym.get(rawSym) || rawSym) as MarketSymbol;
      const quote = parseFloat(data.tick.quote);
      const epoch = data.tick.epoch;

      const prev = this.currentPrices[sym] || quote;
      this.currentPrices[sym] = quote;

      const tick: Tick = {
        epoch,
        quote,
        symbol: sym,
        change: quote - prev,
      };

      this.notifyTickListeners(sym, tick);
    }
  }

  public subscribeTicks(symbol: MarketSymbol, callback: TickListener) {
    if (!this.tickListeners.has(symbol)) {
      this.tickListeners.set(symbol, new Set());
    }
    this.tickListeners.get(symbol)!.add(callback);
    this.activeSubscriptions.add(symbol);

    if (this.isLiveWs && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.subscribeRealTicks(symbol);
    } else {
      this.ensureSimulatedTicks(symbol);
    }
  }

  public unsubscribeTicks(symbol: MarketSymbol, callback: TickListener) {
    if (this.tickListeners.has(symbol)) {
      this.tickListeners.get(symbol)!.delete(callback);
      if (this.tickListeners.get(symbol)!.size === 0) {
        this.tickSubscriptionsCleanup(symbol);
      }
    }
  }

  private tickSubscriptionsCleanup(symbol: MarketSymbol) {
    this.activeSubscriptions.delete(symbol);
    if (this.simIntervals.has(symbol)) {
      window.clearInterval(this.simIntervals.get(symbol)!);
      this.simIntervals.delete(symbol);
    }
    if (this.isLiveWs && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const realSym = Array.from(this.realToRequestedSym.entries()).find(([, req]) => req === symbol)?.[0] || symbol;
      this.ws.send(JSON.stringify({ forget: realSym }));
    }
  }

  private subscribeRealTicks(symbol: MarketSymbol) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.failedLiveSymbols.has(symbol)) {
        const altSym = this.symbolFallbackMap[symbol];
        if (altSym && !this.failedLiveSymbols.has(altSym)) {
          this.realToRequestedSym.set(altSym, symbol);
          this.ws.send(JSON.stringify({ ticks: altSym }));
          return;
        }
        this.ensureSimulatedTicks(symbol);
        return;
      }
      this.ws.send(JSON.stringify({ ticks: symbol }));
    }
  }

  private startSimulatedTicksForAll() {
    this.activeSubscriptions.forEach((sym) => {
      this.ensureSimulatedTicks(sym);
    });
  }

  private ensureSimulatedTicks(symbol: MarketSymbol) {
    if (this.simIntervals.has(symbol)) return;

    // Tick speed: 1s for 1HZ75V / StepIndex, 2s for Volatility 75 / 100, Crash/Boom
    const intervalMs = symbol.includes('1HZ') || symbol === 'STEPINDEX' ? 1000 : 1500;

    const intervalId = window.setInterval(() => {
      let current = this.currentPrices[symbol] || 10000;
      let change = 0;

      if (symbol.startsWith('CRASH')) {
        // Crash index: steady small rise, occasional sharp drop
        const isCrash = Math.random() < 0.08;
        if (isCrash) {
          change = -(Math.random() * 25 + 10);
        } else {
          change = Math.random() * 0.8 + 0.1;
        }
      } else if (symbol.startsWith('BOOM')) {
        // Boom index: steady small drop, occasional sharp spike up
        const isSpike = Math.random() < 0.08;
        if (isSpike) {
          change = Math.random() * 30 + 15;
        } else {
          change = -(Math.random() * 0.7 + 0.1);
        }
      } else if (symbol === 'STEPINDEX') {
        // Step index: moves by exactly +/- 0.1
        change = Math.random() > 0.5 ? 0.1 : -0.1;
      } else {
        // Volatility index random walk
        const volPercent = symbol === 'R_100' ? 0.0012 : symbol === 'R_75' ? 0.0008 : 0.0004;
        const delta = (Math.random() - 0.49) * (current * volPercent);
        change = parseFloat(delta.toFixed(symbol === 'R_75' ? 2 : 4));
      }

      current = parseFloat((current + change).toFixed(4));
      this.currentPrices[symbol] = current;

      const tick: Tick = {
        epoch: Math.floor(Date.now() / 1000),
        quote: current,
        symbol,
        change,
      };

      this.notifyTickListeners(symbol, tick);
    }, intervalMs);

    this.simIntervals.set(symbol, intervalId);
  }

  private notifyTickListeners(symbol: MarketSymbol, tick: Tick) {
    const listeners = this.tickListeners.get(symbol);
    if (listeners) {
      listeners.forEach((cb) => cb(tick));
    }
    // Also update open active contracts for this symbol
    this.updateActiveContractsWithTick(symbol, tick);
  }

  // --- CONTRACT PURCHASING & PAPER TRADING ENGINE ---

  public purchaseContract(params: {
    symbol: MarketSymbol;
    contractType: string;
    stake: number;
    durationTicks: number;
    barrier?: number;
    targetDigit?: number;
    multiplier?: number;
    growthRate?: number;
    takeProfit?: number;
    stopLoss?: number;
    symbolName: string;
  }): ActiveContract {
    const spot = this.currentPrices[params.symbol] || 1000;
    const contractId = 'DERIV_' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // Calculate potential payout based on contract type
    let payoutMultiplier = 1.95; // default Rise/Fall 95% return
    if (params.contractType === 'DIGITDIFF') payoutMultiplier = 1.095;
    if (params.contractType === 'DIGITMATCH') payoutMultiplier = 8.85;
    if (params.contractType === 'DIGITOVER' || params.contractType === 'DIGITUNDER') {
      const target = params.targetDigit ?? 5;
      const winWays = params.contractType === 'DIGITOVER' ? (9 - target) : target;
      payoutMultiplier = Math.max(1.1, parseFloat((9.5 / (winWays || 1)).toFixed(2)));
    }
    if (params.contractType === 'DIGITEVEN' || params.contractType === 'DIGITODD') payoutMultiplier = 1.95;
    if (params.contractType === 'TOUCH' || params.contractType === 'NOTOUCH') payoutMultiplier = 2.45;
    if (params.contractType === 'ACCU') payoutMultiplier = 1.0 + (params.growthRate || 0.03) * params.durationTicks;
    if (params.contractType === 'MULT') payoutMultiplier = 1.0; // Dynamic leverage based

    const potentialPayout = parseFloat((params.stake * payoutMultiplier).toFixed(2));

    const contract: ActiveContract = {
      id: contractId,
      symbol: params.symbol,
      symbolName: params.symbolName,
      contractType: params.contractType,
      entrySpot: spot,
      currentSpot: spot,
      barrier: params.barrier !== undefined ? params.barrier : spot,
      targetDigit: params.targetDigit,
      multiplier: params.multiplier,
      growthRate: params.growthRate || 0.03,
      takeProfit: params.takeProfit,
      stopLoss: params.stopLoss,
      stake: params.stake,
      potentialPayout,
      currentProfit: 0,
      startTime: Date.now(),
      expiryTime: Date.now() + params.durationTicks * 1500,
      durationTicks: params.durationTicks,
      remainingTicks: params.durationTicks,
      status: 'OPEN',
      historySpots: [spot],
    };

    this.activeContracts.set(contractId, contract);

    // If connected over live WS, queue proposal request for live order execution
    if (this.isLiveWs && this.token && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.pendingProposalBuys.set(contractId, contract);
      console.log(`[Deriv WS Flow 4/6] Sending proposal request for contract type ${params.contractType} on ${params.symbol}...`);
      this.ws.send(JSON.stringify({
        proposal: 1,
        amount: params.stake,
        basis: 'stake',
        contract_type: params.contractType,
        currency: 'USD',
        duration: params.durationTicks,
        duration_unit: 't',
        symbol: params.symbol,
        barrier: params.barrier ? String(params.barrier) : undefined,
        passthrough: { client_contract_id: contractId },
      }));
    }

    this.notifyContractListeners(contract);
    return contract;
  }

  private handleProposalOpenContractUpdate(poc: any) {
    if (!poc) return;
    const liveId = String(poc.contract_id || poc.id);
    // Find contract by live ID or client_contract_id in passthrough
    const passthroughId = poc.passthrough?.client_contract_id;
    const contract = this.activeContracts.get(liveId) || (passthroughId ? this.activeContracts.get(passthroughId) : undefined);

    if (contract) {
      contract.currentSpot = parseFloat(poc.current_spot || poc.exit_tick || contract.currentSpot);
      contract.currentProfit = parseFloat(poc.profit || 0);
      
      const isEnded = Boolean(poc.is_sold || poc.is_expired || poc.status === 'won' || poc.status === 'lost' || poc.is_settled);
      if (isEnded) {
        contract.status = poc.profit >= 0 ? 'WON' : 'LOST';
        contract.isWin = poc.profit >= 0;
        contract.exitSpot = parseFloat(poc.exit_tick || poc.current_spot || contract.currentSpot);
      } else {
        contract.status = 'OPEN';
      }
      this.notifyContractListeners(contract);
    }
  }

  public subscribeContracts(callback: ContractListener) {
    this.contractListeners.add(callback);
  }

  public unsubscribeContracts(callback: ContractListener) {
    this.contractListeners.delete(callback);
  }

  public sellContractEarly(contractId: string): ActiveContract | null {
    const contract = this.activeContracts.get(contractId);
    if (!contract || contract.status !== 'OPEN') return null;

    contract.status = 'SOLD';
    // If accumulated profit is positive, credit profit, else cap max loss to stake
    if (contract.currentProfit > 0) {
      contract.isWin = true;
    } else {
      contract.isWin = false;
    }
    this.notifyContractListeners(contract);
    return contract;
  }

  private updateActiveContractsWithTick(symbol: MarketSymbol, tick: Tick) {
    this.activeContracts.forEach((contract) => {
      if (contract.symbol === symbol && contract.status === 'OPEN') {
        contract.currentSpot = tick.quote;
        contract.historySpots.push(tick.quote);
        contract.remainingTicks -= 1;

        const lastDigit = parseInt(tick.quote.toFixed(2).slice(-1), 10);
        const percentChange = (tick.quote - contract.entrySpot) / contract.entrySpot;

        // Contract specific real-time profit tracking & early triggers
        if (contract.contractType === 'MULT') {
          const leverage = contract.multiplier || 50;
          let profit = contract.stake * leverage * percentChange;

          // Check SL / TP limits
          if (contract.takeProfit && profit >= contract.takeProfit) {
            profit = contract.takeProfit;
            contract.status = 'WON';
            contract.isWin = true;
          } else if (contract.stopLoss && profit <= -contract.stopLoss) {
            profit = -contract.stopLoss;
            contract.status = 'LOST';
            contract.isWin = false;
          } else if (profit <= -contract.stake) {
            // Margin call / Stop out
            profit = -contract.stake;
            contract.status = 'LOST';
            contract.isWin = false;
          }
          contract.currentProfit = parseFloat(profit.toFixed(2));

        } else if (contract.contractType === 'ACCU') {
          // Accumulator tick growth
          const rate = contract.growthRate || 0.03;
          const ticksElapsed = contract.durationTicks - contract.remainingTicks;
          const accruedFactor = Math.pow(1 + rate, ticksElapsed) - 1;
          
          // Check if tick range knock-out happens (1% chance per tick)
          const isKnockout = Math.abs(percentChange) > 0.005;
          if (isKnockout) {
            contract.status = 'LOST';
            contract.isWin = false;
            contract.currentProfit = -contract.stake;
          } else {
            contract.currentProfit = parseFloat((contract.stake * accruedFactor).toFixed(2));
          }

        } else if (contract.contractType === 'TOUCH') {
          const barrier = contract.barrier || contract.entrySpot;
          if (Math.abs(tick.quote - contract.entrySpot) >= Math.abs(barrier - contract.entrySpot)) {
            contract.status = 'WON';
            contract.isWin = true;
            contract.currentProfit = contract.potentialPayout - contract.stake;
          } else {
            contract.currentProfit = -parseFloat((contract.stake * (contract.remainingTicks / contract.durationTicks)).toFixed(2));
          }

        } else if (contract.contractType === 'NOTOUCH') {
          const barrier = contract.barrier || contract.entrySpot;
          if (Math.abs(tick.quote - contract.entrySpot) >= Math.abs(barrier - contract.entrySpot)) {
            contract.status = 'LOST';
            contract.isWin = false;
            contract.currentProfit = -contract.stake;
          } else {
            contract.currentProfit = contract.potentialPayout - contract.stake;
          }

        } else if (contract.contractType === 'DIGITDIFF') {
          const isDiff = lastDigit !== (contract.targetDigit ?? 0);
          contract.currentProfit = isDiff ? (contract.potentialPayout - contract.stake) : -contract.stake;
        } else if (contract.contractType === 'DIGITMATCH') {
          const isMatch = lastDigit === (contract.targetDigit ?? 0);
          contract.currentProfit = isMatch ? (contract.potentialPayout - contract.stake) : -contract.stake;
        } else {
          // CALL / PUT / HIGHER / LOWER / DIGITOVER / DIGITUNDER / DIGITEVEN / DIGITODD
          const isCall = contract.contractType === 'CALL' || contract.contractType === 'HIGHER';
          const isWinningNow = isCall ? tick.quote > contract.entrySpot : tick.quote < contract.entrySpot;

          contract.currentProfit = isWinningNow
            ? parseFloat(((contract.potentialPayout - contract.stake) * (1 - contract.remainingTicks / contract.durationTicks)).toFixed(2))
            : -parseFloat((contract.stake * (1 - contract.remainingTicks / contract.durationTicks)).toFixed(2));
        }

        // Final Expiry check if still OPEN
        if (contract.status === 'OPEN' && contract.remainingTicks <= 0) {
          let won = false;

          if (contract.contractType === 'CALL') {
            won = tick.quote > contract.entrySpot;
          } else if (contract.contractType === 'PUT') {
            won = tick.quote < contract.entrySpot;
          } else if (contract.contractType === 'HIGHER') {
            won = tick.quote > (contract.barrier || contract.entrySpot);
          } else if (contract.contractType === 'LOWER') {
            won = tick.quote < (contract.barrier || contract.entrySpot);
          } else if (contract.contractType === 'DIGITMATCH') {
            won = lastDigit === (contract.targetDigit ?? 0);
          } else if (contract.contractType === 'DIGITDIFF') {
            won = lastDigit !== (contract.targetDigit ?? 0);
          } else if (contract.contractType === 'DIGITOVER') {
            won = lastDigit > (contract.targetDigit ?? 5);
          } else if (contract.contractType === 'DIGITUNDER') {
            won = lastDigit < (contract.targetDigit ?? 5);
          } else if (contract.contractType === 'DIGITEVEN') {
            won = lastDigit % 2 === 0;
          } else if (contract.contractType === 'DIGITODD') {
            won = lastDigit % 2 !== 0;
          } else if (contract.contractType === 'NOTOUCH') {
            won = true; // didn't touch
          } else if (contract.contractType === 'ACCU') {
            won = true; // survived all ticks
          } else if (contract.contractType === 'MULT') {
            won = contract.currentProfit > 0;
          } else {
            won = tick.quote !== contract.entrySpot;
          }

          contract.isWin = won;
          contract.exitSpot = tick.quote;
          contract.status = won ? 'WON' : 'LOST';
          contract.currentProfit = won ? (contract.potentialPayout - contract.stake) : -contract.stake;
        }

        this.notifyContractListeners(contract);
      }
    });
  }

  private notifyContractListeners(contract: ActiveContract) {
    this.contractListeners.forEach((cb) => cb(contract));
  }

  private startContractTicker() {
    if (this.activeContractsInterval) return;
    this.activeContractsInterval = window.setInterval(() => {
      // Clean old finished contracts if needed
    }, 1000);
  }

  public getCurrentPrice(symbol: MarketSymbol): number {
    return this.currentPrices[symbol] || 10000;
  }
}

export const derivWS = new DerivWebSocketService();
