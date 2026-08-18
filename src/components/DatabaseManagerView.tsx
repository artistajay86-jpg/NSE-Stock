import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HardDrive, 
  CheckCircle2, 
  RotateCw, 
  FileSpreadsheet, 
  FileJson, 
  ShieldCheck, 
  Layers, 
  Activity,
  Terminal,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X
} from 'lucide-react';
import { DatabaseStats } from '../types';

interface DatabaseManagerViewProps {
  isDark: boolean;
  onRefresh: () => void;
}

export const DatabaseManagerView: React.FC<DatabaseManagerViewProps> = ({
  isDark,
  onRefresh,
}) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string>('stocks');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Deletion Modal / Action State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatusMsg, setDeleteStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchTableData(activeTable);
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/database/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching DB stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    setActiveTable(tableName);
    setTableLoading(true);
    try {
      const res = await fetch(`/api/database/export/${tableName}?format=json`);
      if (res.ok) {
        const data = await res.json();
        setTableData(data.slice(0, 150)); // preview first 150
      }
    } catch (e) {
      console.error('Error fetching table data:', e);
    } finally {
      setTableLoading(false);
    }
  };

  const handleCheckpoint = async () => {
    try {
      const res = await fetch('/api/database/checkpoint', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCheckpointMsg(data.message || 'CHECKPOINT executed successfully.');
        fetchStats();
        onRefresh();
        setTimeout(() => setCheckpointMsg(null), 4000);
      }
    } catch (e) {
      console.error('Checkpoint error:', e);
    }
  };

  const handleDownloadExport = (tableName: string, format: 'csv' | 'json') => {
    window.open(`/api/database/export/${tableName}?format=${format}`, '_blank');
  };

  // Truncate currently selected table
  const handleTruncateCurrentTable = async () => {
    if (!window.confirm(`Are you sure you want to TRUNCATE / CLEAR all data in table "${activeTable}"? This action cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    setDeleteStatusMsg(null);
    try {
      const res = await fetch('/api/database/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TABLE',
          tableName: activeTable,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteStatusMsg({
          text: `Successfully truncated table "${activeTable}". Deleted ${data.deletedRows || 0} rows.`,
          type: 'success',
        });
        fetchStats();
        fetchTableData(activeTable);
        onRefresh();
      } else {
        setDeleteStatusMsg({
          text: data.error || 'Failed to clear table',
          type: 'error',
        });
      }
    } catch (err: any) {
      setDeleteStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteStatusMsg(null), 6000);
    }
  };

  // Purge All Market Data (Factory Reset)
  const handlePurgeAllMarketData = async () => {
    setIsDeleting(true);
    setDeleteStatusMsg(null);
    try {
      const res = await fetch('/api/database/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PURGE' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteStatusMsg({
          text: `Database Purge Complete. Cleared ${data.deletedBars.toLocaleString()} historical bars, ${data.deletedStocks} stocks, and download logs.`,
          type: 'success',
        });
        setShowPurgeModal(false);
        fetchStats();
        fetchTableData(activeTable);
        onRefresh();
      } else {
        setDeleteStatusMsg({
          text: data.error || 'Purge failed',
          type: 'error',
        });
      }
    } catch (err: any) {
      setDeleteStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered rows for active table preview
  const filteredRows = tableData.filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some(val => String(val).toLowerCase().includes(term));
  });

  return (
    <div className="space-y-3 pb-8">
      {/* Database Header & Engine Metrics */}
      <div className={`p-3 rounded border transition-all ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-1.5">
                <span>EMBEDDED DUCKDB ENGINE & DATA MANAGEMENT</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-normal">
                  IN-PROCESS OLAP
                </span>
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
              High-performance columnar storage engine with ACID guarantees, multi-table exports, and granular data purge facilities.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              onClick={handleCheckpoint}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-[#09090b] shadow-xs transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>FORCE CHECKPOINT</span>
            </button>

            <button
              onClick={() => setShowPurgeModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs font-mono font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>PURGE ALL DATA</span>
            </button>

            <button
              onClick={fetchStats}
              className={`p-1.5 rounded border transition-all ${
                isDark ? 'border-[#27272a] bg-[#121214] text-[#a1a1aa] hover:text-[#e4e4e7]' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {checkpointMsg && (
          <div className="mt-2.5 p-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{checkpointMsg}</span>
          </div>
        )}

        {deleteStatusMsg && (
          <div className={`mt-2.5 p-2 rounded border text-xs font-mono flex items-center gap-2 ${
            deleteStatusMsg.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}>
            {deleteStatusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{deleteStatusMsg.text}</span>
          </div>
        )}

        {/* Database Metric Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Historical OHLC Bars</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {stats?.totalBars != null ? stats.totalBars.toLocaleString() : '0'}
            </div>
            <div className="text-[9px] text-[#71717a] font-mono mt-0.5">Columnar Vectorized</div>
          </div>

          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Stock Constituents</div>
            <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
              {stats?.totalStocks ?? 0}
            </div>
            <div className="text-[9px] text-[#71717a] font-mono mt-0.5">Nifty 50, Next 50, Midcap</div>
          </div>

          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">Database File Size</div>
            <div className="text-xl font-bold font-mono text-teal-400 mt-0.5">
              {stats?.fileSizeBytes ? `${(stats.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '0 MB'}
            </div>
            <div className="text-[9px] text-[#71717a] font-mono mt-0.5">market_data.duckdb</div>
          </div>

          <div className={`p-2.5 rounded border ${isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[9px] uppercase tracking-wider text-[#71717a] font-mono">WAL Journal Size</div>
            <div className="text-xl font-bold font-mono text-purple-300 mt-0.5">
              {stats?.walSizeBytes ? `${(stats.walSizeBytes / 1024).toFixed(1)} KB` : '0 KB'}
            </div>
            <div className="text-[9px] text-[#71717a] font-mono mt-0.5">WAL recovery active</div>
          </div>
        </div>
      </div>

      {/* Table Browser & Data Operations */}
      <div className={`rounded border overflow-hidden transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className={`p-2.5 px-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
        }`}>
          {/* Table Selector Tabs */}
          <div className={`flex items-center flex-wrap gap-1 p-0.5 rounded border ${isDark ? 'border-[#27272a] bg-[#121214]' : 'border-slate-200 bg-slate-100'} text-xs font-mono`}>
            {(stats?.tables || []).map(t => (
              <button
                key={t.name}
                onClick={() => fetchTableData(t.name)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                  activeTable === t.name
                    ? 'bg-emerald-500 text-[#09090b] font-bold'
                    : isDark
                    ? 'text-[#71717a] hover:text-[#e4e4e7]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.name} ({(t.rowCount || 0).toLocaleString()})
              </button>
            ))}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center flex-wrap gap-1.5">
            {/* Search Filter */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-[#71717a]" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filter table..."
                className={`py-0.5 pl-6 pr-2 rounded border text-[10px] font-mono ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            {/* Truncate Active Table Button */}
            <button
              onClick={handleTruncateCurrentTable}
              disabled={isDeleting}
              className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-mono font-semibold border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Table</span>
            </button>

            {/* Export Buttons */}
            <button
              onClick={() => handleDownloadExport(activeTable, 'csv')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleDownloadExport(activeTable, 'json')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono font-semibold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors"
            >
              <FileJson className="w-3 h-3" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Table Data Preview */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs font-mono">
            <thead className={`border-b font-mono font-bold uppercase tracking-wider text-[10px] sticky top-0 ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <tr>
                {filteredRows.length > 0 &&
                  Object.keys(filteredRows[0]).map(col => (
                    <th key={col} className="py-2 px-2.5">{col}</th>
                  ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'}`}>
              {tableLoading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-[#71717a]">
                    <div className="flex items-center justify-center space-x-2">
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span className="text-xs font-mono">Loading table rows...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-[#71717a] text-xs font-mono">
                    No rows found in {activeTable} {searchTerm ? `matching "${searchTerm}"` : ''}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-emerald-500/5 transition-colors">
                    {Object.values(row).map((val: any, i) => (
                      <td key={i} className="py-1.5 px-2.5 truncate max-w-[200px] text-slate-300 text-[11px]">
                        {val === null ? <span className="text-[#52525b]">NULL</span> : String(val)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`p-2 px-3 border-t text-[10px] font-mono text-[#71717a] flex justify-between ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
        }`}>
          <span>
            Previewing {filteredRows.length} rows from table: <strong className="text-slate-300">{activeTable}</strong>
          </span>
          <span>DuckDB v1.2+ Columnar Storage Engine</span>
        </div>
      </div>

      {/* Confirmation Modal for Complete Database Purge */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md p-4 rounded-lg border shadow-xl ${
            isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-white border-slate-200 text-slate-900'
          } space-y-3 font-mono`}>
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Full Database Purge</span>
              </div>
              <button
                onClick={() => setShowPurgeModal(false)}
                className="text-[#71717a] hover:text-[#e4e4e7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              This action will completely delete all historical OHLCV bars, delivery data, downloaded logs, and custom stocks from the embedded DuckDB database file.
            </p>

            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
              ⚠️ WARNING: All stored market time-series will be permanently removed. The baseline constituents will be re-initialized.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold border border-[#27272a] hover:bg-[#18181b] text-[#a1a1aa]"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeAllMarketData}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Purging Database...' : 'Confirm & Wipe Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
