import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/api';
import { 
  Settings as SettingsIcon, 
  Wallet, 
  Key, 
  ShieldCheck, 
  Save, 
  RefreshCw,
  Info,
  ExternalLink,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { TradingAccount } from '../types';

interface SettingsViewProps {
  isDark: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ isDark }) => {
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Brokerage Config State
  const [brokerage, setBrokerage] = useState({
    broker: 'shoonya',
    apiKey: '',
    apiSecret: '',
    userId: ''
  });
  const [showSecret, setShowSecret] = useState(false);

  // Capital State
  const [capitalInput, setCapitalInput] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth('/api/account');
      setAccount(data);
      setCapitalInput(data.total_capital.toString());
      if (data.brokerage) {
        setBrokerage(prev => ({ ...prev, ...data.brokerage }));
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateCapital = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetchWithAuth('/api/account/capital', {
        method: 'PUT',
        body: JSON.stringify({ totalCapital: Number(capitalInput) }),
      });
      setAccount(res);
      setMsg({ text: 'Capital updated successfully', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Update failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrokerage = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await fetchWithAuth('/api/brokerage/config', {
        method: 'POST',
        body: JSON.stringify(brokerage),
      });
      setMsg({ text: 'Brokerage credentials saved securely', type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center space-x-2">
        <SettingsIcon className="w-5 h-5 text-emerald-500" />
        <h1 className="text-lg font-bold tracking-tight uppercase font-mono">Application Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Capital Management */}
        <div className={`p-5 rounded border shadow-sm ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center space-x-2 mb-4">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase font-mono">Capital Management</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`text-[11px] font-mono uppercase mb-1.5 block ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                Total Trading Capital (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(e.target.value)}
                  className={`w-full pl-3 pr-10 py-2 rounded border font-mono text-sm ${
                    isDark 
                      ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7] focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  } focus:outline-none transition-all`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500">INR</div>
              </div>
              <p className="mt-2 text-[10px] text-[#71717a] leading-relaxed">
                This amount represents your total theoretical or actual liquid capital. 
                Paper trades will subtract from this balance.
              </p>
            </div>

            <div className={`p-3 rounded border ${
              isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-[#a1a1aa]">Current Balance:</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  ₹{account?.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={handleUpdateCapital}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'UPDATING...' : 'UPDATE CAPITAL'}</span>
            </button>
          </div>
        </div>

        {/* Brokerage Configuration */}
        <div className={`p-5 rounded border shadow-sm ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center space-x-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold uppercase font-mono">Live Market Execution</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`text-[11px] font-mono uppercase mb-1.5 block ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                Preferred Broker (Free API)
              </label>
              <select
                value={brokerage.broker}
                onChange={(e) => setBrokerage(prev => ({ ...prev, broker: e.target.value }))}
                className={`w-full px-3 py-2 rounded border font-mono text-sm ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                } focus:outline-none`}
              >
                <option value="shoonya">Shoonya (Finvasia) - Zero Brokerage</option>
                <option value="upstox">Upstox API</option>
                <option value="dhan">Dhan HQ</option>
                <option value="flat_trade">Flat Trade - Zero Brokerage</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-[11px] font-mono uppercase mb-1.5 block ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                  API Key
                </label>
                <input
                  type="text"
                  value={brokerage.apiKey}
                  onChange={(e) => setBrokerage(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="App Key"
                  className={`w-full px-3 py-2 rounded border font-mono text-sm ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  } focus:outline-none`}
                />
              </div>
              <div>
                <label className={`text-[11px] font-mono uppercase mb-1.5 block ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                  User ID
                </label>
                <input
                  type="text"
                  value={brokerage.userId}
                  onChange={(e) => setBrokerage(prev => ({ ...prev, userId: e.target.value }))}
                  placeholder="FA12345"
                  className={`w-full px-3 py-2 rounded border font-mono text-sm ${
                    isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                  } focus:outline-none`}
                />
              </div>
            </div>

            <div className="relative">
              <label className={`text-[11px] font-mono uppercase mb-1.5 block ${isDark ? 'text-[#71717a]' : 'text-slate-500'}`}>
                API Secret / Password
              </label>
              <input
                type={showSecret ? 'text' : 'password'}
                value={brokerage.apiSecret}
                onChange={(e) => setBrokerage(prev => ({ ...prev, apiSecret: e.target.value }))}
                placeholder="••••••••••••••••"
                className={`w-full pl-3 pr-10 py-2 rounded border font-mono text-sm ${
                  isDark ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7]' : 'bg-slate-50 border-slate-200'
                } focus:outline-none`}
              />
              <button 
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-[34px] text-[#71717a] hover:text-[#a1a1aa]"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className={`p-3 rounded border flex items-start space-x-2 ${
              isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
            }`}>
              <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#71717a] leading-relaxed">
                Credentials are encrypted and stored in your private Firestore document. 
                They are only used server-side to execute your live orders.
              </p>
            </div>

            <button
              onClick={handleSaveBrokerage}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded bg-[#1c1c1f] hover:bg-[#27272a] text-white border border-[#27272a] font-bold text-sm transition-colors disabled:opacity-50"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'SAVING...' : 'SECURE CONFIGURATION'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Access Info */}
      <div className={`p-5 rounded border shadow-sm ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-2 mb-4">
          <Info className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold uppercase font-mono">Platform Security & Access</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold font-mono text-[#a1a1aa] uppercase">Identity Protection</h3>
            <p className="text-[10px] text-[#71717a] leading-relaxed">
              We use Firebase Authentication for session management. All API requests are verified with OIDC ID tokens.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold font-mono text-[#a1a1aa] uppercase">Data Isolation</h3>
            <p className="text-[10px] text-[#71717a] leading-relaxed">
              Firestore Security Rules (RBAC) ensure your trade history and configuration are strictly private to your UID.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold font-mono text-[#a1a1aa] uppercase">Encrypted Storage</h3>
            <p className="text-[10px] text-[#71717a] leading-relaxed">
              Sensitive brokerage secrets are handled solely by our server-side API proxy, never exposed to the frontend.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      {msg && (
        <div className={`fixed bottom-10 right-5 z-50 p-4 rounded border flex items-center space-x-2 shadow-2xl animate-in fade-in slide-in-from-bottom-5 ${
          msg.type === 'success' 
            ? 'bg-[#121214] border-emerald-500 text-emerald-400' 
            : 'bg-[#121214] border-rose-500 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-xs font-bold font-mono">{msg.text}</span>
        </div>
      )}
    </div>
  );
};

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
);

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
