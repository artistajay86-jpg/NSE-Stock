import React from 'react';
import { 
  Radar, 
  BarChart3, 
  DownloadCloud, 
  Database, 
  Bell, 
  BookmarkCheck, 
  Sparkles, 
  Sun, 
  Moon,
  Activity,
  Zap,
  Terminal,
  Clock,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { ThemeMode } from '../types';

export type ActiveTab = 'scanner' | 'derivative' | 'positions' | 'backtester' | 'downloader' | 'database' | 'alerts' | 'saved' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isDark: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  onOpenAIChat: () => void;
  dbHealthy: boolean;
  totalBars: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  theme,
  setTheme,
  onOpenAIChat,
  dbHealthy,
  totalBars,
}) => {
  const [liveQuotes, setLiveQuotes] = React.useState<Record<string, { price: number; changePct: number; isLive: boolean }>>({
    'BAJAJ-AUTO': { price: 10671, changePct: 0.85, isLive: true },
    'RELIANCE': { price: 3010, changePct: 0.42, isLive: true },
    'TATAMOTORS': { price: 985, changePct: 1.15, isLive: true },
    'HDFCBANK': { price: 1650, changePct: -0.22, isLive: true },
  });

  const [syncTimestamp, setSyncTimestamp] = React.useState<string>('2026-08-15 15:30:00 IST');

  React.useEffect(() => {
    const now = new Date();
    setSyncTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' IST');
  }, []);

  React.useEffect(() => {
    const fetchTopQuotes = async () => {
      try {
        const res = await fetch('/api/live-quotes?symbols=BAJAJ-AUTO,RELIANCE,TATAMOTORS,HDFCBANK,TCS');
        if (res.ok) {
          const data = await res.json();
          if (data.quotes) {
            setLiveQuotes(data.quotes);
          }
        }
      } catch {
        // Quiet failover
      }
    };

    fetchTopQuotes();
    const timer = setInterval(fetchTopQuotes, 10000); // 10s live price refresh
    return () => clearInterval(timer);
  }, []);

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'scanner', label: 'Scanner', icon: Radar },
    { id: 'derivative', label: 'Futures OI Scanner', icon: Zap },
    { id: 'positions', label: 'Active Trades', icon: ShieldCheck },
    { id: 'backtester', label: 'Backtester', icon: BarChart3 },
    { id: 'downloader', label: 'Downloader', icon: DownloadCloud },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'saved', label: 'Reports', icon: BookmarkCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className={`sticky top-0 z-40 border-b transition-colors duration-150 ${
      isDark 
        ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' 
        : 'bg-white border-slate-200 text-slate-900'
    } backdrop-blur-md shadow-xs`}>
      <div className="max-w-(--breakpoint-2xl) mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-12">
          {/* Left: Brand Logo & Live Market Tickers */}
          <div className="flex items-center space-x-4">
            <div 
              className="flex items-center space-x-2 cursor-pointer select-none group" 
              onClick={() => setActiveTab('scanner')}
            >
              <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center shadow-xs shadow-emerald-500/20">
                <span className="text-[#09090b] font-black text-xs italic tracking-tighter">N</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-xs sm:text-sm tracking-tight">
                  NIFTY <span className="text-emerald-500 font-extrabold">ACCUMULATOR</span>
                </span>
                <span className="hidden xl:inline-block text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  v2.4
                </span>
              </div>
            </div>

            <div className={`hidden lg:block h-4 w-px ${isDark ? 'bg-[#27272a]' : 'bg-slate-200'} mx-1`} />

            {/* High Density Dynamic Live Market Tickers */}
            <div className={`hidden lg:flex items-center space-x-3 text-[10px] uppercase font-semibold font-mono ${
              isDark ? 'text-[#a1a1aa]' : 'text-slate-600'
            }`}>
              <div className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                <span className={isDark ? 'text-[#71717a]' : 'text-slate-400'}>BAJAJ-AUTO:</span>
                <span className="text-emerald-400 font-bold">₹{liveQuotes['BAJAJ-AUTO']?.price?.toLocaleString('en-IN') || '10,671'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className={isDark ? 'text-[#71717a]' : 'text-slate-400'}>RELIANCE:</span>
                <span className="text-emerald-400 font-bold">₹{liveQuotes['RELIANCE']?.price?.toLocaleString('en-IN') || '3,010'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className={isDark ? 'text-[#71717a]' : 'text-slate-400'}>TATAMOTORS:</span>
                <span className="text-emerald-400 font-bold">₹{liveQuotes['TATAMOTORS']?.price?.toLocaleString('en-IN') || '985'}</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Links (Compact Terminal density) */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-100 ${
                    isActive
                      ? isDark
                        ? 'bg-[#1c1c1f] text-emerald-400 border border-[#27272a] shadow-xs font-bold'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-bold'
                      : isDark
                      ? 'text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#18181b]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-[#71717a]' : 'text-slate-400')}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Tools: Engine Health, AI Advisor, Theme Toggle */}
          <div className="flex items-center space-x-2">
            {/* DuckDB Engine Status Pill */}
            <div className={`hidden sm:flex items-center space-x-1 px-2 py-1 rounded border text-[10px] font-mono ${
              isDark ? 'bg-[#1c1c1f] border-[#27272a] text-[#a1a1aa]' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>Sync: <strong className="text-emerald-400">{syncTimestamp}</strong></span>
            </div>

            <div className={`flex items-center space-x-1.5 px-2 py-1 rounded border text-[10px] font-mono ${
              dbHealthy
                ? isDark
                  ? 'bg-[#1c1c1f] border-[#27272a] text-[#a1a1aa]'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${dbHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="font-bold">DUCKDB: {dbHealthy ? 'ACTIVE' : 'OFFLINE'}</span>
            </div>

            {/* AI Advisor Button */}
            <button
              id="open-ai-chat-btn"
              onClick={onOpenAIChat}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all border shadow-xs ${
                isDark
                  ? 'bg-[#1c1c1f] border-[#27272a] text-purple-300 hover:border-purple-500/50 hover:bg-[#27272a]'
                  : 'bg-purple-50 border-purple-200 text-purple-700 hover:border-purple-300'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-emerald-500 to-blue-500 p-[1px] flex items-center justify-center">
                <div className="w-full h-full bg-[#09090b] rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                  AI
                </div>
              </div>
              <span className="text-[11px] font-bold">Advisor</span>
            </button>

            {/* Theme Selector Dropdown */}
            <select
              value={theme}
              onChange={e => setTheme(e.target.value as ThemeMode)}
              className={`py-1 px-2 rounded border text-xs font-mono font-bold ${
                isDark ? 'bg-[#1c1c1f] border-[#27272a] text-emerald-400' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
              title="Select Color Theme"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="midnight">Midnight</option>
              <option value="emerald">Emerald</option>
              <option value="amber">Amber</option>
            </select>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className={`flex md:hidden overflow-x-auto py-1.5 space-x-1 border-t ${
          isDark ? 'border-[#27272a]' : 'border-slate-200'
        } scrollbar-none`}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] whitespace-nowrap font-medium ${
                  isActive
                    ? 'bg-emerald-500 text-[#09090b] font-bold'
                    : isDark
                    ? 'text-[#a1a1aa] bg-[#1c1c1f]'
                    : 'text-slate-600 bg-slate-100'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

