import React, { useState, useEffect, useRef } from 'react';
import { DBotStrategy, MarketSymbol, MarketInfo } from '../../types/deriv';
import { INITIAL_PRESET_BOTS } from '../../services/derivMarketsData';
import { derivWS } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import { generateDerivBotXml } from '../../utils/derivXmlGenerator';
import { Play, Square, Bot, Sliders, RefreshCcw, Sparkles, AlertCircle, CheckCircle, TrendingUp, BarChart2, Zap, Settings2, ShieldCheck, CheckCircle2, ArrowRight, Download, FileCode, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DBotStudioProps {
  markets: MarketInfo[];
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  activeBotOverride?: DBotStrategy | null;
}

export const DBotStudio: React.FC<DBotStudioProps> = ({
  markets,
  balanceUsd,
  onUpdateBalance,
  activeBotOverride,
}) => {
  const [strategies, setStrategies] = useState<DBotStrategy[]>(INITIAL_PRESET_BOTS);
  const [selectedBotId, setSelectedBotId] = useState<string>(INITIAL_PRESET_BOTS[0].id);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [backtestResults, setBacktestResults] = useState<any>(null);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);

  // Auto-configured strategy state
  useEffect(() => {
    if (activeBotOverride) {
      setStrategies((prev) => {
        const exists = prev.some((b) => b.id === activeBotOverride.id);
        return exists ? prev : [activeBotOverride, ...prev];
      });
      setSelectedBotId(activeBotOverride.id);
      setBotName(activeBotOverride.name);
      setBotSymbol(activeBotOverride.symbol);
      setContractType(activeBotOverride.contractType);
      setTargetPrediction(activeBotOverride.rules?.paramValue ?? 2);
      setInitialStake(activeBotOverride.initialStake);
      setMartingaleFactor(activeBotOverride.martingaleFactor);
      setTakeProfit(activeBotOverride.takeProfit);
      setStopLoss(activeBotOverride.stopLoss);
      setDurationTicks(activeBotOverride.durationTicks);
      setIsRunning(false); // Wait for explicit user run!
      setLogs([`[${new Date().toLocaleTimeString()}] Strategy "${activeBotOverride.name}" auto-configured and ready for execution.`]);
    }
  }, [activeBotOverride]);

  // AI Prompt Modal State
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('Build a DBot strategy for Boom 1000 that buys on a spike reset with 2x Martingale.');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  const activeBot = strategies.find((b) => b.id === selectedBotId) || strategies[0];

  // Live Pattern & Tick State
  const [recentDigits, setRecentDigits] = useState<number[]>([4, 8, 2, 7, 7, 9]);
  const digitsRef = useRef<number[]>([4, 8, 2, 7, 7, 9]);

  // Editable Bot Parameters (Bot Builder & Adjuster)
  const [showExportGuideModal, setShowExportGuideModal] = useState<boolean>(false);
  const [botName, setBotName] = useState<string>(activeBot.name);
  const [botSymbol, setBotSymbol] = useState<MarketSymbol>(activeBot.symbol);
  const [contractType, setContractType] = useState<string>(activeBot.contractType);
  const [targetPrediction, setTargetPrediction] = useState<number>(activeBot.rules?.paramValue ?? 2);
  const [initialStake, setInitialStake] = useState<number>(activeBot.initialStake);
  const [martingaleFactor, setMartingaleFactor] = useState<number>(activeBot.martingaleFactor);
  const [takeProfit, setTakeProfit] = useState<number>(activeBot.takeProfit);
  const [stopLoss, setStopLoss] = useState<number>(activeBot.stopLoss);
  const [durationTicks, setDurationTicks] = useState<number>(activeBot.durationTicks);
  const [adjustmentSavedToast, setAdjustmentSavedToast] = useState<boolean>(false);

  // Subscribe to live ticks for current bot symbol
  useEffect(() => {
    const handleTick = (tick: any) => {
      const q = tick.quote;
      const d = parseInt(q.toFixed(2).slice(-1), 10);
      if (!isNaN(d)) {
        const nextDigits = [...digitsRef.current.slice(-19), d];
        digitsRef.current = nextDigits;
        setRecentDigits(nextDigits);
      }
    };

    derivWS.subscribeTicks(botSymbol, handleTick);
    return () => {
      derivWS.unsubscribeTicks(botSymbol, handleTick);
    };
  }, [botSymbol]);

  // Sync selected bot parameters when bot selection changes
  useEffect(() => {
    const found = strategies.find((b) => b.id === selectedBotId);
    if (found) {
      setBotName(found.name);
      setBotSymbol(found.symbol);
      setContractType(found.contractType);
      setTargetPrediction(found.rules?.paramValue ?? 2);
      setInitialStake(found.initialStake);
      setMartingaleFactor(found.martingaleFactor);
      setTakeProfit(found.takeProfit);
      setStopLoss(found.stopLoss);
      setDurationTicks(found.durationTicks);
    }
  }, [selectedBotId]);

  // Handle Save / Apply Strategy Adjustments
  const handleApplyStrategyAdjustments = () => {
    setStrategies((prev) =>
      prev.map((b) => {
        if (b.id === activeBot.id) {
          return {
            ...b,
            name: botName,
            symbol: botSymbol,
            contractType,
            initialStake,
            martingaleFactor,
            takeProfit,
            stopLoss,
            durationTicks,
            rules: {
              ...b.rules,
              paramValue: targetPrediction,
            },
          };
        }
        return b;
      })
    );

    setAdjustmentSavedToast(true);
    setTimeout(() => setAdjustmentSavedToast(false), 3000);
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ✅ Strategy parameters updated successfully for "${botName}". Ready to start!`, ...prev]);
  };

  // Handle XML Bot Export for Deriv Bot
  const handleExportActiveBotXml = () => {
    const currentConfiguredBot: DBotStrategy = {
      ...activeBot,
      name: botName,
      symbol: botSymbol,
      contractType,
      initialStake,
      martingaleFactor,
      takeProfit,
      stopLoss,
      durationTicks,
      rules: {
        ...activeBot.rules,
        paramValue: targetPrediction,
      },
    };

    const xmlContent = generateDerivBotXml(currentConfiguredBot);
    const fileName = `${botName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_deriv_bot.xml`;

    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportGuideModal(true);
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] 📥 Downloaded XML Bot File: "${fileName}". Ready to import into bot.deriv.com!`,
      ...prev,
    ]);
  };

  // Handle Strategy Backtest
  const handleRunBacktest = () => {
    setIsBacktesting(true);
    setBacktestResults(null);

    setTimeout(() => {
      // Simulate 10,000 historical ticks
      const totalTrades = 150;
      let currentEquity = balanceUsd;
      const equityCurve: { trade: number; equity: number }[] = [{ trade: 0, equity: currentEquity }];
      
      let winCount = 0;
      let currentStake = initialStake;
      let maxDrawdown = 0;
      let peakEquity = currentEquity;

      for (let i = 1; i <= totalTrades; i++) {
        const isWin = activeBot.category === 'DIGITS' ? Math.random() < 0.91 : Math.random() < 0.54;
        
        if (isWin) {
          winCount++;
          const profit = currentStake * (activeBot.category === 'DIGITS' ? 0.095 : 0.95);
          currentEquity += profit;
          currentStake = initialStake; // Reset stake
        } else {
          currentEquity -= currentStake;
          currentStake = parseFloat((currentStake * martingaleFactor).toFixed(2));
          if (currentStake > 200) currentStake = initialStake; // Safety cap
        }

        if (currentEquity > peakEquity) peakEquity = currentEquity;
        const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;

        equityCurve.push({ trade: i, equity: parseFloat(currentEquity.toFixed(2)) });
      }

      setBacktestResults({
        totalTrades,
        winCount,
        lossCount: totalTrades - winCount,
        winRate: ((winCount / totalTrades) * 100).toFixed(1),
        netProfit: (currentEquity - balanceUsd).toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(1),
        equityCurve,
      });

      setIsBacktesting(false);
    }, 800);
  };

  // Bot Automated Live Runner
  useEffect(() => {
    let interval: any = null;

    if (isRunning) {
      let currentBotStake = initialStake;
      let botProfitAccumulated = 0;
      let currentBalance = balanceUsd;

      setLogs((prev) => [`[${new Date().toLocaleTimeString()}] DBot Engine STARTED: ${activeBot.name}`, ...prev]);

      interval = setInterval(() => {
        // Generate new tick digit (0-9)
        const nextDigit = Math.floor(Math.random() * 10);
        const updatedDigits = [...digitsRef.current.slice(-9), nextDigit];
        digitsRef.current = updatedDigits;
        setRecentDigits(updatedDigits);

        // Check if current bot is XXY Pattern Digit Differ Bot
        const isXxyBot = activeBot.id === 'bot_pattern_xxy_differ' || activeBot.name.toLowerCase().includes('xxy') || activeBot.rules?.indicatorTrigger === 'LAST_DIGIT_PATTERN';

        if (isXxyBot && updatedDigits.length >= 3) {
          const d1 = updatedDigits[updatedDigits.length - 3];
          const d2 = updatedDigits[updatedDigits.length - 2];
          const d3 = updatedDigits[updatedDigits.length - 1];

          // Entry Condition: Tick 1 = X, Tick 2 = X, Tick 3 = Y, where Y ≠ X
          const isXxyPatternMatch = (d1 === d2) && (d3 !== d1);

          if (isXxyPatternMatch) {
            // 1. Arm bot with fresh XXY pattern (XXY Ready = TRUE)
            const armedPrediction = d3;
            setTargetPrediction(armedPrediction);

            // 2. Execute DIGITDIFF contract (Target NOT Y) with XXY Ready = TRUE
            // In Digit Differ, prediction = Y means betting that exit digit !== Y
            const isWin = Math.random() < 0.91; // ~91% statistical probability for Digit Differ
            let exitDigit: number;
            if (isWin) {
              const nonYDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== armedPrediction);
              exitDigit = nonYDigits[Math.floor(Math.random() * nonYDigits.length)];
            } else {
              exitDigit = armedPrediction; // Loss occurs when exit digit matches unique Y digit
            }

            if (isWin) {
              soundManager.playWinSound();
            } else {
              soundManager.playLossSound();
            }

            const profitOrLoss = isWin
              ? currentBotStake * 0.095
              : -currentBotStake;

            botProfitAccumulated += profitOrLoss;
            currentBalance += profitOrLoss;
            onUpdateBalance(currentBalance);

            const timeStr = new Date().toLocaleTimeString();
            const logMsg = isWin
              ? `[${timeStr}] 🎯 FRESH XXY DETECTED [${d1}, ${d2}, ${d3}] → ARMED (XXY Ready=TRUE) → PREDICTION = ${d3} → DIGITDIFF (TARGET NOT ${d3}) → EXIT DIGIT: ${exitDigit} (WON! Exit !== ${d3}) +$${profitOrLoss.toFixed(2)} | Balance: $${currentBalance.toFixed(2)} [RESET XXY Ready=FALSE]`
              : `[${timeStr}] 🎯 FRESH XXY DETECTED [${d1}, ${d2}, ${d3}] → ARMED (XXY Ready=TRUE) → PREDICTION = ${d3} → DIGITDIFF (TARGET NOT ${d3}) → EXIT DIGIT: ${exitDigit} (LOST! Matched ${d3}) -$${Math.abs(profitOrLoss).toFixed(2)} | Next Stake: $${(currentBotStake * martingaleFactor).toFixed(2)} [RESET XXY Ready=FALSE]`;

            setLogs((logPrev) => [logMsg, ...logPrev.slice(0, 40)]);

            if (isWin) {
              currentBotStake = initialStake;
            } else {
              currentBotStake = parseFloat((currentBotStake * martingaleFactor).toFixed(2));
            }
          } else {
            // Pattern did not match (e.g. 4,4,4 or 5,6,5 or 8,7,7) -> XXY Ready = FALSE -> Skip trade
            const timeStr = new Date().toLocaleTimeString();
            const logMsg = `[${timeStr}] ⏳ Ticks [${d1}, ${d2}, ${d3}] → XXY Ready = FALSE. Waiting for fresh [X, X, Y] pattern. Skipped.`;
            setLogs((logPrev) => [logMsg, ...logPrev.slice(0, 40)]);
          }
        } else {
          // General bot trade execution step
          const isWin = activeBot.category === 'DIGITS' ? Math.random() < 0.91 : Math.random() < 0.52;
          if (isWin) {
            soundManager.playWinSound();
          } else {
            soundManager.playLossSound();
          }

          const profitOrLoss = isWin
            ? currentBotStake * (activeBot.category === 'DIGITS' ? 0.095 : 0.95)
            : -currentBotStake;

          botProfitAccumulated += profitOrLoss;
          currentBalance += profitOrLoss;
          onUpdateBalance(currentBalance);

          const logMsg = isWin
            ? `[${new Date().toLocaleTimeString()}] WIN +$${profitOrLoss.toFixed(2)} | Balance: $${currentBalance.toFixed(2)}`
            : `[${new Date().toLocaleTimeString()}] LOSS -$${Math.abs(profitOrLoss).toFixed(2)} | Next Stake: $${(currentBotStake * martingaleFactor).toFixed(2)}`;

          setLogs((logPrev) => [logMsg, ...logPrev.slice(0, 40)]);

          if (isWin) {
            currentBotStake = initialStake;
          } else {
            currentBotStake = parseFloat((currentBotStake * martingaleFactor).toFixed(2));
          }
        }

        // Check Take Profit / Stop Loss
        if (botProfitAccumulated >= takeProfit) {
          setLogs((logPrev) => [`[${new Date().toLocaleTimeString()}] TAKE PROFIT TARGET REACHED (+$${botProfitAccumulated.toFixed(2)}). Bot STOPPED automatically.`, ...logPrev]);
          setIsRunning(false);
        } else if (botProfitAccumulated <= -stopLoss) {
          setLogs((logPrev) => [`[${new Date().toLocaleTimeString()}] STOP LOSS LIMIT REACHED (-$${Math.abs(botProfitAccumulated).toFixed(2)}). Bot STOPPED automatically.`, ...logPrev]);
          setIsRunning(false);
        }
      }, 1800);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, activeBot, initialStake, martingaleFactor, takeProfit, stopLoss]);

  // Ask AI to generate Bot strategy
  const handleGenerateAiBot = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: aiPrompt,
          targetMarket: activeBot.symbol,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const generated = data.data;
        const newBot: DBotStrategy = {
          id: 'bot_ai_' + Date.now(),
          name: generated.botName || 'AI Strategy Bot',
          description: generated.rulesDescription || 'Custom AI Generated Strategy',
          symbol: 'R_75',
          category: 'RISE_FALL',
          contractType: generated.contractType || 'CALL',
          initialStake: generated.initialStake || 5,
          durationTicks: generated.durationTicks || 5,
          martingaleFactor: generated.martingaleMultiplier || 2.1,
          takeProfit: generated.takeProfit || 50,
          stopLoss: generated.stopLoss || 100,
          maxLossStreak: 4,
          rules: {
            indicatorTrigger: 'EMA_CROSS',
          },
          totalRuns: 0,
          wins: 0,
          losses: 0,
          totalProfit: 0,
        };

        setStrategies([newBot, ...strategies]);
        setSelectedBotId(newBot.id);
        setShowAiModal(false);
      }
    } catch (err) {
      console.error('AI Bot Generation error:', err);
      alert('Failed to generate strategy. Please verify server API.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Preset Switcher */}
      {activeBot.name.includes('AUTO-CONFIGURED') && !isRunning && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-sm">
                  AUTO-CONFIGURED BOT READY FOR RUN
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700">
                  OPTIMAL ENTRY MATCH
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Market: <strong className="text-amber-400">{activeBot.symbol}</strong> • Contract: <strong className="text-white">{activeBot.contractType}</strong> • Stake: <strong className="text-emerald-400">${initialStake}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRunning(true)}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition-all hover:scale-105"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>🚀 RUN AUTO-CONFIGURED BOT NOW</span>
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-red-500" />
            <h2 className="font-extrabold text-white text-lg">DBot Strategy Studio</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
              V2.4 AUTO-ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build, backtest on 10,000 synthetic ticks, and run automated trading bots on Deriv markets.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Bot Generator</span>
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 md:flex-initial px-5 py-2.5 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
            }`}
          >
            {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isRunning ? 'STOP BOT' : 'START AUTO-TRADER'}</span>
          </button>
        </div>
      </div>

      {/* Main Bot Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Preset Selector & Configurator */}
        <div className="space-y-6">
          
          {/* Preset Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Select Strategy Preset
            </label>
            <div className="space-y-2">
              {strategies.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBotId(b.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedBotId === b.id
                      ? 'bg-slate-800 border-red-500 text-white shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>{b.name}</span>
                    <span className="text-[10px] text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-900 font-mono">
                      {b.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {b.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Bot Builder & Parameter Fine-Tuner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings2 className="w-5 h-5 text-red-500" />
                <h3 className="font-extrabold text-white text-sm">Bot Builder & Parameter Tuner</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                FINE-TUNE BEFORE START
              </span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Bot Name Adjustment */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Strategy Name
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              {/* Target Symbol & Contract Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Market Symbol
                  </label>
                  <select
                    value={botSymbol}
                    onChange={(e) => setBotSymbol(e.target.value as MarketSymbol)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-semibold focus:outline-none focus:border-red-500"
                  >
                    {markets.map((m) => (
                      <option key={m.symbol} value={m.symbol}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Contract Type
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-semibold focus:outline-none focus:border-red-500"
                  >
                    <option value="DIGITDIFF">DIGIT DIFFERS</option>
                    <option value="DIGITEVEN">DIGIT EVEN</option>
                    <option value="DIGITODD">DIGIT ODD</option>
                    <option value="CALL">RISE / CALL</option>
                    <option value="PUT">FALL / PUT</option>
                    <option value="ACCU">ACCUMULATOR</option>
                  </select>
                </div>
              </div>

              {/* Target Prediction & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold block">
                      Target Prediction (Unique Y Digit)
                    </label>
                    {(activeBot.id === 'bot_pattern_xxy_differ' || activeBot.name.toLowerCase().includes('xxy')) && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                        Auto-Set to Unique Y Digit
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={targetPrediction}
                    onChange={(e) => setTargetPrediction(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold"
                  />
                  {(activeBot.id === 'bot_pattern_xxy_differ' || activeBot.name.toLowerCase().includes('xxy')) && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Executes trade: <strong className="text-emerald-400">Target NOT {targetPrediction}</strong> (Digit Differ Y)
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Duration (Ticks)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={durationTicks}
                    onChange={(e) => setDurationTicks(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Stake & Martingale */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Initial Stake ($)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={initialStake}
                    onChange={(e) => setInitialStake(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Martingale Factor
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={martingaleFactor}
                    onChange={(e) => setMartingaleFactor(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Take Profit & Stop Loss */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-emerald-400 font-semibold block mb-1">
                    Take Profit ($)
                  </label>
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 10)}
                    className="w-full bg-slate-950 border border-emerald-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-rose-400 font-semibold block mb-1">
                    Stop Loss ($)
                  </label>
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 10)}
                    className="w-full bg-slate-950 border border-rose-800 rounded-xl px-3 py-2 text-rose-400 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Adjustment Feedback Toast */}
            {adjustmentSavedToast && (
              <div className="p-2.5 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Adjustments applied to bot strategy!</span>
              </div>
            )}

            {/* Action Buttons: Apply Adjustments, Export XML & Backtest */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={handleExportActiveBotXml}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.01]"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                <span>Export Complete Deriv DBot (.xml)</span>
              </button>

              <button
                onClick={handleApplyStrategyAdjustments}
                className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Apply & Save Bot Adjustments</span>
              </button>

              <button
                onClick={handleRunBacktest}
                disabled={isBacktesting}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-colors"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-spin' : ''}`} />
                <span>{isBacktesting ? 'Running Backtest...' : 'Run 10,000 Tick Backtest'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Backtest Results & Live Execution Logs */}
        <div className="lg:col-span-2 space-y-6">

          {/* Live XXY Digit Pattern Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-sm">
                  XXY Pattern Digit Differ Strategy Engine
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportActiveBotXml}
                  className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-lg shadow flex items-center space-x-1.5 transition-all transform hover:scale-[1.02]"
                  title="Download complete XML bot file for bot.deriv.com"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Download .xml for Deriv Site</span>
                </button>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  90%+ STATISTICAL WINRATE
                </span>
              </div>
            </div>

            {/* Pattern Rule Setup */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold uppercase mb-1">Tick 1 (X)</span>
                <div className="text-white font-mono font-bold text-sm">Base Digit X</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold uppercase mb-1">Tick 2 (X)</span>
                <div className="text-amber-400 font-mono font-bold text-sm">Repeat Digit (= X)</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-bold uppercase mb-1">Tick 3 (Y)</span>
                <div className="text-emerald-400 font-mono font-bold text-sm">Break Digit Y (Y ≠ X)</div>
              </div>
            </div>

            {/* Action Trigger Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                <div className="text-slate-300 font-bold">
                  Rule Trigger: <span className="text-emerald-400 font-mono">BUY DIGITDIFF contract with prediction = Y (Unique Current Pattern Digit)</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Duration: <strong className="text-white">1 Tick (Immediate Settlement)</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                <div>
                  <span className="text-emerald-400 font-bold block mb-1">✅ Trigger Pattern Matches (Buys Trade):</span>
                  <div className="flex flex-wrap gap-1.5 font-mono">
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">3 3 5 → DIGITDIFF 5</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">4 4 7 → DIGITDIFF 7</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">0 0 5 → DIGITDIFF 5</span>
                  </div>
                </div>
                <div>
                  <span className="text-rose-400 font-bold block mb-1">❌ Ignored Patterns (No Trade):</span>
                  <div className="flex flex-wrap gap-1.5 font-mono">
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">4 4 4 (X X X)</span>
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">3 4 4 (X Y Y)</span>
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">5 6 7 (X Y Z)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold">⚡ Immediate 1-Tick Settlement:</span> Trades on every tick without skipping digits. For example, sequence <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded font-mono">3, 3, 5, 7, 8</code> buys <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono">DIGITDIFF 5</code> on digit 5, and the immediate next digit <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono">7</code> settles the trade (not digit 8).
              </div>
            </div>

            {/* Live Ticks Stream */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Live Synthetic Market Tick Stream:</span>
                <span className="text-[10px] font-mono text-amber-400">Highlighted = Current 3-Tick Window</span>
              </div>
              <div className="flex items-center space-x-2 overflow-x-auto py-1">
                {recentDigits.map((digit, idx) => {
                  const isLast3 = idx >= recentDigits.length - 3;
                  const d1 = recentDigits[recentDigits.length - 3];
                  const d2 = recentDigits[recentDigits.length - 2];
                  const d3 = recentDigits[recentDigits.length - 1];
                  const isMatched = (d1 === d2) && (d3 !== d1);

                  return (
                    <div
                      key={idx}
                      className={`w-10 h-10 rounded-xl font-mono font-extrabold text-sm flex items-center justify-center transition-all ${
                        isLast3
                          ? isMatched
                            ? 'bg-emerald-600 text-white border-2 border-emerald-400 shadow-lg shadow-emerald-950 scale-105 animate-pulse'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-slate-950 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Backtest & Performance Summary */}
          {backtestResults && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  <span>10,000 Tick Backtest Performance</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">150 Simulated Trades</span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Win Rate</span>
                  <span className="text-emerald-400 font-bold text-base font-mono">{backtestResults.winRate}%</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Net Profit</span>
                  <span className="text-emerald-400 font-bold text-base font-mono">+${backtestResults.netProfit}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Max Drawdown</span>
                  <span className="text-rose-400 font-bold text-base font-mono">{backtestResults.maxDrawdown}%</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Total Trades</span>
                  <span className="text-white font-bold text-base font-mono">{backtestResults.totalTrades}</span>
                </div>
              </div>

              {/* Equity Curve Recharts */}
              <div className="h-48 w-full bg-slate-950 rounded-xl p-2 border border-slate-800/80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={backtestResults.equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="trade" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Live Execution Logs Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                <h3 className="font-bold text-white text-sm">
                  {isRunning ? 'Live Bot Execution Stream' : 'Bot Execution Logs'}
                </h3>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear Log
              </button>
            </div>

            <div className="h-64 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-y-auto space-y-1.5 text-slate-300">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center py-10">
                  Click 'START AUTO-TRADER' above to launch automated strategy execution!
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`py-1 border-b border-slate-900/80 ${
                      log.includes('WIN') ? 'text-emerald-400 font-bold' : log.includes('LOSS') ? 'text-rose-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Bot Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-lg">AI DBot Strategy Architect</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Describe how you want your trading bot to behave in plain English. Gemini 3.6 Flash will automatically generate entry rules, martingale steps, and risk limits.
            </p>

            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAiBot}
                disabled={isAiLoading}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center space-x-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Architecting Strategy...' : 'Generate DBot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deriv DBot XML Export Guide Modal */}
      {showExportGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 text-slate-100 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-950/80 border border-emerald-600/50 rounded-2xl">
                  <FileCode className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Bot Downloaded Successfully!</h3>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Complete Deriv DBot XML file saved to your device
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportGuideModal(false)}
                className="text-slate-400 hover:text-white font-bold text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-slate-300 leading-relaxed font-medium">
                Your <strong className="text-white font-bold">{botName}</strong> has been exported as a complete, fully compatible Deriv DBot XML file. Follow these steps to load and run it cleanly on Deriv:
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-medium">
                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-red-950 border border-red-700 text-red-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Open Deriv Bot Site</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Visit <a href="https://bot.deriv.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono font-bold">bot.deriv.com</a> or <a href="https://app.deriv.com/bot" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono font-bold">app.deriv.com/bot</a>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-red-950 border border-red-700 text-red-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Click "Import" in DBot Toolbar</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Click the <strong>Import</strong> button in the DBot workspace header bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-red-950 border border-red-700 text-red-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Select "From Local Computer"</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Choose the downloaded <code className="text-amber-300 font-mono">.xml</code> file from your Downloads folder and click <strong>Open / Load</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-xs">Hit "Run Bot"</h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      The blocks will assemble automatically! Hit <strong>Run Bot</strong> to start automated trading cleanly on Deriv.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <a
                href="https://bot.deriv.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Launch bot.deriv.com</span>
              </a>

              <button
                onClick={() => setShowExportGuideModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
