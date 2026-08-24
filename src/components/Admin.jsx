import { useState, useEffect } from 'react';
import { Settings, Clock, ListChecks, Trash2, Activity, CheckCircle, AlertCircle, RefreshCw, Unlink, Bell } from 'lucide-react';
import { api } from '../lib/api';
import { NotificationRules } from './NotificationRules';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-40';

function GoogleFitPanel({ onRefreshEntries }) {
  const [status, setStatus] = useState(null); // null = loading, { connected, updatedAt }
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [days, setDays] = useState(7);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = async () => {
    try {
      const s = await api.googleFitStatus();
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    }
  };

  useEffect(() => {
    load();
    // Handle redirect back from Google OAuth
    const params = new URLSearchParams(window.location.search);
    const gfit = params.get('gfit');
    if (gfit === 'connected') {
      window.history.replaceState({}, '', window.location.pathname);
      load();
    } else if (gfit === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      setSyncResult({ error: 'Google authorisation failed. Check your redirect URI settings.' });
    }
  }, []);

  const handleConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/integrations/google-fit/auth`;
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.googleFitSync(days);
      setSyncResult({ synced: result.synced, days: result.days, stepsdays: result.stepsdays, distdays: result.distdays });
      await load();
      if (onRefreshEntries) await onRefreshEntries();
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Fit? Your existing synced data stays.')) return;
    setDisconnecting(true);
    try {
      await api.googleFitDisconnect();
      setStatus({ connected: false });
      setSyncResult(null);
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className={panelBase}>
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Google Fit</h2>
        {status?.connected && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold ml-2">
            <CheckCircle className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>
      <p className="text-xs text-game-dim mb-4">Sync steps and run/walk distance directly from Google Fit into your daily entries.</p>

      {status === null && <div className="text-game-dim text-sm">Checking connection…</div>}

      {status !== null && !status.connected && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-700 rounded-xl p-3 text-xs text-game-dim">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              Before connecting, add this to your <strong className="text-game-text">Google Cloud Console → Authorised redirect URIs</strong>:
              <div className="mt-1 font-mono text-amber-400 bg-slate-800 rounded px-2 py-1 text-[11px] break-all">
                {`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/integrations/google-fit/callback`}
              </div>
            </div>
          </div>
          <button onClick={handleConnect} className={btnPrimary + ' flex items-center gap-2'}>
            <Activity className="w-4 h-4" /> Connect Google Fit
          </button>
        </div>
      )}

      {status?.connected && (
        <div className="space-y-4">
          {status.updatedAt && (
            <div className="text-xs text-game-dim">
              Last synced: <span className="text-game-text font-bold">{new Date(status.updatedAt).toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Sync period</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text outline-none focus:border-amber-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button onClick={handleSync} disabled={syncing} className={btnPrimary + ' flex items-center gap-2'}>
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-2 rounded-lg transition disabled:opacity-40">
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          </div>

          {syncResult && (
            <div className={`rounded-xl p-3 text-sm ${syncResult.error ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
              {syncResult.error
                ? `Error: ${syncResult.error}`
                : `Done — ${syncResult.stepsdays || 0} days with steps, ${syncResult.distdays || 0} days with distance synced from last ${syncResult.days} days. Check Daily Quest to see the data.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Admin({ config, onUpdateCategory, onDeleteCategory, onDeleteHabit, onRefreshEntries }) {
  const [expectedMap, setExpectedMap] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const map = {};
    (config.categories || []).forEach((c) => {
      map[c.id] = c.expectedHours ?? '';
    });
    setExpectedMap(map);
  }, [config.categories]);

  const handleExpectedChange = (id, value) => {
    setExpectedMap((m) => ({ ...m, [id]: value }));
  };

  const saveCategory = (category) => {
    const value = expectedMap[category.id];
    const num = value === '' ? null : parseFloat(value);
    onUpdateCategory({ ...category, expectedHours: num });
  };

  if (showNotifications) {
    return <NotificationRules onBack={() => setShowNotifications(false)} />;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
            <Settings className="w-7 h-7" /> QUEST SETTINGS
          </h1>
          <p className="text-game-dim text-sm">Tune categories, expected hours, habits and integrations.</p>
        </div>
        <button
          onClick={() => setShowNotifications(true)}
          className="flex items-center gap-2 text-xs text-game-dim hover:text-game-text border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition"
        >
          <Bell className="w-4 h-4" /> Notifications
        </button>
      </div>

      <GoogleFitPanel onRefreshEntries={onRefreshEntries} />

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Time Categories</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Expected Hours</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(config.categories || []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40 transition">
                  <td className="px-4 py-3 font-bold text-game-text">{c.name}</td>
                  <td className="px-4 py-3 text-game-dim font-mono text-xs">{c.key || '-'}</td>
                  <td className="px-4 py-3 w-40">
                    <input
                      type="number" min={0} max={24} step={0.5}
                      value={expectedMap[c.id] ?? ''}
                      onChange={(e) => handleExpectedChange(c.id, e.target.value)}
                      onBlur={() => saveCategory(c)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCategory(c)}
                      className={`${inputBase} w-24`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: c.color || '#94a3b8' }} />
                      <span className="text-game-dim text-xs">{c.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onDeleteCategory(c.id)} className="text-slate-500 hover:text-red-400 transition" title="Remove category">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Daily Habits</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {(config.habits || []).map((h) => (
            <div key={h.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-sm text-game-text font-bold">{h.name}</span>
              <button onClick={() => onDeleteHabit(h.id)} className="text-slate-500 hover:text-red-400 transition" title="Remove habit">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-game-dim text-xs mt-3">Add new habits from the Daily Quest page.</p>
      </div>
    </div>
  );
}
