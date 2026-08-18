import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '../lib/api';
import { 
  Search, 
  Filter, 
  RotateCw, 
  FileSpreadsheet, 
  FileText, 
  Sparkles, 
  Bell, 
  TrendingUp, 
  ShieldAlert, 
  Layers, 
  BarChart2, 
  ArrowUpDown, 
  Bookmark, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sliders,
  Zap,
  Activity,
  Radio
} from 'lucide-react';
import { AIAnalysisResponse, PriceAlert, ScanConfig, ScanResult, ALL_INDICES_LIST, TradingAccount } from '../types';
import { exportScanToExcel, exportScanToPDF } from '../utils/exportUtils';

interface ScannerViewProps {
  isDark: boolean;
  onOpenStockDetail: (symbol: string, scanResult?: ScanResult) => void;
  onOpenSetAlert: (symbol: string, defaultPrice: number) => void;
  onSaveScan: (title: string, config: ScanConfig, results: ScanResult[]) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  isDark,
  onOpenStockDetail,
  onOpenSetAlert,
  onSaveScan,
}) => {
  const [config, setConfig] = useState<ScanConfig>({
    indexFilter: 'ALL',
    sectorFilter: 'ALL',
    lookbackDays: 66, // 3 Months default
    lowerPct: 0.0,
    upperPct: 1.0,
    minDeliveryPct: 40.0,
    deliveryMultiplier: 1.0,
    minVolume: 0,
    priceField: 'close',
    inZoneOnly: false,
    highDeliveryOnly: false,
    searchQuery: '',
    initialCapital: 1000000,
    initialCapitalPerTrade: 50000,
    maxCapitalPerTrade: 100000,
    targetPct: 8.0,
    stopLossPct: 2.5,
    maxHoldingDays: 45,
  });

  const [isLiveMode, setIsLiveMode] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [liveSyncMsg, setLiveSyncMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Sorting
  const [sortField, setSortField] = useState<keyof ScanResult>('accumulation_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // AI Commentary State
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Paper Trading State
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  // Fetch account balance
  const fetchAccount = async () => {
    try {
      const data = await fetchWithAuth('/api/account');
      setAccount(data);
      // Sync local config with DB balance if needed
      setConfig(prev => ({ ...prev, initialCapital: data.total_capital }));
    } catch (err) {
      console.error('Failed to fetch account:', err);
    }
  };

  const updateServerCapital = async (val: number) => {
    try {
      const data = await fetchWithAuth('/api/account/capital', {
        method: 'PUT',
        body: JSON.stringify({ totalCapital: val }),
      });
      setAccount(data);
    } catch (err) {
      console.error('Failed to update server capital:', err);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const handleExecuteTrade = async (item: ScanResult) => {
    if (!account) return;

    // Use tactical plan if available, otherwise default to config SL and Tgt
    const slPct = item.tactical_plan?.initial_stop_loss 
      ? +(((item.latest_close - Number(item.tactical_plan.initial_stop_loss)) / item.latest_close) * 100).toFixed(2)
      : config.stopLossPct;
    
    const tgtPct = item.tactical_plan?.target_price
      ? +(((Number(item.tactical_plan.target_price) - item.latest_close) / item.latest_close) * 100).toFixed(2)
      : config.targetPct;

    // Calculate shares based on capital per trade
    const shares = Math.floor(config.initialCapitalPerTrade / item.latest_close);
    if (shares === 0) {
      alert(`Capital ₹${config.initialCapitalPerTrade} is insufficient for ${item.symbol} @ ₹${item.latest_close}`);
      return;
    }

    setIsExecuting(item.symbol);
    try {
      const data = await fetchWithAuth('/api/positions', {
        method: 'POST',
        body: JSON.stringify({
          symbol: item.symbol,
          entryPrice: item.latest_close,
          shares,
          initialStopLossPct: slPct,
          initialTargetPct: tgtPct,
          notes: `${isLiveMode ? 'LIVE' : 'PAPER'} trade from scanner. Score: ${item.accumulation_score}`,
          isLive: isLiveMode
        }),
      });

      alert(data.message || `Successfully executed ${isLiveMode ? 'LIVE' : 'PAPER'} trade for ${shares} shares of ${item.symbol}`);
      fetchAccount(); // Update balance
    } catch (err: any) {
      alert(`System error: ${err.message}`);
    } finally {
      setIsExecuting(null);
    }
  };

  // Sectors list
  const sectors = useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => { if (r.sector) set.add(r.sector); });
    return Array.from(set).sort();
  }, [results]);

  const runScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`Scan request failed with status ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || 'Failed to execute accumulation scan.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerLiveSync = async () => {
    setIsSyncingLive(true);
    setLiveSyncMsg(null);
    try {
      const res = await fetch('/api/sync/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universe: config.indexFilter }),
      });
      const data = await res.json();
      if (res.ok) {
        setLiveSyncMsg(`Live market synced (${data.syncedCount || data.updatedBars} stocks updated)`);
        await runScan();
      } else {
        setLiveSyncMsg(`Sync warning: ${data.error || data.details}`);
      }
    } catch (e: any) {
      setLiveSyncMsg(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncingLive(false);
      setTimeout(() => setLiveSyncMsg(null), 4500);
    }
  };

  useEffect(() => {
    runScan();
  }, [config.indexFilter, config.lookbackDays, config.lowerPct, config.upperPct, config.inZoneOnly, config.highDeliveryOnly]);

  const runAIAnalysis = async () => {
    if (results.length === 0) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, config }),
      });
      if (!res.ok) throw new Error('AI Analysis failed');
      const data = await res.json();
      setAiAnalysis(data);
    } catch (err: any) {
      console.error('AI Analysis error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter & Sort results locally for immediate search responsiveness
  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];

    if (config.sectorFilter !== 'ALL') {
      list = list.filter(r => r.sector === config.sectorFilter);
    }

    if (config.searchQuery.trim()) {
      const q = config.searchQuery.toLowerCase();
      list = list.filter(r => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'zone_status') {
        const order = { IN_ZONE: 1, BELOW_ZONE: 2, ABOVE_ZONE: 3 };
        aVal = order[a.zone_status];
        bVal = order[b.zone_status];
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [results, config.sectorFilter, config.searchQuery, sortField, sortOrder]);

  const handleSort = (field: keyof ScanResult) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Metric Aggregations
  const inZoneCount = results.filter(r => r.zone_status === 'IN_ZONE').length;
  const highDelivCount = results.filter(r => r.high_delivery_flag).length;
  const avgDelivery = results.length > 0 ? (results.reduce((s, r) => s + r.delivery_pct, 0) / results.length).toFixed(1) : '0';

  return (
    <div className="space-y-3 pb-8">
      {/* Top Banner & Control Deck */}
      <div className={`p-3 rounded border transition-all ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-1.5">
                <span>ACCUMULATION ZONE SCANNER</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-normal">
                  +5% TO +6%
                </span>
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
              Institutional multi-period low anchor scanning with DuckDB delivery confirmation.
            </p>
          </div>

          {/* Account Balance Widget */}
          <div className="flex items-center gap-3">
            {account && (
              <div className={`px-3 py-1.5 rounded border flex flex-col items-end ${
                isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Available Balance</div>
                <div className={`text-sm font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  ₹{account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Cards (High Density) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`px-2.5 py-1.5 rounded border ${
              isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Universe</div>
              <div className="text-sm font-bold text-[#e4e4e7] font-mono flex items-center justify-between">
                <span>{results.length}</span>
                <span className="text-[9px] text-emerald-400 font-mono">STOCKS</span>
              </div>
            </div>

            <div className={`px-2.5 py-1.5 rounded border ${
              inZoneCount > 0
                ? isDark
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-mono font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>IN ZONE</span>
              </div>
              <div className="text-sm font-bold font-mono">
                {inZoneCount} <span className="text-[10px] font-normal text-[#71717a]">({results.length > 0 ? Math.round((inZoneCount / results.length) * 100) : 0}%)</span>
              </div>
            </div>

            <div className={`px-2.5 py-1.5 rounded border ${
              isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">Avg Deliv %</div>
              <div className="text-sm font-bold text-[#e4e4e7] font-mono">{avgDelivery}%</div>
            </div>

            <div className={`px-2.5 py-1.5 rounded border ${
              isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono font-semibold">High Deliv</div>
              <div className="text-sm font-bold text-teal-400 font-mono">{highDelivCount}</div>
            </div>
          </div>
        </div>

        {/* Primary Filter Bar */}
        <div className={`mt-3 pt-2.5 border-t ${isDark ? 'border-[#27272a]' : 'border-slate-200'} flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[280px]">
            {/* Index Selector */}
            <div className={`flex items-center p-0.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-100 border-slate-200'} text-[11px]`}>
              <select
                value={config.indexFilter}
                onChange={e => setConfig(prev => ({ ...prev, indexFilter: e.target.value }))}
                className={`py-1 px-2 rounded bg-transparent font-mono font-bold text-xs ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                } focus:outline-hidden`}
              >
                {ALL_INDICES_LIST.map(idx => (
                  <option key={idx} value={idx}>
                    {idx === 'ALL' ? '🌐 All Indices (150+ Stocks)' : `📊 ${idx}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Lookback Preset (Up to 5 Years) */}
            <div className={`flex items-center space-x-0.5 p-0.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-100 border-slate-200'} text-[11px]`}>
              {[
                { label: '1M', days: 22 },
                { label: '3M', days: 66 },
                { label: '6M', days: 132 },
                { label: '1Y', days: 252 },
                { label: '2Y', days: 504 },
                { label: '3Y', days: 756 },
                { label: '4Y', days: 1460 },
                { label: '5Y', days: 1825 },
              ].map(item => (
                <button
                  key={item.days}
                  onClick={() => setConfig(prev => ({ ...prev, lookbackDays: item.days }))}
                  className={`px-1.5 py-1 rounded text-[10px] font-mono font-medium transition-all ${
                    config.lookbackDays === item.days
                      ? 'bg-[#1c1c1f] text-emerald-400 border border-[#27272a] font-bold'
                      : isDark
                      ? 'text-[#71717a] hover:text-[#e4e4e7]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[160px] flex-1 max-w-xs">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
              <input
                type="text"
                placeholder="Search symbol, sector..."
                value={config.searchQuery}
                onChange={e => setConfig(prev => ({ ...prev, searchQuery: e.target.value }))}
                className={`w-full pl-7 pr-2.5 py-1 text-xs rounded border transition-all ${
                  isDark
                    ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7] placeholder-[#71717a] focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'
                } focus:outline-hidden font-mono`}
              />
            </div>
          </div>

          {/* Action Tools: Sync Live, Filters toggle, Refresh, AI Commentary, Export */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all ${
                isLiveMode
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  : isDark
                  ? 'bg-[#121214] border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
              title="Toggle between Paper Trading and Live Market Trading"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`} />
              <span>{isLiveMode ? 'LIVE TRADING' : 'PAPER MODE'}</span>
            </button>

            <button
              onClick={handleTriggerLiveSync}
              disabled={isSyncingLive}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all ${
                isSyncingLive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : isDark
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
              title="Sync live real-time market prices from NSE feed"
            >
              <Zap className={`w-3 h-3 ${isSyncingLive ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span className="text-[11px]">{isSyncingLive ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                showFilters
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : isDark
                  ? 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:bg-[#1c1c1f]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Params</span>
            </button>

            <button
              onClick={runScan}
              disabled={loading}
              className={`p-1.5 rounded border transition-all ${
                isDark ? 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#1c1c1f]' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Re-run Scan"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={runAIAnalysis}
              disabled={aiLoading || results.length === 0}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition-all border shadow-xs ${
                isDark
                  ? 'bg-[#121214] border-[#27272a] text-purple-300 hover:border-purple-500/50 hover:bg-[#1c1c1f]'
                  : 'bg-purple-50 border-purple-200 text-purple-800'
              }`}
            >
              <Sparkles className={`w-3 h-3 text-purple-400 ${aiLoading ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-bold">{aiLoading ? 'Analyzing...' : 'AI Report'}</span>
            </button>

            {/* Export Dropdown / Buttons */}
            <button
              onClick={() => exportScanToExcel(results, config)}
              className={`p-1.5 rounded border text-emerald-400 hover:bg-emerald-500/10 transition-colors ${
                isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'
              }`}
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => exportScanToPDF(results, config)}
              className={`p-1.5 rounded border text-rose-400 hover:bg-rose-500/10 transition-colors ${
                isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'
              }`}
              title="Export to PDF Report"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onSaveScan(`Scan_${config.indexFilter}_${config.lookbackDays}D_${new Date().toLocaleDateString()}`, config, results)}
              className={`p-1.5 rounded border text-amber-400 hover:bg-amber-500/10 transition-colors ${
                isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'
              }`}
              title="Bookmark / Save Analysis"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Market Sync Feedback & Active Quotes Ribbon */}
        {liveSyncMsg && (
          <div className="mt-2.5 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{liveSyncMsg}</span>
            </div>
            <span className="text-[10px] text-[#71717a]">Updated: {lastSyncTime}</span>
          </div>
        )}

        {/* Real-time Market Live Prices Strip */}
        <div className={`mt-2.5 pt-2 border-t ${isDark ? 'border-[#1c1c1f]' : 'border-slate-100'} flex items-center overflow-x-auto no-scrollbar space-x-4 text-[11px] font-mono py-0.5`}>
          <div className="flex items-center space-x-1.5 shrink-0 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] tracking-wider uppercase">Live Market Prices:</span>
          </div>
          {results.slice(0, 10).map(stk => (
            <div
              key={stk.symbol}
              onClick={() => onOpenStockDetail(stk.symbol, stk)}
              className={`shrink-0 flex items-center space-x-1.5 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                isDark ? 'bg-[#121214] hover:bg-[#18181b] border border-[#27272a]' : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span className="font-bold text-[#e4e4e7]">{stk.symbol}</span>
              <span className="font-bold text-emerald-400">₹{stk.latest_close.toFixed(2)}</span>
              <span className={`text-[10px] ${stk.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stk.change_pct >= 0 ? '+' : ''}{stk.change_pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Expandable Advanced Parameter Sliders */}
        {showFilters && (
          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-[#27272a]' : 'border-slate-200'} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs`}>
            {/* Capital Config */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Total Capital Amount:</label>
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
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Capital Investment / Trade:</label>
              <input
                type="number"
                value={config.initialCapitalPerTrade}
                onChange={e => setConfig(prev => ({ ...prev, initialCapitalPerTrade: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Target %:</label>
              <input
                type="number"
                step="0.5"
                value={config.targetPct}
                onChange={e => setConfig(prev => ({ ...prev, targetPct: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-emerald-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>Stop Loss %:</label>
              <input
                type="number"
                step="0.5"
                value={config.stopLossPct}
                onChange={e => setConfig(prev => ({ ...prev, stopLossPct: Number(e.target.value) }))}
                className={`w-full py-1 px-2.5 rounded border font-mono font-bold text-rose-400 text-xs ${
                  isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>

            {/* Zone Bounds */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium text-[11px]">
                <span className={isDark ? 'text-[#71717a]' : 'text-slate-400'}>Zone Corridor:</span>
                <span className="text-emerald-400 font-mono font-bold">+{config.lowerPct}% to +{config.upperPct}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={config.lowerPct}
                  onChange={e => setConfig(prev => ({ ...prev, lowerPct: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={config.upperPct}
                  onChange={e => setConfig(prev => ({ ...prev, upperPct: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            {/* Min Delivery */}
            <div className="space-y-1">
              <div className="flex justify-between font-medium text-[11px]">
                <span className={isDark ? 'text-[#71717a]' : 'text-slate-400'}>Min Delivery %:</span>
                <span className="text-teal-400 font-mono font-bold">{config.minDeliveryPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={config.minDeliveryPct}
                onChange={e => setConfig(prev => ({ ...prev, minDeliveryPct: Number(e.target.value) }))}
                className="w-full accent-teal-500"
              />
            </div>

            {/* Sector Filter */}
            <div className="space-y-1">
              <label className={`text-[11px] font-medium block ${isDark ? 'text-[#71717a]' : 'text-slate-400'}`}>Sector Category:</label>
              <select
                value={config.sectorFilter}
                onChange={e => setConfig(prev => ({ ...prev, sectorFilter: e.target.value }))}
                className={`w-full py-1 px-2 text-xs rounded border ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <option value="ALL">All Sectors ({sectors.length})</option>
                {sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Quick Toggles */}
            <div className="flex flex-col space-y-1.5 justify-center text-[11px]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.inZoneOnly}
                  onChange={e => setConfig(prev => ({ ...prev, inZoneOnly: e.target.checked }))}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className={isDark ? 'text-[#a1a1aa]' : 'text-slate-700'}>In-Zone Setups Only</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.highDeliveryOnly}
                  onChange={e => setConfig(prev => ({ ...prev, highDeliveryOnly: e.target.checked }))}
                  className="rounded text-teal-500 focus:ring-teal-500"
                />
                <span className={isDark ? 'text-[#a1a1aa]' : 'text-slate-700'}>High Delivery Flag Only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* AI Market Commentary Card (If generated) */}
      {aiAnalysis && (
        <div className={`p-3 rounded border transition-all ${
          isDark
            ? 'bg-[#0c0c0e] border-[#27272a]'
            : 'bg-purple-50/50 border-purple-200'
        } shadow-xs`}>
          <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-[#27272a]' : 'border-purple-200'}`}>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="font-bold text-xs uppercase tracking-tight font-mono text-purple-300">
                Gemini Institutional Accumulation Commentary
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
              gemini-2.5-flash
            </span>
          </div>

          <div className="mt-2.5 space-y-2.5 text-xs">
            <p className={`leading-relaxed text-xs ${isDark ? 'text-[#e4e4e7]' : 'text-slate-700'}`}>
              {aiAnalysis.summary}
            </p>

            {/* Key Insights Pills */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {aiAnalysis.keyInsights.map((insight, idx) => (
                <div key={idx} className={`p-2 rounded border ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-[#a1a1aa]' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="font-semibold text-purple-400 text-[10px] mb-0.5 flex items-center gap-1 font-mono uppercase">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Key Metric #{idx + 1}</span>
                  </div>
                  <p className="text-[11px] leading-normal">{insight}</p>
                </div>
              ))}
            </div>

            {/* Top AI Accumulation Candidates Table */}
            {aiAnalysis.accumulationCandidates && aiAnalysis.accumulationCandidates.length > 0 && (
              <div className="mt-2">
                <h3 className="font-semibold text-[10px] text-[#71717a] mb-1.5 uppercase font-mono tracking-wider">
                  Top High-Conviction Setups Identified by AI
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {aiAnalysis.accumulationCandidates.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => onOpenStockDetail(c.symbol)}
                      className={`p-2.5 rounded border cursor-pointer hover:border-emerald-500/60 transition-all ${
                        isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs font-mono text-emerald-400">{c.symbol}</span>
                        <span className={`text-[9px] font-bold font-mono px-1 py-0.2 rounded-xs ${
                          c.zoneQuality === 'A+' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          Grade {c.zoneQuality}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#a1a1aa] font-mono space-y-0.5 mb-1.5">
                        <div>Breakout Odds: <strong className="text-[#e4e4e7]">{c.breakoutProbabilityPct}%</strong></div>
                        <div>Target: <strong className="text-emerald-400">₹{c.recommendedTarget}</strong> | SL: <strong className="text-rose-400">₹{c.recommendedStopLoss}</strong></div>
                        <div>R:R Ratio: <strong className="text-teal-300">{c.riskRewardRatio}</strong></div>
                      </div>
                      <p className="text-[10px] text-[#71717a] italic line-clamp-2">{c.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy Verdict */}
            <div className={`p-2 rounded border flex items-center justify-between ${
              isDark ? 'bg-[#121214] border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold text-[11px] font-mono">Verdict: {aiAnalysis.strategyVerdict}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Results Table (High Density Terminal Style) */}
      <div className={`rounded border overflow-hidden transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-mono font-bold uppercase tracking-wider text-[10px] ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('symbol')}>
                  <div className="flex items-center space-x-1">
                    <span>Symbol</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 cursor-pointer" onClick={() => handleSort('latest_close')}>
                  <div className="flex items-center space-x-1">
                    <span>LTP (₹)</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 cursor-pointer" onClick={() => handleSort('period_low')}>
                  <div className="flex items-center space-x-1">
                    <span>Anchor Low</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5">Accumulation Corridor (+5-6%)</th>
                <th className="py-2.5 px-2.5 cursor-pointer" onClick={() => handleSort('zone_status')}>
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5">
                  <div className="flex items-center space-x-1 text-emerald-400">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>1:1 Trailing Stop Plan</span>
                  </div>
                </th>
                <th className="py-2.5 px-2.5 cursor-pointer" onClick={() => handleSort('delivery_pct')}>
                  <div className="flex items-center space-x-1">
                    <span>Delivery %</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 cursor-pointer" onClick={() => handleSort('volume_ratio')}>
                  <div className="flex items-center space-x-1">
                    <span>Vol Ratio</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 cursor-pointer text-center" onClick={() => handleSort('accumulation_score')}>
                  <div className="flex items-center justify-center space-x-1">
                    <span>Score</span>
                    <ArrowUpDown className="w-2.5 h-2.5" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'}`}>
              {filteredAndSortedResults.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#71717a]">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <AlertCircle className="w-6 h-6 text-[#71717a]" />
                      <p className="text-xs font-mono font-medium">No stocks matched the active scan criteria.</p>
                      <p className="text-[10px] text-[#71717a]">Adjust delivery threshold or lookback timeframe.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedResults.map(item => {
                  const isInZone = item.zone_status === 'IN_ZONE';
                  const isBelow = item.zone_status === 'BELOW_ZONE';
                  const isAbove = item.zone_status === 'ABOVE_ZONE';

                  return (
                    <tr
                      key={item.symbol}
                      className={`transition-colors group hover:bg-emerald-500/5 ${
                        isInZone
                          ? isDark
                            ? 'bg-emerald-950/15 border-l-2 border-l-emerald-500'
                            : 'bg-emerald-50/50 border-l-2 border-l-emerald-600'
                          : ''
                      }`}
                    >
                      {/* Stock Symbol & Name */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col cursor-pointer" onClick={() => onOpenStockDetail(item.symbol, item)}>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs font-mono group-hover:text-emerald-400 transition-colors">
                              {item.symbol}
                            </span>
                            <span className={`text-[9px] font-mono px-1 rounded-xs ${isDark ? 'bg-[#18181b] text-[#71717a] border border-[#27272a]' : 'bg-slate-100 text-slate-600'}`}>
                              {item.index_name.replace('NIFTY ', '')}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#71717a] truncate max-w-[150px]">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      {/* LTP & Change */}
                      <td className="py-2 px-2.5 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-[#e4e4e7]">₹{item.latest_close.toFixed(2)}</span>
                          {item.is_live && (
                            <span className="inline-flex items-center px-1 py-0.2 rounded-xs text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] font-medium flex items-center space-x-1 ${
                          item.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          <span>{item.change_pct >= 0 ? '+' : ''}{item.change_pct}%</span>
                          {item.day_high && item.day_low && item.day_high !== item.day_low && (
                            <span className="text-[9px] text-[#71717a] font-normal hidden xl:inline">
                              (H: ₹{item.day_high.toFixed(0)} L: ₹{item.day_low.toFixed(0)})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Period Low Anchor */}
                      <td className="py-2 px-2.5 font-mono text-[#a1a1aa]">
                        <div className="font-semibold text-xs">₹{item.period_low.toFixed(2)}</div>
                        <div className="text-[9px] text-[#71717a]">{item.period_low_date}</div>
                      </td>

                      {/* Accumulation Zone Range */}
                      <td className="py-2 px-2.5 font-mono">
                        <div className="text-xs font-medium text-emerald-400">
                          ₹{item.zone_lower} - ₹{item.zone_upper}
                        </div>
                        <div className="text-[9px] text-[#71717a]">
                          +{config.lowerPct}% to +{config.upperPct}% low
                        </div>
                      </td>

                      {/* Zone Status Badge */}
                      <td className="py-2 px-2.5">
                        {isInZone && (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-xs text-[9px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                            <span>IN ZONE</span>
                          </span>
                        )}
                        {isBelow && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[9px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Below ({item.distance_to_zone_pct}%)
                          </span>
                        )}
                        {isAbove && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-xs text-[9px] font-mono font-medium ${isDark ? 'bg-[#18181b] text-[#71717a] border border-[#27272a]' : 'bg-slate-100 text-slate-500'}`}>
                            Above (+{item.distance_to_zone_pct}%)
                          </span>
                        )}
                      </td>

                      {/* 1:1 Trailing Stop Tactical Plan */}
                      <td className="py-2 px-2.5 font-mono text-[11px]">
                        <div className="flex items-center space-x-1 text-slate-200">
                          <span className="text-rose-400 font-semibold">SL: ₹{item.tactical_plan?.initial_stop_loss || (item.latest_close * 0.975).toFixed(1)}</span>
                          <span className="text-[#71717a]">➔</span>
                          <span className="text-emerald-400 font-semibold">Tgt: ₹{item.tactical_plan?.target_price || (item.latest_close * 1.08).toFixed(1)}</span>
                        </div>
                        <div className="text-[9px] text-emerald-400/80 font-medium flex items-center gap-0.5 mt-0.5">
                          <span>⚡ +1% Move = +1% SL Ratchet</span>
                        </div>
                      </td>

                      {/* Delivery % & Progress */}
                      <td className="py-2 px-2.5 min-w-[110px]">
                        <div className="flex items-center justify-between text-xs font-mono font-bold">
                          <span className={item.high_delivery_flag ? 'text-teal-400' : 'text-[#a1a1aa]'}>
                            {item.delivery_pct}%
                          </span>
                          <span className="text-[9px] text-[#71717a]">20d: {item.avg_delivery_pct_20}%</span>
                        </div>
                        <div className={`w-full ${isDark ? 'bg-[#18181b]' : 'bg-slate-200'} rounded-full h-1 mt-1 overflow-hidden`}>
                          <div
                            className={`h-full rounded-full ${
                              item.delivery_pct >= 50 ? 'bg-teal-400' : item.delivery_pct >= 40 ? 'bg-emerald-500' : 'bg-[#71717a]'
                            }`}
                            style={{ width: `${Math.min(100, item.delivery_pct)}%` }}
                          />
                        </div>
                      </td>

                      {/* Volume Ratio */}
                      <td className="py-2 px-2.5 font-mono">
                        <div className={`font-semibold text-xs ${item.volume_ratio >= 1.5 ? 'text-emerald-400 font-bold' : 'text-[#a1a1aa]'}`}>
                          {item.volume_ratio}x
                        </div>
                        <div className="text-[9px] text-[#71717a] font-normal">
                          {(item.volume / 100000).toFixed(1)}L
                        </div>
                      </td>

                      {/* Sparkline */}
                      <td className="py-2 px-2.5">
                        {item.sparkline && item.sparkline.length > 5 ? (
                          <svg className="w-16 h-5 overflow-visible">
                            {(() => {
                              const min = Math.min(...item.sparkline);
                              const max = Math.max(...item.sparkline);
                              const range = max - min || 1;
                              const points = item.sparkline
                                .map((val, i) => {
                                  const x = (i / (item.sparkline.length - 1)) * 64;
                                  const y = 20 - ((val - min) / range) * 16;
                                  return `${x},${y}`;
                                })
                                .join(' ');
                              const isPositive = item.sparkline[item.sparkline.length - 1] >= item.sparkline[0];
                              return (
                                <polyline
                                  fill="none"
                                  stroke={isInZone ? '#10b981' : isPositive ? '#34d399' : '#f87171'}
                                  strokeWidth="1.25"
                                  points={points}
                                />
                              );
                            })()}
                          </svg>
                        ) : (
                          <span className="text-[#71717a] text-[10px]">--</span>
                        )}
                      </td>

                      {/* Accumulation Score */}
                      <td className="py-2 px-2.5 text-center">
                        <span className={`inline-block font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-xs ${
                          item.accumulation_score >= 80
                            ? 'bg-emerald-500 text-[#09090b]'
                            : item.accumulation_score >= 65
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isDark ? 'bg-[#18181b] text-[#71717a] border border-[#27272a]' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.accumulation_score}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onOpenStockDetail(item.symbol, item)}
                            className={`p-1 rounded border transition-colors ${
                              isDark ? 'border-[#27272a] bg-[#121214] text-[#a1a1aa] hover:text-emerald-400 hover:border-emerald-500' : 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                            title="Interactive Chart & Deep Dive"
                          >
                            <BarChart2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onOpenSetAlert(item.symbol, item.latest_close)}
                            className={`p-1 rounded border transition-colors ${
                              isDark ? 'border-[#27272a] bg-[#121214] text-[#a1a1aa] hover:text-amber-400 hover:border-amber-500' : 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                            title="Set Price/Zone Alert"
                          >
                            <Bell className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleExecuteTrade(item)}
                            disabled={isExecuting === item.symbol}
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[10px] font-bold font-mono border transition-all ${
                              isExecuting === item.symbol
                                ? (isLiveMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                                : isLiveMode
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 shadow-sm shadow-rose-500/5'
                                : isDark
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/5'
                                : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {isExecuting === item.symbol ? (
                              <RotateCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <TrendingUp className="w-3 h-3" />
                            )}
                            <span>{isExecuting === item.symbol ? 'EXECUTING' : (isLiveMode ? 'LIVE BUY' : 'BUY')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className={`p-2 px-3 border-t flex items-center justify-between text-[11px] font-mono ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div>
            Showing <strong className={isDark ? 'text-[#e4e4e7]' : 'text-slate-800'}>{filteredAndSortedResults.length}</strong> of {results.length} stocks
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>In Zone (+5% to +6%)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>High Delivery (&gt;50%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
