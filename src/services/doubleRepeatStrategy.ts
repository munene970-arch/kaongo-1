import { MarketSymbol, Tick } from '../types/deriv';
import { derivWS } from './derivWebSocket';

export interface DoubleRepeatStatus {
  running: boolean;
  symbol: MarketSymbol;
  stake: number;
  ticksSeen: number;
  trades: number;
  lastPattern?: [number, number, number];
  lastPrediction?: number;
  lastMessage: string;
}

type StatusListener = (status: DoubleRepeatStatus) => void;

const getLastDigit = (tick: Tick): number => {
  const pipSize = Number.isInteger(tick.pipSize) ? tick.pipSize! : 2;
  const factor = Math.pow(10, Math.max(0, pipSize));
  return Math.floor(Math.abs(Math.round(tick.quote * factor))) % 10;
};

class DoubleRepeatStrategyService {
  private running = false;
  private symbol: MarketSymbol = 'R_75';
  private stake = 10;
  private history: number[] = [];
  private trades = 0;
  private ticksSeen = 0;
  private lastPattern?: [number, number, number];
  private lastPrediction?: number;
  private lastMessage = 'Stopped';
  private listener?: (tick: Tick) => void;
  private statusListeners = new Set<StatusListener>();

  subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => { this.statusListeners.delete(listener); };
  }

  private notify() {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => listener(status));
  }

  getStatus(): DoubleRepeatStatus {
    return {
      running: this.running,
      symbol: this.symbol,
      stake: this.stake,
      ticksSeen: this.ticksSeen,
      trades: this.trades,
      lastPattern: this.lastPattern,
      lastPrediction: this.lastPrediction,
      lastMessage: this.lastMessage,
    };
  }

  setStake(stake: number) {
    if (Number.isFinite(stake) && stake > 0) this.stake = stake;
    this.notify();
  }

  setSymbol(symbol: MarketSymbol) {
    if (symbol === this.symbol) return;
    this.stop();
    this.symbol = symbol;
    this.history = [];
    this.ticksSeen = 0;
    this.trades = 0;
    this.lastPattern = undefined;
    this.lastPrediction = undefined;
    this.lastMessage = `Ready on ${symbol}`;
    this.notify();
  }

  start(symbol: MarketSymbol = this.symbol, stake = this.stake) {
    this.stop(false);
    this.symbol = symbol;
    this.stake = stake;
    this.history = [];
    this.ticksSeen = 0;
    this.trades = 0;
    this.lastPattern = undefined;
    this.lastPrediction = undefined;
    this.lastMessage = `Waiting for X X Y on ${symbol}`;
    this.running = true;
    this.listener = (tick: Tick) => this.onTick(tick);
    derivWS.subscribeTicks(symbol, this.listener);
    this.notify();
  }

  stop(update = true) {
    if (this.listener) {
      derivWS.unsubscribeTicks(this.symbol, this.listener);
      this.listener = undefined;
    }
    this.running = false;
    this.lastMessage = 'Stopped';
    if (update) this.notify();
  }

  private onTick(tick: Tick) {
    if (!this.running || tick.symbol !== this.symbol) return;

    const digit = getLastDigit(tick);
    this.history.push(digit);
    if (this.history.length > 3) this.history.shift();
    this.ticksSeen += 1;

    if (this.history.length < 3) {
      this.lastMessage = `Waiting: ${this.history.join(' ')}`;
      this.notify();
      return;
    }

    const [x1, x2, y] = this.history;
    const isPattern = x1 === x2 && y !== x1;
    this.lastPattern = [x1, x2, y];

    if (!isPattern) {
      this.lastMessage = `No trade: ${x1} ${x2} ${y}`;
      this.notify();
      return;
    }

    this.lastPrediction = y;
    this.trades += 1;
    this.lastMessage = `Pattern ${x1} ${x2} ${y} → BUY DIFFERS ${y}`;

    derivWS.purchaseContract({
      symbol: this.symbol,
      symbolName: this.symbol,
      contractType: 'DIGITDIFF',
      stake: this.stake,
      durationTicks: 1,
      targetDigit: y,
      barrier: y,
    });

    this.notify();
  }
}

export const doubleRepeatStrategy = new DoubleRepeatStrategyService();