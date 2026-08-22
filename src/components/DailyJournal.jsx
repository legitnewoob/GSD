import { useState, useEffect, useRef } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { MOOD_OPTIONS, ENERGY_OPTIONS, POWER_OPTIONS, getHabitGroup, HABIT_GROUP_ORDER } from '../utils/constants';
import { Check, ChevronLeft, ChevronRight, Sword, Heart, Zap, Moon, Coins, Footprints, Scroll, Plus, Trash2, CalendarDays } from 'lucide-react';

const LEVEL_COLORS = [
  'bg-red-900/40 border-red-700/60 text-red-400',
  'bg-orange-900/40 border-orange-700/50 text-orange-400',
  'bg-yellow-900/40 border-yellow-700/50 text-yellow-400',
  'bg-lime-900/40 border-lime-600/60 text-lime-400',
  'bg-emerald-900/40 border-emerald-600/60 text-emerald-400',
];

function RatingPicker({ options, value, onSelect }) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(selected ? null : opt)}
            title={opt.label}
            className={[
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg border font-black transition',
              selected
                ? LEVEL_COLORS[opt.value - 1]
                : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            <span className="text-base leading-none">{opt.value}</span>
            <span className="text-[9px] uppercase tracking-wide leading-tight">{opt.short}</span>
          </button>
        );
      })}
    </div>
  );
}

const CAT_COLORS = ['#f59e0b','#3b82f6','#22c55e','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#14b8a6','#a855f7'];

const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';

