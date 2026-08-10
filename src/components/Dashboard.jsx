import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { specialCategoryKeys } from '../utils/constants';
import { Calendar, Sword, Moon, Sparkles } from 'lucide-react';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

function getHours(entry, key) {
  const cats = entry.categories || {};
  const found = Object.values(cats).find((c) => c.key === key);
  return found ? parseFloat(found.hours) || 0 : 0;
}

function StatCard({ icon: Icon, label, value, unit = '' }) {
  return (
    <div className={`${panelBase} text-center`}>
      <div className="flex justify-center mb-2">
        <Icon className="w-6 h-6 text-amber-400" />
      </div>
      <div className="text-3xl font-black text-game-gold text-glow">{value}</div>
      <div className="text-xs text-game-dim uppercase tracking-wide mt-1">{label} {unit}</div>
    </div>
  );
}

export function Dashboard({ config, entries }) {
  const habitsList = config.habits || [];
  const categoriesList = config.categories || [];
  const sleepCategory = categoriesList.find((c) => c.key === specialCategoryKeys.sleep);

  if (!entries.length) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">STATS</h1>
        <p className="text-game-dim mt-2">Complete a daily quest to unlock your character stats.</p>
      </div>
    );
  }

  const days = entries.length;
  const avgPower = days
    ? (entries.reduce((s, e) => s + (e.power?.value || 0), 0) / days).toFixed(1)
    : '0.0';
  const avgSleep = days
    ? (entries.reduce((s, e) => s + getHours(e, specialCategoryKeys.sleep), 0) / days).toFixed(1)
    : '0.0';
  const totalHabitCells = days * habitsList.length;
  const checkedHabits = entries.reduce(
    (sum, e) => sum + habitsList.filter((h) => e.habits[h.id]).length,
    0
  );
  const habitCompletion = totalHabitCells
    ? ((checkedHabits / totalHabitCells) * 100).toFixed(1)
    : '0.0';

  const lineData = entries.map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    power: e.power?.value || 0,
    sleep: getHours(e, specialCategoryKeys.sleep),
  }));

  const habitData = habitsList.map((h) => {
    const completed = entries.reduce((sum, e) => sum + (e.habits[h.id] ? 1 : 0), 0);
    const pct = days ? ((completed / days) * 100).toFixed(1) : 0;
    return { name: h.name, value: Number(pct) };
  });

  const categoryTotals = categoriesList.map((c) => ({
    name: c.name,
    value: entries.reduce((sum, e) => sum + (parseFloat(e.categories[c.id]?.hours) || 0), 0),
    color: c.color || '#94a3b8',
  }));

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">STATS</h1>
        <p className="text-game-dim text-sm">Your hero's performance over time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Quests completed" value={days} />
        <StatCard icon={Sword} label="Avg power" value={avgPower} />
        <StatCard icon={Moon} label="Avg sleep" value={avgSleep} unit="hrs" />
        <StatCard icon={Sparkles} label="Habit mastery" value={`${habitCompletion}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Power by day</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Sleep by day</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis domain={[0, 12]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="sleep" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Habit mastery</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={habitData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Mastery']} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Time split</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} hrs`, name]} contentStyle={tooltipStyle} />
                <Pie
                  data={categoryTotals}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={(entry) => `${entry.name}: ${entry.value.toFixed(1)}h`}
                  labelLine={false}
                >
                  {categoryTotals.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
