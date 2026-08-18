import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '../lib/api';
import { 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Plus, 
  RefreshCw, 
  Sliders, 
  ExternalLink, 
  Edit3, 
  XCircle, 
  Trash2, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Search,
  Filter,
  DollarSign,
  Lock,
  BarChart2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ActivePosition, PositionProtectionStatus, TradingAccount } from '../types';

interface ActivePositionsViewProps {
  isDark: boolean;
  onOpenStockDetail: (symbol: string) => void;
  onOpenSetAlert?: (symbol: string, defaultPrice: number) => void;
}

export const ActivePositionsView: React.FC<ActivePositionsViewProps> = ({
  isDark,
  onOpenStockDetail,
  onOpenSetAlert,
}) => {
  const [positions, setPositions] = useState<ActivePosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(10);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [protectionFilter, setProtectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<ActivePosition | null>(null);

  // Paper Trading Account State
  const [account, setAccount] = useState<TradingAccount | null>(null);

  // Add position form
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [newEntryPrice, setNewEntryPrice] = useState<string>('');
  const [newShares, setNewShares] = useState<string>('100');
  const [newEntryDate, setNewEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newStopLossPct, setNewStopLossPct] = useState<string>('2.5');
  const [newTargetPct, setNewTargetPct] = useState<string>('8.0');
  const [newNotes, setNewNotes] = useState<string>('');

  // Close position form
  const [closeExitPrice, setCloseExitPrice] = useState<string>('');
  const [closeExitDate, setCloseExitDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // In-card simulation state mapped by position id
  const [simGains, setSimGains] = useState<Record<string, number>>({});
  const [expandedSimulators, setExpandedSimulators] = useState<Record<string, boolean>>({});

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const [posData, accData] = await Promise.all([
        fetchWithAuth('/api/positions'),
        fetchWithAuth('/api/account')
      ]);

      if (posData.positions) {
        setPositions(posData.positions);
        setLastRefreshed(new Date());
      }
      setAccount(accData);
    } catch (e) {
      console.error('Failed to fetch active positions or account:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchPositions();
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalSec]);

  // Summary Metrics calculations
  const openPositions = useMemo(() => positions.filter(p => p.status === 'OPEN'), [positions]);
  
  const totalCapitalInvested = useMemo(() => {
    return openPositions.reduce((acc, p) => acc + (p.investedAmount || (p.entryPrice * p.shares)), 0);
  }, [openPositions]);

  const currentPortfolioValue = useMemo(() => {
    return openPositions.reduce((acc, p) => acc + (p.currentPrice * p.shares), 0);
  }, [openPositions]);

  const totalUnrealizedPnL = useMemo(() => {
    return openPositions.reduce((acc, p) => acc + p.unrealizedPnL, 0);
  }, [openPositions]);

  const totalUnrealizedPnLPct = useMemo(() => {
    if (totalCapitalInvested === 0) return 0;
    return +((totalUnrealizedPnL / totalCapitalInvested) * 100).toFixed(2);
  }, [totalCapitalInvested, totalUnrealizedPnL]);

  const totalLockedProfits = useMemo(() => {
    return openPositions.reduce((acc, p) => acc + (p.lockedProfitAmount || 0), 0);
  }, [openPositions]);

  // Breakdown counts
  const protectionCounts = useMemo(() => {
    const counts = {
      RUNNER_MODE: 0,
      PROFIT_SECURED: 0,
      BREAKEVEN_LOCKED: 0,
      RATCHET_ACTIVE: 0,
      BASE_RISK: 0,
      SL_TRIGGERED: 0,
      TARGET_HIT: 0,
    };
    openPositions.forEach(p => {
      if (counts[p.protectionStatus] !== undefined) {
        counts[p.protectionStatus]++;
      }
    });
    return counts;
  }, [openPositions]);

  // Filtered positions list
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
      if (statusFilter === 'OPEN' && p.status !== 'OPEN') return false;
      if (statusFilter === 'CLOSED' && p.status !== 'CLOSED') return false;
      if (protectionFilter !== 'ALL' && p.protectionStatus !== protectionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSym = p.symbol.toLowerCase().includes(q);
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesSector = (p.sector || '').toLowerCase().includes(q);
        if (!matchesSym && !matchesName && !matchesSector) return false;
      }
      return true;
    });
  }, [positions, statusFilter, protectionFilter, searchQuery]);

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newEntryPrice) return;

    try {
      await fetchWithAuth('/api/positions', {
        method: 'POST',
        body: JSON.stringify({
          symbol: newSymbol.trim().toUpperCase(),
          entryPrice: Number(newEntryPrice),
          shares: Number(newShares) || 100,
          entryDate: newEntryDate,
          initialStopLossPct: Number(newStopLossPct) || 2.5,
          initialTargetPct: Number(newTargetPct) || 8.0,
          notes: newNotes,
          isLive: false // Manual adds always default to paper for safety
        }),
      });

      setIsAddModalOpen(false);
      setNewSymbol('');
      setNewEntryPrice('');
      setNewShares('100');
      setNewNotes('');
      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClosePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition || !closeExitPrice) return;

    try {
      await fetchWithAuth(`/api/positions/${selectedPosition.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          exitPrice: Number(closeExitPrice),
          exitDate: closeExitDate,
        }),
      });

      setIsCloseModalOpen(false);
      setSelectedPosition(null);
      setCloseExitPrice('');
      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePosition = async (id: string, symbol: string) => {
    if (!window.confirm(`Are you sure you want to delete active position for ${symbol}?`)) return;
    try {
      await fetchWithAuth(`/api/positions/${id}`, { method: 'DELETE' });
      fetchPositions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status: PositionProtectionStatus) => {
    switch (status) {
      case 'RUNNER_MODE':
        return {
          label: 'RUNNER MODE ACTIVE',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: Zap,
          desc: 'Target dynamically expanding upwards. Stop loss locking high compounding profits.'
        };
      case 'PROFIT_SECURED':
        return {
          label: 'PURE PROFIT LOCKED',
          bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
          icon: Lock,
          desc: 'Stop loss is above entry price. Guaranteed positive return secured.'
        };
      case 'BREAKEVEN_LOCKED':
        return {
          label: 'BREAKEVEN PROTECTED',
          bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: ShieldCheck,
          desc: 'Zero downside capital risk. Trailing SL moved to entry breakeven.'
        };
      case 'RATCHET_ACTIVE':
        return {
          label: 'RISK RATCHET ACTIVE',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: TrendingUp,
          desc: 'Stop loss moved upward from entry level, cutting initial downside risk.'
        };
      case 'SL_TRIGGERED':
        return {
          label: 'STOP LOSS TRIGGERED',
          bg: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
          icon: AlertTriangle,
          desc: 'Current price reached or breached dynamic trailing stop loss.'
        };
      case 'TARGET_HIT':
        return {
          label: 'DYNAMIC TARGET HIT',
          bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          icon: CheckCircle2,
          desc: 'Price reached dynamic profit target milestone.'
        };
      case 'BASE_RISK':
      default:
        return {
          label: 'MAX RISK CAPPED (-2.5%)',
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          icon: ShieldAlert,
          desc: 'Initial position. Stop loss strictly fixed at configured maximum loss bound.'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Real-Time Portfolio Summary Banner */}
      <div className={`p-4 rounded-xl border transition-colors ${
        isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#27272a]">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold font-mono text-[#e4e4e7] flex items-center space-x-2">
                  <span>Ongoing Positions &amp; Dynamic Trailing Stop-Loss Dashboard</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase animate-pulse">
                    Live Continuous Trail
                  </span>
                </h1>
                <p className={`text-xs ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                  Real-time active trade status monitoring with <strong>upward-only continuous trailing stop loss</strong> and <strong>strictly capped maximum risk parameters</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 bg-[#18181b] p-1 rounded-lg border border-[#27272a] text-xs font-mono">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2 py-1 rounded flex items-center space-x-1 transition-colors ${
                  autoRefresh ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span>{autoRefresh ? `${refreshIntervalSec}s Live` : 'Paused'}</span>
              </button>

              <button
                type="button"
                onClick={fetchPositions}
                disabled={loading}
                className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-white transition-colors text-xs"
                title="Refresh Quotes Now"
              >
                Sync Now
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-900/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Position</span>
            </button>
          </div>
        </div>

        {/* Real-time Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-3">
          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center justify-between">
              <span>Available Cash</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className={`text-sm sm:text-base font-bold mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ₹{account?.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Available for paper trading
            </div>
          </div>

          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
              <span>Capital Invested</span>
              <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="text-sm sm:text-base font-bold text-[#e4e4e7] mt-1">
              ₹{totalCapitalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              {openPositions.length} active ongoing trade{openPositions.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
              <span>Current Market Value</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm sm:text-base font-bold text-emerald-400 mt-1">
              ₹{currentPortfolioValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Live quote synchronized
            </div>
          </div>

          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
              <span>Net Unrealized P&amp;L</span>
              <span className={`text-[10px] font-bold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalUnrealizedPnLPct >= 0 ? `+${totalUnrealizedPnLPct}%` : `${totalUnrealizedPnLPct}%`}
              </span>
            </div>
            <div className={`text-sm sm:text-base font-bold mt-1 ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Cumulative live position profit
            </div>
          </div>

          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-teal-400 uppercase font-bold flex items-center justify-between">
              <span>Guaranteed Locked Profit</span>
              <Lock className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="text-sm sm:text-base font-bold text-teal-300 mt-1">
              +₹{totalLockedProfits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Protected by Upward-Only Trailing SL
            </div>
          </div>

          <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
              <span>Risk Health Matrix</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-center space-x-1.5 mt-1 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold" title="Runners">
                {protectionCounts.RUNNER_MODE} Runner
              </span>
              <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold" title="Risk Free / In Profit">
                {protectionCounts.PROFIT_SECURED + protectionCounts.BREAKEVEN_LOCKED} Risk-Free
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Max SL strictly bounded to -2.5%
            </div>
          </div>
        </div>
      </div>

      {/* Filter & View Mode Controls Bar */}
      <div className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs font-mono ${
        isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tab Filter */}
          <div className="flex items-center space-x-1 bg-[#18181b] p-0.5 rounded border border-[#27272a]">
            {(['OPEN', 'CLOSED', 'ALL'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  statusFilter === tab
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab === 'OPEN' ? `Active Trades (${openPositions.length})` : tab === 'CLOSED' ? 'Closed Trades' : 'All Trades'}
              </button>
            ))}
          </div>

          {/* Protection Status Filter */}
          <div className="flex items-center space-x-1 bg-[#18181b] p-0.5 rounded border border-[#27272a]">
            {[
              { id: 'ALL', label: 'All Status' },
              { id: 'RUNNER_MODE', label: 'Runners' },
              { id: 'PROFIT_SECURED', label: 'In Profit' },
              { id: 'BREAKEVEN_LOCKED', label: 'Breakeven' },
              { id: 'BASE_RISK', label: 'Base Risk' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProtectionFilter(f.id)}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  protectionFilter === f.id
                    ? 'bg-[#27272a] text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol, sector..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`pl-8 pr-3 py-1 rounded text-xs border outline-none font-mono ${
                isDark ? 'bg-[#18181b] border-[#27272a] text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
              }`}
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-[#18181b] p-0.5 rounded border border-[#27272a]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2 py-1 rounded text-xs ${viewMode === 'cards' ? 'bg-[#27272a] text-emerald-400 font-bold' : 'text-zinc-400'}`}
            >
              Detailed Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded text-xs ${viewMode === 'table' ? 'bg-[#27272a] text-emerald-400 font-bold' : 'text-zinc-400'}`}
            >
              Compact Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Positions Cards or Table */}
      {filteredPositions.length === 0 ? (
        <div className={`p-12 rounded-xl border text-center font-mono ${
          isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'
        }`}>
          <ShieldAlert className="w-12 h-12 text-zinc-500 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold text-zinc-300">No active positions matching current filter</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            Add a new ongoing position to start continuous dynamic trailing stop loss tracking and dynamic progressive target calculations.
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ongoing Trade</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Detailed Dynamic Position Cards */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredPositions.map(pos => {
            const badge = getStatusBadge(pos.protectionStatus);
            const isWinner = pos.unrealizedPnL >= 0;
            const simGain = simGains[pos.id] !== undefined ? simGains[pos.id] : pos.maxGainFromEntryPct;
            const isSimExpanded = !!expandedSimulators[pos.id];

            // Real-time simulated price calculation if slider adjusted
            const liveOrSimPrice = +(pos.entryPrice * (1 + simGain / 100)).toFixed(2);
            const simRawSl = +(pos.entryPrice * (1 - (pos.initialStopLossPct - Math.max(0, simGain)) / 100)).toFixed(2);
            const calculatedSimSl = Math.max(pos.initialStopLossPrice, simRawSl);
            const simLockedProfitPct = +(simGain - pos.initialStopLossPct).toFixed(2);

            const simTargetTier = Math.floor(Math.max(0, simGain - 4.0) / 4.0);
            const simTargetPct = +(pos.initialTargetPct + simTargetTier * 4.0).toFixed(1);
            const simTargetPrice = +(pos.entryPrice * (1 + simTargetPct / 100)).toFixed(2);

            // Buffer distance between current price and dynamic trailing stop loss
            const slDistancePct = +(((pos.currentPrice - pos.dynamicTrailingStopLoss) / pos.currentPrice) * 100).toFixed(2);

            return (
              <div
                key={pos.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isDark ? 'bg-[#121214] border-[#27272a] hover:border-emerald-500/40' : 'bg-white border-slate-200 shadow-sm hover:border-emerald-500'
                }`}
              >
                {/* Card Header */}
                <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-[#18181b]/70 border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div 
                      onClick={() => onOpenStockDetail(pos.symbol)}
                      className="cursor-pointer group flex items-center space-x-2"
                    >
                      <span className="font-bold font-mono text-base text-[#e4e4e7] group-hover:text-emerald-400 transition-colors">
                        {pos.symbol}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {pos.sector}
                    </span>
                    {pos.isLive && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                      {pos.indexName}
                    </span>
                  </div>

                  {/* Protection Status Badge */}
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold flex items-center space-x-1 ${badge.bg}`}>
                      <badge.icon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    {pos.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPosition(pos);
                          setCloseExitPrice(pos.currentPrice.toString());
                          setIsCloseModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-mono font-bold transition-colors"
                      >
                        Exit Trade
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Main Metrics Body */}
                <div className="p-4 space-y-4">
                  {/* Primary 3 Pillars: Current Price, Entry Price, Calculated Dynamic Stop Loss */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                    {/* Current Market Price */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
                        <span>Current Price</span>
                        <span className={`font-bold text-[10px] ${pos.currentPriceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.currentPriceChangePct >= 0 ? `+${pos.currentPriceChangePct}%` : `${pos.currentPriceChangePct}%`}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-[#e4e4e7] mt-1">
                        ₹{pos.currentPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Peak: <strong className="text-emerald-400">₹{pos.highestPriceReached.toFixed(2)}</strong> (+{pos.maxGainFromEntryPct}%)
                      </div>
                    </div>

                    {/* Entry Price & Shares */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[10px] text-[#71717a] uppercase font-bold flex items-center justify-between">
                        <span>Entry Price</span>
                        <span className="text-zinc-400">{pos.entryDate}</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-zinc-300 mt-1">
                        ₹{pos.entryPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {pos.shares} Qty (₹{pos.investedAmount.toLocaleString('en-IN')})
                      </div>
                    </div>

                    {/* CALCULATED DYNAMIC TRAILING STOP LOSS VALUE */}
                    <div className={`p-2.5 rounded-lg border relative overflow-hidden ${
                      pos.dynamicTrailingStopLoss > pos.entryPrice
                        ? isDark ? 'bg-teal-950/20 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-900'
                        : isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="text-[10px] uppercase font-bold flex items-center justify-between text-teal-400">
                        <span>Dynamic Trailing SL</span>
                        <Lock className="w-3 h-3" />
                      </div>
                      <div className="text-base sm:text-lg font-bold text-teal-300 mt-1">
                        ₹{pos.dynamicTrailingStopLoss.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-teal-400/90 font-medium">
                        {pos.dynamicTrailingStopLoss > pos.entryPrice ? (
                          <span>+{pos.dynamicTrailingStopLossPct}% Locked Profit</span>
                        ) : pos.dynamicTrailingStopLoss === pos.entryPrice ? (
                          <span className="text-blue-400">0.0% Breakeven (0 Risk)</span>
                        ) : (
                          <span className="text-amber-400">{pos.dynamicTrailingStopLossPct}% Reduced Risk</span>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Progressive Target */}
                    <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center justify-between">
                        <span>Dynamic Target</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                          Tier {pos.dynamicTargetTier + 1}
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-purple-300 mt-1">
                        ₹{pos.dynamicTargetPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-purple-400">
                        +{pos.dynamicTargetPct}% Expanded Target
                      </div>
                    </div>
                  </div>

                  {/* Visual Dynamic Trailing Risk & Reward Progress Bar */}
                  <div className={`p-3 rounded-lg border font-mono ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-zinc-400">
                        Initial Stop: <strong className="text-rose-400">₹{pos.initialStopLossPrice} (-{pos.initialStopLossPct}% Fixed Max)</strong>
                      </span>
                      <span className="text-zinc-300">
                        Trailing Stop: <strong className={pos.dynamicTrailingStopLoss >= pos.entryPrice ? 'text-teal-300' : 'text-amber-400'}>₹{pos.dynamicTrailingStopLoss}</strong> ({slDistancePct}% buffer)
                      </span>
                      <span className="text-purple-300">
                        Dynamic Target: <strong>₹{pos.dynamicTargetPrice} (+{pos.dynamicTargetPct}%)</strong>
                      </span>
                    </div>

                    {/* Multi-tier dynamic visual bar */}
                    <div className="relative w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex items-center">
                      {/* Fixed Initial Max SL Bound Marker */}
                      <div className="absolute left-[5%] top-0 bottom-0 w-1 bg-rose-500 z-10" title="Fixed Initial Max Stop Loss" />
                      
                      {/* Entry Price Breakeven Marker */}
                      <div className="absolute left-[25%] top-0 bottom-0 w-1 bg-zinc-400 z-10" title="Entry Price Breakeven (0%)" />
                      
                      {/* Dynamic Trailing Stop loss filled zone */}
                      {(() => {
                        const minRange = pos.initialStopLossPrice;
                        const maxRange = pos.dynamicTargetPrice;
                        const totalSpread = maxRange - minRange;
                        if (totalSpread <= 0) return null;

                        const slPosPct = Math.min(100, Math.max(0, ((pos.dynamicTrailingStopLoss - minRange) / totalSpread) * 100));
                        const curPosPct = Math.min(100, Math.max(0, ((pos.currentPrice - minRange) / totalSpread) * 100));

                        return (
                          <>
                            <div 
                              className="h-full bg-teal-500/30 transition-all duration-300"
                              style={{ width: `${slPosPct}%` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-2.5 h-3 bg-emerald-400 rounded-full shadow-lg border border-black z-20 -ml-1 transition-all duration-300"
                              style={{ left: `${curPosPct}%` }}
                              title={`Current Price ₹${pos.currentPrice}`}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-1.5 h-3 bg-teal-300 rounded-full z-20 -ml-0.5 transition-all duration-300"
                              style={{ left: `${slPosPct}%` }}
                              title={`Dynamic Trailing SL ₹${pos.dynamicTrailingStopLoss}`}
                            />
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5">
                      <span>Max Loss Bound: -{pos.initialStopLossPct}%</span>
                      <span>Entry: ₹{pos.entryPrice}</span>
                      <span className="text-emerald-400 font-bold">Unrealized PnL: {isWinner ? '+' : ''}₹{pos.unrealizedPnL} ({isWinner ? '+' : ''}{pos.unrealizedPnLPct}%)</span>
                      <span className="text-purple-400">Target T{pos.dynamicTargetTier + 1}</span>
                    </div>
                  </div>

                  {/* Notes / Strategy Rationale if present */}
                  {pos.notes && (
                    <div className={`p-2 rounded border text-xs font-mono ${
                      isDark ? 'bg-[#18181b]/50 border-[#27272a] text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <span className="text-[#71717a] uppercase font-bold text-[10px]">Trade Strategy Notes: </span>
                      <span>{pos.notes}</span>
                    </div>
                  )}

                  {/* Interactive Dynamic Price & Trailing Simulator Toggle */}
                  <div className={`rounded-lg border overflow-hidden ${
                    isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setExpandedSimulators(prev => ({ ...prev, [pos.id]: !prev[pos.id] }))}
                      className="w-full p-2.5 flex items-center justify-between text-xs font-mono font-bold text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Interactive Live Trailing Simulator ({pos.symbol})</span>
                      </div>
                      <div className="flex items-center space-x-1 text-[11px] text-zinc-400">
                        <span>{isSimExpanded ? 'Hide Simulator' : 'Test Upward Ratchet'}</span>
                        {isSimExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {isSimExpanded && (
                      <div className="p-3 border-t border-[#27272a] space-y-3 font-mono">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">
                            Simulate Price Advance: <strong className="text-emerald-400">+{simGain.toFixed(1)}%</strong>
                          </span>
                          <div className="flex items-center space-x-1">
                            {[1.0, 2.5, 5.0, 8.0, 12.0, 15.0].map(pct => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setSimGains(prev => ({ ...prev, [pos.id]: pct }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  simGain === pct
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
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
                          value={simGain}
                          onChange={e => setSimGains(prev => ({ ...prev, [pos.id]: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
                            <div className="text-[9px] text-[#71717a] uppercase">Simulated Price</div>
                            <div className="font-bold text-emerald-400 text-sm mt-0.5">₹{liveOrSimPrice}</div>
                            <div className="text-[9px] text-zinc-400">(+{simGain.toFixed(1)}%)</div>
                          </div>

                          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
                            <div className="text-[9px] text-[#71717a] uppercase">Dynamic Trailing SL</div>
                            <div className={`font-bold text-sm mt-0.5 ${simGain >= 2.5 ? 'text-teal-300' : 'text-amber-400'}`}>
                              ₹{calculatedSimSl}
                            </div>
                            <div className="text-[9px] text-zinc-400">
                              {simGain >= 2.5 ? `+${simLockedProfitPct}% Locked` : `${simLockedProfitPct}% Risk`}
                            </div>
                          </div>

                          <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
                            <div className="text-[9px] text-[#71717a] uppercase">Expanding Target</div>
                            <div className="font-bold text-purple-300 text-sm mt-0.5">₹{simTargetPrice}</div>
                            <div className="text-[9px] text-purple-400">(+{simTargetPct}% Tier {simTargetTier + 1})</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className={`p-2.5 border-t flex items-center justify-between text-xs font-mono ${
                  isDark ? 'bg-[#18181b]/50 border-[#27272a]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onOpenStockDetail(pos.symbol)}
                      className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white flex items-center space-x-1 transition-colors text-xs"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Chart &amp; Plan</span>
                    </button>

                    {onOpenSetAlert && (
                      <button
                        type="button"
                        onClick={() => onOpenSetAlert(pos.symbol, pos.dynamicTrailingStopLoss)}
                        className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white transition-colors text-xs"
                      >
                        Set SL Alert
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleDeletePosition(pos.id, pos.symbol)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Delete Trade Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact Trading Table View */
        <div className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className={`border-b ${isDark ? 'bg-[#18181b] border-[#27272a] text-[#a1a1aa]' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                <tr>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-2.5">Entry Date</th>
                  <th className="py-2.5 px-2.5">Entry (₹)</th>
                  <th className="py-2.5 px-2.5">Current (₹)</th>
                  <th className="py-2.5 px-2.5">Peak (₹)</th>
                  <th className="py-2.5 px-2.5">Dynamic Trailing SL (₹)</th>
                  <th className="py-2.5 px-2.5">Target (₹)</th>
                  <th className="py-2.5 px-2.5">Unrealized P&amp;L</th>
                  <th className="py-2.5 px-2.5">Protected Profit</th>
                  <th className="py-2.5 px-2.5">Protection Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'}`}>
                {filteredPositions.map(pos => {
                  const badge = getStatusBadge(pos.protectionStatus);
                  const isWin = pos.unrealizedPnL >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="py-2 px-3">
                        <div 
                          className="font-bold text-white cursor-pointer hover:text-emerald-400 flex items-center space-x-1"
                          onClick={() => onOpenStockDetail(pos.symbol)}
                        >
                          <span>{pos.symbol}</span>
                          {pos.isLive && (
                            <span className="flex items-center text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 rounded">LIVE</span>
                          )}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </div>
                        <div className="text-[10px] text-zinc-500">{pos.sector}</div>
                      </td>
                      <td className="py-2 px-2.5 text-zinc-400">{pos.entryDate}</td>
                      <td className="py-2 px-2.5 font-bold text-zinc-300">₹{pos.entryPrice.toFixed(2)}</td>
                      <td className="py-2 px-2.5 font-bold text-emerald-400">
                        <div>₹{pos.currentPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-zinc-400">{pos.currentPriceChangePct >= 0 ? `+${pos.currentPriceChangePct}%` : `${pos.currentPriceChangePct}%`}</div>
                      </td>
                      <td className="py-2 px-2.5 text-zinc-300 font-bold">₹{pos.highestPriceReached.toFixed(2)}</td>
                      
                      {/* CALCULATED DYNAMIC TRAILING STOP LOSS */}
                      <td className="py-2 px-2.5 font-bold text-teal-300">
                        <div>₹{pos.dynamicTrailingStopLoss.toFixed(2)}</div>
                        <div className="text-[10px] text-teal-400/80">
                          {pos.dynamicTrailingStopLoss > pos.entryPrice ? `+${pos.dynamicTrailingStopLossPct}% Locked` : `${pos.dynamicTrailingStopLossPct}% Max Loss Capped`}
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-purple-300 font-bold">
                        <div>₹{pos.dynamicTargetPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-purple-400">+{pos.dynamicTargetPct}% (T{pos.dynamicTargetTier + 1})</div>
                      </td>

                      <td className="py-2 px-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded font-bold ${
                          isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {isWin ? '+' : ''}₹{pos.unrealizedPnL.toFixed(2)} ({isWin ? '+' : ''}{pos.unrealizedPnLPct}%)
                        </span>
                      </td>

                      <td className="py-2 px-2.5 font-bold text-teal-300">
                        {pos.lockedProfitAmount > 0 ? `+₹${pos.lockedProfitAmount.toLocaleString('en-IN')}` : '0.00 (Risk Free)'}
                      </td>

                      <td className="py-2 px-2.5">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                          <badge.icon className="w-2.5 h-2.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenStockDetail(pos.symbol)}
                            className="p-1 text-zinc-400 hover:text-emerald-400"
                            title="Open Candlestick Chart"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                          </button>

                          {pos.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPosition(pos);
                                setCloseExitPrice(pos.currentPrice.toString());
                                setIsCloseModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold"
                            >
                              Exit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add New Active Position Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-xl border p-5 font-mono shadow-2xl ${
            isDark ? 'bg-[#121214] border-[#27272a] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <div className="flex items-center space-x-2 font-bold text-sm text-emerald-400">
                <Plus className="w-4 h-4" />
                <span>Add Active Trade / Ongoing Position</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPosition} className="space-y-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Stock Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BAJAJ-AUTO, RELIANCE"
                    value={newSymbol}
                    onChange={e => setNewSymbol(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white uppercase focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Entry Price (₹) *</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="e.g. 10250.00"
                    value={newEntryPrice}
                    onChange={e => setNewEntryPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Quantity / Shares</label>
                  <input
                    type="number"
                    value={newShares}
                    onChange={e => setNewShares(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Max Stop Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newStopLossPct}
                    onChange={e => setNewStopLossPct(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-rose-400 focus:border-emerald-500 outline-none font-bold"
                  />
                  <span className="text-[9px] text-zinc-500">Fixed initial risk bound</span>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Initial Target (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTargetPct}
                    onChange={e => setNewTargetPct(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-purple-400 focus:border-emerald-500 outline-none font-bold"
                  />
                  <span className="text-[9px] text-zinc-500">Dynamically expands</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Entry Date</label>
                <input
                  type="date"
                  value={newEntryDate}
                  onChange={e => setNewEntryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Strategy / Accumulation Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Institutional delivery breakout above 20 DMA accumulation zone..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/30 text-[10px] text-emerald-300">
                ⚡ <strong>Dynamic Rules:</strong> Stop loss ratchets strictly upward with every price advance. Max loss is capped at -{newStopLossPct}% at entry and cannot move downward.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Track Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exit / Close Position Modal */}
      {isCloseModalOpen && selectedPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-xl border p-5 font-mono shadow-2xl ${
            isDark ? 'bg-[#121214] border-[#27272a] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <div className="flex items-center space-x-2 font-bold text-sm text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>Close Active Position: {selectedPosition.symbol}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClosePosition} className="space-y-3.5 mt-4 text-xs">
              <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-400">Entry Price:</span>
                  <span className="font-bold">₹{selectedPosition.entryPrice}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-400">Dynamic Trailing SL:</span>
                  <span className="font-bold text-teal-300">₹{selectedPosition.dynamicTrailingStopLoss}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-400">Current Market Price:</span>
                  <span className="font-bold text-emerald-400">₹{selectedPosition.currentPrice}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Exit Price (₹) *</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={closeExitPrice}
                  onChange={e => setCloseExitPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white font-bold text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Exit Date</label>
                <input
                  type="date"
                  value={closeExitDate}
                  onChange={e => setCloseExitDate(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Confirm Exit &amp; Record P&amp;L
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
