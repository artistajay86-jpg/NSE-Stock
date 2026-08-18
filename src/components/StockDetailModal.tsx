import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Bell, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Layers, 
  Calendar,
  Activity,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine, 
  ReferenceArea 
} from 'recharts';
import { HistoricalBar, ScanResult } from '../types';
import { CandlestickChart } from './CandlestickChart';

interface StockDetailModalProps {
  symbol: string;
  scanResult?: ScanResult;
  isDark: boolean;
  onClose: () => void;
  onSetAlert: (symbol: string, defaultPrice: number) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  symbol,
  scanResult,
  isDark,
  onClose,
  onSetAlert,
}) => {
  const [bars, setBars] = useState<HistoricalBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'>('6M');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [customSimGain, setCustomSimGain] = useState<number>(3.5);
  const [isTrackedSuccess, setIsTrackedSuccess] = useState<boolean>(false);
  const [liveData, setLiveData] = useState<{
    price: number;
    changePct: number;
    high: number;
    low: number;
    open: number;
    volume: number;
    isLive: boolean;
    timestamp: string;
  } | null>(null);

  const handleTrackActivePosition = async () => {
    try {
      const price = liveData?.price || (bars.length ? bars[bars.length - 1].close : 0);
      if (!price) return;

      const res = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          entryPrice: price,
          shares: 100,
          initialStopLossPct: 2.5,
          initialTargetPct: 8.0,
          notes: `Added from Accumulator analysis for ${symbol}. Trailing SL ratcheting active.`,
        }),
      });

      if (res.ok) {
        setIsTrackedSuccess(true);
        setActionMsg(`✓ Added ${symbol} to Active Trades Dashboard with Dynamic Upward-Only Trailing SL!`);
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (e) {
      console.error('Failed to track position:', e);
    }
  };

  useEffect(() => {
    fetchHistoricalBars();
    fetchLiveQuote();
  }, [symbol]);

  const fetchLiveQuote = async () => {
    try {
      const res = await fetch(`/api/stocks/${symbol}/live`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(data);
      }
    } catch {
      // Quiet failover
    }
  };

  const fetchHistoricalBars = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/${symbol}/history`);
      if (!res.ok) throw new Error('Failed to load historical data');
      const data = await res.json();
      setBars(data);
    } catch (err) {
      console.error('Error fetching stock bars:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTickerLive = async () => {
    setIsSyncingLive(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/downloader/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`Live market quote synced (${data.added} bars updated)`);
        await Promise.all([fetchHistoricalBars(), fetchLiveQuote()]);
      } else {
        setActionMsg(`Sync error: ${data.error}`);
      }
    } catch (e: any) {
      setActionMsg(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncingLive(false);
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleDeleteTickerData = async () => {
    if (!window.confirm(`Delete all historical bars for stock ticker "${symbol}" from DuckDB?`)) return;
    try {
      const res = await fetch(`/api/stocks/${symbol}/data`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`Deleted ${data.deletedBars || 0} bars for ${symbol}.`);
        setBars([]);
      }
    } catch (e: any) {
      setActionMsg(`Delete error: ${e.message}`);
    }
  };

  const generateAIDeepDive = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/stock-deepdive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, scanMetric: scanResult }),
      });
      if (!res.ok) throw new Error('Deep dive request failed');
      const data = await res.json();
      setAiReport(data.markdown);
    } catch (err) {
      console.error('AI Deep dive error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter bars based on timeframe
  const displayBars = React.useMemo(() => {
    if (bars.length === 0) return [];
    let days = bars.length;
    if (timeframe === '1M') days = 22;
    else if (timeframe === '3M') days = 66;
    else if (timeframe === '6M') days = 132;
    else if (timeframe === '1Y') days = 252;
    else if (timeframe === '3Y') days = 756;
    else if (timeframe === '5Y') days = 1825;
    return bars.slice(-days);
  }, [bars, timeframe]);

  // Calculate anchor low and zone for the selected chart window
  const chartMetrics = React.useMemo(() => {
    if (displayBars.length === 0 && !liveData && !scanResult) return null;
    let minLow = Infinity;
    let maxHigh = -Infinity;
    let minLowDate = '';

    for (const b of displayBars) {
      if (b.close < minLow) {
        minLow = b.close;
        minLowDate = b.date;
      }
      if (b.high > maxHigh) {
        maxHigh = b.high;
      }
    }

    const latest = displayBars[displayBars.length - 1];
    const latestPrice = liveData?.price || scanResult?.latest_close || latest?.close || 0;
    
    if (minLow === Infinity) {
      minLow = scanResult?.period_low || latestPrice * 0.95;
    }

    const zoneLower = scanResult?.zone_lower || +(minLow * 1.05).toFixed(2);
    const zoneUpper = scanResult?.zone_upper || +(minLow * 1.06).toFixed(2);

    return {
      minLow,
      minLowDate: minLowDate || scanResult?.period_low_date || '',
      maxHigh: Math.max(maxHigh, liveData?.high || 0),
      zoneLower,
      zoneUpper,
      latestPrice,
      latestDeliveryPct: latest?.delivery_pct || scanResult?.delivery_pct || 0,
      latestVolume: liveData?.volume || latest?.volume || scanResult?.volume || 0,
    };
  }, [displayBars, liveData, scanResult]);

  // Format chart data with rolling 20-day delivery SMA
  const chartData = React.useMemo(() => {
    const data = displayBars.map((b, idx, arr) => {
      const windowSlice = arr.slice(Math.max(0, idx - 19), idx + 1);
      const deliverySma = +(windowSlice.reduce((s, x) => s + x.delivery_pct, 0) / windowSlice.length).toFixed(1);
      return {
        date: b.date.substring(5), // MM-DD
        fullDate: b.date,
        close: b.close,
        open: b.open,
        high: b.high,
        low: b.low,
        volume: b.volume,
        deliveryQty: b.delivery_qty,
        deliveryPct: b.delivery_pct,
        deliverySma,
      };
    });

    if (data.length > 0 && liveData?.price) {
      data[data.length - 1].close = liveData.price;
      if (liveData.high) data[data.length - 1].high = Math.max(data[data.length - 1].high, liveData.high);
      if (liveData.low) data[data.length - 1].low = Math.min(data[data.length - 1].low, liveData.low);
    }
    return data;
  }, [displayBars, liveData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#09090b]/80 backdrop-blur-xs overflow-y-auto">
      <div className={`relative w-full max-w-5xl rounded border shadow-2xl overflow-hidden my-auto transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#e4e4e7]' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-3 px-4 border-b flex items-center justify-between ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">
              {symbol.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold font-mono tracking-tight">{symbol}</h2>
                {scanResult && (
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs ${
                    scanResult.zone_status === 'IN_ZONE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                      : scanResult.zone_status === 'BELOW_ZONE'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-[#18181b] text-[#71717a] border border-[#27272a]'
                  }`}>
                    {scanResult.zone_status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#71717a] font-mono">{scanResult?.name || 'National Stock Exchange of India (NSE)'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleTrackActivePosition}
              title="Track this stock as an active position with dynamic upward-only trailing stop loss"
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                isTrackedSuccess 
                  ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{isTrackedSuccess ? '✓ Tracked' : '+ Track Position'}</span>
            </button>

            <button
              onClick={handleSyncTickerLive}
              disabled={isSyncingLive}
              title="Sync live quote and latest tick for this stock"
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <Zap className={`w-3 h-3 ${isSyncingLive ? 'animate-spin' : ''}`} />
              <span>{isSyncingLive ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            <button
              onClick={handleDeleteTickerData}
              title="Delete historical bars for this stock from DuckDB"
              className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Data</span>
            </button>

            <button
              onClick={() => onSetAlert(symbol, chartMetrics?.latestPrice || 0)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Bell className="w-3 h-3" />
              <span>Set Alert</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded border border-[#27272a] hover:bg-[#18181b] text-[#71717a] hover:text-[#e4e4e7] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-3.5 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Current Close Price</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">₹{chartMetrics?.latestPrice.toFixed(2)}</div>
            </div>
            <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Anchor Period Low</div>
              <div className="text-base font-bold font-mono text-slate-200 mt-0.5">₹{chartMetrics?.minLow.toFixed(2)}</div>
            </div>
            <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Accumulation (+5% to +6%)</div>
              <div className="text-xs font-bold font-mono text-teal-400 mt-0.5">
                ₹{chartMetrics?.zoneLower} - ₹{chartMetrics?.zoneUpper}
              </div>
            </div>
            <div className={`p-2 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Delivery Volume %</div>
              <div className="text-base font-bold font-mono text-teal-300 mt-0.5">{chartMetrics?.latestDeliveryPct}%</div>
            </div>
          </div>

          {/* Detailed Period OHLCV & VWAP Strip (Updated for Selected Period / 3Y / 5Y Analysis) */}
          {(() => {
            if (displayBars.length === 0) return null;
            const firstBar = displayBars[0];
            const latestBar = displayBars[displayBars.length - 1];
            
            const open = firstBar?.open || 0;
            const high = Math.max(...displayBars.map(b => b.high), liveData?.high || 0);
            const low = Math.min(...displayBars.map(b => b.low), liveData?.low || Infinity);
            const close = liveData?.price || latestBar?.close || 0;
            
            const firstBarIndex = bars.findIndex(b => b.date === firstBar.date);
            const prevBar = firstBarIndex > 0 ? bars[firstBarIndex - 1] : firstBar;
            const prevClose = prevBar?.close || firstBar?.open || 0;

            let cumVolume = 0;
            let cumVolPrice = 0;
            for (const b of displayBars) {
              const typicalPrice = (b.high + b.low + b.close) / 3;
              cumVolume += b.volume;
              cumVolPrice += typicalPrice * b.volume;
            }
            const vwap = cumVolume > 0 ? +(cumVolPrice / cumVolume).toFixed(2) : +((high + low + 2 * close) / 4).toFixed(2);

            return (
              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#121214]/80 border-[#27272a]' : 'bg-slate-100 border-slate-200'}`}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] mb-1.5 flex items-center justify-between">
                  <span>Period Quote Details (OHLCV & VWAP) — {timeframe} Analysis ({displayBars.length} Bars)</span>
                  <span className="text-emerald-400">Reconciled</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-mono">
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">START CLOSE</div>
                    <div className="font-bold text-[#e4e4e7]">₹{prevClose.toFixed(2)}</div>
                  </div>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">PERIOD OPEN</div>
                    <div className="font-bold text-[#e4e4e7]">₹{open.toFixed(2)}</div>
                  </div>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">PERIOD HIGH</div>
                    <div className="font-bold text-emerald-400">₹{high.toFixed(2)}</div>
                  </div>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">PERIOD LOW</div>
                    <div className="font-bold text-rose-400">₹{low === Infinity ? '0.00' : low.toFixed(2)}</div>
                  </div>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">PERIOD CLOSE</div>
                    <div className="font-bold text-teal-400">₹{close.toFixed(2)}</div>
                  </div>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-[#18181b]' : 'bg-white'} border border-transparent`}>
                    <div className="text-[9px] text-[#71717a]">PERIOD VWAP</div>
                    <div className="font-bold text-purple-400">₹{vwap.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Timeframe Presets */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold uppercase text-[#e4e4e7]">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>OHLC Candlestick, Zone & Delivery Distribution</span>
            </div>

            <div className={`flex items-center space-x-0.5 p-0.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-100 border-slate-200'} text-[10px] font-mono`}>
              {(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded font-medium transition-all ${
                    timeframe === tf
                      ? 'bg-emerald-500 text-[#09090b] font-bold'
                      : isDark
                      ? 'text-[#71717a] hover:text-[#e4e4e7]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Main Candlestick, Zone & Delivery Bars Chart */}
          <CandlestickChart
            data={displayBars}
            height={260}
            isDark={isDark}
            symbol={symbol}
            zoneLower={chartMetrics?.zoneLower}
            zoneUpper={chartMetrics?.zoneUpper}
            anchorLow={chartMetrics?.minLow}
            showDelivery={true}
            showVolume={true}
          />

          {/* Dynamic Real-Time Continuous Trailing Stop Loss & Dynamic Expanding Target Calculator */}
          {(() => {
            const currentPrice = liveData?.price || (bars.length > 0 ? bars[bars.length - 1].close : 0);
            if (!currentPrice) return null;
            const initialSlPct = 2.5; // Fixed parameter ceiling
            const initialTargetPct = 8.0;
            const initialSl = +(currentPrice * (1 - initialSlPct / 100)).toFixed(2);
            const initialTarget = +(currentPrice * (1 + initialTargetPct / 100)).toFixed(2);

            // Dynamic live simulation values based on customSimGain
            const simPrice = +(currentPrice * (1 + customSimGain / 100)).toFixed(2);
            // Strictly enforce: dynamic SL can only move UPWARD (never downward below initial parameter stop loss)
            const rawDynamicSl = +(currentPrice * (1 - (initialSlPct - Math.max(0, customSimGain)) / 100)).toFixed(2);
            const dynamicSl = Math.max(initialSl, rawDynamicSl);
            const dynamicProfitLockedPct = +(customSimGain - initialSlPct).toFixed(2);
            
            // Dynamic progressive target expansion: Target expands upwards as stock climbs
            const dynamicTargetTier = Math.floor(Math.max(0, customSimGain - 4.0) / 4.0);
            const dynamicExpandedTargetPct = +(initialTargetPct + dynamicTargetTier * 4.0).toFixed(1);
            const dynamicExpandedTargetPrice = +(currentPrice * (1 + dynamicExpandedTargetPct / 100)).toFixed(2);

            const simulationSteps = [
              { gainPct: 0, label: 'Entry Base', price: currentPrice, sl: initialSl, slType: 'Max Risk Fixed (-2.5%)', target: initialTarget, targetLabel: '+8.0% T1', lockedProfit: 'Risk: -2.5% (Max Bound)' },
              { gainPct: 1.0, label: '+1.0% Advance', price: +(currentPrice * 1.01).toFixed(2), sl: +(currentPrice * 0.985).toFixed(2), slType: 'Ratchet SL Up', target: initialTarget, targetLabel: '+8.0% T1', lockedProfit: 'Risk cut to -1.5%' },
              { gainPct: 2.5, label: '+2.5% Breakeven', price: +(currentPrice * 1.025).toFixed(2), sl: currentPrice, slType: 'Breakeven Locked', target: initialTarget, targetLabel: '+8.0% T1', lockedProfit: '0.0% Risk Free' },
              { gainPct: 5.0, label: '+5.0% In Profit', price: +(currentPrice * 1.05).toFixed(2), sl: +(currentPrice * 1.025).toFixed(2), slType: 'Pure Profit Trailing', target: +(currentPrice * 1.08).toFixed(2), targetLabel: '+8.0% T1', lockedProfit: '+2.5% Locked Profit' },
              { gainPct: 8.0, label: '+8.0% T1 Hit', price: +(currentPrice * 1.08).toFixed(2), sl: +(currentPrice * 1.055).toFixed(2), slType: 'Target 1 Secured', target: +(currentPrice * 1.12).toFixed(2), targetLabel: 'Expanded -> +12% T2', lockedProfit: '+5.5% Locked Profit' },
              { gainPct: 12.0, label: '+12% Runner', price: +(currentPrice * 1.12).toFixed(2), sl: +(currentPrice * 1.095).toFixed(2), slType: 'Runner Mode Max', target: +(currentPrice * 1.16).toFixed(2), targetLabel: 'Expanded -> +16% T3', lockedProfit: '+9.5% Locked Profit' },
            ];

            return (
              <div className={`p-3 rounded border ${isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-wrap items-center justify-between pb-2 mb-2.5 border-b border-[#27272a] gap-2">
                  <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-emerald-400 uppercase">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dynamic Trailing Stop Loss &amp; Dynamic Target Execution Plan</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      UPWARD ONLY
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      MAX SL: -2.5% FIXED
                    </span>
                  </div>
                </div>

                <div className={`p-2 rounded border mb-3 text-[11px] font-mono leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-2 ${isDark ? 'bg-[#18181b] border-[#27272a] text-[#a1a1aa]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <div>
                    <span className="text-emerald-400 font-bold">1. Upward-Only Dynamic Ratchet:</span> Stop loss strictly advances upward with every higher price high. It <strong>never moves downward</strong> if the price pulls back.
                  </div>
                  <div>
                    <span className="text-rose-400 font-bold">2. Fixed Parameter Max Stop Loss:</span> Maximum downside loss is strictly capped at <strong>-2.5% (₹{initialSl})</strong> at entry and can never exceed this parameter boundary.
                  </div>
                </div>

                {/* Interactive Dynamic Price & Trailing Simulation Slider */}
                <div className={`p-2.5 rounded border mb-3 ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="text-[10px] uppercase font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
                      <span>Interactive Live Simulator:</span>
                      <span className="text-zinc-300">Price moves up by <strong className="text-emerald-400">+{customSimGain}%</strong></span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {[1.0, 2.5, 4.0, 6.0, 8.0, 10.0, 15.0].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setCustomSimGain(pct)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            customSimGain === pct
                              ? 'bg-emerald-500 text-black'
                              : isDark ? 'bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a]' : 'bg-white text-zinc-600 hover:text-zinc-900 border border-slate-200'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.1"
                    value={customSimGain}
                    onChange={e => setCustomSimGain(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2.5"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className={`p-1.5 rounded border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                      <div className="text-[9px] text-[#71717a] uppercase">Simulated Stock Price</div>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5">₹{simPrice}</div>
                      <div className="text-[9px] text-zinc-400">(+{customSimGain}% from entry)</div>
                    </div>

                    <div className={`p-1.5 rounded border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                      <div className="text-[9px] text-[#71717a] uppercase">Dynamic Trailing Stop Loss</div>
                      <div className={`font-bold text-sm mt-0.5 ${customSimGain >= 2.5 ? 'text-emerald-400' : 'text-rose-400'}`}>₹{dynamicSl}</div>
                      <div className="text-[9px] text-zinc-400">({customSimGain >= 2.5 ? `+${dynamicProfitLockedPct}% Locked` : `${dynamicProfitLockedPct}% Risk`})</div>
                    </div>

                    <div className={`p-1.5 rounded border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                      <div className="text-[9px] text-[#71717a] uppercase">Dynamic Expanded Target</div>
                      <div className="font-bold text-teal-300 text-sm mt-0.5">₹{dynamicExpandedTargetPrice}</div>
                      <div className="text-[9px] text-teal-400/90">(+{dynamicExpandedTargetPct}% Next Tier)</div>
                    </div>

                    <div className={`p-1.5 rounded border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-slate-200'}`}>
                      <div className="text-[9px] text-[#71717a] uppercase">Dynamic Protection Status</div>
                      <div className="font-bold text-xs mt-1 text-emerald-400">
                        {customSimGain >= 8.0 ? '🎯 Runner Mode Active' : customSimGain >= 2.5 ? '🛡️ Risk Free Protected' : '⚡ Ratchet Active'}
                      </div>
                      <div className="text-[9px] text-zinc-400">Continuously Adjusting</div>
                    </div>
                  </div>
                </div>

                {/* Progressive Milestone Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                  {simulationSteps.map(step => (
                    <div
                      key={step.gainPct}
                      className={`p-2 rounded border transition-all ${
                        step.gainPct === 0
                          ? isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                          : step.gainPct >= 5.0
                          ? isDark ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-emerald-400 uppercase">{step.label}</div>
                      <div className="text-xs font-bold text-[#e4e4e7] mt-0.5">₹{step.price}</div>
                      <div className="text-[9px] text-[#71717a] mt-1">Stop Loss: <strong className="text-rose-400">₹{step.sl}</strong></div>
                      <div className="text-[9px] text-[#71717a]">Target: <strong className="text-teal-400">{step.targetLabel}</strong></div>
                      <div className="text-[9px] font-medium text-emerald-400 mt-1">{step.lockedProfit}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Gemini AI Deep Dive Analysis */}
          <div className={`p-3 rounded border ${
            isDark
              ? 'bg-[#0c0c0e] border-[#27272a]'
              : 'bg-purple-50/50 border-purple-200'
          }`}>
            <div className={`flex items-center justify-between pb-2 mb-2 border-b ${isDark ? 'border-[#27272a]' : 'border-purple-200'}`}>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <h3 className="font-bold text-xs uppercase font-mono text-purple-300">
                  Gemini AI Institutional Deep Dive
                </h3>
              </div>
              <button
                onClick={generateAIDeepDive}
                disabled={aiLoading}
                className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Synthesizing...' : aiReport ? 'Re-generate' : 'Generate Deep Dive'}</span>
              </button>
            </div>

            {aiReport ? (
              <div className={`text-xs leading-relaxed space-y-2 prose prose-invert max-w-none ${isDark ? 'text-[#e4e4e7]' : 'text-slate-700'}`}>
                <div className="whitespace-pre-line text-xs font-sans">{aiReport}</div>
              </div>
            ) : (
              <div className="py-4 text-center text-[#71717a] font-mono text-xs">
                Click "Generate Deep Dive" to get Wyckoff accumulation analysis, volume absorption breakdown, and strategic entry plan for {symbol}.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-2.5 px-4 border-t flex items-center justify-between text-xs font-mono ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className="text-[11px]">Powered by DuckDB Columnar Analytical Engine.</div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
