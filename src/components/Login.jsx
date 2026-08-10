import { useState } from 'react';
import { Shield } from 'lucide-react';

const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';

export function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-panel rounded-2xl border border-game-border shadow-glow p-8 w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow mb-2">QUEST VAULT</h1>
        <p className="text-game-dim text-sm mb-6">Enter the realm password to continue your adventure.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputBase}
            autoFocus
          />
          {error && <div className="text-red-400 text-sm text-left">{error}</div>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 disabled:opacity-50 text-slate-900 font-black py-3 rounded-lg transition shadow-glow uppercase tracking-wide"
          >
            {loading ? 'Unlocking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
