import { format, parseISO, subDays, startOfWeek } from 'date-fns';
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
  Label,
} from 'recharts';
import { specialCategoryKeys } from '../utils/constants';
import { Calendar, Sword, Moon, Sparkles, Heart, Zap, Monitor, Footprints, Flame, TrendingUp } from 'lucide-react';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

function getHours(entry, key) {
  const cats = entry.categories || {};
  const found = Object.values(cats).find((c) => c.key === key);
  return found ? parseFloat(found.hours) || 0 : 0;
}

function StatCard({ icon: Icon, label, value, unit = '', color = 'text-game-gold' }) {
  return (
    <div className={`${panelBase} text-center`}>
      <div className="flex justify-center mb-2">
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className={`text-3xl font-black text-glow ${color}`}>{value}</div>
      <div className="text-xs text-game-dim uppercase tracking-wide mt-1">{label}{unit ? ` (${unit})` : ''}</div>
    </div>
  );
}

function computeStreak(entries) {
  const allDates = new Set(entries.map((e) => e.date));
  let streak = 0;
  let check = new Date();
  while (true) {
    const ds = format(check, 'yyyy-MM-dd');
    if (allDates.has(ds)) {
      streak++;
      check = subDays(check, 1);
    } else {
      break;
    }
  }
  return streak;
}

