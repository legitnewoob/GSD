import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Star, Zap, Target, Shield } from 'lucide-react';
import { XP_LEVEL_THRESHOLD } from '../utils/constants';
import { questStatus } from '../utils/xp';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

const RANGES = [
  { label: '7D',  days: 7 },
  { label: '30D', days: 30 },
];

const XP_CATEGORIES = [
  { key: 'habit',      label: 'Habits',     color: '#f59e0b' },
  { key: 'power',      label: 'Power',      color: '#ec4899' },
  { key: 'health',     label: 'Health',     color: '#22c55e' },
  { key: 'focus',      label: 'Focus',      color: '#3b82f6' },
  { key: 'reflection', label: 'Reflection', color: '#8b5cf6' },
  { key: 'bonus',      label: 'Bonus',      color: '#06b6d4' },
];

function questTier(xp) {
  if (xp >= 80) return { label: '🏆 Epic',        color: 'text-emerald-400' };
  if (xp >= 50) return { label: '⭐ Good',         color: 'text-amber-400'   };
  if (xp >= 25) return { label: '▲ Weak',          color: 'text-orange-400'  };
  return              { label: '○ Miss',            color: 'text-slate-500'   };
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

function CustomBreakdownTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const { label: tierLabel, color } = questTier(total);
  return (
    <div style={tooltipStyle} className="rounded-xl px-4 py-3 text-sm min-w-[160px]">
      <div className="font-black text-game-text mb-2">{label} — <span className={color}>{tierLabel}</span></div>
      {payload.map((p) => p.value > 0 && (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.fill }} className="font-bold">{p.name}</span>
          <span className="text-game-dim">{p.value} XP</span>
        </div>
      ))}
      <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between font-black">
        <span className="text-game-text">Total</span>
        <span className="text-game-gold">{total} XP</span>
      </div>
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
  const nextLevelAt = level * XP_LEVEL_THRESHOLD;
  const progress = Math.min(100, (xpIntoLevel / XP_LEVEL_THRESHOLD) * 100).toFixed(1);

  // Filter for chart + quests
  const cutoffStr = format(subDays(new Date(), range - 1), 'yyyy-MM-dd');
  const visibleEntries = entries.filter((e) => e.date >= cutoffStr);

  const dateFormat = range === 7 ? 'EEE d' : 'dd MMM';
  const xInterval  = range === 7 ? 0 : 4;

  const xpData = visibleEntries.map((e) => ({
    date:       format(parseISO(e.date), dateFormat),
    habit:      e.xp.habit,
    power:      e.xp.power,
    health:     e.xp.health,
    focus:      e.xp.focus,
    reflection: e.xp.reflection,
    bonus:      e.xp.bonus,
    total:      e.xp.total,
  }));

  const recentQuests = [...visibleEntries].reverse().map((e) => ({
    date:   format(parseISO(e.date), 'dd MMM'),
    xp:     e.xp.total,
    habit:  e.xp.habit,
    health: e.xp.health,
    focus:  e.xp.focus,
  }));

  const avgXp  = xpData.length ? Math.round(xpData.reduce((s, d) => s + d.total, 0) / xpData.length) : 0;
  const bestXp = xpData.length ? Math.max(...xpData.map((d) => d.total)) : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">HERO</h1>
        <p className="text-game-dim text-sm">Level up by mastering habits, deep work, sleep and reflections.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Shield} label="Hero Level"     value={level}    sub={`${xpIntoLevel} / ${XP_LEVEL_THRESHOLD} XP this level`} />
        <StatCard icon={Zap}    label="Total XP"       value={totalXp}  sub={`Next rank at ${nextLevelAt} XP`} />
        <StatCard icon={Star}   label="Rank progress"  value={`${progress}%`} sub={`${Math.round(progress)}% to rank ${level + 1}`} />
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-2">XP bar</h2>
        <div className="relative w-full h-5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200 transition-all"
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

      {/* XP breakdown chart */}
      <div className={panelBase}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Daily XP breakdown</h2>
            <p className="text-xs text-game-dim mt-0.5">Avg {avgXp} XP · Best {bestXp} XP · {xpData.length} quests</p>
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
        {/* Category legend */}
        <div className="flex flex-wrap gap-3 mb-3">
          {XP_CATEGORIES.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-xs text-game-dim">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={xpData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={xInterval} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomBreakdownTooltip />} />
              {XP_CATEGORIES.map((c, i) => (
                <Bar
                  key={c.key}
                  dataKey={c.key}
                  name={c.label}
                  stackId="xp"
                  fill={c.color}
                  radius={i === XP_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent quests */}
      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">
          Quest log <span className="text-xs font-normal text-game-dim ml-1">last {range}d</span>
        </h2>
        {recentQuests.length === 0 ? (
          <p className="text-game-dim text-sm">No quests in this range.</p>
        ) : (
          <div className="space-y-2">
            {recentQuests.map((q) => {
              const { label: tierLabel, color } = questTier(q.xp);
              return (
                <div key={q.date} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                  <Target className={`w-4 h-4 shrink-0 ${color}`} />
                  <span className="text-sm font-bold text-game-text w-14 shrink-0">{q.date}</span>
                  {/* Mini XP bars */}
                  <div className="flex-1 flex gap-1 items-center">
                    {XP_CATEGORIES.map((c) => {
                      const val = q[c.key] ?? 0;
                      if (val === 0) return null;
                      return (
                        <div key={c.key} title={`${c.label}: ${val} XP`}
                          className="h-4 rounded-sm min-w-[4px]"
                          style={{ backgroundColor: c.color, width: `${Math.max(4, val * 1.5)}px` }}
                        />
                      );
                    })}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-black ${color}`}>{tierLabel}</span>
                    <span className="text-game-gold text-xs font-bold ml-2">+{q.xp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
