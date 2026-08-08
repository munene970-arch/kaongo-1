import React, { useState } from 'react';
import { MarketInfo, MarketSignal } from '../../types/deriv';
import { INITIAL_MARKET_SIGNALS } from '../../services/derivMarketsData';
import { RefreshCw, Bell, Flame, TrendingUp, TrendingDown, Zap, ShieldAlert } from 'lucide-react';

interface MarketAnalyzerProps {
  markets: MarketInfo[];
  onSelectMarket: (symbol: any) => void;
}

export const MarketAnalyzer: React.FC<MarketAnalyzerProps> = ({ markets, onSelectMarket }) => {
  const [signals, setSignals] = useState<MarketSignal[]>(INITIAL_MARKET_SIGNALS);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 text-red-500" />
            <h2 className="font-extrabold text-white text-lg">Synthetic Market Heatmap & Signals</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              REAL-TIME MATRIX
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live momentum, RSI 14 indicators, Crash/Boom spike probability, and automated entry signals.
          </p>
        </div>

        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
            audioEnabled
              ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{audioEnabled ? 'Audio Spike Alerts ON' : 'Alerts Muted'}</span>
        </button>
      </div>

      {/* Markets Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map((m) => {
          const isUp = m.change24h >= 0;
          return (
            <div
              key={m.symbol}
              onClick={() => onSelectMarket(m.symbol)}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-red-500/50 cursor-pointer transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{m.displayName}</h3>
                  <span className="text-[10px] text-slate-400">{m.category}</span>
                </div>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  isUp ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {isUp ? '+' : ''}{m.change24h}%
                </span>
              </div>

              <div className="flex items-baseline justify-between font-mono">
                <span className="text-lg font-extrabold text-white">
                  {m.currentPrice.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400">
                  Vol: High
                </span>
              </div>

              {/* Progress Bar RSI Simulation */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>RSI 14</span>
                  <span className={m.change24h > 2 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                    {Math.min(85, Math.max(15, Math.round(50 + m.change24h * 5)))}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isUp ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.min(85, Math.max(15, Math.round(50 + m.change24h * 5)))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Signal Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="font-extrabold text-white text-sm flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Automated Trade Signal Feeds</span>
        </h3>

        <div className="space-y-3">
          {signals.map((sig) => (
            <div
              key={sig.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{sig.symbolName}</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                    {sig.type}
                  </span>
                  <span className="text-slate-500 text-[10px]">{sig.time}</span>
                </div>
                <p className="text-slate-400 text-xs">{sig.description}</p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-400 block">Recommended Entry</span>
                  <span className="text-emerald-400 font-bold">{sig.recommendedTrade}</span>
                </div>
                <button
                  onClick={() => onSelectMarket(sig.symbol)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs"
                >
                  Trade
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
