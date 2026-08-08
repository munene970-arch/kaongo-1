import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, MarketInfo, Tick, ActiveContract, TradeCategory } from '../../types/deriv';
import { derivWS } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Activity,
  AlertCircle,
  ShieldCheck,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Sliders,
  Zap,
  Percent,
  BarChart2,
  Layers,
  Crosshair,
  Volume2,
  VolumeX,
  Sparkles,
  Info
} from 'lucide-react';

interface TradingTerminalProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  activeContracts: ActiveContract[];
}

export const TradingTerminal: React.FC<TradingTerminalProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
}) => {
  const currentMarket = markets.find((m) => m.symbol === selectedSymbol) || markets[0];

  const [ticks, setTicks] = useState<Tick[]>([]);
  const [tradeCategory, setTradeCategory] = useState<TradeCategory>('RISE_FALL');
  const [digitSubtype, setDigitSubtype] = useState<'MATCHES' | 'DIFFERS' | 'OVER_UNDER' | 'EVEN_ODD'>('MATCHES');
  const [durationTicks, setDurationTicks] = useState<number>(5);
  const [stake, setStake] = useState<number>(10);
  const [targetDigit, setTargetDigit] = useState<number>(7);
  const [barrierOffset, setBarrierOffset] = useState<number>(0.25);
  const [multiplier, setMultiplier] = useState<number>(50);
  const [growthRate, setGrowthRate] = useState<number>(0.03); // 3% accumulator growth
  const [takeProfit, setTakeProfit] = useState<number>(20);
  const [stopLoss, setStopLoss] = useState<number>(10);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [showIndicators, setShowIndicators] = useState<boolean>(true);
  const [indicatorType, setIndicatorType] = useState<'EMA' | 'BOLLINGER' | 'RSI'>('EMA');

  // Subscribe to real-time ticks
  useEffect(() => {
    const handleNewTick = (tick: Tick) => {
      setTicks((prev) => {
        const next = [...prev, tick];
        return next.slice(-60); // Keep last 60 ticks for chart
      });
    };

    setTicks([]); // Reset on symbol change
    derivWS.subscribeTicks(selectedSymbol, handleNewTick);

    return () => {
      derivWS.unsubscribeTicks(selectedSymbol, handleNewTick);
    };
  }, [selectedSymbol]);

  const currentPrice = ticks.length > 0 ? ticks[ticks.length - 1].quote : currentMarket.currentPrice;
  const prevPrice = ticks.length > 1 ? ticks[ticks.length - 2].quote : currentPrice;
  const isUp = currentPrice >= prevPrice;
  const lastDigit = parseInt(currentPrice.toFixed(2).slice(-1), 10) || 0;

  // Calculate Last Digit Frequency Distribution (0-9) over last 60 ticks
  const digitCounts = useMemo(() => {
    const counts = Array(10).fill(0);
    ticks.forEach((t) => {
      const d = parseInt(t.quote.toFixed(2).slice(-1), 10);
      if (!isNaN(d) && d >= 0 && d <= 9) counts[d]++;
    });
    const total = ticks.length || 1;
    return counts.map((count) => ({
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [ticks]);

  // Handle Trade Execution
  const handleExecuteTrade = (contractType: string, overrideParams?: Partial<{ barrier: number; targetDigit: number }>) => {
    if (stake <= 0) {
      alert('Please enter a valid stake amount.');
      return;
    }
    if (stake > balanceUsd) {
      alert('Insufficient account balance.');
      return;
    }

    if (isSoundEnabled) soundManager.playClickSound();

    // Deduct stake from account
    onUpdateBalance(balanceUsd - stake);

    const calculatedBarrier = overrideParams?.barrier !== undefined 
      ? overrideParams.barrier 
      : (tradeCategory === 'HIGHER_LOWER' || tradeCategory === 'TOUCH_NO_TOUCH'
          ? (contractType.includes('HIGHER') || contractType.includes('TOUCH') ? currentPrice + barrierOffset : currentPrice - barrierOffset)
          : currentPrice);

    // Purchase contract in engine
    derivWS.purchaseContract({
      symbol: selectedSymbol,
      symbolName: currentMarket.displayName,
      contractType,
      stake,
      durationTicks,
      barrier: calculatedBarrier,
      targetDigit: overrideParams?.targetDigit ?? targetDigit,
      multiplier,
      growthRate,
      takeProfit: (tradeCategory === 'MULTIPLIER' || tradeCategory === 'ACCUMULATOR') ? takeProfit : undefined,
      stopLoss: (tradeCategory === 'MULTIPLIER' || tradeCategory === 'ACCUMULATOR') ? stopLoss : undefined,
    });
  };

  const handleSellContract = (contractId: string) => {
    const sold = derivWS.sellContractEarly(contractId);
    if (sold) {
      if (isSoundEnabled) soundManager.playWinSound();
      onUpdateBalance(balanceUsd + sold.stake + sold.currentProfit);
    }
  };

  // SVG Chart Calculations
  const minPrice = ticks.length > 0 ? Math.min(...ticks.map((t) => t.quote)) * 0.9997 : currentPrice * 0.999;
  const maxPrice = ticks.length > 0 ? Math.max(...ticks.map((t) => t.quote)) * 1.0003 : currentPrice * 1.001;
  const range = maxPrice - minPrice || 1;

  // Technical Indicators Calculation
  const ema10Points = useMemo(() => {
    if (ticks.length < 10) return [];
    const k = 2 / (10 + 1);
    let ema = ticks[0].quote;
    return ticks.map((t, idx) => {
      if (idx === 0) return ema;
      ema = t.quote * k + ema * (1 - k);
      return ema;
    });
  }, [ticks]);

  const sma20Points = useMemo(() => {
    return ticks.map((t, idx) => {
      if (idx < 19) return null;
      const slice = ticks.slice(idx - 19, idx + 1);
      const avg = slice.reduce((acc, curr) => acc + curr.quote, 0) / 20;
      return avg;
    });
  }, [ticks]);

  // RSI 14 Period Gauge Calculation
  const currentRsi = useMemo(() => {
    if (ticks.length < 15) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = ticks.length - 14; i < ticks.length; i++) {
      const diff = ticks[i].quote - ticks[i - 1].quote;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14 || 0.0001;
    const rs = avgGain / avgLoss;
    return Math.round(100 - 100 / (1 + rs));
  }, [ticks]);

  return (
    <div className="space-y-6">
      
      {/* Symbol & Market Overview Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Market Dropdown Selector & Current Quote */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <select
                value={selectedSymbol}
                onChange={(e) => onSelectSymbol(e.target.value as MarketSymbol)}
                className="bg-slate-950 border border-slate-700 text-white font-black text-base rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:border-red-500 cursor-pointer shadow-inner"
              >
                {markets.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.displayName} ({m.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className={`font-mono text-3xl font-black tracking-tight ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentPrice.toFixed(4)}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                currentMarket.change24h >= 0 
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                  : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}>
                {currentMarket.change24h >= 0 ? '+' : ''}{currentMarket.change24h}%
              </span>
            </div>
          </div>

          {/* Quick Metrics: Last Digit Badge, RSI Gauge, Sound Toggle */}
          <div className="flex items-center space-x-3">
            {/* Last Digit Pill */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Last Digit:</span>
              <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-mono font-black flex items-center justify-center text-sm shadow-md shadow-red-950/60">
                {lastDigit}
              </span>
            </div>

            {/* RSI 14 Gauge */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">RSI(14):</span>
              <span className={`font-mono font-bold ${
                currentRsi >= 70 ? 'text-rose-400' : currentRsi <= 30 ? 'text-emerald-400' : 'text-amber-300'
              }`}>
                {currentRsi}
              </span>
            </div>

            {/* Sound Toggle Button */}
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className={`p-2 rounded-xl border transition-colors ${
                isSoundEnabled ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
              title={isSoundEnabled ? 'Audio Chimes Active' : 'Muted'}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive SVG Chart + Complete Trade Execution Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SVG Chart Container (2 Columns on lg) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between min-h-[460px]">
          
          {/* Chart Controls Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-red-500" />
                <span>Live Deriv Tick Feed Engine</span>
              </span>
              {currentMarket.symbol.startsWith('CRASH') && (
                <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Spike Detector
                </span>
              )}
              {currentMarket.symbol.startsWith('BOOM') && (
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Boom Hunter
                </span>
              )}
            </div>

            {/* Technical Indicator Buttons */}
            <div className="flex items-center space-x-1.5 text-xs">
              <button
                onClick={() => setShowIndicators(!showIndicators)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] ${
                  showIndicators ? 'bg-red-950 border-red-700 text-red-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                EMA 10
              </button>
              <button
                onClick={() => setIndicatorType(indicatorType === 'BOLLINGER' ? 'EMA' : 'BOLLINGER')}
                className={`px-2.5 py-1 rounded-lg border font-bold transition-all text-[11px] ${
                  indicatorType === 'BOLLINGER' ? 'bg-indigo-950 border-indigo-700 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                Bollinger
              </button>
            </div>
          </div>

          {/* SVG Canvas Area */}
          <div className="relative w-full h-[320px] bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center p-4">
            
            {/* Background Grid */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-10 pointer-events-none">
              <div className="border-r border-b border-slate-400" />
              <div className="border-r border-b border-slate-400" />
              <div className="border-r border-b border-slate-400" />
              <div className="border-r border-b border-slate-400" />
              <div className="border-r border-b border-slate-400" />
              <div className="border-b border-slate-400" />
            </div>

            {ticks.length < 2 ? (
              <div className="flex flex-col items-center space-y-2 text-slate-500">
                <Activity className="w-6 h-6 animate-spin text-red-500" />
                <span className="text-xs font-semibold">Initializing Deriv tick stream...</span>
              </div>
            ) : (
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 200">
                
                {/* SVG Gradient Fill */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Main Tick Line Path */}
                {(() => {
                  const points = ticks.map((t, idx) => {
                    const x = (idx / (ticks.length - 1)) * 500;
                    const y = 190 - ((t.quote - minPrice) / range) * 180;
                    return `${x},${y}`;
                  });

                  const lineString = points.join(' L ');
                  const areaString = `M 0,200 L ${lineString} L 500,200 Z`;

                  return (
                    <>
                      <path d={areaString} fill="url(#chartGradient)" />
                      <path d={`M ${lineString}`} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  );
                })()}

                {/* EMA 10 Indicator Overlay */}
                {showIndicators && ema10Points.length > 1 && (() => {
                  const emaFiltered = ema10Points.map((ema, idx) => {
                    const x = (idx / (ticks.length - 1)) * 500;
                    const y = 190 - ((ema - minPrice) / range) * 180;
                    return `${x},${y}`;
                  }).join(' L ');

                  return (
                    <path
                      d={`M ${emaFiltered}`}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  );
                })()}

                {/* Current Price Dot */}
                {(() => {
                  const lastIdx = ticks.length - 1;
                  const cx = 500;
                  const cy = 190 - ((ticks[lastIdx].quote - minPrice) / range) * 180;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r="7" fill="#ef4444" className="animate-ping opacity-75" />
                      <circle cx={cx} cy={cy} r="4.5" fill="#ffffff" stroke="#ef4444" strokeWidth="2.5" />
                    </g>
                  );
                })()}
              </svg>
            )}

            {/* Live Spot Float Overlay */}
            <div className="absolute right-3 top-3 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white shadow-xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Spot: {currentPrice.toFixed(4)}</span>
            </div>
          </div>

          {/* Last Digit Distribution Histogram Bar */}
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="text-[11px] font-bold text-slate-400 mb-2 flex justify-between items-center">
              <span>LAST DIGIT FREQUENCY DISTRIBUTION (60 TICKS)</span>
              <span className="text-red-400 text-[10px]">Statistically Balanced</span>
            </div>
            <div className="grid grid-cols-10 gap-1 text-center font-mono text-[10px]">
              {digitCounts.map((d, i) => (
                <div key={i} className="flex flex-col items-center space-y-1">
                  <div className="w-full bg-slate-950 h-8 rounded relative overflow-hidden flex items-end">
                    <div
                      className={`w-full transition-all duration-300 ${
                        i === lastDigit ? 'bg-red-500' : 'bg-slate-700/80'
                      }`}
                      style={{ height: `${Math.max(10, Math.min(100, d.pct * 4))}%` }}
                    />
                  </div>
                  <span className={`font-bold ${i === lastDigit ? 'text-red-400' : 'text-slate-400'}`}>
                    {i}
                  </span>
                  <span className="text-[9px] text-slate-500">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Complete Order Control Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          
          <div>
            <h3 className="font-extrabold text-white text-base mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Deriv Trade Execution</span>
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-md">
                Up to 95%+ Payout
              </span>
            </h3>

            {/* Trade Category Navigation Tabs */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4">
              {[
                { key: 'RISE_FALL', label: 'Rise/Fall' },
                { key: 'TOUCH_NO_TOUCH', label: 'Touch' },
                { key: 'DIGITS', label: 'Digits' },
                { key: 'ACCUMULATOR', label: 'Accu' },
                { key: 'MULTIPLIER', label: 'Mult' },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setTradeCategory(cat.key as TradeCategory)}
                  className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all ${
                    tradeCategory === cat.key
                      ? 'bg-red-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Category Specific Control Panel */}

            {/* 1. DIGITS SUBTYPES SELECTOR */}
            {tradeCategory === 'DIGITS' && (
              <div className="space-y-3 mb-4 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-900 rounded-lg">
                  {[
                    { key: 'MATCHES', label: 'Matches/Differs' },
                    { key: 'OVER_UNDER', label: 'Over/Under' },
                    { key: 'EVEN_ODD', label: 'Even/Odd' },
                  ].map((sub) => (
                    <button
                      key={sub.key}
                      onClick={() => setDigitSubtype(sub.key as any)}
                      className={`py-1 text-[10px] font-bold rounded ${
                        digitSubtype === sub.key ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {digitSubtype !== 'EVEN_ODD' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between mb-1">
                      <span>Prediction Target Digit (0-9)</span>
                      <span className="text-red-400 font-bold">Target: {targetDigit}</span>
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          onClick={() => setTargetDigit(d)}
                          className={`py-1 text-xs font-mono font-bold rounded-md border ${
                            targetDigit === d
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. ACCUMULATOR GROWTH RATE SELECTOR */}
            {tradeCategory === 'ACCUMULATOR' && (
              <div className="space-y-2 mb-4 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <label className="text-xs font-semibold text-slate-300 flex justify-between">
                  <span>Growth Rate per Tick</span>
                  <span className="text-amber-400 font-bold">{(growthRate * 100).toFixed(0)}%</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0.01, 0.02, 0.03, 0.04, 0.05].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setGrowthRate(rate)}
                      className={`py-1 rounded text-xs font-bold border ${
                        growthRate === rate
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {(rate * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. MULTIPLIER LEVERAGE SELECTOR */}
            {tradeCategory === 'MULTIPLIER' && (
              <div className="space-y-2 mb-4 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <label className="text-xs font-semibold text-slate-300 flex justify-between">
                  <span>Leverage Factor</span>
                  <span className="text-red-400 font-bold">x{multiplier}</span>
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {[10, 20, 50, 100, 200, 500].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(m)}
                      className={`py-1 rounded text-[11px] font-extrabold border ${
                        multiplier === m
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      x{m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration Selector (for Rise/Fall, Digits, Touch) */}
            {tradeCategory !== 'MULTIPLIER' && (
              <div className="space-y-1.5 mb-4">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Duration (Ticks)</span>
                  <span className="text-slate-400 font-mono text-[11px]">{durationTicks} Ticks</span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 3, 5, 8, 10].map((t) => (
                    <button
                      key={t}
                      onClick={() => setDurationTicks(t)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        durationTicks === t
                          ? 'bg-slate-800 border-red-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {t} T
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stake Input & Quick Percentage Shortcuts */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-semibold text-slate-300 flex justify-between">
                <span>Stake Amount ($)</span>
                <span className="text-slate-400 text-[11px]">Balance: ${balanceUsd.toFixed(2)}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Stake Quick Shortcuts */}
              <div className="flex space-x-1 pt-1">
                {[5, 10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setStake(amt)}
                    className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Payout Summary Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1 mb-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Estimated Return:</span>
                <span className="text-emerald-400 font-bold">
                  {tradeCategory === 'DIGITS' && digitSubtype === 'MATCHES' ? '885% (Digit Match)' :
                   tradeCategory === 'ACCUMULATOR' ? `Compound ${(growthRate * 100).toFixed(0)}%/tick` :
                   tradeCategory === 'MULTIPLIER' ? `x${multiplier} Leveraged` : '95% Payout'}
                </span>
              </div>
              <div className="flex justify-between text-slate-200 font-bold border-t border-slate-800 pt-1">
                <span>Net Profit Potential:</span>
                <span className="text-emerald-400 font-mono">
                  +${(stake * (tradeCategory === 'DIGITS' && digitSubtype === 'MATCHES' ? 7.85 : 0.95)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buy Buttons */}
          <div className="space-y-2 pt-1">
            {tradeCategory === 'RISE_FALL' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExecuteTrade('CALL')}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center space-y-0.5 transition-all"
                >
                  <div className="flex items-center space-x-1">
                    <ArrowUpRight className="w-5 h-5 stroke-[3]" />
                    <span>RISE / HIGHER</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-90">Win if spot finishes HIGHER</span>
                </button>

                <button
                  onClick={() => handleExecuteTrade('PUT')}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center space-y-0.5 transition-all"
                >
                  <div className="flex items-center space-x-1">
                    <ArrowDownRight className="w-5 h-5 stroke-[3]" />
                    <span>FALL / LOWER</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-90">Win if spot finishes LOWER</span>
                </button>
              </div>
            )}

            {tradeCategory === 'TOUCH_NO_TOUCH' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExecuteTrade('TOUCH')}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5"
                >
                  <Crosshair className="w-4 h-4" />
                  <span>TOUCH BARRIER</span>
                </button>
                <button
                  onClick={() => handleExecuteTrade('NOTOUCH')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>NO TOUCH</span>
                </button>
              </div>
            )}

            {tradeCategory === 'DIGITS' && (
              <div>
                {digitSubtype === 'MATCHES' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExecuteTrade('DIGITMATCH')}
                      className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow flex items-center justify-center space-x-1"
                    >
                      <span>MATCHES ({targetDigit})</span>
                    </button>
                    <button
                      onClick={() => handleExecuteTrade('DIGITDIFF')}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow flex items-center justify-center space-x-1"
                    >
                      <span>DIFFERS ({targetDigit})</span>
                    </button>
                  </div>
                )}

                {digitSubtype === 'OVER_UNDER' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExecuteTrade('DIGITOVER')}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow flex items-center justify-center space-x-1"
                    >
                      <span>OVER ({targetDigit})</span>
                    </button>
                    <button
                      onClick={() => handleExecuteTrade('DIGITUNDER')}
                      className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow flex items-center justify-center space-x-1"
                    >
                      <span>UNDER ({targetDigit})</span>
                    </button>
                  </div>
                )}

                {digitSubtype === 'EVEN_ODD' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExecuteTrade('DIGITEVEN')}
                      className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow"
                    >
                      <span>DIGIT EVEN</span>
                    </button>
                    <button
                      onClick={() => handleExecuteTrade('DIGITODD')}
                      className="py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow"
                    >
                      <span>DIGIT ODD</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {tradeCategory === 'ACCUMULATOR' && (
              <button
                onClick={() => handleExecuteTrade('ACCU')}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg shadow-amber-950/50 flex items-center justify-center space-x-2 transition-all"
              >
                <Flame className="w-5 h-5 fill-white" />
                <span>START ACCUMULATOR ({durationTicks} Ticks Auto-Scalp)</span>
              </button>
            )}

            {tradeCategory === 'MULTIPLIER' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExecuteTrade('MULT')}
                  className="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow"
                >
                  <span>BUY MULTIPLIER (LONG x{multiplier})</span>
                </button>
                <button
                  onClick={() => handleExecuteTrade('MULT')}
                  className="py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow"
                >
                  <span>SELL MULTIPLIER (SHORT x{multiplier})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active & Historical Contracts Table Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center space-x-2">
            <Clock className="w-5 h-5 text-red-500" />
            <span>Active & Settlement Contracts Monitor</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {activeContracts.length} Total Registered
          </span>
        </div>

        {activeContracts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No active or recent trade contracts. Select trade params and execute above to run the Deriv trading engine!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Contract ID</th>
                  <th className="p-3">Market</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Entry Spot</th>
                  <th className="p-3">Current Spot</th>
                  <th className="p-3">Stake</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Profit / Loss</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {activeContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-slate-300 font-bold">{c.id}</td>
                    <td className="p-3 text-white font-medium">{c.symbolName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        c.contractType.includes('CALL') || c.contractType.includes('HIGHER')
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {c.contractType}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{c.entrySpot.toFixed(4)}</td>
                    <td className="p-3 text-white font-bold">{c.currentSpot.toFixed(4)}</td>
                    <td className="p-3 text-slate-300">${c.stake.toFixed(2)}</td>
                    <td className="p-3">
                      {c.status === 'OPEN' && (
                        <span className="text-amber-400 font-bold flex items-center space-x-1 animate-pulse">
                          <span>OPEN ({c.remainingTicks}t)</span>
                        </span>
                      )}
                      {c.status === 'WON' && (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>WON</span>
                        </span>
                      )}
                      {c.status === 'LOST' && (
                        <span className="text-rose-400 font-bold flex items-center space-x-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>LOST</span>
                        </span>
                      )}
                      {c.status === 'SOLD' && (
                        <span className="text-slate-400 font-bold">EARLY CASH OUT</span>
                      )}
                    </td>
                    <td className={`p-3 font-bold ${
                      c.currentProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {c.currentProfit >= 0 ? '+' : ''}${c.currentProfit.toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      {c.status === 'OPEN' && (
                        <button
                          onClick={() => handleSellContract(c.id)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] rounded-lg transition-colors"
                        >
                          Cash Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
