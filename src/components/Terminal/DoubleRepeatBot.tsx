import React, { useEffect, useState } from 'react';
import { MarketSymbol } from '../../types/deriv';
import { doubleRepeatStrategy, DoubleRepeatStatus } from '../../services/doubleRepeatStrategy';
import { Play, Square, Zap } from 'lucide-react';

interface Props {
  symbol: MarketSymbol;
  balance: number;
}

export const DoubleRepeatBot: React.FC<Props> = ({ symbol, balance }) => {
  const [stake, setStake] = useState(10);
  const [status, setStatus] = useState<DoubleRepeatStatus>(doubleRepeatStrategy.getStatus());

  useEffect(() => doubleRepeatStrategy.subscribeStatus(setStatus), []);
  useEffect(() => {
    doubleRepeatStrategy.setSymbol(symbol);
  }, [symbol]);

  const start = () => {
    if (stake <= 0 || stake > balance) return;
    doubleRepeatStrategy.setStake(stake);
    doubleRepeatStrategy.start(symbol, stake);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-white">Double-Repeat DIFFERS Bot</h3>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${status.running ? 'text-emerald-300 bg-emerald-950 border-emerald-800' : 'text-slate-400 bg-slate-950 border-slate-800'}`}>
              {status.running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Detects X X Y (Y ≠ X) → buys DIGITDIFF Y → 1 tick expiry.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-400">Stake</label>
          <input
            type="number"
            min="0.35"
            step="0.01"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value) || 0)}
            disabled={status.running}
            className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white outline-none focus:border-red-500 disabled:opacity-50"
          />
          {!status.running ? (
            <button onClick={start} disabled={stake <= 0 || stake > balance} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black rounded-lg flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 fill-current" /> Start Bot
            </button>
          ) : (
            <button onClick={() => doubleRepeatStrategy.stop()} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 fill-current" /> Stop Bot
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-[11px] font-mono">
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2"><span className="text-slate-500">Market</span><div className="text-white font-bold">{symbol}</div></div>
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2"><span className="text-slate-500">Ticks</span><div className="text-white font-bold">{status.ticksSeen}</div></div>
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2"><span className="text-slate-500">Signals</span><div className="text-white font-bold">{status.trades}</div></div>
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2"><span className="text-slate-500">Prediction</span><div className="text-emerald-400 font-bold">{status.lastPrediction ?? '—'}</div></div>
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-2 col-span-2 md:col-span-1"><span className="text-slate-500">Engine</span><div className="text-white font-bold truncate">{status.lastMessage}</div></div>
      </div>
    </div>
  );
};
