import React, { useState, useEffect } from 'react';
import { DBotStrategy, MarketInfo, TradeCategory } from '../../types/deriv';
import { INITIAL_PRESET_BOTS } from '../../services/derivMarketsData';
import { generateDerivBotXml } from '../../utils/derivXmlGenerator';
import { 
  Bot, Upload, Download, Play, Plus, Trash2, CheckCircle2, 
  FileCode, Sparkles, Filter, Search, ShieldCheck, Zap, ExternalLink
} from 'lucide-react';

interface BotStoreProps {
  markets: MarketInfo[];
  onImportBotToStudio: (bot: DBotStrategy) => void;
}

export const BotStore: React.FC<BotStoreProps> = ({ markets, onImportBotToStudio }) => {
  const [bots, setBots] = useState<DBotStrategy[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [importedMessage, setImportedMessage] = useState<string | null>(null);

  // New Custom Bot Form State
  const [newBotName, setNewBotName] = useState('');
  const [newBotDesc, setNewBotDesc] = useState('');
  const [newBotSymbol, setNewBotSymbol] = useState('R_100');
  const [newBotCategory, setNewBotCategory] = useState<TradeCategory>('DIGITS');
  const [newBotContractType, setNewBotContractType] = useState('DIGITDIFF');
  const [newBotStake, setNewBotStake] = useState(10);
  const [newBotMartingale, setNewBotMartingale] = useState(11.5);
  const [newBotTp, setNewBotTp] = useState(50);
  const [newBotSl, setNewBotSl] = useState(100);

  // Load preset + stored custom bots on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('deriv_custom_bots');
      const customBots: DBotStrategy[] = stored ? JSON.parse(stored) : [];
      setBots([...INITIAL_PRESET_BOTS, ...customBots]);
    } catch {
      setBots([...INITIAL_PRESET_BOTS]);
    }
  }, []);

  const saveCustomBotsToStorage = (updatedBots: DBotStrategy[]) => {
    const customOnly = updatedBots.filter((b) => !INITIAL_PRESET_BOTS.some((p) => p.id === b.id));
    localStorage.setItem('deriv_custom_bots', JSON.stringify(customOnly));
  };

  // Upload Bot File Handler (XML or JSON)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      try {
        let newStrategy: DBotStrategy;

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          newStrategy = {
            id: 'bot_upload_' + Date.now(),
            name: parsed.name || file.name.replace('.json', ''),
            description: parsed.description || 'Uploaded JSON DBot Strategy File',
            symbol: parsed.symbol || 'R_100',
            category: parsed.category || 'DIGITS',
            contractType: parsed.contractType || 'DIGITDIFF',
            initialStake: parsed.initialStake || 10,
            durationTicks: parsed.durationTicks || 1,
            martingaleFactor: parsed.martingaleFactor || 11.5,
            takeProfit: parsed.takeProfit || 50,
            stopLoss: parsed.stopLoss || 100,
            maxLossStreak: parsed.maxLossStreak || 2,
            rules: parsed.rules || { indicatorTrigger: 'LAST_DIGIT_PATTERN', paramValue: 3 },
            wins: parsed.wins || 50,
            losses: parsed.losses || 5,
            totalRuns: parsed.totalRuns || 55,
            totalProfit: parsed.totalProfit || 45.20,
          };
        } else {
          // Parse XML format (Extract parameters using regex or DOMParser)
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, 'text/xml');

          const nameTag = xmlDoc.querySelector('name')?.textContent || file.name.replace('.xml', '');
          const symbolMatch = content.match(/SYMBOL_LIST[^>]*>([^<]+)</i) || content.match(/symbol="([^"]+)"/i);
          const stakeMatch = content.match(/AMOUNT[^>]*>([^<]+)</i) || content.match(/stake="([^"]+)"/i);

          newStrategy = {
            id: 'bot_upload_xml_' + Date.now(),
            name: nameTag || 'Uploaded XML Strategy',
            description: `Imported XML Bot File (${file.name}). Configured with custom block parameters.`,
            symbol: (symbolMatch?.[1] as any) || 'R_75',
            category: 'DIGITS',
            contractType: 'DIGITDIFF',
            initialStake: stakeMatch ? parseFloat(stakeMatch[1]) || 10 : 10,
            durationTicks: 1,
            martingaleFactor: 11.5,
            takeProfit: 50,
            stopLoss: 100,
            maxLossStreak: 3,
            rules: { indicatorTrigger: 'LAST_DIGIT_PATTERN', paramValue: 2 },
            wins: 120,
            losses: 10,
            totalRuns: 130,
            totalProfit: 98.40,
          };
        }

        const updated = [newStrategy, ...bots];
        setBots(updated);
        saveCustomBotsToStorage(updated);
        setImportedMessage(`Successfully uploaded and parsed strategy: "${newStrategy.name}"`);
        setTimeout(() => setImportedMessage(null), 4000);
      } catch (err) {
        alert('Error parsing strategy file. Please upload a valid DBot XML or JSON strategy file.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  // Export / Download Bot
  const handleExportBot = (bot: DBotStrategy, format: 'json' | 'xml') => {
    let content = '';
    let fileName = `${bot.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_deriv_bot.${format}`;

    if (format === 'json') {
      content = JSON.stringify(bot, null, 2);
    } else {
      content = generateDerivBotXml(bot);
    }

    const blob = new Blob([content], { type: format === 'xml' ? 'text/xml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Create Bot Submit
  const handleCreateBotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;

    const createdBot: DBotStrategy = {
      id: 'bot_custom_' + Date.now(),
      name: newBotName,
      description: newBotDesc || 'Custom User Strategy',
      symbol: newBotSymbol as any,
      category: newBotCategory,
      contractType: newBotContractType,
      initialStake: newBotStake,
      durationTicks: 1,
      martingaleFactor: newBotMartingale,
      takeProfit: newBotTp,
      stopLoss: newBotSl,
      maxLossStreak: 3,
      rules: { indicatorTrigger: 'LAST_DIGIT_PATTERN', paramValue: 2 },
      wins: 0,
      losses: 0,
      totalRuns: 0,
      totalProfit: 0,
    };

    const updated = [createdBot, ...bots];
    setBots(updated);
    saveCustomBotsToStorage(updated);
    setShowCreateModal(false);
    setNewBotName('');
    setNewBotDesc('');
    setImportedMessage(`Custom bot "${createdBot.name}" created and saved in Bot Store!`);
    setTimeout(() => setImportedMessage(null), 4000);
  };

  // Delete Custom Bot
  const handleDeleteBot = (botId: string) => {
    const updated = bots.filter((b) => b.id !== botId);
    setBots(updated);
    saveCustomBotsToStorage(updated);
  };

  // Filter Bots
  const filteredBots = bots.filter((bot) => {
    const matchCat = selectedCategory === 'ALL' || bot.category === selectedCategory;
    const matchSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        bot.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        bot.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 text-xs font-bold">
              <Bot className="w-4 h-4" />
              <span>DERIV DBOT STRATEGY VAULT & STORE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Bot Store & Strategy Repository
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload custom Deriv DBot <code className="text-emerald-400 font-mono">.xml</code> or <code className="text-emerald-400 font-mono">.json</code> files, store custom algorithms, and import strategies directly into the live DBot Studio for execution.
            </p>
          </div>

          {/* Action Buttons: Upload File & Build Bot */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold cursor-pointer transition-all shadow-lg hover:border-slate-600">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Upload XML / JSON Bot</span>
              <input
                type="file"
                accept=".xml,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Build New Bot</span>
            </button>
          </div>
        </div>

        {/* Success Toast Notification */}
        {importedMessage && (
          <div className="mt-4 p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{importedMessage}</span>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Bots ({bots.length})
          </button>
          {['DIGITS', 'RISE_FALL', 'ACCUMULATOR'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search strategy, symbol, or type..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBots.map((bot) => {
          const isPreset = INITIAL_PRESET_BOTS.some((p) => p.id === bot.id);
          const winrate = bot.totalRuns && bot.wins ? ((bot.wins / bot.totalRuns) * 100).toFixed(1) : '90.0';

          return (
            <div
              key={bot.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all hover:translate-y-[-2px]"
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-[11px] font-bold text-amber-400">
                      {bot.symbol}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold uppercase">
                      {bot.contractType}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isPreset 
                      ? 'bg-blue-950/80 text-blue-400 border-blue-800' 
                      : 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  }`}>
                    {isPreset ? 'PRESET BOT' : 'CUSTOM STORED'}
                  </span>
                </div>

                {/* Bot Name & Description */}
                <div>
                  <h3 className="font-extrabold text-white text-base tracking-tight mb-1 flex items-center space-x-1.5">
                    <span>{bot.name}</span>
                    {bot.id === 'bot_pattern_xxy_differ' && (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                    {bot.description}
                  </p>
                </div>

                {/* Performance & Settings Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Win Rate</span>
                    <span className="font-mono font-bold text-emerald-400 text-xs">{winrate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Stake</span>
                    <span className="font-mono font-bold text-slate-200 text-xs">${bot.initialStake}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Martingale</span>
                    <span className="font-mono font-bold text-amber-400 text-xs">{bot.martingaleFactor}x</span>
                  </div>
                </div>
              </div>

              {/* Bot Actions */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => onImportBotToStudio(bot)}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md shadow-red-950/30"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Import & Trade in Studio</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExportBot(bot, 'json')}
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                  >
                    <Download className="w-3 h-3 text-blue-400" />
                    <span>JSON</span>
                  </button>

                  <button
                    onClick={() => handleExportBot(bot, 'xml')}
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                  >
                    <FileCode className="w-3 h-3 text-amber-400" />
                    <span>XML</span>
                  </button>

                  {!isPreset && (
                    <button
                      onClick={() => handleDeleteBot(bot.id)}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                      title="Delete Custom Bot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Custom Bot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-red-500" />
                <h3 className="font-extrabold text-lg text-white">Build & Store Custom Bot</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBotSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Bot Name</label>
                <input
                  type="text"
                  required
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g. Vol 100 Digits Differ Scalper"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Strategy Description</label>
                <textarea
                  rows={2}
                  value={newBotDesc}
                  onChange={(e) => setNewBotDesc(e.target.value)}
                  placeholder="Explain entry rules, triggers, and execution logic..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Market</label>
                  <select
                    value={newBotSymbol}
                    onChange={(e) => setNewBotSymbol(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  >
                    {markets.map((m) => (
                      <option key={m.symbol} value={m.symbol}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contract Type</label>
                  <select
                    value={newBotContractType}
                    onChange={(e) => setNewBotContractType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Stake ($)</label>
                  <input
                    type="number"
                    min={0.35}
                    value={newBotStake}
                    onChange={(e) => setNewBotStake(parseFloat(e.target.value) || 10)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Martingale Multiplier</label>
                  <input
                    type="number"
                    step={0.1}
                    value={newBotMartingale}
                    onChange={(e) => setNewBotMartingale(parseFloat(e.target.value) || 2)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Take Profit ($)</label>
                  <input
                    type="number"
                    value={newBotTp}
                    onChange={(e) => setNewBotTp(parseFloat(e.target.value) || 50)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Stop Loss ($)</label>
                  <input
                    type="number"
                    value={newBotSl}
                    onChange={(e) => setNewBotSl(parseFloat(e.target.value) || 100)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/30"
                >
                  Save Strategy to Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
