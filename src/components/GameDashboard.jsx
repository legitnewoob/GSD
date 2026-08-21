import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Trophy, Star, Zap, Target, Shield } from 'lucide-react';
import { XP_LEVEL_THRESHOLD } from '../utils/constants';
import { questStatus } from '../utils/xp';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

const RANGES = [
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
];

function xpColor(xp) {
  if (xp >= 80) return '#22c55e';
  if (xp >= 50) return '#f59e0b';
  if (xp >= 25) return '#f97316';
  return '#64748b';
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className={`${panelBase} flex items-start gap-4`}>
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-glow">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-black text-game-gold text-glow">{value}</div>
        <div className="text-xs text-game-dim uppercase tracking-wide">{label}</div>
        {sub && <div className="text-sm text-game-dim mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function CustomXpTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const xp = payload[0].value;
  return (
    <div style={tooltipStyle} className="rounded-lg px-3 py-2 text-sm">
      <div className="font-black text-game-text">{label}</div>
      <div style={{ color: xpColor(xp) }} className="font-bold">{xp} XP — {questStatus(xp)}</div>
    </div>
  );
}

export function GameDashboard({ entries }) {
  const [range, setRange] = useState(7);

  if (!entries.length) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">HERO</h1>
        <p className="text-game-dim mt-2">Complete quests to reveal your hero's rank.</p>
      </div>
    );
  }

  // Hero stats always from all-time last entry
  const last = entries[entries.length - 1];
  const level = last.level;
  const totalXp = last.cumulativeXp;
  const xpIntoLevel = totalXp % XP_LEVEL_THRESHOLD;
  const progress = Math.min(100, (xpIntoLevel / XP_LEVEL_THRESHOLD) * 100).toFixed(1);

  // Filter for chart
  const cutoffStr = format(subDays(new Date(), range - 1), 'yyyy-MM-dd');
  const visibleEntries = entries.filter((e) => e.date >= cutoffStr);

  const dateFormat = range === 7 ? 'EEE d' : 'dd MMM';
  const xInterval = range === 7 ? 0 : 4;

  const xpData = visibleEntries.map((e) => ({
    date: format(parseISO(e.date), dateFormat),
    xp: e.xp.total,
  }));

  const recentQuests = [...visibleEntries].reverse().map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    status: questStatus(e.xp.total),
    xp: e.xp.total,
  }));

  const avgXp = xpData.length
    ? Math.round(xpData.reduce((s, d) => s + d.xp, 0) / xpData.length)
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">HERO</h1>
        <p className="text-game-dim text-sm">Level up by mastering habits, deep work, sleep and reflections.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Shield} label="Hero Level" value={level} sub={`${xpIntoLevel} / ${XP_LEVEL_THRESHOLD} XP this level`} />
        <StatCard icon={Zap} label="Total XP" value={totalXp} sub={`Next rank at ${level * XP_LEVEL_THRESHOLD} XP`} />
        <StatCard icon={Star} label="Rank progress" value={`${progress}%`} sub={`${Math.round(progress)}% to rank ${level + 1}`} />
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-2">XP bar</h2>
        <div className="relative w-full h-5 bg-slate-900 rounded-full overflow-hidden border border-slate-700 shadow-inner">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200 transition-all shadow-glow"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-900 uppercase tracking-wider">
            {progress}%
          </div>
        </div>
        <div className="flex justify-between text-sm text-game-dim mt-2 font-bold">
          <span>Rank {level}</span>
          <span>Rank {level + 1}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={panelBase}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Daily XP loot</h2>
              <p className="text-xs text-game-dim mt-0.5">Avg {avgXp} XP · {xpData.length} quests</p>
            </div>
            <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0">
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setRange(r.days)}
                  className={[
                    'px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide transition',
                    range === r.days ? 'bg-amber-500 text-slate-900' : 'text-game-dim hover:text-game-text',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={xpData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={xInterval} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomXpTooltip />} />
                <Bar dataKey="xp" radius={[4, 4, 0, 0]}>
                  {xpData.map((d, i) => (
                    <Cell key={i} fill={xpColor(d.xp)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* XP tier legend */}
          <div className="flex gap-4 mt-3 text-xs text-game-dim flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />≥80 Epic</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />≥50 Good</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />≥25 Weak</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" />&lt;25 Miss</span>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">
            Recent quests <span className="text-xs font-normal text-game-dim ml-1">last {range}d</span>
          </h2>
          <div className="space-y-2 overflow-y-auto max-h-80">
            {recentQuests.length === 0 ? (
              <p className="text-game-dim text-sm">No quests in this range.</p>
            ) : recentQuests.map((q) => {
              const color = q.xp >= 80 ? 'text-emerald-400' : q.xp >= 50 ? 'text-amber-400' : q.xp >= 25 ? 'text-orange-400' : 'text-slate-500';
              return (
                <div key={q.date} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Target className={`w-4 h-4 ${color}`} />
                    <span className="text-sm font-bold text-game-text">{q.date}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black ${color}`}>{q.status}</span>
                    <span className="text-game-gold text-xs font-bold ml-2">+{q.xp} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
