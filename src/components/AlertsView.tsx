import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Mail, 
  Smartphone, 
  RotateCw, 
  Activity,
  Sparkles,
  Layers
} from 'lucide-react';
import { PriceAlert } from '../types';

interface AlertsViewProps {
  isDark: boolean;
  initialSymbol?: string;
  initialPrice?: number;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  isDark,
  initialSymbol,
  initialPrice,
}) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form fields
  const [symbol, setSymbol] = useState(initialSymbol || 'RELIANCE');
  const [targetPrice, setTargetPrice] = useState(initialPrice || 2450);
  const [condition, setCondition] = useState<'ENTERS_ACCUMULATION_ZONE' | 'PRICE_ABOVE' | 'PRICE_BELOW' | 'HIGH_DELIVERY_SPIKE'>('ENTERS_ACCUMULATION_ZONE');
  const [email, setEmail] = useState('trader@marketpulse.in');
  const [enableEmail, setEnableEmail] = useState(true);
  const [enablePush, setEnablePush] = useState(true);
  const [notes, setNotes] = useState('Institutional accumulation entry alert');

  // Push notification permission state
  const [pushStatus, setPushStatus] = useState<string>('default');
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (e) {
      console.error('Error fetching alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          targetPrice: Number(targetPrice),
          condition,
          email,
          enableEmail,
          enablePush,
          notes,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchAlerts();
      }
    } catch (err) {
      console.error('Create alert error:', err);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      fetchAlerts();
    } catch (e) {
      console.error('Delete alert error:', e);
    }
  };

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);
      if (perm === 'granted') {
        new Notification('Nifty Scanner Alerts Activated', {
          body: 'You will receive real-time push notifications for stock accumulation entries.',
        });
      }
    }
  };

  const handleSimulateMovement = async (sym: string) => {
    try {
      setSimulationStatus(`Simulating real-time market breakout for ${sym}...`);
      const res = await fetch('/api/alerts/simulate-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, changePct: 2.5 }),
      });
      if (res.ok) {
        setTimeout(() => {
          fetchAlerts();
          setSimulationStatus(`Simulated price move recorded! Alerts re-evaluated.`);
          setTimeout(() => setSimulationStatus(null), 3000);
        }, 800);
      }
    } catch (e) {
      console.error('Simulation error:', e);
    }
  };

  return (
    <div className="space-y-3 pb-8">
      {/* Alerts Header & Controls */}
      <div className={`p-3 rounded border transition-all ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h1 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-1.5">
                <span>REAL-TIME PRICE & ACCUMULATION ALERT ENGINE</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-normal">
                  ACTIVE DAEMON
                </span>
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
              Push notifications and email dispatches when stocks enter the +5% to +6% accumulation corridor or experience high-delivery volume absorption.
            </p>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-[#09090b] shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Alert</span>
            </button>

            {pushStatus !== 'granted' && (
              <button
                onClick={requestPushPermission}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Enable Push</span>
              </button>
            )}

            <button
              onClick={fetchAlerts}
              className={`p-1.5 rounded border transition-all ${
                isDark ? 'border-[#27272a] bg-[#121214] text-[#a1a1aa] hover:text-[#e4e4e7]' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Simulation Banner */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-1.5 text-[#71717a] font-mono text-[11px]">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active monitoring loop evaluates constituents every 30s.</span>
          </div>

          <div className="flex items-center space-x-1.5 text-[10px] font-mono">
            <span className="text-[#71717a]">Simulate Tick Move:</span>
            {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'].map(sym => (
              <button
                key={sym}
                onClick={() => handleSimulateMovement(sym)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-teal-400 hover:bg-[#18181b]' : 'bg-slate-100 border-slate-200 text-teal-700'
                }`}
              >
                {sym} +2.5%
              </button>
            ))}
          </div>
        </div>

        {simulationStatus && (
          <div className="mt-2 p-2 rounded border border-teal-500/40 bg-teal-500/10 text-teal-300 text-xs font-mono">
            {simulationStatus}
          </div>
        )}
      </div>

      {/* Alerts List Table */}
      <div className={`rounded border overflow-hidden transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      } shadow-xs`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-mono font-bold uppercase tracking-wider text-[10px] ${
              isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#71717a]' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="py-2 px-3">Symbol</th>
                <th className="py-2 px-2.5">Condition</th>
                <th className="py-2 px-2.5">Target / Price (₹)</th>
                <th className="py-2 px-2.5">Status</th>
                <th className="py-2 px-2.5">Channels</th>
                <th className="py-2 px-2.5">Last Trigger Details</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1c1c1f]' : 'divide-slate-200'} font-mono`}>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#71717a] text-xs">
                    No price alerts created yet. Click "Create Alert" to set one up.
                  </td>
                </tr>
              ) : (
                alerts.map(a => (
                  <tr key={a.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="py-2 px-3 font-bold text-[#e4e4e7] text-xs">
                      {a.symbol}
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="font-semibold text-slate-300 text-[11px]">
                        {a.condition.replace(/_/g, ' ')}
                      </span>
                      {a.notes && <div className="text-[10px] text-[#71717a] truncate max-w-[180px]">{a.notes}</div>}
                    </td>
                    <td className="py-2 px-2.5 font-bold text-emerald-400 text-xs">
                      ₹{a.targetPrice.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5">
                      <span className={`inline-block px-1.5 py-0.2 rounded-xs text-[9px] font-bold uppercase tracking-wider ${
                        a.triggerStatus === 'TRIGGERED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {a.triggerStatus}
                      </span>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="flex items-center space-x-1.5 text-[#71717a]">
                        {a.enablePush && <Smartphone className="w-3.5 h-3.5 text-emerald-400" title="Push Enabled" />}
                        {a.enableEmail && <Mail className="w-3.5 h-3.5 text-teal-400" title={`Email: ${a.email}`} />}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-[11px] text-[#a1a1aa] max-w-[240px]">
                      {a.lastTriggerDetails || (
                        <span className="text-[#52525b]">Monitoring live order flow...</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDeleteAlert(a.id)}
                        className="p-1 rounded border border-[#27272a] hover:bg-rose-500/20 text-[#71717a] hover:text-rose-400 transition-colors"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#09090b]/80 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded border p-4 shadow-2xl transition-colors ${
            isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#e4e4e7]' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h2 className="text-xs font-bold font-mono uppercase tracking-tight mb-3 flex items-center gap-1.5 text-[#e4e4e7]">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Configure Price & Accumulation Alert</span>
            </h2>

            <form onSubmit={handleCreateAlert} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[#71717a] text-[10px] uppercase font-medium block mb-1">Stock Symbol (NSE):</label>
                <input
                  type="text"
                  required
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  className={`w-full py-1.5 px-2.5 rounded border text-xs font-mono font-bold ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="text-[#71717a] text-[10px] uppercase font-medium block mb-1">Alert Condition:</label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value as any)}
                  className={`w-full py-1.5 px-2.5 rounded border text-xs font-mono ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <option value="ENTERS_ACCUMULATION_ZONE">Enters Accumulation Zone (+5% to +6%)</option>
                  <option value="HIGH_DELIVERY_SPIKE">Institutional Delivery Spike (&gt;60% or 1.5x Avg)</option>
                  <option value="PRICE_ABOVE">Price Crosses Above Target (Breakout)</option>
                  <option value="PRICE_BELOW">Price Crosses Below Level (Stop Loss)</option>
                </select>
              </div>

              <div>
                <label className="text-[#71717a] text-[10px] uppercase font-medium block mb-1">Target / Reference Price (₹):</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={targetPrice}
                  onChange={e => setTargetPrice(Number(e.target.value))}
                  className={`w-full py-1.5 px-2.5 rounded border text-xs font-mono font-bold text-emerald-400 ${
                    isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="text-[#71717a] text-[10px] uppercase font-medium block mb-1">Email for Dispatch:</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full py-1.5 px-2.5 rounded border text-xs font-mono ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center space-x-4 pt-1 text-xs">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePush}
                    onChange={e => setEnablePush(e.target.checked)}
                    className="rounded-xs text-emerald-500"
                  />
                  <span className="text-[#a1a1aa]">Web Push Notification</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableEmail}
                    onChange={e => setEnableEmail(e.target.checked)}
                    className="rounded-xs text-teal-500"
                  />
                  <span className="text-[#a1a1aa]">Email Update</span>
                </label>
              </div>

              <div>
                <label className="text-[#71717a] text-[10px] uppercase font-medium block mb-1">Trader Notes (Optional):</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Look for breakout candle on 15m chart"
                  className={`w-full py-1.5 px-2.5 rounded border text-xs font-mono ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end space-x-1.5 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-bold text-xs shadow-xs transition-colors"
                >
                  Save Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
