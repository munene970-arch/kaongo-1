export type MarketSymbol = 
  | 'R_10' | 'R_25' | 'R_50' | 'R_75' | 'R_100'
  | '1HZ10V' | '1HZ25V' | '1HZ50V' | '1HZ75V' | '1HZ100V' | '1HZ150V' | '1HZ250V'
  | 'CRASH1000' | 'CRASH500' | 'CRASH300' | 'BOOM1000' | 'BOOM500' | 'BOOM300'
  | 'STEPINDEX' | 'JUMP10' | 'JUMP25' | 'JUMP50' | 'JUMP75' | 'JUMP100'
  | 'RDBEAR' | 'RDBULL';

export interface MarketInfo {
  symbol: MarketSymbol;
  displayName: string;
  category: 'Volatility Indices' | 'Crash & Boom' | 'Step & Jump';
  description: string;
  currentPrice: number;
  change24h: number;
  isHighVolatility: boolean;
  minStake: number;
  maxStake: number;
}

export type TradeCategory = 'RISE_FALL' | 'HIGHER_LOWER' | 'TOUCH_NO_TOUCH' | 'DIGITS' | 'ACCUMULATOR' | 'MULTIPLIER';

export interface Tick {
  epoch: number;
  quote: number;
  symbol: MarketSymbol;
  id?: string;
  change?: number;
  pipSize?: number;
}

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ActiveContract {
  id: string;
  symbol: MarketSymbol;
  symbolName: string;
  contractType: string;
  entrySpot: number;
  currentSpot: number;
  barrier?: number;
  targetDigit?: number;
  multiplier?: number;
  growthRate?: number;
  takeProfit?: number;
  stopLoss?: number;
  stake: number;
  potentialPayout: number;
  currentProfit: number;
  startTime: number;
  expiryTime: number;
  durationTicks: number;
  remainingTicks: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'SOLD' | 'CANCELLED';
  isWin?: boolean;
  exitSpot?: number;
  historySpots: number[];
}

export type DBotIndicatorTrigger =
  | 'EMA_CROSS'
  | 'RSI_OVERSOLD'
  | 'SPIKE_DETECT'
  | 'LAST_DIGIT_PATTERN'
  | 'ACCU_SCALP'
  | 'S_DIFFER_QUAD_PATTERN'
  | 'ALTERNATING_DIGIT_DIFF';

export interface DBotStrategy {
  id: string;
  name: string;
  description: string;
  symbol: MarketSymbol;
  category: TradeCategory;
  contractType: string;
  initialStake: number;
  durationTicks: number;
  martingaleFactor: number;
  takeProfit: number;
  stopLoss: number;
  maxLossStreak: number;
  rules: {
    indicatorTrigger: DBotIndicatorTrigger;
    paramValue?: number;
  };
  isActive?: boolean;
  totalRuns?: number;
  wins?: number;
  losses?: number;
  totalProfit?: number;
}

export interface MasterTrader {
  id: string;
  name: string;
  avatar: string;
  badge: 'PRO' | 'TOP_GAINER' | 'VIP' | 'QUANT';
  specialtyMarket: string;
  winRate: number;
  totalRoi30d: number;
  copiersCount: number;
  totalProfitUsd: number;
  maxDrawdown: number;
  riskScore: number;
  isFollowing?: boolean;
  copySettings?: {
    allocationUsd: number;
    multiplier: number;
    maxLossUsd: number;
  };
}

export interface MarketSignal {
  id: string;
  symbol: MarketSymbol;
  symbolName: string;
  type: 'BULLISH_BREAKOUT' | 'BEARISH_DIVERGENCE' | 'CRASH_SPIKE_ALERT' | 'BOOM_SPIKE_ALERT' | 'DIGIT_REPEAT';
  time: string;
  confidence: number;
  entryPrice: number;
  description: string;
  recommendedTrade: string;
}
