import React, { useState } from 'react';
import { MarketInfo, MarketSymbol } from '../../types/deriv';
import { Key, Sparkles, Send, ShieldAlert, TrendingUp, CheckCircle, HelpCircle } from 'lucide-react';

interface AICopilotPanelProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  balanceUsd: number;
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  markets,
  selectedSymbol,
  balanceUsd,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const currentMarket = markets.find((m) => m.symbol === selectedSymbol) || markets[0];

  const handleRunAiAnalysis = async (customPrompt?: string) => {
    setLoading(true);
    setAnalysisResult(null);

    const queryPrompt = customPrompt || prompt || `Analyze current market conditions for ${currentMarket.displayName}`;

    try {
      const res = await fetch('/api/ai/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: currentMarket.displayName,
          ticks: [
            { quote: currentMarket.currentPrice * 0.999 },
            { quote: currentMarket.currentPrice * 1.0001 },
            { quote: currentMarket.currentPrice },
          ],
          timeframe: '1m',
          indicatorSummary: {
            rsi: 62,
            ema10VsEma50: 'Bullish Crossover',
            volatility: 'High',
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setAnalysisResult(data.data);
      } else {
        alert('AI analysis service response error');
      }
    } catch (e: any) {
      console.error('AI Copilot error:', e);
      alert('Failed to connect to AI server endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const promptPills = [
    `Analyze ${currentMarket.displayName} trend & entry point`,
    `Calculate safe stake size for $${balanceUsd} balance`,
    `Is ${currentMarket.displayName} ready for a spike or breakout?`,
    `Optimal DBot settings for ${currentMarket.displayName}`,
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Key className="w-6 h-6 text-purple-400" />
            <h2 className="font-extrabold text-white text-lg">Deriv AI Trade Copilot</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
              GEMINI 3.6 FLASH
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time server-side AI market analysis, strategy advisor, and risk manager.
          </p>
        </div>

        <button
          onClick={() => handleRunAiAnalysis()}
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2 transition-all"
        >
          <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analyzing Market...' : 'Run Full AI Analysis'}</span>
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {promptPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => handleRunAiAnalysis(pill)}
            className="p-3 bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-xl text-left text-xs text-slate-300 font-medium transition-all"
          >
            <div className="flex items-center space-x-1 text-purple-400 mb-1">
              <Sparkles className="w-3 h-3" />
              <span className="text-[10px] uppercase font-bold">Quick Analysis</span>
            </div>
            <span>{pill}</span>
          </button>
        ))}
      </div>

      {/* Custom Prompt Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center space-x-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Gemini AI anything about Deriv markets, DBot strategies, or risk rules..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={() => handleRunAiAnalysis()}
          disabled={loading}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-1"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask AI</span>
        </button>
      </div>

      {/* AI Structured Results Card */}
      {analysisResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="font-extrabold text-white text-base">
                AI Analysis Report for {analysisResult.symbol}
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                analysisResult.bias === 'BULLISH'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : analysisResult.bias === 'BEARISH'
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                BIAS: {analysisResult.bias}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                Confidence: {analysisResult.confidence}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Recommended Strategy</span>
              <span className="text-purple-400 font-bold text-sm">{analysisResult.recommendedStrategy}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Suggested Entry</span>
              <span className="text-white font-bold text-sm">{analysisResult.suggestedEntry}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Risk Rating</span>
              <span className="text-amber-400 font-bold text-sm">{analysisResult.riskLevel}</span>
            </div>
          </div>

          {/* Observations & Reasoning */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
              Key Market Observations & Reasoning
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
              {analysisResult.keyObservation}
            </p>

            {analysisResult.reasoningPoints && (
              <ul className="space-y-1.5 text-xs text-slate-400">
                {analysisResult.reasoningPoints.map((pt: string, idx: number) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
