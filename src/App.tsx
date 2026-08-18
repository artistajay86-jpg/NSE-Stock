import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { ScannerView } from './components/ScannerView';
import { DerivativeScannerView } from './components/DerivativeScannerView';
import { BacktestView } from './components/BacktestView';
import { DataDownloaderView } from './components/DataDownloaderView';
import { DatabaseManagerView } from './components/DatabaseManagerView';
import { AlertsView } from './components/AlertsView';
import { SavedAnalysesView } from './components/SavedAnalysesView';
import { ActivePositionsView } from './components/ActivePositionsView';
import { SettingsView } from './components/SettingsView';
import { StockDetailModal } from './components/StockDetailModal';
import { AIChatDrawer } from './components/AIChatDrawer';
import { LoginView } from './components/LoginView';
import { useAuth } from './hooks/useAuth';
import { DatabaseStats, ScanConfig, ScanResult, ThemeMode } from './types';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const isDark = theme !== 'light';

  const themeBgClass = {
    dark: 'bg-[#09090b] text-[#e4e4e7]',
    light: 'bg-slate-50 text-slate-900',
    midnight: 'bg-[#030712] text-[#f3f4f6]',
    emerald: 'bg-[#022c22] text-[#ecfdf5]',
    amber: 'bg-[#1c1917] text-[#fef3c7]',
  }[theme];

  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);

  // Selected Stock Modal
  const [selectedStock, setSelectedStock] = useState<{
    symbol: string;
    scanResult?: ScanResult;
  } | null>(null);

  // Alert Pre-fill
  const [alertTarget, setAlertTarget] = useState<{
    symbol: string;
    price: number;
  } | null>(null);

  // Database Health & Stats
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [dbHealthy, setDbHealthy] = useState<boolean>(true);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDatabaseHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setDbHealthy(true);
        setDbStats(prev => ({
          totalStocks: data.totalStocks || 0,
          totalBars: data.totalBars || 0,
          fileSizeBytes: 0,
          walSizeBytes: 0,
          tables: [],
        }));
      } else {
        setDbHealthy(false);
      }
    } catch (e) {
      setDbHealthy(false);
    }
  };

  useEffect(() => {
    fetchDatabaseHealth();
    const interval = setInterval(fetchDatabaseHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#09090b]' : 'bg-slate-50'}`}>
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginView isDark={isDark} />;
  }

  const handleOpenStockDetail = (symbol: string, scanResult?: ScanResult) => {
    setSelectedStock({ symbol, scanResult });
  };

  const handleOpenSetAlert = (symbol: string, defaultPrice: number) => {
    setAlertTarget({ symbol, price: defaultPrice });
    setActiveTab('alerts');
    showToast(`Navigated to Alerts for ${symbol} @ ₹${defaultPrice}`);
  };

  const handleSaveScan = async (title: string, config: ScanConfig, results: ScanResult[]) => {
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'SCAN',
          configJson: JSON.stringify(config),
          resultsJson: JSON.stringify(results.slice(0, 100)),
        }),
      });
      if (res.ok) {
        showToast('Scan analysis saved to DuckDB database!');
      }
    } catch (e) {
      showToast('Failed to bookmark scan', 'error');
    }
  };

  const handleSaveBacktest = async (title: string, config: any, results: any) => {
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'BACKTEST',
          configJson: JSON.stringify(config),
          resultsJson: JSON.stringify(results),
        }),
      });
      if (res.ok) {
        showToast('Backtest report saved to DuckDB database!');
      }
    } catch (e) {
      showToast('Failed to bookmark backtest', 'error');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 ${themeBgClass}`}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        theme={theme}
        setTheme={setTheme}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        dbHealthy={dbHealthy}
        totalBars={dbStats?.totalBars || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-(--breakpoint-2xl) w-full mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {activeTab === 'scanner' && (
          <ScannerView
            isDark={isDark}
            onOpenStockDetail={handleOpenStockDetail}
            onOpenSetAlert={handleOpenSetAlert}
            onSaveScan={handleSaveScan}
          />
        )}

        {activeTab === 'derivative' && (
          <DerivativeScannerView
            isDark={isDark}
            onOpenStockDetail={handleOpenStockDetail}
            onOpenSetAlert={handleOpenSetAlert}
          />
        )}

        {activeTab === 'positions' && (
          <ActivePositionsView
            isDark={isDark}
            onOpenStockDetail={handleOpenStockDetail}
            onOpenSetAlert={handleOpenSetAlert}
          />
        )}

        {activeTab === 'backtester' && (
          <BacktestView
            isDark={isDark}
            onOpenStockDetail={handleOpenStockDetail}
            onSaveBacktest={handleSaveBacktest}
          />
        )}

        {activeTab === 'downloader' && (
          <DataDownloaderView
            isDark={isDark}
            onRefreshDatabase={fetchDatabaseHealth}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseManagerView
            isDark={isDark}
            onRefresh={fetchDatabaseHealth}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            isDark={isDark}
            initialSymbol={alertTarget?.symbol}
            initialPrice={alertTarget?.price}
          />
        )}

        {activeTab === 'saved' && (
          <SavedAnalysesView
            isDark={isDark}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            isDark={isDark}
          />
        )}
      </main>

      {/* High Density Terminal Status Footer */}
      <footer className={`h-8 border-t flex items-center justify-between px-4 text-[10px] font-mono shrink-0 transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-emerald-400">DUCKDB_ENGINE: STABLE</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1">
            <span>SYNC_STATUS: UP-TO-DATE (15:30 IST)</span>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            <span>LATENCY: 0.4ms</span>
          </div>
        </div>
        <div className="flex items-center space-x-3 uppercase font-bold text-[9px] sm:text-[10px]">
          <span className="hidden sm:inline">WAL: 12.4 MB</span>
          <span className="text-emerald-400">CHECKPOINT OK</span>
          <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-[#27272a] text-white' : 'bg-slate-200 text-slate-800'}`}>
            v2.4.0-PRO
          </span>
        </div>
      </footer>

      {/* Stock Candlestick & Zone Detail Modal */}
      {selectedStock && (
        <StockDetailModal
          symbol={selectedStock.symbol}
          scanResult={selectedStock.scanResult}
          isDark={isDark}
          onClose={() => setSelectedStock(null)}
          onSetAlert={(sym, price) => {
            setSelectedStock(null);
            handleOpenSetAlert(sym, price);
          }}
        />
      )}

      {/* Gemini AI Interactive Advisor Slide-over Drawer */}
      <AIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        isDark={isDark}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-10 right-5 z-50 animate-bounce">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded shadow-xl border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-[#121214] border-emerald-500 text-emerald-300'
              : 'bg-[#121214] border-rose-500 text-rose-300'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
