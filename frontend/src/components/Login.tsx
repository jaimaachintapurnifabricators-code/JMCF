import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Hammer, AlertTriangle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(30,41,59,0.5),rgba(2,6,23,1))] px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-8 relative">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-slate-800/80 rounded-lg text-amber-500 mb-3 border border-slate-700/50">
            <Hammer className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Jai Maa Chintpurni Fabricators
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 font-medium tracking-wide">
            INVENTORY & ACCOUNTS PORTAL
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 rounded-lg text-slate-100 text-sm outline-none transition-all placeholder:text-slate-600"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 rounded-lg text-slate-100 text-sm outline-none transition-all placeholder:text-slate-600"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition-all focus:outline-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-950/20"
          >
            <Shield className="h-4 w-4" />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-600 border-t border-slate-800/80 pt-6">
          Authorized personnel only. Sessions are audited and logged.
        </div>
      </div>
    </div>
  );
};
