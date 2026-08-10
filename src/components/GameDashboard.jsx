import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Trophy, Star, Zap, Target, Shield } from 'lucide-react';
import { XP_LEVEL_THRESHOLD } from '../utils/constants';
import { questStatus } from '../utils/xp';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

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

export function GameDashboard({ entries }) {
  if (!entries.length) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">HERO</h1>
        <p className="text-game-dim mt-2">Complete quests to reveal your hero's rank.</p>
      </div>
    );
  }

  const last = entries[entries.length - 1];
  const level = last.level;
  const totalXp = last.cumulativeXp;
  const xpIntoLevel = totalXp % XP_LEVEL_THRESHOLD;
  const nextLevelXp = level * XP_LEVEL_THRESHOLD;
  const progress = Math.min(100, (xpIntoLevel / XP_LEVEL_THRESHOLD) * 100).toFixed(1);

  const xpData = entries.map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    xp: e.xp.total,
    status: questStatus(e.xp.total),
  }));

  const recentQuests = [...entries].reverse().slice(0, 7).map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    status: questStatus(e.xp.total),
    xp: e.xp.total,
  }));

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">HERO</h1>
        <p className="text-game-dim text-sm">Level up by mastering habits, deep work, sleep and reflections.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Shield} label="Hero Level" value={level} sub={`${xpIntoLevel} / ${XP_LEVEL_THRESHOLD} XP this level`} />
        <StatCard icon={Zap} label="Total XP" value={totalXp} sub={`Next rank at ${nextLevelXp} XP`} />
        <StatCard icon={Star} label="Rank progress" value={`${progress}%`} sub={`${Math.round(progress)}% to rank ${level + 1}`} />
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">XP bar</h2>
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
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Daily XP loot</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={xpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="xp" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Recent quests</h2>
          <div className="space-y-3">
            {recentQuests.map((q) => (
              <div key={q.date} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <div className="flex items-center gap-3">
                  <Target className={`w-5 h-5 ${q.xp >= 80 ? 'text-emerald-400' : q.xp >= 50 ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-sm font-bold text-game-text">{q.date}</span>
                </div>
                <div className="text-sm text-game-dim font-bold">{q.status} <span className="text-game-gold">({q.xp} XP)</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
