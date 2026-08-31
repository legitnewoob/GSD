import { useState, useEffect } from 'react';
import { parseISO, startOfWeek, format } from 'date-fns';
import { History, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { specialCategoryKeys } from '../utils/constants';
import { api } from '../lib/api';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition resize-none';

function weekLabel(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return `Week of ${format(start, 'dd MMM')}`;
}

function MonthHistoryPanel() {
  const [snapshots, setSnapshots] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const load = async () => {
    const data = await api.getBudgetSnapshots();
    setSnapshots(data);
    setSelectedMonth((prev) => prev || data[0]?.month || null);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      await api.captureBudgetSnapshot();
      await load();
    } finally {
      setCapturing(false);
    }
  };

  const snapshot = snapshots?.find((s) => s.month === selectedMonth);

  return (
    <div className={panelBase}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Month History</h2>
        </div>
        <div className="flex items-center gap-2">
          {snapshots && snapshots.length > 0 && (
            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-game-text outline-none focus:border-amber-500"
            >
              {snapshots.map((s) => (
                <option key={s.month} value={s.month}>{format(parseISO(`${s.month}-01`), 'MMMM yyyy')}</option>
              ))}
            </select>
          )}
          <button onClick={handleCapture} disabled={capturing} title="Save a snapshot of the current month right now" className="flex items-center gap-1 text-xs text-game-dim hover:text-amber-400 border border-slate-700 hover:border-amber-500/50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${capturing ? 'animate-spin' : ''}`} /> Snapshot now
          </button>
        </div>
      </div>
      <p className="text-xs text-game-dim mb-4">Budget, spend, and credit card state as of month-end — captured automatically when a new month starts.</p>

      {snapshots === null && <div className="text-game-dim text-sm">Loading…</div>}
      {snapshots?.length === 0 && (
        <p className="text-game-dim text-sm">No months recorded yet — this fills in once a month closes out, or hit "Snapshot now" to capture the current month.</p>
      )}

      {snapshot && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Income</div>
              <div className="text-lg font-black text-emerald-400">₹{(snapshot.monthlyIncome || 0).toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Fixed budget vs spent</div>
              <div className="text-lg font-black text-blue-400">
                ₹{snapshot.totalFixedSpent.toLocaleString()} <span className="text-xs text-game-dim font-normal">/ ₹{snapshot.totalFixed.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Daily pool budget vs spent</div>
              <div className="text-lg font-black text-amber-400">
                ₹{snapshot.totalDailySpent.toLocaleString()} <span className="text-xs text-game-dim font-normal">/ ₹{snapshot.totalDailyPool.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Balances</div>
              <div className="text-sm font-black text-game-text">Cash ₹{(snapshot.cashBalance || 0).toLocaleString()}</div>
              <div className="text-sm font-black text-game-text">Bank ₹{(snapshot.bankBalance || 0).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-game-dim uppercase tracking-wide mb-2">Category breakdown</div>
            <div className="space-y-1">
              {(snapshot.categories || []).map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2 text-sm">
                  <span className="text-game-text font-bold">{c.name}</span>
                  <span className="text-game-dim">
                    {c.type === 'fixed'
                      ? `₹${(c.spentAmount || 0).toLocaleString()} / ₹${c.budgetedAmount.toLocaleString()}`
                      : `₹${c.budgetedAmount.toLocaleString()} pool`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {snapshot.creditCards && snapshot.creditCards.length > 0 && (
            <div>
              <div className="text-xs text-game-dim uppercase tracking-wide mb-2">Credit cards (state as of this month)</div>
              <div className="space-y-1">
                {snapshot.creditCards.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-game-text font-bold">
                      {c.isPaid ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      {c.name}
                    </span>
                    <span className={c.isPaid ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {c.isPaid ? 'Cleared' : `₹${(c.currentBalance || 0).toLocaleString()} due`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getSleepHours(entry) {
  const cats = entry.categories || {};
  const found = Object.values(cats).find((c) => c.key === specialCategoryKeys.sleep);
  return found ? parseFloat(found.hours) || 0 : 0;
}

export function WeeklyReview({ config, entries }) {
  const habitsList = config.habits || [];
  const weeks = new Map();

  entries.forEach((entry) => {
    const date = parseISO(entry.date);
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const key = format(start, 'yyyy-MM-dd');
    if (!weeks.has(key)) {
      weeks.set(key, { label: weekLabel(date), entries: [] });
    }
    weeks.get(key).entries.push(entry);
  });

  const data = Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => {
      const days = group.entries.length;
      const avgPower =
        group.entries.reduce((s, e) => s + (e.power?.value || 0), 0) / days;
      const avgSleep =
        group.entries.reduce((s, e) => s + getSleepHours(e), 0) / days;
      const checked = group.entries.reduce(
        (sum, e) => sum + habitsList.filter((h) => e.habits[h.id]).length,
        0
      );
      const completion = (checked / (days * habitsList.length)) * 100;
      const totalXp = group.entries.reduce((s, e) => s + (e.xp?.total || 0), 0);
      const totalSteps = group.entries.reduce((s, e) => s + (parseFloat(e.steps) || 0), 0);

      return {
        label: group.label,
        days,
        avgPower: avgPower.toFixed(1),
        avgSleep: avgSleep.toFixed(1),
        completion: completion.toFixed(1),
        totalXp,
        totalSteps,
      };
    })
    .reverse();

  if (!data.length) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">ADVENTURE LOG</h1>
          <p className="text-game-dim mt-2">Return after a few quests to review your weekly campaign.</p>
        </div>
        <MonthHistoryPanel />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">ADVENTURE LOG</h1>
        <p className="text-game-dim text-sm">Weekly campaign summaries and reflection scrolls.</p>
      </div>

      <MonthHistoryPanel />

      <div className={`${panelBase} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
              <tr>
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Avg power</th>
                <th className="px-4 py-3">Avg sleep</th>
                <th className="px-4 py-3">Habits</th>
                <th className="px-4 py-3">Total XP</th>
                <th className="px-4 py-3">Steps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((row) => (
                <tr key={row.label} className="hover:bg-slate-900/40 transition">
                  <td className="px-4 py-3 font-bold text-game-text">{row.label}</td>
                  <td className="px-4 py-3 text-game-dim">{row.days}</td>
                  <td className="px-4 py-3 text-game-dim">{row.avgPower}</td>
                  <td className="px-4 py-3 text-game-dim">{row.avgSleep} hrs</td>
                  <td className="px-4 py-3 text-game-dim">{row.completion}%</td>
                  <td className="px-4 py-3 font-black text-game-gold">{row.totalXp}</td>
                  <td className="px-4 py-3 text-game-dim">{row.totalSteps.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          'What legendary feats did you achieve?',
          'What drained your HP or mana?',
          'What is the next boss fight?',
        ].map((prompt) => (
          <div key={prompt} className={panelBase}>
            <h3 className="text-sm font-black uppercase tracking-wide text-game-dim mb-2">{prompt}</h3>
            <textarea
              rows={4}
              placeholder="Inscribe your thoughts..."
              className={inputBase}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
