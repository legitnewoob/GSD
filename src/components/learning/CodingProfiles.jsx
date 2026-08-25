import { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, RefreshCw, AlertCircle, Flame } from 'lucide-react';
import { api } from '../../lib/api';
import { Heatmap } from './Heatmap';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-40';

const PLATFORMS = [
  { key: 'codeforces', label: 'Codeforces' },
  { key: 'leetcode', label: 'LeetCode' },
  { key: 'atcoder', label: 'AtCoder' },
];

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function computeStreak(heatmap) {
  if (!heatmap || heatmap.length === 0) return null;
  const activeDates = new Set(heatmap.filter((h) => h.count > 0).map((h) => h.date));
  if (activeDates.size === 0) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayStr}T00:00:00Z`);
  const yesterdayStr = new Date(today.getTime() - ONE_DAY_MS).toISOString().slice(0, 10);

  let anchor = null;
  if (activeDates.has(todayStr)) anchor = today;
  else if (activeDates.has(yesterdayStr)) anchor = new Date(today.getTime() - ONE_DAY_MS);

  if (anchor) {
    let days = 0;
    let cursor = anchor;
    while (activeDates.has(cursor.toISOString().slice(0, 10))) {
      days++;
      cursor = new Date(cursor.getTime() - ONE_DAY_MS);
    }
    return { active: true, days };
  }

  const lastActive = [...activeDates].sort().pop();
  const daysSince = Math.round((today - new Date(`${lastActive}T00:00:00Z`)) / ONE_DAY_MS);
  return { active: false, days: daysSince };
}

export function CodingProfiles() {
  const [profiles, setProfiles] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [adding, setAdding] = useState(false);
  const [platform, setPlatform] = useState('');
  const [username, setUsername] = useState('');

  const streak = computeStreak(stats?.heatmap);

  const loadProfiles = async () => {
    const data = await api.getCpProfiles();
    setProfiles(data);
  };

  const loadStats = async (force = false) => {
    setLoadingStats(true);
    try {
      const data = await api.getCpStats(force);
      setStats(data);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadStats();
  }, []);

  const availablePlatforms = PLATFORMS.filter((p) => !profiles?.some((prof) => prof.platform === p.key));

  const handleConnect = async () => {
    if (!platform || !username.trim()) return;
    await api.saveCpProfile({ platform, username: username.trim() });
    setPlatform('');
    setUsername('');
    setAdding(false);
    await loadProfiles();
    await loadStats(true);
  };

  const handleDisconnect = async (plat) => {
    if (!confirm('Disconnect this profile?')) return;
    await api.deleteCpProfile(plat);
    await loadProfiles();
    await loadStats(true);
  };

  return (
    <div className={panelBase}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Coding Profiles</h2>
        </div>
        <button onClick={() => loadStats(true)} disabled={loadingStats} className="flex items-center gap-1 text-xs text-game-dim hover:text-amber-400 transition disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <p className="text-xs text-game-dim mb-4">Live solve counts, last-solved dates, and combined activity across your platforms.</p>

      {streak && (
        <div
          className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-sm font-bold w-fit ${
            streak.active
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-slate-900 border-slate-700 text-game-dim'
          }`}
        >
          <Flame className={`w-4 h-4 ${streak.active ? 'text-amber-400' : 'text-slate-500'}`} />
          {streak.active
            ? `Streak: ${streak.days} day${streak.days === 1 ? '' : 's'}`
            : `Haven't solved a problem in ${streak.days} day${streak.days === 1 ? '' : 's'}`}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {profiles?.map((prof) => {
          const stat = stats?.platforms.find((p) => p.platform === prof.platform);
          const label = PLATFORMS.find((p) => p.key === prof.platform)?.label || prof.platform;
          return (
            <div key={prof.platform} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-game-dim uppercase tracking-wide">{label}</div>
                  <div className="text-xs text-game-dim font-mono">{prof.username}</div>
                </div>
                <button onClick={() => handleDisconnect(prof.platform)} className="text-slate-500 hover:text-red-400 transition" title="Disconnect">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {!stat && <div className="text-xs text-game-dim">Loading…</div>}
              {stat?.error && (
                <div className="flex items-start gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {stat.error}
                </div>
              )}
              {stat && !stat.error && (
                <div>
                  <div className="text-2xl font-black text-game-gold">{stat.solvedCount}</div>
                  <div className="text-xs text-game-dim">solved · last {formatDate(stat.lastSolvedDate)}</div>
                </div>
              )}
            </div>
          );
        })}

        {adding ? (
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3 space-y-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputBase}>
              <option value="">Choose platform…</option>
              {availablePlatforms.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <input className={inputBase} placeholder="Username / handle" value={username} onChange={(e) => setUsername(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleConnect} disabled={!platform || !username.trim()} className={btnPrimary + ' flex-1'}>Connect</button>
              <button onClick={() => setAdding(false)} className="text-xs text-game-dim hover:text-game-text px-3">Cancel</button>
            </div>
          </div>
        ) : (
          availablePlatforms.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-3 text-sm text-game-dim hover:text-amber-400 transition"
            >
              <Plus className="w-4 h-4" /> Connect a platform
            </button>
          )
        )}
      </div>

      {stats?.heatmap?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-game-dim">Combined activity</span>
          </div>
          <Heatmap data={stats.heatmap} />
        </div>
      )}
    </div>
  );
}
