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
type PendingTrade = { contract: ActiveContract; currency: string };
type ClientContract = ActiveContract & { liveContractId?: string };

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private appId = REGISTERED_DERIV_APP_ID;
  private token: string | null = null;
  private currency = 'USD';
  private isConnected = false;
  private isAuthorized = false;
  private intentionallyClosed = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private connectGeneration = 0;

  private tickListeners = new Map<MarketSymbol, Set<TickListener>>();
  private activeSubscriptions = new Set<MarketSymbol>();
  private currentPrices = new Map<MarketSymbol, number>();
  private lastTicks = new Map<MarketSymbol, Tick>();
  private activeContracts = new Map<string, ActiveContract>();
  private pendingTrades = new Map<string, PendingTrade>();
  private liveToClientContract = new Map<string, string>();
  private settlementPollTimers = new Map<string, number>();
  private settledContracts = new Set<string>();
  private contractListeners = new Set<ContractListener>();
  private authListeners = new Set<AuthListener>();
  private cachedEmail?: string;
  private cachedLoginId?: string;
  private cachedIsVirtual = false;
  private activeEndpointUrl = 'Deriv OTP WebSocket';

  public subscribeAuth(callback: AuthListener) { this.authListeners.add(callback); }
  public unsubscribeAuth(callback: AuthListener) { this.authListeners.delete(callback); }
  public subscribeContracts(callback: ContractListener) { this.contractListeners.add(callback); }
  public unsubscribeContracts(callback: ContractListener) { this.contractListeners.delete(callback); }
  private notifyAuth(status: AuthStatus) { this.authListeners.forEach((callback) => callback(status)); }
  private notifyContract(contract: ActiveContract) { this.contractListeners.forEach((callback) => callback({ ...contract, historySpots: [...contract.historySpots] })); }

  public sanitizeToken(rawToken?: string | null): string | null {
    if (!rawToken) return null;
    const clean = rawToken.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');
    return clean || null;
  }

  public connect(appId: string = REGISTERED_DERIV_APP_ID, rawToken?: string) {
    this.appId = appId?.trim() || REGISTERED_DERIV_APP_ID;
    this.token = this.sanitizeToken(rawToken);
    this.intentionallyClosed = false;
    this.isAuthorized = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.connectGeneration += 1;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.closeSocket(false);
    this.openSocket(this.connectGeneration);
  }

  public disconnect() {
    this.intentionallyClosed = true;
    this.token = null;
    this.isAuthorized = false;
    this.isConnected = false;
    this.connectGeneration += 1;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.settlementPollTimers.forEach((timer) => window.clearTimeout(timer));
    this.settlementPollTimers.clear();
    this.closeSocket(false);
    this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null });
  }

  private closeSocket(clearHandlers = true) {
    if (!this.ws) return;
    if (clearHandlers) { this.ws.onopen = null; this.ws.onclose = null; this.ws.onerror = null; this.ws.onmessage = null; }
    try { this.ws.close(); } catch (_) {}
    this.ws = null;
  }

  private async getAuthenticatedWebSocketUrl(generation: number): Promise<{ url: string; accountId?: string }> {
    if (!this.token) throw new Error('Enter a Deriv API token to authorize this account.');
    const response = await fetch('/.netlify/functions/deriv-otp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ appId: this.appId, token: this.token, accountId: this.cachedLoginId || undefined }), cache: 'no-store' });
    const body = await response.text();
    let data: any;
    try { data = JSON.parse(body); } catch { throw new Error(body || `OTP request failed (${response.status})`); }
    if (!response.ok || !data?.url) throw new Error(data?.error || `OTP request failed (${response.status})`);
    if (generation !== this.connectGeneration || this.intentionallyClosed) throw new Error('Connection attempt was cancelled.');
    return { url: String(data.url), accountId: data.accountId ? String(data.accountId) : undefined };
  }

  private openSocket(generation: number) {
    if (generation !== this.connectGeneration || this.intentionallyClosed) return;
    this.getAuthenticatedWebSocketUrl(generation).then(({ url, accountId }) => {
      if (generation !== this.connectGeneration || this.intentionallyClosed) return;
      this.activeEndpointUrl = url;
      if (accountId) this.cachedLoginId = accountId;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        if (generation !== this.connectGeneration || ws !== this.ws) { try { ws.close(); } catch (_) {} return; }
        this.isConnected = true; this.isAuthorized = true; this.reconnectAttempts = 0;
        this.notifyAuth({ isAuthorized: true, loginid: this.cachedLoginId, email: this.cachedEmail, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null });
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        ws.send(JSON.stringify({ get_settings: 1 }));
        this.activeSubscriptions.forEach((symbol) => this.sendTickSubscription(symbol));
      };
      ws.onmessage = (event) => { if (generation !== this.connectGeneration || ws !== this.ws) return; try { this.handleMessage(JSON.parse(event.data)); } catch (error) { console.error('[Deriv WS] Invalid JSON message:', error); } };
      ws.onerror = () => { if (generation !== this.connectGeneration || ws !== this.ws) return; this.isConnected = false; this.isAuthorized = false; this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: 'Authenticated Deriv WebSocket error.' }); };
      ws.onclose = (event) => { if (generation !== this.connectGeneration || ws !== this.ws) return; this.ws = null; this.isConnected = false; this.isAuthorized = false; const error = `Deriv WebSocket connection closed. Code: ${event.code} Reason: ${event.reason || 'none'}`; console.warn('[Deriv WS]', error); if (!this.intentionallyClosed && this.token) { this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error }); this.scheduleReconnect(generation); } };
    }).catch((error) => { if (generation !== this.connectGeneration || this.intentionallyClosed) return; this.isConnected = false; this.isAuthorized = false; const message = error instanceof Error ? error.message : String(error); console.error('[Deriv WS] Failed to obtain authenticated WebSocket URL:', message); this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: message }); if (this.token) this.scheduleReconnect(generation); });
  }

  private scheduleReconnect(generation: number) { if (this.reconnectTimer !== null || generation !== this.connectGeneration) return; const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts)); this.reconnectAttempts += 1; this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.openSocket(generation); }, delay); }
  public getIsLiveWs(): boolean { return this.isConnected && this.isAuthorized; }
  public getActiveEndpoint(): string { return this.activeEndpointUrl; }
  public getLastTick(symbol: MarketSymbol): Tick | undefined { return this.lastTicks.get(symbol); }
  public getCurrentPrice(symbol: MarketSymbol): number { return this.currentPrices.get(symbol) || 0; }

  private handleMessage(data: any) { if (data.error) { this.handleApiError(data); return; } switch (data.msg_type) { case 'authorize': this.handleAuthorize(data.authorize); break; case 'balance': this.handleBalance(data.balance); break; case 'get_settings': this.handleSettings(data.get_settings); break; case 'tick': this.handleTick(data.tick); break; case 'proposal': this.handleProposal(data); break; case 'buy': this.handleBuy(data); break; case 'proposal_open_contract': this.handleContractUpdate(data.proposal_open_contract); break; case 'ping': break; default: break; } }

  private handleAuthorize(auth: any) { if (!auth) return; this.isAuthorized = true; this.cachedLoginId = auth.loginid || this.cachedLoginId; this.cachedEmail = auth.email || this.cachedEmail; this.currency = auth.currency || this.currency; this.cachedIsVirtual = Boolean(auth.is_virtual); const scopes = Array.isArray(auth.scopes) ? auth.scopes : auth.scopes && typeof auth.scopes === 'object' ? Object.keys(auth.scopes) : []; this.notifyAuth({ isAuthorized: true, loginid: this.cachedLoginId, email: this.cachedEmail, balance: Number(auth.balance) || 0, currency: this.currency, isVirtual: this.cachedIsVirtual, scopes, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null }); }
  private handleBalance(balance: any) { if (!balance) return; const value = Number(balance.balance); if (!Number.isFinite(value)) return; this.currency = balance.currency || this.currency; this.cachedLoginId = balance.loginid || balance.account || this.cachedLoginId; this.notifyAuth({ isAuthorized: this.isAuthorized, loginid: this.cachedLoginId, email: this.cachedEmail, balance: value, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: this.isAuthorized ? null : 'Account is not authorized.' }); }
  private handleSettings(settings: any) { if (!settings) return; if (settings.email) this.cachedEmail = settings.email; if (this.isAuthorized) this.notifyAuth({ isAuthorized: true, loginid: this.cachedLoginId, email: this.cachedEmail, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null }); }

  private cancelPendingTrade(clientId: string, reason: string) {
    const pending = this.pendingTrades.get(clientId);
    if (!pending) return;
    this.pendingTrades.delete(clientId);
    pending.contract.status = 'CANCELLED';
    pending.contract.isWin = false;
    pending.contract.currentProfit = 0;
    pending.contract.remainingTicks = 0;
    this.activeContracts.delete(clientId);
    this.notifyContract(pending.contract);
    console.warn('[Deriv WS] Trade cancelled before execution:', reason);
    this.refreshBalance();
  }

  private handleApiError(data: any) {
    const message = data.error?.message || 'Deriv API request failed.';
    const code = data.error?.code || 'API_ERROR';
    console.error(`[Deriv WS] ${code}: ${message}`, data.error);
    const clientId = data.echo_req?.passthrough?.client_contract_id;
    if (clientId && this.pendingTrades.has(clientId)) this.cancelPendingTrade(String(clientId), `${code}: ${message}`);
    const contractId = data.echo_req?.contract_id;
    if (contractId) this.clearSettlementPolling(String(contractId));
    this.notifyAuth({ isAuthorized: this.isAuthorized, loginid: this.cachedLoginId, email: this.cachedEmail, currency: this.currency, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: `${code}: ${message}` });
  }

  private refreshBalance() { if (this.ws?.readyState !== WebSocket.OPEN) return; try { this.ws.send(JSON.stringify({ balance: 1 })); } catch (error) { console.warn('[Deriv WS] Balance refresh failed:', error); } }

  private handleTick(tickData: any) { if (!tickData?.symbol) return; const symbol = tickData.symbol as MarketSymbol; const quote = Number(tickData.quote); if (!Number.isFinite(quote)) return; const previous = this.currentPrices.get(symbol) ?? quote; const pipSize = Number.isInteger(tickData.pip_size) ? Number(tickData.pip_size) : undefined; const tick: Tick = { epoch: Number(tickData.epoch) || Math.floor(Date.now() / 1000), quote, symbol, id: tickData.id ? String(tickData.id) : undefined, change: quote - previous, pipSize }; this.currentPrices.set(symbol, quote); this.lastTicks.set(symbol, tick); this.tickListeners.get(symbol)?.forEach((callback) => callback(tick)); }
  public subscribeTicks(symbol: MarketSymbol, callback: TickListener) { let listeners = this.tickListeners.get(symbol); if (!listeners) { listeners = new Set<TickListener>(); this.tickListeners.set(symbol, listeners); } listeners.add(callback); this.activeSubscriptions.add(symbol); if (this.ws?.readyState === WebSocket.OPEN) this.sendTickSubscription(symbol); }
  public unsubscribeTicks(symbol: MarketSymbol, callback: TickListener) { const listeners = this.tickListeners.get(symbol); if (!listeners) return; listeners.delete(callback); if (listeners.size > 0) return; this.tickListeners.delete(symbol); this.activeSubscriptions.delete(symbol); if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify({ forget_all: 'ticks' })); this.activeSubscriptions.forEach((activeSymbol) => this.sendTickSubscription(activeSymbol)); } }
  private sendTickSubscription(symbol: MarketSymbol) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 })); }

  private createClientContract(params: { symbol: MarketSymbol; contractType: string; stake: number; durationTicks: number; barrier?: number; targetDigit?: number; multiplier?: number; growthRate?: number; takeProfit?: number; stopLoss?: number; symbolName: string; }): ActiveContract {
    const spot = this.currentPrices.get(params.symbol) ?? 0; const duration = Math.max(1, Math.floor(params.durationTicks || 1));
    return { id: `PENDING_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, symbol: params.symbol, symbolName: params.symbolName, contractType: params.contractType, entrySpot: spot, currentSpot: spot, barrier: params.barrier, targetDigit: params.targetDigit, multiplier: params.multiplier, growthRate: params.growthRate, takeProfit: params.takeProfit, stopLoss: params.stopLoss, stake: params.stake, potentialPayout: params.stake, currentProfit: 0, startTime: Date.now(), expiryTime: Date.now() + duration * 1000, durationTicks: duration, remainingTicks: duration, status: 'OPEN', historySpots: spot ? [spot] : [] };
  }

  public purchaseContract(params: { symbol: MarketSymbol; contractType: string; stake: number; durationTicks: number; barrier?: number; targetDigit?: number; multiplier?: number; growthRate?: number; takeProfit?: number; stopLoss?: number; symbolName: string; }): ActiveContract {
    const contract = this.createClientContract(params); const clientId = contract.id; const stake = Number(params.stake);
    if (!Number.isFinite(stake) || stake <= 0) { contract.status = 'CANCELLED'; contract.currentProfit = 0; contract.remainingTicks = 0; this.notifyContract(contract); return contract; }
    this.activeContracts.set(clientId, contract); this.pendingTrades.set(clientId, { contract, currency: this.currency }); this.notifyContract(contract);
    if (!this.isAuthorized || !this.ws || this.ws.readyState !== WebSocket.OPEN) { this.cancelPendingTrade(clientId, 'account is not authorized/live'); return contract; }
    const request: Record<string, any> = { proposal: 1, amount: stake, basis: 'stake', contract_type: params.contractType, currency: this.currency, duration: Math.max(1, Math.floor(params.durationTicks || 1)), duration_unit: 't', underlying_symbol: params.symbol, passthrough: { client_contract_id: clientId } };
    if (['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'].includes(params.contractType)) {
      const digit = params.targetDigit;
      if (digit === undefined || !Number.isInteger(digit) || digit < 0 || digit > 9) { this.cancelPendingTrade(clientId, 'invalid digit prediction'); return contract; }
      request.barrier = String(digit); contract.barrier = digit; contract.targetDigit = digit;
    } else if (params.barrier !== undefined) request.barrier = String(params.barrier);
    try { console.info('[Deriv WS] Requesting live proposal:', request); this.ws.send(JSON.stringify(request)); }
    catch (error) { this.cancelPendingTrade(clientId, error instanceof Error ? error.message : String(error)); }
    return contract;
  }

  private handleProposal(data: any) {
    const clientId = data.echo_req?.passthrough?.client_contract_id; if (!clientId) return;
    const pending = this.pendingTrades.get(clientId); if (!pending) return;
    if (data.error || !data.proposal?.id) { this.cancelPendingTrade(String(clientId), data.error?.message || 'proposal was not created'); return; }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const proposalId = String(data.proposal.id); const askPrice = Number(data.proposal.ask_price ?? pending.contract.stake);
    const buyRequest = { buy: proposalId, price: Math.max(pending.contract.stake, askPrice), passthrough: { client_contract_id: clientId } };
    pending.contract.potentialPayout = Number(data.proposal.payout) || pending.contract.stake;
    try { console.info('[Deriv WS] Buying live proposal:', proposalId); this.ws.send(JSON.stringify(buyRequest)); }
    catch (error) { this.cancelPendingTrade(String(clientId), error instanceof Error ? error.message : String(error)); }
  }

  private handleBuy(data: any) {
    const clientId = data.echo_req?.passthrough?.client_contract_id || data.buy?.passthrough?.client_contract_id;
    if (!clientId || !this.pendingTrades.has(clientId)) return;
    const pending = this.pendingTrades.get(clientId)!;
    if (data.error || !data.buy?.contract_id) { this.cancelPendingTrade(String(clientId), data.error?.message || 'buy request was rejected'); return; }
    const liveId = String(data.buy.contract_id); this.liveToClientContract.set(liveId, clientId); this.pendingTrades.delete(clientId);
    const clientContract = pending.contract as ClientContract; clientContract.liveContractId = liveId; clientContract.entrySpot = Number(data.buy.start_spot ?? clientContract.entrySpot); clientContract.currentSpot = clientContract.entrySpot; clientContract.potentialPayout = Number(data.buy.payout) || clientContract.potentialPayout; clientContract.historySpots = clientContract.entrySpot ? [clientContract.entrySpot] : []; clientContract.status = 'OPEN'; this.activeContracts.delete(clientId); this.activeContracts.set(clientId, clientContract); this.notifyContract(clientContract); this.refreshBalance();
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: liveId, subscribe: 1 })); this.beginSettlementPolling(liveId, 0); }
  }

  private beginSettlementPolling(liveId: string, attempt: number) { if (this.settledContracts.has(liveId) || this.settlementPollTimers.has(liveId)) return; if (attempt >= 20) { this.settlementPollTimers.delete(liveId); console.warn('[Deriv WS] Settlement polling timed out:', liveId); return; } const timer = window.setTimeout(() => { this.settlementPollTimers.delete(liveId); if (this.settledContracts.has(liveId)) return; if (this.ws?.readyState === WebSocket.OPEN) { try { this.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: liveId })); } catch (_) {} } this.beginSettlementPolling(liveId, attempt + 1); }, attempt === 0 ? 300 : 350); this.settlementPollTimers.set(liveId, timer); }
  private clearSettlementPolling(liveId: string) { const timer = this.settlementPollTimers.get(liveId); if (timer !== undefined) window.clearTimeout(timer); this.settlementPollTimers.delete(liveId); }
  private getContractProfit(poc: any, contract: ActiveContract): number { const directProfit = Number(poc?.profit); if (Number.isFinite(directProfit)) return directProfit; const sellPrice = Number(poc?.sell_price); const buyPrice = Number(poc?.buy_price); if (Number.isFinite(sellPrice) && Number.isFinite(buyPrice)) return sellPrice - buyPrice; const payout = Number(poc?.payout); if (Number.isFinite(payout) && Number.isFinite(buyPrice)) return payout - buyPrice; const status = String(poc?.status || '').toLowerCase(); if (['lost', 'sold'].includes(status) || poc?.is_sold || poc?.is_expired || poc?.is_settled) return -Number(contract.stake || 0); return Number(contract.currentProfit) || 0; }

  private handleContractUpdate(poc: any) {
    if (!poc) return; const liveId = String(poc.contract_id || poc.id || ''); if (!liveId) return; const clientId = this.liveToClientContract.get(liveId) || liveId; const contract = this.activeContracts.get(clientId); if (!contract) return;
    if (poc.current_spot !== undefined) { const currentSpot = Number(poc.current_spot); if (Number.isFinite(currentSpot)) { contract.currentSpot = currentSpot; if (contract.historySpots[contract.historySpots.length - 1] !== currentSpot) contract.historySpots.push(currentSpot); if (contract.historySpots.length > 100) contract.historySpots.shift(); } }
    if (poc.entry_spot !== undefined) { const value = Number(poc.entry_spot); if (Number.isFinite(value)) contract.entrySpot = value; }
    if (poc.payout !== undefined) { const value = Number(poc.payout); if (Number.isFinite(value)) contract.potentialPayout = value; }
    if (poc.exit_tick !== undefined) { const value = Number(poc.exit_tick); if (Number.isFinite(value)) contract.exitSpot = value; }
    if (poc.exit_tick_time !== undefined) { const value = Number(poc.exit_tick_time); if (Number.isFinite(value)) contract.expiryTime = value * 1000; }
    const status = String(poc.status || '').toLowerCase(); const ended = Boolean(poc.is_sold || poc.is_expired || poc.is_settled || ['won', 'lost', 'sold'].includes(status));
    if (ended) {
      if (this.settledContracts.has(liveId)) return; this.settledContracts.add(liveId); this.clearSettlementPolling(liveId);
      const profit = this.getContractProfit(poc, contract); contract.currentProfit = Number.isFinite(profit) ? profit : 0; contract.isWin = contract.currentProfit > 0; contract.status = status === 'sold' || poc.is_sold ? 'SOLD' : (contract.currentProfit > 0 ? 'WON' : 'LOST'); contract.remainingTicks = 0; if (poc.exit_tick !== undefined) { const value = Number(poc.exit_tick); if (Number.isFinite(value)) contract.exitSpot = value; }
      this.activeContracts.set(clientId, contract); this.notifyContract(contract); this.refreshBalance(); window.setTimeout(() => this.refreshBalance(), 350); return;
    }
    const reportedProfit = Number(poc.profit); if (Number.isFinite(reportedProfit)) contract.currentProfit = reportedProfit; contract.status = 'OPEN'; if (poc.tick_count !== undefined && poc.tick_count !== null) { const tickCount = Number(poc.tick_count); if (Number.isFinite(tickCount)) contract.remainingTicks = Math.max(0, contract.durationTicks - tickCount); } this.notifyContract(contract);
  }

  public sellContractEarly(contractId: string): ActiveContract | null { const contract = this.activeContracts.get(contractId); if (!contract || contract.status !== 'OPEN' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return null; const liveId = (contract as ClientContract).liveContractId || this.liveToClientContract.get(contractId) || contractId; this.ws.send(JSON.stringify({ sell: liveId, price: 0 })); return contract; }
}

export const derivWS = new DerivWebSocketService();