import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/api';
import { 
  Play, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  FileSpreadsheet, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw,
  Search,
  Filter,
  DollarSign,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { BacktestConfig, BacktestResult, Trade, ALL_INDICES_LIST } from '../types';
import { exportBacktestToExcel, exportBacktestToPDF } from '../utils/exportUtils';

interface BacktestViewProps {
  isDark: boolean;
  onOpenStockDetail: (symbol: string) => void;
  onSaveBacktest: (title: string, config: any, results: any) => void;
}

export const BacktestView: React.FC<BacktestViewProps> = ({
  isDark,
  onOpenStockDetail,
  onSaveBacktest,
}) => {
  const [config, setConfig] = useState<BacktestConfig>({
    lookbackDays: 66,
    lowerPct: 0.0,
    upperPct: 1.0,
    minDeliveryPct: 40.0,
    deliveryMultiplier: 1.0,
    targetPct: 8.0,
    stopLossPct: 2.5,
    maxHoldingDays: 45,
    priorityResolution: 'STOP_LOSS_FIRST',
    initialCapital: 1000000,
    initialCapitalPerTrade: 50000,
    maxCapitalPerTrade: 100000,
    maxSimultaneousTrades: 10,
    rankingMetric: 'DELIVERY_PCT',
    indexFilter: 'ALL',
  });

  const [timeMode, setTimeMode] = useState<string>('6M');

  const handleTimeModeChange = (mode: string) => {
    setTimeMode(mode);
    let days = 132;
    if (mode === '1W') days = 7;
    else if (mode === '1M') days = 22;
    else if (mode === '3M') days = 66;
    else if (mode === '6M') days = 132;
    else if (mode === '1Y') days = 252;
    else if (mode === '2Y') days = 504;
    else if (mode === '3Y') days = 756;
    else if (mode === '5Y') days = 1825;

    const end = new Date();
    const start = new Date();
    if (mode === '1W') start.setDate(end.getDate() - 7);
    else if (mode === '1M') start.setMonth(end.getMonth() - 1);
    else if (mode === '3M') start.setMonth(end.getMonth() - 3);
    else if (mode === '6M') start.setMonth(end.getMonth() - 6);
    else if (mode === '1Y') start.setFullYear(end.getFullYear() - 1);
    else if (mode === '2Y') start.setFullYear(end.getFullYear() - 2);
    else if (mode === '3Y') start.setFullYear(end.getFullYear() - 3);
    else if (mode === '5Y') start.setFullYear(end.getFullYear() - 5);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    setConfig(prev => ({
      ...prev,
      lookbackDays: days,
      startDate: mode === 'CUSTOM' ? (prev.startDate || '2025-01-01') : formatDate(start),
      endDate: mode === 'CUSTOM' ? (prev.endDate || formatDate(end)) : formatDate(end),
    }));
  };

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/account');
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, initialCapital: data.total_capital }));
      }
    } catch (err) {
      console.error('Failed to fetch account in backtest:', err);
    }
  };

  const updateServerCapital = async (val: number) => {
    try {
      await fetch('/api/account/capital', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalCapital: val }),
      });
    } catch (err) {
      console.error('Failed to update server capital in backtest:', err);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  // Trade log filter & search
  const [tradeSearch, setTradeSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<'ALL' | 'TARGET' | 'STOP_LOSS' | 'TIME_LIMIT'>('ALL');

  const generatePineScript = (cfg: BacktestConfig) => {
    return `//@version=5
strategy("Accumulation Trailing Strategy", overlay=true, initial_capital=${cfg.initialCapital}, default_qty_type=strategy.cash, default_qty_value=${cfg.maxCapitalPerTrade})

// Inputs
lookbackDays = input.int(${cfg.lookbackDays}, "Lookback Days")
lowerPct = input.float(${cfg.lowerPct}, "Zone Lower %")
upperPct = input.float(${cfg.upperPct}, "Zone Upper %")
minDeliveryPct = input.float(${cfg.minDeliveryPct}, "Min Delivery %")
initialTargetPct = input.float(${cfg.targetPct}, "Initial Target %")
initialStopLossPct = input.float(${cfg.stopLossPct}, "Max Risk %")
maxHoldingDays = input.int(${cfg.maxHoldingDays}, "Max Holding Days")

// Entry Condition Logic
anchorLow = ta.lowest(low, lookbackDays)
zoneLower = anchorLow * (1 + lowerPct / 100)
zoneUpper = anchorLow * (1 + upperPct / 100)

inZone = close >= zoneLower and close <= zoneUpper
// Qualifying delivery would typically be imported via a custom security or data feed
qualifyingDelivery = true 

if inZone and qualifyingDelivery and strategy.position_size == 0
    strategy.entry("Long", strategy.long)

// Dynamic Trailing Stop Loss & Target Logic
var float trailingSL = na
var float dynamicTarget = na
var int entryBar = 0

if strategy.position_size > 0
    if strategy.position_size[1] == 0 // New entry
        entryBar := bar_index
        trailingSL := strategy.position_avg_price * (1 - initialStopLossPct / 100)
        dynamicTarget := strategy.position_avg_price * (1 + initialTargetPct / 100)
    
    // Calculate Peak Gain for Upward Ratchet
    peakPrice = ta.highest(high, bar_index - entryBar + 1)
    gainFromEntry = ((peakPrice - strategy.position_avg_price) / strategy.position_avg_price) * 100
    
    // Continuous Upward-Only Trailing SL (Ratchet)
    // Moves up 1% for every 1% gain above entry
    currentDynamicSL = strategy.position_avg_price * (1 - (initialStopLossPct - math.max(0, gainFromEntry)) / 100)
    trailingSL := math.max(nz(trailingSL), currentDynamicSL)
    
    // Expanding Target (Progressive Tiers)
    targetTier = math.floor(math.max(0, gainFromEntry - 4.0) / 4.0)
    dynamicTarget := strategy.position_avg_price * (1 + (initialTargetPct + targetTier * 4.0) / 100)

    // Exit Execution
    if close <= trailingSL
        strategy.close("Long", comment="SL Triggered")
    if close >= dynamicTarget
        strategy.close("Long", comment="Target Hit")
    
    // Time Limit Exit
    if bar_index - entryBar >= maxHoldingDays
        strategy.close("Long", comment="Time Exit")

// Visuals
plot(strategy.position_size > 0 ? trailingSL : na, "Trailing SL", color=color.red, style=plot.style_linebr)
plot(strategy.position_size > 0 ? dynamicTarget : na, "Dynamic Target", color=color.green, style=plot.style_linebr)
`;
  };

  // AI Critique State
  const [aiCritique, setAiCritique] = useState<{
    assessment: string;
    strengths: string[];
    weaknesses: string[];
    optimizationTips: string[];
    marketRegimeFit: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Backtest failed with status ${res.status}`);
      }
      const data: BacktestResult = await res.json();
      setResult(data);
      setAiCritique(null); // reset AI until requested
    } catch (err: any) {
      console.error('Backtest error:', err);
      setError(err.message || 'Failed to run backtest simulation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBacktest();
  }, []);

  const runAICritique = async () => {
    if (!result) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backtest: result }),
      });
      if (!res.ok) throw new Error('AI Critique request failed');
      const data = await res.json();
      setAiCritique(data);
    } catch (err) {
      console.error('AI Critique error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Filtered trade list
  const filteredTrades = React.useMemo(() => {
    if (!result) return [];
    let list = result.trades;

    if (reasonFilter !== 'ALL') {
      list = list.filter(t => t.exitReason === reasonFilter);
    }

    if (tradeSearch.trim()) {
      const q = tradeSearch.toLowerCase();
      list = list.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }

    return list;
  }, [result, reasonFilter, tradeSearch]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-3 pb-8">
      {/* Strategy Control Panel & Config Deck */}
      <div className={`p-3 rounded border transition-all ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-1.5">
                <span>WALK-FORWARD ACCUMULATION BACKTESTER</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-normal">
                  PORTFOLIO SIM
                </span>
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
              True historical portfolio execution entering on institutional accumulation signals with target, stop-loss, and max holding exits.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#09090b] shadow-xs transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-[#09090b] ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Simulating...' : 'Run Simulation'}</span>
            </button>

            {result && (
              <>
                <button
                  onClick={runAICritique}
                  disabled={aiLoading}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs font-semibold border transition-all ${
                    isDark
                      ? 'bg-[#121214] border-[#27272a] text-purple-300 hover:border-purple-500/50 hover:bg-[#1c1c1f]'
                      : 'bg-purple-50 border-purple-200 text-purple-800'
                  }`}
                >
                  <Sparkles className={`w-3 h-3 text-purple-400 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span className="text-[11px] font-bold">{aiLoading ? 'Critiquing...' : 'AI Critique'}</span>
                </button>

                <button
                  onClick={() => exportBacktestToExcel(result)}
                  className={`p-1.5 rounded border text-emerald-400 hover:bg-emerald-500/10 transition-colors ${
                    isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'
                  }`}
                  title="Export to Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => exportBacktestToPDF(result)}
                  className={`p-1.5 rounded border text-rose-400 hover:bg-rose-500/10 transition-colors ${
                    isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'
                  }`}
                  title="Export to PDF Report"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Config Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3 text-xs">
          {/* Time Period / Duration */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Time Period / Span:</label>
            <select
              value={timeMode}
              onChange={e => handleTimeModeChange(e.target.value)}
              className={`w-full py-1 px-2 rounded border text-xs font-mono font-bold ${
                isDark ? 'bg-[#121214] border-[#27272a] text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
              }`}
            >
              <option value="1W">1 Week (7 Days)</option>
              <option value="1M">1 Month (~22 Days)</option>
              <option value="3M">3 Months (~66 Days)</option>
              <option value="6M">6 Months (~132 Days)</option>
              <option value="1Y">1 Year (252 Bars)</option>
              <option value="2Y">2 Years (504 Bars)</option>
              <option value="3Y">3 Years (756 Bars)</option>
              <option value="5Y">5 Years (1825 Bars)</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Start & End Date (if CUSTOM selected) */}
          {timeMode === 'CUSTOM' ? (
            <>
              <div className="space-y-0.5">
                <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Start Date:</label>
                <input
                  type="date"
                  value={config.startDate || '2025-01-01'}
                  onChange={e => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                  className={`w-full py-1 px-2 rounded border text-xs font-mono ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
              <div className="space-y-0.5">
                <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>End Date:</label>
                <input
                  type="date"
                  value={config.endDate || '2026-08-15'}
                  onChange={e => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  className={`w-full py-1 px-2 rounded border text-xs font-mono ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            </>
          ) : null}

          {/* Stop Loss % */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Initial Stop Loss:</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={config.stopLossPct}
                onChange={e => setConfig(prev => ({ ...prev, stopLossPct: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-rose-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] text-[10px] font-mono">%</span>
            </div>
          </div>

          {/* Target Profit % */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Target / Runner Cap:</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={config.targetPct}
                onChange={e => setConfig(prev => ({ ...prev, targetPct: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] text-[10px] font-mono">%</span>
            </div>
          </div>

          {/* Total Capital Amount */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Total Capital Amount:</label>
            <div className="relative">
              <input
                type="number"
                value={config.initialCapital}
                onChange={e => {
                  const val = Number(e.target.value);
                  setConfig(prev => ({ ...prev, initialCapital: val }));
                  updateServerCapital(val);
                }}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] text-[10px] font-mono">₹</span>
            </div>
          </div>

          {/* Initial Amount per Trade */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Initial Amt / Trade:</label>
            <div className="relative">
              <input
                type="number"
                value={config.initialCapitalPerTrade}
                onChange={e => setConfig(prev => ({ ...prev, initialCapitalPerTrade: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] text-[10px] font-mono">₹</span>
            </div>
          </div>

          {/* Max Capital per Trade */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Max Amt / Trade:</label>
            <div className="relative">
              <input
                type="number"
                value={config.maxCapitalPerTrade}
                onChange={e => setConfig(prev => ({ ...prev, maxCapitalPerTrade: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] text-[10px] font-mono">₹</span>
            </div>
          </div>


          {/* Max Holding Days */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Max Holding Days:</label>
            <input
              type="number"
              min="5"
              max="90"
              value={config.maxHoldingDays}
              onChange={e => setConfig(prev => ({ ...prev, maxHoldingDays: Number(e.target.value) }))}
              className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-slate-200 text-xs ${
                isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
              }`}
            />
          </div>

          {/* Universe Index */}
          <div className="space-y-0.5">
            <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Index Universe:</label>
            <select
              value={config.indexFilter}
              onChange={e => setConfig(prev => ({ ...prev, indexFilter: e.target.value }))}
              className={`w-full py-1 px-2 rounded border text-xs ${
                isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {ALL_INDICES_LIST.map(idx => (
                <option key={idx} value={idx}>
                  {idx === 'ALL' ? 'All Indexes & Constituents' : idx}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* KPI Performance Summary Deck */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {/* Win Rate */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold flex items-center justify-between">
                <span>Win Rate</span>
                <Percent className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {result.metrics.winRatePct}%
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                {result.metrics.winningTrades}W / {result.metrics.losingTrades}L ({result.metrics.totalTrades} total)
              </div>
            </div>

            {/* Profit Factor */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Profit Factor</div>
              <div className="text-xl font-bold font-mono text-teal-300 mt-0.5">
                {result.metrics.profitFactor}
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                Win: +{result.metrics.avgWinPnlPct}% / Loss: {result.metrics.avgLossPnlPct}%
              </div>
            </div>

            {/* Total ROI */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold flex items-center justify-between">
                <span>Strategy ROI</span>
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              </div>
              <div className={`text-xl font-bold font-mono mt-0.5 ${result.metrics.totalRoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.metrics.totalRoiPct >= 0 ? '+' : ''}{result.metrics.totalRoiPct}%
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                PnL: ₹{result.metrics.totalPnl.toLocaleString()}
              </div>
            </div>

            {/* Expectancy */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold flex items-center justify-between">
                <span>Expectancy</span>
                <Sparkles className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-300 mt-0.5">
                {result.metrics.expectancyPct >= 0 ? '+' : ''}{result.metrics.expectancyPct}%
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                Win/Loss Ratio: {result.metrics.winLossRatio}x
              </div>
            </div>

            {/* Max Drawdown */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold flex items-center justify-between">
                <span>Max Drawdown</span>
                <ShieldAlert className="w-3 h-3 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
                -{result.metrics.maxDrawdownPct}%
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                Bench: +{result.metrics.benchmarkRoiPct}%
              </div>
            </div>

            {/* Sharpe Ratio */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Sharpe Ratio</div>
              <div className="text-xl font-bold font-mono text-purple-300 mt-0.5">
                {result.metrics.sharpeRatio}
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                CAGR: {result.metrics.cagrPct}%
              </div>
            </div>

            {/* Avg Trade PnL */}
            <div className={`p-2.5 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Avg Trade PnL</div>
              <div className={`text-xl font-bold font-mono mt-0.5 ${result.metrics.avgTradePnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.metrics.avgTradePnlPct >= 0 ? '+' : ''}{result.metrics.avgTradePnlPct}%
              </div>
              <div className="text-[9px] font-mono text-[#71717a] mt-0.5">
                Avg Hold: {result.metrics.avgHoldingDays} Days
              </div>
            </div>
          </div>

          {/* AI Strategy Critique Card (If available) */}
          {aiCritique && (
            <div className={`p-3 rounded border transition-all ${
              isDark
                ? 'bg-[#0c0c0e] border-[#27272a]'
                : 'bg-purple-50/50 border-purple-200'
            }`}>
              <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#27272a]' : 'border-purple-200'}`}>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h3 className="font-bold text-xs uppercase tracking-tight font-mono text-purple-300">
                    Gemini AI Strategy Critique & Parameter Optimization
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                  Quantitative Review
                </span>
              </div>

              <div className="mt-2.5 space-y-2.5 text-xs">
                <p className={`leading-relaxed text-xs ${isDark ? 'text-[#e4e4e7]' : 'text-slate-700'}`}>
                  {aiCritique.assessment}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-emerald-400 text-[10px] mb-1 flex items-center gap-1 font-mono uppercase">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Strategy Strengths</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-[#a1a1aa]">
                      {(aiCritique?.strengths || []).map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-rose-400 text-[10px] mb-1 flex items-center gap-1 font-mono uppercase">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Risk Weaknesses</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-[#a1a1aa]">
                      {(aiCritique?.weaknesses || []).map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                    <div className="font-semibold text-teal-400 text-[10px] mb-1 flex items-center gap-1 font-mono uppercase">
                      <Sparkles className="w-3 h-3" />
                      <span>Optimization Tips</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-[#a1a1aa]">
                      {(aiCritique?.optimizationTips || []).map((tip, i) => (
                        <li key={i}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={`p-2 rounded border flex items-center justify-between ${
                  isDark ? 'bg-[#121214] border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}>
                  <span className="font-semibold text-[11px] font-mono">Regime Fit: {aiCritique.marketRegimeFit}</span>
                </div>
              </div>
            </div>
          )}

          {/* Equity Curve & Benchmark Chart */}
          <div className={`p-3 rounded border transition-all ${
            isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
          } shadow-xs`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-xs text-[#e4e4e7] uppercase font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Portfolio Equity Growth vs Benchmark</span>
                </h3>
                <p className="text-[10px] text-[#71717a] font-mono">
                  Simulation: {result.timeframe.start} to {result.timeframe.end}
                </p>
              </div>

              <div className="flex items-center space-x-3 text-[10px] font-mono">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-emerald-400" />
                  <span className="text-emerald-400">Accumulation Strategy</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-slate-500" />
                  <span className="text-[#71717a]">Benchmark (Equal-Weight)</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={result.equityCurve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={9} tickLine={false} />
                  <YAxis
                    stroke="#52525b"
                    fontSize={9}
                    tickLine={false}
                    tickFormatter={val => `₹${(val / 100000).toFixed(1)}L`}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                    formatter={(val: any, name: any) => [
                      `₹${Number(val).toLocaleString()}`,
                      name === 'equity' ? 'Portfolio Equity' : 'Universe Benchmark',
                    ]}
                  />
                  <Line type="monotone" dataKey="benchmarkEquity" stroke="#71717a" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly & Yearly Returns Heatmap */}
          {result.yearlyReturns.length > 0 && (
            <div className={`p-3 rounded border transition-all ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
            } shadow-xs`}>
              <h3 className="font-bold text-xs uppercase font-mono text-[#e4e4e7] mb-2">
                Monthly & Annual Returns Heatmap (%)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs font-mono">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-[#27272a] text-[#71717a]' : 'border-slate-200 text-slate-500'} text-[10px] uppercase font-bold`}>
                      <th className="py-1.5 px-2 text-left">Year</th>
                      {monthNames.map(m => (
                        <th key={m} className="py-1.5 px-1.5">{m}</th>
                      ))}
                      <th className="py-1.5 px-2 font-bold text-[#e4e4e7]">Year Total</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'}`}>
                    {result.yearlyReturns.map(y => {
                      const yearMonths = result.monthlyReturns.filter(m => m.year === y.year);
                      return (
                        <tr key={y.year}>
                          <td className="py-1.5 px-2 text-left font-bold text-slate-300 text-[11px]">{y.year}</td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                            const monthData = yearMonths.find(ym => ym.month === m);
                            const val = monthData ? monthData.returnPct : null;
                            const isPos = val !== null && val > 0;
                            const isNeg = val !== null && val < 0;

                            return (
                              <td key={m} className="py-1.5 px-1">
                                {val !== null ? (
                                  <span className={`inline-block px-1 py-0.2 rounded-xs text-[10px] font-bold ${
                                    isPos
                                      ? val >= 4 ? 'bg-emerald-500 text-[#09090b]' : 'bg-emerald-500/20 text-emerald-400'
                                      : isNeg
                                      ? val <= -3 ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-400'
                                      : 'text-[#71717a]'
                                  }`}>
                                    {val > 0 ? '+' : ''}{val}%
                                  </span>
                                ) : (
                                  <span className="text-[#3f3f46]">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-1.5 px-2 font-bold">
                            <span className={`px-1.5 py-0.5 rounded-xs text-[11px] font-bold ${
                              y.returnPct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {y.returnPct >= 0 ? '+' : ''}{y.returnPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trade Log Table */}
          <div className={`rounded border overflow-hidden transition-colors ${
            isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
          } shadow-xs`}>
            {/* Trade Log Filters Header */}
            <div className={`p-2 px-3 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-xs uppercase font-mono text-[#e4e4e7]">Simulated Trade Log</h3>
                <span className="text-[10px] text-[#71717a] font-mono">({filteredTrades.length} Trades)</span>
              </div>

              <div className="flex items-center space-x-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[#71717a]" />
                  <input
                    type="text"
                    placeholder="Filter symbol..."
                    value={tradeSearch}
                    onChange={e => setTradeSearch(e.target.value)}
                    className={`pl-6 pr-2 py-0.5 text-xs rounded border font-mono ${
                      isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7] placeholder-[#71717a]' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                {/* Reason Filter */}
                <div className={`flex items-center space-x-0.5 p-0.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-100 border-slate-200'} text-[10px] font-mono`}>
                  {(['ALL', 'TARGET', 'STOP_LOSS', 'TIME_LIMIT'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setReasonFilter(r)}
                      className={`px-1.5 py-0.5 rounded font-medium transition-all ${
                        reasonFilter === r
                          ? 'bg-emerald-500 text-[#09090b] font-bold'
                          : isDark
                          ? 'text-[#71717a] hover:text-[#e4e4e7]'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {r === 'ALL' ? 'All' : r === 'TARGET' ? 'Target Hit' : r === 'STOP_LOSS' ? 'Stop Loss' : 'Time Exit'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-mono font-bold uppercase tracking-wider text-[10px] ${
                  isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <tr>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-2.5">Entry Date</th>
                    <th className="py-2 px-2.5">Entry Price (₹)</th>
                    <th className="py-2 px-2.5">Invested Amount</th>
                    <th className="py-2 px-2.5">Peak / Max (₹)</th>
                    <th className="py-2 px-2.5">Exit Date</th>
                    <th className="py-2 px-2.5">Exit Price (₹)</th>
                    <th className="py-2 px-2.5">Exit Amount (incl. PnL)</th>
                    <th className="py-2 px-2.5">PnL %</th>
                    <th className="py-2 px-2.5">PnL (₹)</th>
                    <th className="py-2 px-2.5">Hold</th>
                    <th className="py-2 px-3 text-right">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'}`}>
                  {filteredTrades.slice(0, 50).map(t => {
                    const isWin = t.pnl > 0;
                    return (
                      <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="py-1.5 px-3 font-bold font-mono text-xs text-[#e4e4e7] cursor-pointer hover:text-emerald-400" onClick={() => onOpenStockDetail(t.symbol)}>
                          <div>{t.symbol}</div>
                        </td>
                        <td className="py-1.5 px-2.5 text-[#71717a] font-mono text-[11px]">{t.entryDate}</td>
                        <td className="py-1.5 px-2.5 font-mono font-medium text-slate-200 text-xs">₹{t.entryPrice.toFixed(2)}</td>
                        <td className="py-1.5 px-2.5 font-mono text-xs text-slate-300">₹{t.investedAmount.toLocaleString()}</td>
                        <td className="py-1.5 px-2.5 font-mono text-emerald-400 text-xs">
                          {t.highestPriceReached ? `₹${t.highestPriceReached.toFixed(2)} (+${t.maxGainPct || 0}%)` : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-[#71717a] font-mono text-[11px]">{t.exitDate}</td>
                        <td className="py-1.5 px-2.5 font-mono font-medium text-slate-200 text-xs">₹{t.exitPrice.toFixed(2)}</td>
                        <td className="py-1.5 px-2.5 font-mono text-xs text-slate-300">₹{t.exitAmount.toLocaleString()}</td>
                        <td className="py-1.5 px-2.5 font-mono">
                          <span className={`inline-flex items-center font-bold px-1 py-0.2 rounded-xs text-[10px] ${
                            isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {isWin ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                            {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct}%
                          </span>
                        </td>
                        <td className={`py-1.5 px-2.5 font-mono font-semibold text-xs ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2.5 text-[#71717a] font-mono text-xs">{t.holdingDays}d</td>
                        <td className="py-1.5 px-3 text-right font-mono">
                          <span className={`inline-block px-1.5 py-0.2 rounded-xs text-[9px] font-bold uppercase tracking-wider ${
                            t.exitReason === 'TARGET'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : t.exitReason === 'STOP_LOSS'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : t.exitReason === 'TIME_LIMIT'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {t.exitReason === 'TARGET' ? '🎯 TARGET HIT' : t.exitReason === 'STOP_LOSS' ? '🛑 STOP LOSS' : t.exitReason === 'TIME_LIMIT' ? '⏳ TIME EXIT' : 'OPEN'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTrades.length > 50 && (
              <div className="p-2 text-center text-[10px] font-mono text-[#71717a] border-t border-[#27272a]">
                Displaying first 50 of {filteredTrades.length} trades. Export to Excel or PDF for full log.
              </div>
            )}
          </div>

          {/* TradingView Pine Script Section */}
          <div className={`mt-6 p-4 rounded border ${isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs uppercase font-mono text-[#e4e4e7]">TradingView Pine Script (Strategy)</h3>
              <button
                onClick={() => navigator.clipboard.writeText(generatePineScript(config))}
                className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold hover:bg-emerald-500/20"
              >
                Copy Script
              </button>
            </div>
            <pre className={`p-3 rounded text-[10px] font-mono overflow-auto h-48 ${isDark ? 'bg-[#121214] text-slate-300' : 'bg-slate-50 text-slate-700'}`}>
              {generatePineScript(config)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
};