export function Dashboard({ config, entries }) {
  const habitsList = config.habits || [];
  const categoriesList = config.categories || [];

  if (!entries.length) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">STATS</h1>
        <p className="text-game-dim mt-2">Complete a daily quest to unlock your character stats.</p>
      </div>
    );
  }

  const days = entries.length;

  const entriesWithPower = entries.filter((e) => e.power?.value);
  const avgPower = entriesWithPower.length
    ? (entriesWithPower.reduce((s, e) => s + e.power.value, 0) / entriesWithPower.length).toFixed(1)
    : '—';

  const entriesWithMood = entries.filter((e) => e.mood?.value);
  const avgMood = entriesWithMood.length
    ? (entriesWithMood.reduce((s, e) => s + e.mood.value, 0) / entriesWithMood.length).toFixed(1)
    : '—';

  const entriesWithEnergy = entries.filter((e) => e.energy?.value);
  const avgEnergy = entriesWithEnergy.length
    ? (entriesWithEnergy.reduce((s, e) => s + e.energy.value, 0) / entriesWithEnergy.length).toFixed(1)
    : '—';

  const avgSleep = days
    ? (entries.reduce((s, e) => s + getHours(e, specialCategoryKeys.sleep), 0) / days).toFixed(1)
    : '0.0';

  const entriesWithScreen = entries.filter((e) => e.screenTime !== '' && e.screenTime != null);
  const avgScreen = entriesWithScreen.length
    ? (entriesWithScreen.reduce((s, e) => s + parseFloat(e.screenTime), 0) / entriesWithScreen.length).toFixed(1)
    : '—';

  const totalKm = entries.reduce((s, e) => s + (parseFloat(e.runWalk) || 0), 0).toFixed(1);
  const totalSteps = entries.reduce((s, e) => s + (parseInt(e.steps) || 0), 0);

  const totalHabitCells = days * habitsList.length;
  const checkedHabits = entries.reduce(
    (sum, e) => sum + habitsList.filter((h) => e.habits[h.id]).length,
    0
  );
  const habitCompletion = totalHabitCells
    ? ((checkedHabits / totalHabitCells) * 100).toFixed(1)
    : '0.0';

  const streak = computeStreak(entries);

  const lineData = entries.map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    power: e.power?.value || null,
    mood: e.mood?.value || null,
    energy: e.energy?.value || null,
    sleep: getHours(e, specialCategoryKeys.sleep) || null,
    screen: e.screenTime !== '' && e.screenTime != null ? parseFloat(e.screenTime) : null,
    steps: parseInt(e.steps) || null,
    stepsScaled: parseInt(e.steps) ? Math.round(parseInt(e.steps) / 100) : null,
    km: parseFloat(e.runWalk) || null,
  }));

  const habitData = habitsList.map((h) => {
    const completed = entries.reduce((sum, e) => sum + (e.habits[h.id] ? 1 : 0), 0);
    const pct = days ? ((completed / days) * 100).toFixed(1) : 0;
    return { name: h.name, value: Number(pct) };
  });

  const categoryTotals = categoriesList
    .map((c) => ({
      name: c.name,
      value: entries.reduce((sum, e) => sum + (parseFloat(e.categories[c.id]?.hours) || 0), 0),
      color: c.color || '#94a3b8',
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalCategoryHours = categoryTotals.reduce((s, c) => s + c.value, 0);

  // Weekly aggregation for steps & distance
  const weeklyActivityData = (() => {
    const weekMap = {};
    entries.forEach((e) => {
      const weekStart = startOfWeek(parseISO(e.date), { weekStartsOn: 1 }); // Monday
      const key = format(weekStart, 'MMM d');
      if (!weekMap[key]) weekMap[key] = { week: key, steps: 0, km: 0, _sort: weekStart.getTime() };
      weekMap[key].steps += parseInt(e.steps) || 0;
      weekMap[key].km += parseFloat(e.runWalk) || 0;
    });
    return Object.values(weekMap)
      .sort((a, b) => a._sort - b._sort)
      .map(({ _sort, ...rest }) => ({ ...rest, km: parseFloat(rest.km.toFixed(2)) }));
  })();

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">STATS</h1>
        <p className="text-game-dim text-sm">Your hero's performance over time.</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Days tracked" value={days} />
        <StatCard icon={Flame} label="Streak" value={streak} unit="days" color="text-orange-400" />
        <StatCard icon={Sword} label="Avg power" value={avgPower} unit="/5" />
        <StatCard icon={Sparkles} label="Habit mastery" value={`${habitCompletion}%`} />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Heart} label="Avg mood" value={avgMood} unit="/5" color="text-pink-400" />
        <StatCard icon={Zap} label="Avg energy" value={avgEnergy} unit="/5" color="text-blue-400" />
        <StatCard icon={Moon} label="Avg sleep" value={avgSleep} unit="hrs" color="text-purple-400" />
        <StatCard icon={Monitor} label="Avg screen" value={avgScreen} unit="hrs" color="text-slate-400" />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Footprints} label="Total run" value={`${totalKm} km`} color="text-emerald-400" />
        <StatCard icon={TrendingUp} label="Total steps" value={totalSteps.toLocaleString()} color="text-cyan-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Power by day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, fill: '#f59e0b' }} connectNulls name="Power" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-2">Mood & Energy</h2>
          <div className="flex gap-4 mb-2">
            <span className="flex items-center gap-1.5 text-xs text-pink-400 font-bold">── Mood</span>
            <span className="flex items-center gap-1.5 text-xs text-blue-400 font-bold">── Energy</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="mood" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, fill: '#ec4899' }} connectNulls name="Mood" />
                <Line type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} connectNulls name="Energy" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Sleep by day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 12]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, 'Sleep']} />
                <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#8b5cf6' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Screen time by day</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, 'Screen time']} />
                <Bar dataKey="screen" fill="#64748b" radius={[3, 3, 0, 0]} name="Screen time" />
              </BarChart>
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
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Mastery']} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={panelBase}>
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Time split</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} hrs`, name]} contentStyle={tooltipStyle} />
                  <Pie data={categoryTotals} dataKey="value" nameKey="name" outerRadius={90} innerRadius={54} strokeWidth={2} stroke="#0b0f19">
                    {categoryTotals.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                    <Label value={`${totalCategoryHours.toFixed(0)}h`} position="center" fill="#f59e0b" style={{ fontSize: 22, fontWeight: 900 }} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 w-full">
              {categoryTotals.map((cat) => {
                const pct = totalCategoryHours > 0 ? ((cat.value / totalCategoryHours) * 100).toFixed(1) : 0;
                return (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="shrink-0 w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm text-game-text truncate">{cat.name}</span>
                    <span className="text-xs text-game-dim">{cat.value.toFixed(1)}h</span>
                    <span className="text-xs font-bold w-10 text-right" style={{ color: cat.color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`${panelBase} lg:col-span-2`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Steps & Distance</h2>
            <div className="flex gap-4">
              <span className="text-xs text-cyan-400 font-bold">▪ Steps</span>
              <span className="text-xs text-emerald-400 font-bold">▪ Km</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivityData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis yAxisId="steps" orientation="left" tick={{ fill: '#06b6d4', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <YAxis yAxisId="km" orientation="right" tick={{ fill: '#22c55e', fontSize: 11 }} tickFormatter={(v) => `${v}km`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => name === 'Steps' ? [v.toLocaleString(), 'Steps'] : [`${v.toFixed(1)} km`, 'Distance']}
                />
                <Bar yAxisId="steps" dataKey="steps" name="Steps" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="km" dataKey="km" name="Km" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
