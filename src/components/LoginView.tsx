import React, { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { LogIn, UserPlus, Globe } from 'lucide-react';

interface LoginViewProps {
  isDark: boolean;
}

export function LoginView({ isDark }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#09090b]' : 'bg-slate-50'}`}>
      <div className={`max-w-md w-full p-8 rounded-xl border shadow-2xl ${
        isDark ? 'bg-[#121214] border-[#27272a]' : 'bg-white border-slate-200'
      }`}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-full">
              <Globe className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          <h1 className={`text-2xl font-bold font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            NIFTY_ACCUMULATION_v2.4
          </h1>
          <p className="text-sm text-[#71717a] mt-2 font-mono uppercase tracking-widest">
            {isRegistering ? 'Create terminal account' : 'Terminal Access Protocol'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono rounded">
            ERROR_LOG: {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-[#71717a] uppercase mb-1">IDENT_EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 rounded border font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
                isDark ? 'bg-[#0c0c0e] border-[#27272a] text-white' : 'bg-slate-50 border-slate-200'
              }`}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-[#71717a] uppercase mb-1">SECURE_PASS</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2 rounded border font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
                isDark ? 'bg-[#0c0c0e] border-[#27272a] text-white' : 'bg-slate-50 border-slate-200'
              }`}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            {isRegistering ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{isRegistering ? 'INITIALIZE_ACCOUNT' : 'AUTHORIZE_ACCESS'}</span>
          </button>
        </form>

        <div className="mt-6 flex flex-col space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-[#27272a]' : 'border-slate-200'}`}></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className={`px-2 font-mono uppercase ${isDark ? 'bg-[#121214] text-[#71717a]' : 'bg-white text-slate-400'}`}>
                OR_SSO_PROVIDER
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className={`w-full py-2.5 border font-mono text-sm font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              isDark ? 'border-[#27272a] text-white hover:bg-[#1c1c1f]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            <span>CONTINUE_WITH_GOOGLE</span>
          </button>
        </div>

        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="w-full mt-6 text-[10px] font-mono text-[#71717a] uppercase hover:text-emerald-500 transition-colors"
        >
          {isRegistering ? 'Already have credentials? Login' : 'Need a new terminal? Register'}
        </button>
      </div>
    </div>
  );
}