function QuestDatePicker({ value, onChange }) {
  const selectedDate = parseISO(value);
  const today = startOfDay(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(selectedDate));
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const firstDay = startOfWeek(startOfMonth(displayMonth), { weekStartsOn: 0 });
  const lastDay = endOfWeek(endOfMonth(displayMonth), { weekStartsOn: 0 });
  const calendarDays = [];
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) calendarDays.push(day);

  const chooseDate = (date) => {
    if (isAfter(date, today)) return;
    onChange(date);
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className="relative w-full text-left sm:inline-block sm:w-auto">
      <button
        type="button"
        onClick={() => {
          if (!isOpen) setDisplayMonth(startOfMonth(selectedDate));
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-slate-900/90 px-3 py-2.5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:border-amber-400/60 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/60 sm:inline-flex sm:min-w-[220px] sm:w-auto"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-400 transition group-hover:bg-amber-500/20">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-amber-400/80">Quest date</span>
            <span className="block text-sm font-bold text-game-text">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
          </span>
        </span>
        <ChevronRight className={['h-4 w-4 text-game-dim transition-transform', isOpen ? 'rotate-90 text-amber-400' : 'group-hover:text-amber-400'].join(' ')} />
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Choose quest date" className="absolute inset-x-0 z-20 mt-2 rounded-2xl border border-slate-600/80 bg-slate-900 p-3 shadow-2xl shadow-black/50 ring-1 ring-amber-500/10 sm:left-auto sm:right-0 sm:w-[296px]">
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setDisplayMonth((month) => subMonths(month, 1))}
              className="rounded-lg p-1.5 text-game-dim transition hover:bg-slate-800 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-black tracking-wide text-game-text">{format(displayMonth, 'MMMM yyyy')}</span>
            <button
              type="button"
              aria-label="Next month"
              disabled={isSameMonth(displayMonth, today)}
              onClick={() => setDisplayMonth((month) => addMonths(month, 1))}
              className="rounded-lg p-1.5 text-game-dim transition hover:bg-slate-800 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-game-dim"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <span key={`${day}-${index}`} className="py-1 text-[10px] font-black text-game-dim">{day}</span>
            ))}
            {calendarDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const unavailable = isAfter(day, today);
              const outsideMonth = !isSameMonth(day, displayMonth);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={unavailable}
                  aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                  aria-pressed={selected}
                  onClick={() => chooseDate(day)}
                  className={[
                    'relative h-8 rounded-lg text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-500/70',
                    selected ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.45)]' : 'text-game-text hover:bg-slate-800 hover:text-amber-300',
                    isToday && !selected ? 'border border-amber-500/60 text-amber-400' : '',
                    outsideMonth && !selected ? 'text-slate-600 hover:text-slate-400' : '',
                    unavailable ? 'cursor-not-allowed opacity-25 hover:bg-transparent hover:text-game-text' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-700 pt-3">
            <button
              type="button"
              onClick={() => chooseDate(today)}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-black uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            >
              Return to today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DailyJournal({
  config,
  entry,
  onSave,
  onDateChange,
  onAddHabit,
  onAddCategory,
  onUpdateCategory,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  todayAllowance,
}) {
  const [draft, setDraft] = useState(entry);
  const [newHabit, setNewHabit] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    setDraft(entry);
  }, [entry.date]);

  if (!draft) return null;

  const commit = (next) => {
    setDraft(next);
    onSave(next);
  };

  const updateField = (field, value) => {
    commit({ ...draft, [field]: value });
  };

  const updateOption = (field, optionList, value) => {
    const selected = optionList.find((o) => String(o.value) === value) || null;
    commit({ ...draft, [field]: selected });
  };

  const updateHabit = (id, value) => {
    const next = { ...draft, habits: { ...draft.habits, [id]: value } };
    commit(next);
  };

  const updateCategory = (id, value) => {
    const next = {
      ...draft,
      categories: {
        ...draft.categories,
        [id]: { ...draft.categories[id], hours: value === '' ? '' : parseFloat(value) },
      },
    };
    commit(next);
  };

  const handleAddHabit = () => {
    if (!newHabit.trim()) return;
    onAddHabit(newHabit.trim());
    setNewHabit('');
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    onAddCategory(newCategory.trim());
    setNewCategory('');
  };

  const habitsList = config.habits || [];
  const categoriesList = config.categories || [];
  const completedHabits = habitsList.filter((h) => draft.habits[h.id]).length;
  const habitPct = habitsList.length ? (completedHabits / habitsList.length) * 100 : 0;

  const totalHours = categoriesList.reduce((sum, c) => {
    const h = parseFloat(draft.categories[c.id]?.hours);
    return sum + (isNaN(h) ? 0 : h);
  }, 0);
  const remaining = +(24 - totalHours).toFixed(1);
  const isOver = totalHours > 24;
  const timePct = Math.min(100, (totalHours / 24) * 100);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">DAILY QUEST</h1>
          <p className="text-game-dim text-sm">Fill one card per evening. It auto-saves as you go.</p>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <QuestDatePicker value={draft.date} onChange={onDateChange} />
        </div>
      </div>

      <div className={`${panelBase} relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
          <Sword className="w-24 h-24 text-amber-500" />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Daily Habits — {completedHabits}/{habitsList.length}</h2>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-5 border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all"
            style={{ width: `${habitPct}%` }}
          />
        </div>
        <div className="space-y-4">
          {HABIT_GROUP_ORDER.map((group) => {
            const groupHabits = habitsList.filter((h) => getHabitGroup(h.name) === group);
            if (groupHabits.length === 0) return null;
            return (
              <div key={group}>
                <div className="text-[10px] font-black uppercase tracking-widest text-game-dim/60 mb-2 pl-0.5">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {groupHabits.map((h) => {
                    const checked = !!draft.habits[h.id];
                    return (
                      <button
                        key={h.id}
                        onClick={() => updateHabit(h.id, !checked)}
                        className={[
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition font-bold',
                          checked
                            ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                            : 'bg-slate-900 border-slate-700 text-game-dim hover:border-amber-500/50 hover:text-game-text',
                        ].join(' ')}
                      >
                        <span className={['w-4 h-4 flex items-center justify-center rounded border', checked ? 'bg-emerald-500 border-emerald-500 text-slate-900' : 'border-slate-600'].join(' ')}>
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
            placeholder="Add a new habit"
            className={`${inputBase} flex-1`}
          />
          <button
            onClick={handleAddHabit}
            className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-2 rounded-lg text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={panelBase}>
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-game-dim mb-3">
            <Heart className="w-4 h-4 text-game-hp" /> Mood
          </label>
          <RatingPicker
            options={MOOD_OPTIONS}
            value={draft.mood?.value ?? null}
            onSelect={(opt) => commit({ ...draft, mood: opt })}
          />
        </div>
        <div className={panelBase}>
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-game-dim mb-3">
            <Zap className="w-4 h-4 text-game-mana" /> Energy
          </label>
          <RatingPicker
            options={ENERGY_OPTIONS}
            value={draft.energy?.value ?? null}
            onSelect={(opt) => commit({ ...draft, energy: opt })}
          />
        </div>
        <div className={panelBase}>
          <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-game-dim mb-3">
            <Sword className="w-4 h-4 text-game-gold" /> Power
          </label>
          <RatingPicker
            options={POWER_OPTIONS}
            value={draft.power?.value ?? null}
            onSelect={(opt) => commit({ ...draft, power: opt })}
          />
        </div>
      </div>

      <div className={panelBase}>
        {/* Header with live total */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Time Allocation</h2>
          </div>
          <div className={`text-sm font-black tabular-nums ${isOver ? 'text-red-400' : 'text-game-gold'}`}>
            {totalHours.toFixed(1)}h / 24h
          </div>
        </div>

        {/* Stacked 24h progress bar */}
        <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mb-1">
          {categoriesList.map((c, i) => {
            const h = parseFloat(draft.categories[c.id]?.hours);
            const val = isNaN(h) ? 0 : h;
            const pct = (val / 24) * 100;
            const offset = categoriesList.slice(0, i).reduce((s, cc) => {
              const hh = parseFloat(draft.categories[cc.id]?.hours);
              return s + (isNaN(hh) ? 0 : (hh / 24) * 100);
            }, 0);
            if (pct === 0) return null;
            return (
              <div
                key={c.id}
                title={`${c.name}: ${val}h`}
                className="absolute inset-y-0 transition-all"
                style={{ left: `${Math.min(offset, 100)}%`, width: `${Math.min(pct, 100 - offset)}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
              />
            );
          })}
          {isOver && <div className="absolute inset-0 bg-red-500/30 animate-pulse" />}
        </div>

        {/* Balance line */}
        <div className={`text-xs font-bold mb-4 ${isOver ? 'text-red-400' : remaining === 0 ? 'text-emerald-400' : 'text-game-dim'}`}>
          {isOver
            ? `⚠ ${Math.abs(remaining)}h over 24h — reduce to balance`
            : remaining === 0
            ? '✓ Perfectly allocated'
            : `${remaining}h unallocated`}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoriesList.map((c, i) => {
            const color = CAT_COLORS[i % CAT_COLORS.length];
            const val = parseFloat(draft.categories[c.id]?.hours);
            const hasVal = !isNaN(val) && val > 0;
            const diffFromExpected = c.expectedHours && hasVal ? +(val - c.expectedHours).toFixed(1) : null;
            return (
              <div key={c.id}>
                <label className="flex items-center gap-1.5 text-xs font-bold text-game-dim uppercase tracking-wide mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {c.name}
                  {c.expectedHours ? <span className="text-slate-600 normal-case font-normal ml-1">· goal {c.expectedHours}h</span> : ''}
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  placeholder={c.expectedHours ? String(c.expectedHours) : '0'}
                  value={draft.categories[c.id]?.hours ?? ''}
                  onChange={(e) => updateCategory(c.id, e.target.value)}
                  className={[inputBase, isOver ? 'border-red-700/60 focus:border-red-500' : ''].join(' ')}
                />
                {diffFromExpected !== null && (
                  <div className={`text-[10px] mt-0.5 font-bold ${diffFromExpected > 0 ? 'text-amber-400' : diffFromExpected < 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {diffFromExpected > 0 ? `+${diffFromExpected}h over goal` : diffFromExpected < 0 ? `${Math.abs(diffFromExpected)}h under goal` : 'On target'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder="Add a new time category"
            className={`${inputBase} flex-1`}
          />
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-2 rounded-lg text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'screenTime', label: 'Screen time (hrs)', icon: Moon },
          { key: 'money', label: 'Gold spent (₹)', icon: Coins, placeholder: todayAllowance > 0 ? `Budget: ₹${todayAllowance}` : undefined },
          { key: 'runWalk', label: 'Run / walk (km)', icon: Footprints },
          { key: 'steps', label: 'Steps', icon: Zap },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.key} className={panelBase}>
              <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-game-dim mb-2">
                <Icon className="w-4 h-4 text-game-gold" /> {f.label}
              </label>
              <input
                type="number"
                min={0}
                value={draft[f.key] ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField(f.key, val === '' ? '' : f.key === 'steps' ? parseInt(val, 10) : parseFloat(val));
                }}
                className={inputBase}
                placeholder={f.placeholder || ''}
              />
            </div>
          );
        })}
      </div>

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <Scroll className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Quest Reflections</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'bigWin', label: 'Epic win' },
            { key: 'drain', label: 'What hit your HP?' },
            { key: 'tomorrow', label: 'Next quest target' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-bold text-game-dim uppercase tracking-wide mb-2">{f.label}</label>
              <textarea
                value={draft[f.key] ?? ''}
                onChange={(e) => updateField(f.key, e.target.value)}
                rows={3}
                className={`${inputBase} resize-none`}
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-bold text-game-dim uppercase tracking-wide mb-2">Scroll notes</label>
          <textarea
            value={draft.notes ?? ''}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={2}
            className={`${inputBase} resize-none`}
          />
        </div>
      </div>

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <Scroll className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Carry-Forward Tasks</h2>
        </div>
        <p className="text-game-dim text-sm mb-4">Small tasks that stay here each day until you cross them off.</p>
        <div className="flex gap-2 mb-4">
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTodo.trim()) {
                onAddTodo(newTodo.trim());
                setNewTodo('');
              }
            }}
            placeholder="e.g. Update resume"
            className={`${inputBase} flex-1`}
          />
          <button
            onClick={() => {
              if (!newTodo.trim()) return;
              onAddTodo(newTodo.trim());
              setNewTodo('');
            }}
            className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-2 rounded-lg text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {(config.todos || [])
            .filter((t) => !t.completed)
            .map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                <button
                  onClick={() => onToggleTodo(t.id)}
                  className="w-5 h-5 rounded border border-slate-600 flex items-center justify-center hover:border-emerald-500"
                >
                  {t.completed && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
                <span className="flex-1 text-sm text-game-text">{t.text}</span>
                <button
                  onClick={() => onDeleteTodo(t.id)}
                  className="text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
