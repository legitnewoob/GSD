import { parseISO, startOfWeek, format } from 'date-fns';
import { specialCategoryKeys } from '../utils/constants';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition resize-none';

function weekLabel(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return `Week of ${format(start, 'dd MMM')}`;
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
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">ADVENTURE LOG</h1>
        <p className="text-game-dim mt-2">Return after a few quests to review your weekly campaign.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">ADVENTURE LOG</h1>
        <p className="text-game-dim text-sm">Weekly campaign summaries and reflection scrolls.</p>
      </div>

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
