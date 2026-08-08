import React, { useState } from 'react';
import { MasterTrader } from '../../types/deriv';
import { INITIAL_MASTER_TRADERS } from '../../services/derivMarketsData';
import { Shield, UserPlus, Check, Sliders, Users, Award, TrendingUp, AlertTriangle } from 'lucide-react';

interface CopyTradingHubProps {
  balanceUsd: number;
}

export const CopyTradingHub: React.FC<CopyTradingHubProps> = ({ balanceUsd }) => {
  const [traders, setTraders] = useState<MasterTrader[]>(INITIAL_MASTER_TRADERS);
  const [selectedTrader, setSelectedTrader] = useState<MasterTrader | null>(null);
  const [allocationUsd, setAllocationUsd] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [maxLossUsd, setMaxLossUsd] = useState<number>(50);

  const handleStartCopy = () => {
    if (!selectedTrader) return;

    setTraders((prev) =>
      prev.map((t) =>
        t.id === selectedTrader.id
          ? {
              ...t,
              isFollowing: true,
              copySettings: {
                allocationUsd,
                multiplier,
                maxLossUsd,
              },
            }
          : t
      )
    );

    setSelectedTrader(null);
  };

  const handleStopCopy = (traderId: string) => {
    setTraders((prev) =>
      prev.map((t) => (t.id === traderId ? { ...t, isFollowing: false } : t))
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-red-500" />
            <h2 className="font-extrabold text-white text-lg">Deriv Master Copy Trading</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              MIRROR ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automatically replicate high-winrate synthetic index trades executed by top verified Deriv quants.
          </p>
        </div>

        <div className="flex items-center space-x-4 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-xs">
          <Users className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-slate-400 block text-[10px]">Active Master Copiers</span>
            <span className="font-mono text-white font-bold">5,595 Traders</span>
          </div>
        </div>
      </div>

      {/* Master Trader Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {traders.map((t) => (
          <div
            key={t.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 hover:border-slate-700 transition-all"
          >
            {/* Header / Avatar info */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-slate-700"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-base">{t.name}</h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{t.specialtyMarket}</p>
                </div>
              </div>

              {/* Risk Badge */}
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">Risk Score</span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  t.riskScore <= 3 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {t.riskScore} / 10
                </span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[10px] block">30D ROI</span>
                <span className="text-emerald-400 font-bold text-sm">+{t.totalRoi30d}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Win Rate</span>
                <span className="text-white font-bold text-sm">{t.winRate}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Copiers</span>
                <span className="text-slate-300 font-bold text-sm">{t.copiersCount}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Max DD: <span className="text-slate-200 font-mono font-bold">{t.maxDrawdown}%</span>
              </div>

              {t.isFollowing ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                    <Check className="w-4 h-4" />
                    <span>Copying</span>
                  </span>
                  <button
                    onClick={() => handleStopCopy(t.id)}
                    className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold rounded-xl"
                  >
                    Pause
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedTrader(t)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Copy Master</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Copy Settings Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-base">Copy Trader: {selectedTrader.name}</h3>
              </div>
              <button
                onClick={() => setSelectedTrader(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Copy Allocation ($)
                </label>
                <input
                  type="number"
                  value={allocationUsd}
                  onChange={(e) => setAllocationUsd(parseFloat(e.target.value) || 10)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Stake Proportion Multiplier
                </label>
                <select
                  value={multiplier}
                  onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                >
                  <option value={0.5}>0.5x (Half Master Stake)</option>
                  <option value={1}>1.0x (Exact Mirror)</option>
                  <option value={2}>2.0x (Double Master Stake)</option>
                </select>
              </div>

              <div>
                <label className="text-rose-400 font-semibold block mb-1">
                  Maximum Loss Buffer ($)
                </label>
                <input
                  type="number"
                  value={maxLossUsd}
                  onChange={(e) => setMaxLossUsd(parseFloat(e.target.value) || 10)}
                  className="w-full bg-slate-950 border border-rose-800 rounded-xl px-3 py-2 text-rose-400 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedTrader(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleStartCopy}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg"
              >
                Activate Mirror Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
