import React, { useState, useEffect } from 'react';
import { 
  BookmarkCheck, 
  Trash2, 
  FileSpreadsheet, 
  FileText, 
  RotateCw, 
  Clock, 
  Layers, 
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { SavedAnalysis } from '../types';

interface SavedAnalysesViewProps {
  isDark: boolean;
  onRestoreAnalysis?: (analysis: SavedAnalysis) => void;
}

export const SavedAnalysesView: React.FC<SavedAnalysesViewProps> = ({
  isDark,
  onRestoreAnalysis,
}) => {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyses');
      if (res.ok) {
        const data = await res.json();
        setAnalyses(data);
      }
    } catch (e) {
      console.error('Error fetching saved analyses:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      fetchSaved();
      if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
    } catch (e) {
      console.error('Delete saved analysis error:', e);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Header */}
      <div className={`p-3 rounded border transition-all ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h1 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-1.5">
                <span>SAVED SCANS & BACKTEST PORTFOLIO ARCHIVE</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-normal">
                  PERSISTED SNAPSHOTS
                </span>
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
              Access bookmarked market scans, strategy parameters, and historical backtest runs stored directly in DuckDB tables.
            </p>
          </div>

          <button
            onClick={fetchSaved}
            className={`p-1.5 rounded border transition-all ${
              isDark ? 'border-[#27272a] bg-[#121214] text-[#a1a1aa] hover:text-[#e4e4e7]' : 'border-slate-200 bg-slate-100 text-slate-700'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of Saved Reports */}
      {analyses.length === 0 ? (
        <div className={`p-8 text-center rounded border ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-white border-slate-200 text-slate-500'
        }`}>
          <BookmarkCheck className="w-8 h-8 mx-auto text-[#52525b] mb-2" />
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#a1a1aa]">No Saved Reports Found</h3>
          <p className="text-[11px] font-mono text-[#71717a] mt-1">
            You can bookmark any scan result or backtest execution using the save report button in the toolbar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {analyses.map(item => (
            <div
              key={item.id}
              className={`p-3 rounded border transition-all hover:border-emerald-500/40 ${
                isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
              } shadow-xs flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-xs uppercase tracking-wider ${
                    item.type === 'SCAN'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  }`}>
                    {item.type} REPORT
                  </span>
                  <span className="text-[10px] font-mono text-[#71717a]">
                    {new Date(item.created_at || item.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-bold text-xs text-[#e4e4e7] line-clamp-1 mb-1.5">
                  {item.title}
                </h3>

                <div className="text-[10px] font-mono text-[#71717a] space-y-0.5 mb-3">
                  <div>ID: <code className="text-[#a1a1aa]">{item.id.slice(0, 18)}...</code></div>
                </div>
              </div>

              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}>
                <button
                  onClick={() => setSelectedAnalysis(item)}
                  className="flex items-center space-x-1 text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>Inspect Data</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 rounded border border-[#27272a] hover:bg-rose-500/20 text-[#71717a] hover:text-rose-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#09090b]/80 backdrop-blur-xs">
          <div className={`w-full max-w-2xl rounded border p-4 shadow-2xl transition-colors ${
            isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#e4e4e7]' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-2.5 border-b mb-3 ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}>
              <h3 className="font-mono font-bold text-xs uppercase tracking-tight text-[#e4e4e7]">{selectedAnalysis.title}</h3>
              <button
                onClick={() => setSelectedAnalysis(null)}
                className="px-2.5 py-0.5 rounded bg-[#27272a] text-[#e4e4e7] text-xs font-mono font-semibold hover:bg-[#3f3f46] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto font-mono">
              <div>
                <strong className="text-[#71717a] text-[10px] uppercase block mb-1">Configuration Parameters:</strong>
                <pre className="p-2.5 rounded border border-[#27272a] bg-[#121214] text-emerald-400 overflow-x-auto text-[10px]">
                  {JSON.stringify(JSON.parse(selectedAnalysis.configJson || '{}'), null, 2)}
                </pre>
              </div>

              <div>
                <strong className="text-[#71717a] text-[10px] uppercase block mb-1">Results Snapshot Preview:</strong>
                <pre className="p-2.5 rounded border border-[#27272a] bg-[#121214] text-teal-300 overflow-x-auto text-[10px] max-h-48">
                  {JSON.stringify(JSON.parse(selectedAnalysis.resultsJson || '[]').slice(0, 10), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
