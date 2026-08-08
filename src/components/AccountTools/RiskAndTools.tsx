import React, { useState } from 'react';
import { Wallet, Calculator, Download, ShieldAlert, ArrowRightLeft, DollarSign } from 'lucide-react';

export const RiskAndTools: React.FC = () => {
  // P2P Currency Calculator state
  const [amountUsd, setAmountUsd] = useState<number>(100);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('KES');
  const [mode, setMode] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');

  // Martingale Calculator state
  const [initialStake, setInitialStake] = useState<number>(2);
  const [multiplier, setMultiplier] = useState<number>(2.1);
  const [steps, setSteps] = useState<number>(6);

  const p2pRates: Record<string, { name: string; symbol: string; buyRate: number; sellRate: number; methods: string }> = {
    'KES': { name: 'Kenyan Shilling', symbol: 'KSh', buyRate: 132.50, sellRate: 130.20, methods: 'M-Pesa, Bank Transfer, Airtel Money' },
    'NGN': { name: 'Nigerian Naira', symbol: '₦', buyRate: 1520.00, sellRate: 1490.00, methods: 'Bank Transfer, Kuda, Chipper' },
    'ZAR': { name: 'South African Rand', symbol: 'R', buyRate: 18.40, sellRate: 18.10, methods: 'EFT, Ozow, Capitec' },
    'IDR': { name: 'Indonesian Rupiah', symbol: 'Rp', buyRate: 16250.00, sellRate: 15980.00, methods: 'DANA, GoPay, OVO, Bank' },
    'BRL': { name: 'Brazilian Real', symbol: 'R$', buyRate: 5.65, sellRate: 5.48, methods: 'PIX, Bank Transfer' },
    'INR': { name: 'Indian Rupee', symbol: '₹', buyRate: 86.20, sellRate: 84.50, methods: 'UPI, PhonePe, Paytm, IMPS' },
    'PHP': { name: 'Philippine Peso', symbol: '₱', buyRate: 58.80, sellRate: 57.50, methods: 'GCash, Maya, Bank Transfer' },
  };

  const currentP2p = p2pRates[selectedCurrency] || p2pRates['KES'];
  const activeRate = mode === 'DEPOSIT' ? currentP2p.buyRate : currentP2p.sellRate;
  const convertedTotal = (amountUsd * activeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Martingale Step Matrix Calculation
  const martingaleMatrix = [];
  let accumulativeRisk = 0;
  let currentStepStake = initialStake;

  for (let i = 1; i <= steps; i++) {
    accumulativeRisk += currentStepStake;
    martingaleMatrix.push({
      step: i,
      stake: currentStepStake.toFixed(2),
      totalLossIfFailed: accumulativeRisk.toFixed(2),
    });
    currentStepStake = parseFloat((currentStepStake * multiplier).toFixed(2));
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Wallet className="w-6 h-6 text-red-500" />
            <h2 className="font-extrabold text-white text-lg">Deriv P2P & Risk Calculator Tools</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              ACCOUNT UTILITIES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Local currency deposit/withdrawal rate conversions and Martingale safety buffer calculations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Deriv P2P Currency Conversion Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>Deriv P2P Rate Calculator</span>
            </h3>
            <div className="flex space-x-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setMode('DEPOSIT')}
                className={`px-3 py-1 font-bold rounded-lg ${
                  mode === 'DEPOSIT' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setMode('WITHDRAWAL')}
                className={`px-3 py-1 font-bold rounded-lg ${
                  mode === 'WITHDRAWAL' ? 'bg-rose-600 text-white' : 'text-slate-400'
                }`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Amount in USD ($)
              </label>
              <input
                type="number"
                value={amountUsd}
                onChange={(e) => setAmountUsd(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Select Local Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
              >
                {Object.keys(p2pRates).map((cur) => (
                  <option key={cur} value={cur}>
                    {cur} - {p2pRates[cur].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Calculated Output Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                Estimated {mode} Equivalent
              </span>
              <div className="text-2xl font-mono font-extrabold text-emerald-400">
                {currentP2p.symbol} {convertedTotal}
              </div>
              <span className="text-[11px] text-slate-500 block">
                P2P Merchant Rate: 1 USD = {activeRate} {selectedCurrency}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">Supported P2P Payment Methods:</div>
              <div>{currentP2p.methods}</div>
            </div>
          </div>
        </div>

        {/* Martingale Safety Matrix Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>Martingale Drawdown Safety Matrix</span>
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Initial ($)</label>
              <input
                type="number"
                value={initialStake}
                onChange={(e) => setInitialStake(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Steps</label>
              <input
                type="number"
                max={10}
                value={steps}
                onChange={(e) => setSteps(Math.min(10, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-2.5">Loss Step</th>
                  <th className="p-2.5">Required Stake ($)</th>
                  <th className="p-2.5 text-right">Cumulative Capital Lost ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {martingaleMatrix.map((row) => (
                  <tr key={row.step} className="hover:bg-slate-900/50">
                    <td className="p-2.5 text-slate-300 font-bold">Step #{row.step}</td>
                    <td className="p-2.5 text-white">${row.stake}</td>
                    <td className="p-2.5 text-rose-400 font-bold text-right">${row.totalLossIfFailed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <p>
              To survive {steps} consecutive losses with multiplier {multiplier}x, your Deriv account requires at least <strong className="text-white font-mono">${accumulativeRisk.toFixed(2)} USD</strong> buffer capital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
