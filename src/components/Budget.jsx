import { useState, useMemo, useEffect, useRef } from 'react';
import {
  format, parseISO, getDaysInMonth, startOfMonth, isSameMonth, isPast,
  addDays, addMonths, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfWeek, subMonths,
} from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  Plus, Trash2, Edit3, Check, X, CreditCard, ChevronDown, ChevronUp, AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2,
} from 'lucide-react';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-500 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition';
const btnGhost = 'border border-slate-600 hover:border-amber-500/50 hover:bg-slate-800 text-game-dim hover:text-game-text font-bold px-3 py-1.5 rounded-lg text-sm transition';

// Compute carry-forward allowance and forward-looking daily from budget
function computeTodayAllowance(entries, budgetCategories) {
  const today = new Date();
  const daysInMonth = getDaysInMonth(today);
  const dayOfMonth = today.getDate();
  const daysLeft = daysInMonth - dayOfMonth + 1; // remaining days including today

  const dailyCats = budgetCategories.filter((c) => c.type === 'daily' && c.isActive !== false);
  const monthlyDailyPool = dailyCats.reduce((s, c) => s + (c.budgetedAmount || 0), 0);
  const baseDaily = monthlyDailyPool / daysInMonth;

  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  const monthEntries = entries.filter((e) => e.date >= monthStart && e.date < todayStr);
  const totalSpentBeforeToday = monthEntries.reduce((s, e) => s + (parseFloat(e.money) || 0), 0);
  const todayEntry = entries.find((e) => e.date === todayStr);
  const spentToday = todayEntry ? (parseFloat(todayEntry.money) || 0) : 0;
  const totalSpentThisMonth = totalSpentBeforeToday + spentToday;

  // Carry-forward allowance for today
  const allowance = dayOfMonth * baseDaily - totalSpentBeforeToday;

  // Forward-looking: (remaining budget) / days left including today.
  // Locked to spend-through-yesterday, same reasoning as `allowance` above — today's own
  // spending shouldn't shrink today's own rate as you log it. Recalculates once the date
  // actually changes, naturally spreading any saved/overspent amount across whatever days
  // are genuinely left rather than a special-cased catch-up window.
  const remainingBudget = monthlyDailyPool - totalSpentBeforeToday;
  const dailyFromBudget = daysLeft > 0 ? remainingBudget / daysLeft : null;

  return { allowance, baseDaily, monthlyDailyPool, daysInMonth, dayOfMonth, daysLeft, totalSpentThisMonth, remainingBudget, dailyFromBudget };
}


function SpentProgressBar({ spent, budget, colorClass }) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : colorClass || 'bg-emerald-500';
  return (
    <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SourceToggle({ value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {['bank', 'cash'].map((source) => (
        <button
          key={source}
          type="button"
          onClick={() => onChange(source)}
          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide transition ${
            (value || 'bank') === source
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-800 text-game-dim border border-slate-600 hover:text-game-text'
          }`}
        >
          {source === 'bank' ? 'Bank' : 'Cash'}
        </button>
      ))}
    </div>
  );
}

function CategoryRow({ cat, autoSpent, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: cat.name, type: cat.type, budgetedAmount: cat.budgetedAmount, spentAmount: cat.spentAmount ?? 0, paymentSource: cat.paymentSource || 'bank' });
  const [saving, setSaving] = useState(false);
  const [spentEditing, setSpentEditing] = useState(false);
  const [spentInput, setSpentInput] = useState('');
  const [spentSource, setSpentSource] = useState(cat.paymentSource || 'bank');

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...cat, ...form, budgetedAmount: parseFloat(form.budgetedAmount) || 0, spentAmount: parseFloat(form.spentAmount) || 0 });
    setSaving(false);
    setEditing(false);
  };

  const handleSaveSpent = async () => {
    const amount = parseFloat(spentInput);
    if (isNaN(amount)) return;
    setSaving(true);
    await onSave({ ...cat, spentAmount: amount, paymentSource: spentSource });
    setSaving(false);
    setSpentEditing(false);
    setSpentInput('');
  };

  // For daily categories, use auto-computed spent from entries; for fixed, use cat.spentAmount
  const effectiveSpent = cat.type === 'daily' && autoSpent !== undefined ? autoSpent : (cat.spentAmount || 0);
  const remaining = cat.budgetedAmount - effectiveSpent;

  if (editing) {
    return (
      <div className="flex flex-wrap gap-2 items-center py-2 px-3 bg-slate-900/60 rounded-lg">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 min-w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
          placeholder="Category name"
        />
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
        >
          <option value="fixed">Fixed</option>
          <option value="daily">Daily pool</option>
        </select>
        <input
          type="number"
          value={form.budgetedAmount}
          onChange={(e) => setForm((f) => ({ ...f, budgetedAmount: e.target.value }))}
          className="w-28 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
          placeholder="Budget (₹)"
        />
        {form.type === 'fixed' && (
          <SourceToggle value={form.paymentSource} onChange={(source) => setForm((f) => ({ ...f, paymentSource: source }))} />
        )}
        <button onClick={handleSave} disabled={saving} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1.5 rounded text-game-dim hover:bg-slate-700 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="py-2 px-3 rounded-lg hover:bg-slate-900/40 transition group">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-game-text text-sm font-bold">{cat.name}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-game-gold font-black text-sm">₹{cat.budgetedAmount.toLocaleString()}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
          <button onClick={() => { setForm({ name: cat.name, type: cat.type, budgetedAmount: cat.budgetedAmount, spentAmount: cat.spentAmount ?? 0, paymentSource: cat.paymentSource || 'bank' }); setEditing(true); }} className="p-1.5 rounded text-game-dim hover:text-amber-400 hover:bg-amber-400/10 transition">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(cat.id)} className="p-1.5 rounded text-game-dim hover:text-red-400 hover:bg-red-400/10 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {cat.budgetedAmount > 0 && (
        <div className="mt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {cat.type === 'fixed' ? (
                spentEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={spentInput}
                      onChange={(e) => setSpentInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSpent(); if (e.key === 'Escape') { setSpentEditing(false); setSpentInput(''); } }}
                      placeholder="Spent ₹"
                      className="w-24 bg-slate-800 border border-amber-500/50 rounded px-2 py-0.5 text-xs text-game-text outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <SourceToggle value={spentSource} onChange={setSpentSource} />
                    <button onClick={handleSaveSpent} disabled={saving} className="p-0.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => { setSpentEditing(false); setSpentInput(''); }} className="p-0.5 rounded text-game-dim hover:bg-slate-700 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSpentInput(String(effectiveSpent)); setSpentSource(cat.paymentSource || 'bank'); setSpentEditing(true); }}
                    className="text-game-dim hover:text-amber-400 transition flex items-center gap-1"
                    title="Log how much you've spent"
                  >
                    Spent: <span className={effectiveSpent > 0 ? 'text-game-text font-bold' : ''}>₹{effectiveSpent.toLocaleString()}</span>
                    <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60" />
                  </button>
                )
              ) : (
                <span className="text-game-dim">Spent: <span className={effectiveSpent > 0 ? 'text-game-text font-bold' : ''}>₹{effectiveSpent.toLocaleString()}</span></span>
              )}
            </div>
            <span className={`font-bold ${remaining < 0 ? 'text-red-400' : remaining < cat.budgetedAmount * 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {remaining >= 0 ? `₹${remaining.toLocaleString()} left` : `₹${Math.abs(remaining).toLocaleString()} over`}
            </span>
          </div>
          <SpentProgressBar spent={effectiveSpent} budget={cat.budgetedAmount} colorClass={cat.type === 'fixed' ? 'bg-blue-500' : 'bg-emerald-500'} />
        </div>
      )}
    </div>
  );
}

function AddCategoryRow({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'daily', budgetedAmount: '', paymentSource: 'bank' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onAdd({ name: form.name.trim(), type: form.type, budgetedAmount: parseFloat(form.budgetedAmount) || 0, paymentSource: form.paymentSource });
    setSaving(false);
    setForm({ name: '', type: 'daily', budgetedAmount: '', paymentSource: 'bank' });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-game-dim hover:text-amber-400 transition py-1 px-3">
        <Plus className="w-4 h-4" /> Add category
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center py-2 px-3 bg-slate-900/60 rounded-lg border border-amber-500/30">
      <input
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1 min-w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
        placeholder="Name (e.g. Food)"
        autoFocus
      />
      <select
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
      >
        <option value="fixed">Fixed</option>
        <option value="daily">Daily pool</option>
      </select>
      <input
        type="number"
        value={form.budgetedAmount}
        onChange={(e) => setForm((f) => ({ ...f, budgetedAmount: e.target.value }))}
        className="w-28 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
        placeholder="₹ / month"
      />
      {form.type === 'fixed' && (
        <SourceToggle value={form.paymentSource} onChange={(source) => setForm((f) => ({ ...f, paymentSource: source }))} />
      )}
      <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-400/10 transition disabled:opacity-40">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => setOpen(false)} className="p-1.5 rounded text-game-dim hover:bg-slate-700 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Compact themed calendar dropdown for a due date. Unlike the journal's date picker,
// future dates are the whole point here, so nothing is disabled — just past/today/future
// styling plus quick "Today" and "Clear" actions.
function DueDatePicker({ value, onChange }) {
  const selectedDate = value ? parseISO(value) : null;
  const today = startOfDay(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(startOfMonth(selectedDate || today));
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
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className="relative w-full text-left">
      <button
        type="button"
        onClick={() => {
          if (!isOpen) setDisplayMonth(startOfMonth(selectedDate || today));
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-left transition hover:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
      >
        <span className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-amber-400/80 shrink-0" />
          <span className={selectedDate ? 'text-game-text font-bold' : 'text-slate-500'}>
            {selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'No due date'}
          </span>
        </span>
        <ChevronRight className={['h-3.5 w-3.5 text-game-dim transition-transform shrink-0', isOpen ? 'rotate-90 text-amber-400' : ''].join(' ')} />
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Choose due date" className="absolute inset-x-0 z-20 mt-2 rounded-2xl border border-slate-600/80 bg-slate-900 p-3 shadow-2xl shadow-black/50 ring-1 ring-amber-500/10 sm:w-[280px]">
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
              onClick={() => setDisplayMonth((month) => addMonths(month, 1))}
              className="rounded-lg p-1.5 text-game-dim transition hover:bg-slate-800 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <span key={`${day}-${index}`} className="py-1 text-[10px] font-black text-game-dim">{day}</span>
            ))}
            {calendarDays.map((day) => {
              const selected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isOverdue = !selected && day < today;
              const outsideMonth = !isSameMonth(day, displayMonth);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                  aria-pressed={selected}
                  onClick={() => chooseDate(day)}
                  className={[
                    'relative h-8 rounded-lg text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-500/70',
                    selected ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.45)]' : 'text-game-text hover:bg-slate-800 hover:text-amber-300',
                    isToday && !selected ? 'border border-amber-500/60 text-amber-400' : '',
                    isOverdue ? 'opacity-40' : '',
                    outsideMonth && !selected ? 'text-slate-600 hover:text-slate-400' : '',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2 border-t border-slate-700 pt-3">
            <button
              type="button"
              onClick={() => chooseDate(today)}
              className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-black uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { onChange(''); setIsOpen(false); }}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-800 py-2 text-xs font-black uppercase tracking-wider text-game-dim transition hover:bg-slate-700 hover:text-game-text focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditCardItem({ card, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: card.name, currentBalance: card.currentBalance, creditLimit: card.creditLimit || '', rewardPoints: card.rewardPoints ?? '', dueDate: card.dueDate ? card.dueDate.slice(0, 10) : '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...card, ...form, currentBalance: parseFloat(form.currentBalance) || 0, creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null, rewardPoints: form.rewardPoints !== '' ? parseFloat(form.rewardPoints) : null, dueDate: form.dueDate || null });
    setSaving(false);
    setEditing(false);
  };

  // Just zeroes the outstanding balance — name, limit, points, and due date stay
  // as-is so the card is ready for the next cycle's amount to be typed in.
  const handleMarkPaid = async () => {
    setSaving(true);
    await onSave({ ...card, currentBalance: 0, isPayment: true });
    setSaving(false);
  };

  const utilizationPct = card.creditLimit ? Math.min(100, (card.currentBalance / card.creditLimit) * 100) : null;
  const isPaid = card.isPaid;

  return (
    <div className={`bg-slate-900/60 rounded-xl border p-4 transition ${isPaid ? 'border-emerald-500/30 opacity-70' : 'border-slate-700'}`}>
      {editing ? (
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-game-text outline-none focus:border-amber-500"
            placeholder="Card name (e.g. HDFC)" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Outstanding (₹)</label>
              <input type="number" value={form.currentBalance} onChange={(e) => setForm((f) => ({ ...f, currentBalance: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-game-text outline-none focus:border-amber-500" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Credit Limit (₹)</label>
              <input type="number" value={form.creditLimit} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-game-text outline-none focus:border-amber-500" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Reward Points</label>
              <input type="number" value={form.rewardPoints} onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-game-text outline-none focus:border-amber-500" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Due Date</label>
            <DueDatePicker value={form.dueDate} onChange={(d) => setForm((f) => ({ ...f, dueDate: d }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>Save</button>
            <button onClick={() => setEditing(false)} className={btnGhost}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${isPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-600'}`}>
              <CreditCard className={`w-5 h-5 ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-game-text">{card.name}</span>
                {isPaid && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">PAID</span>
                )}
              </div>
              <div className={`text-2xl font-black ${isPaid ? 'text-emerald-400 line-through opacity-50' : 'text-red-400'}`}>
                ₹{card.currentBalance.toLocaleString()}
              </div>
              {isPaid && <div className="text-xs text-emerald-400 font-bold -mt-1">₹0 outstanding</div>}
              <div className="flex gap-3 mt-0.5 flex-wrap items-center">
                {utilizationPct !== null && !isPaid && (
                  <span className="text-xs text-game-dim">{utilizationPct.toFixed(0)}% of ₹{card.creditLimit.toLocaleString()}</span>
                )}
                {card.rewardPoints != null && (
                  <span className="text-xs text-amber-400 font-bold">{card.rewardPoints.toLocaleString()} pts</span>
                )}
                {card.dueDate && !isPaid && (
                  <span className={`text-xs font-bold ${isPast(parseISO(card.dueDate)) ? 'text-red-400' : 'text-game-dim'}`}>
                    Due {format(parseISO(card.dueDate), 'dd MMM')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 items-start">
            <button
              onClick={handleMarkPaid}
              disabled={saving}
              title="Mark as paid — zeroes balance, keeps everything else for next cycle"
              className="p-1.5 rounded text-game-dim hover:text-emerald-400 hover:bg-emerald-400/10 transition disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setForm({ name: card.name, currentBalance: card.currentBalance, creditLimit: card.creditLimit || '', rewardPoints: card.rewardPoints ?? '', dueDate: card.dueDate ? card.dueDate.slice(0, 10) : '' }); setEditing(true); }}
              className="p-1.5 rounded text-game-dim hover:text-amber-400 hover:bg-amber-400/10 transition">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(card.id)} className="p-1.5 rounded text-game-dim hover:text-red-400 hover:bg-red-400/10 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {utilizationPct !== null && !editing && !isPaid && (
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilizationPct > 80 ? 'bg-red-500' : utilizationPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AddCreditCardButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', currentBalance: '', creditLimit: '', rewardPoints: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onAdd({ name: form.name.trim(), currentBalance: parseFloat(form.currentBalance) || 0, creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null, rewardPoints: form.rewardPoints ? parseFloat(form.rewardPoints) : null, dueDate: form.dueDate || null });
    setSaving(false);
    setForm({ name: '', currentBalance: '', creditLimit: '', rewardPoints: '', dueDate: '' });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnGhost + ' flex items-center gap-2'}>
        <Plus className="w-4 h-4" /> Add card
      </button>
    );
  }

  return (
    <div className="bg-slate-900/60 rounded-xl border border-amber-500/30 p-4 space-y-3">
      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className={inputBase} placeholder="Card name (e.g. HDFC)" autoFocus />
      <div className="grid grid-cols-3 gap-2">
        <input type="number" value={form.currentBalance} onChange={(e) => setForm((f) => ({ ...f, currentBalance: e.target.value }))}
          className={inputBase} placeholder="Outstanding (₹)" />
        <input type="number" value={form.creditLimit} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
          className={inputBase} placeholder="Limit (optional)" />
        <input type="number" value={form.rewardPoints} onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
          className={inputBase} placeholder="Points" />
      </div>
      <div>
        <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Due Date</label>
        <DueDatePicker value={form.dueDate} onChange={(d) => setForm((f) => ({ ...f, dueDate: d }))} />
      </div>
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={saving || !form.name.trim()} className={btnPrimary}>Add card</button>
        <button onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

export function Budget({ config, entries, onSaveBudget, onSaveBudgetCategory, onDeleteBudgetCategory, onSaveCreditCard, onDeleteCreditCard }) {
  const [income, setIncome] = useState(config.budgetSetting?.monthlyIncome || '');
  const [incomeEditing, setIncomeEditing] = useState(false);
  const [cashBalance, setCashBalance] = useState(config.budgetSetting?.cashBalance ?? '');
  const [bankBalance, setBankBalance] = useState(config.budgetSetting?.bankBalance ?? '');
  const [balanceEditing, setBalanceEditing] = useState(false);
  const [quickAdd, setQuickAdd] = useState('');
  const [showChart, setShowChart] = useState(false);

  // cashBalance/bankBalance are local drafts (so typing doesn't fight the server), but they
  // need to pick up balance changes that happen elsewhere — CC payments, daily spend, fixed
  // category spend — without waiting for a full reload. Skip syncing while the user is
  // actively editing so it doesn't clobber what they're typing.
  useEffect(() => {
    if (balanceEditing) return;
    setCashBalance(config.budgetSetting?.cashBalance ?? '');
    setBankBalance(config.budgetSetting?.bankBalance ?? '');
  }, [config.budgetSetting?.cashBalance, config.budgetSetting?.bankBalance, balanceEditing]);

  const budgetCategories = useMemo(() => config.budgetCategories || [], [config.budgetCategories]);
  const creditCards = config.creditCards || [];

  const { allowance, baseDaily, monthlyDailyPool, daysInMonth, dayOfMonth, daysLeft, totalSpentThisMonth, remainingBudget, dailyFromBudget } = useMemo(
    () => computeTodayAllowance(entries, budgetCategories),
    [entries, budgetCategories]
  );

  const fixedCategories = budgetCategories.filter((c) => c.type === 'fixed');
  const dailyCategories = budgetCategories.filter((c) => c.type === 'daily');
  const totalFixed = fixedCategories.reduce((s, c) => s + c.budgetedAmount, 0);
  const totalFixedSpent = fixedCategories.reduce((s, c) => s + (c.spentAmount || 0), 0);
  const totalIncome = parseFloat(income) || 0;
  // Paid fixed spend and this month's daily spend have already been drawn out of
  // Cash/Bank as they were logged (bank-sync), so only what's still UNPAID needs to be
  // set aside here — subtracting the full budgeted amount would double-count the part
  // that's already left the balance.
  const unpaidFixed = Math.max(0, totalFixed - totalFixedSpent);
  const unspentDailyPool = Math.max(0, monthlyDailyPool - totalSpentThisMonth);
  const totalAllocated = unpaidFixed + unspentDailyPool;
  const totalCcDebt = creditCards.filter((c) => !c.isPaid).reduce((s, c) => s + (c.currentBalance || 0), 0);
  const totalRewardPoints = creditCards.reduce((s, c) => s + (c.rewardPoints || 0), 0);
  const ccDebtDueThisMonth = creditCards
    .filter((c) => !c.isPaid && c.dueDate && isSameMonth(parseISO(c.dueDate), new Date()))
    .reduce((s, c) => s + (c.currentBalance || 0), 0);

  const cashVal = cashBalance === '' ? null : parseFloat(cashBalance);
  const bankVal = bankBalance === '' ? null : parseFloat(bankBalance);
  const totalAvailable = (cashVal ?? 0) + (bankVal ?? 0);
  const hasBalanceSet = cashVal !== null || bankVal !== null;
  const availableAfterCc = totalAvailable - totalCcDebt;

  // Days remaining in month (including today)
  const daysLeftIncludingToday = daysInMonth - dayOfMonth + 1;

  // Effective daily rate for remaining days (remaining budget ÷ days left including today)
  const effectiveDailyRemaining = daysLeftIncludingToday > 0 ? remainingBudget / daysLeftIncludingToday : 0;

  // Balance after setting aside allocations (what's truly free)
  const balanceAfterAllocations = hasBalanceSet ? totalAvailable - totalAllocated : null;

  // Alerts
  const ccExceedsBalance = hasBalanceSet && ccDebtDueThisMonth > totalAvailable;
  const overBudget = hasBalanceSet && totalAllocated > totalAvailable;

  const chartData = entries.map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    amount: parseFloat(e.money) || 0,
  }));
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const thisMonthEntries = entries.filter((e) => e.date.startsWith(format(new Date(), 'yyyy-MM')));
  const monthTotal = thisMonthEntries.reduce((s, e) => s + (parseFloat(e.money) || 0), 0);

  const handleSaveIncome = async () => {
    await onSaveBudget({
      monthlyIncome: income === '' ? null : parseFloat(income),
    });
    setIncomeEditing(false);
  };

  const handleSaveBalance = async () => {
    await onSaveBudget({
      cashBalance: cashBalance === '' ? null : parseFloat(cashBalance),
      bankBalance: bankBalance === '' ? null : parseFloat(bankBalance),
    });
    setBalanceEditing(false);
  };

  const handleQuickAdd = async (amount) => {
    const current = parseFloat(bankBalance) || 0;
    const newVal = String(current + amount);
    setBankBalance(newVal);
    await onSaveBudget({ bankBalance: current + amount });
    setQuickAdd('');
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">TREASURY</h1>
        <p className="text-game-dim text-sm">Budget your gold, track debt, and spend wisely.</p>
      </div>

      {/* Alerts */}
      {ccExceedsBalance && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-black text-red-400 text-sm">CC Debt Exceeds Available Balance</div>
            <div className="text-sm text-game-dim mt-0.5">
              You owe <span className="text-red-400 font-bold">₹{ccDebtDueThisMonth.toLocaleString()}</span> on credit cards due this month but only have{' '}
              <span className="text-amber-400 font-bold">₹{totalAvailable.toLocaleString()}</span> available.{' '}
              Shortfall: <span className="text-red-400 font-bold">₹{(ccDebtDueThisMonth - totalAvailable).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
      {!ccExceedsBalance && hasBalanceSet && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-black text-emerald-400 text-sm">CC Debt Covered</div>
            <div className="text-sm text-game-dim mt-0.5">
              {ccDebtDueThisMonth > 0 ? (
                <>
                  You owe <span className="text-emerald-400 font-bold">₹{ccDebtDueThisMonth.toLocaleString()}</span> on credit cards due this month and have{' '}
                  <span className="text-amber-400 font-bold">₹{totalAvailable.toLocaleString()}</span> available.{' '}
                  Gap left after paying: <span className="text-emerald-400 font-bold">₹{(totalAvailable - ccDebtDueThisMonth).toLocaleString()}</span>
                </>
              ) : (
                <>No credit card debt due this month — <span className="text-emerald-400 font-bold">₹{totalAvailable.toLocaleString()}</span> available to spend.</>
              )}
            </div>
          </div>
        </div>
      )}
      {overBudget && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-black text-amber-400 text-sm">Unpaid Allocations Exceed Available Balance</div>
            <div className="text-sm text-game-dim mt-0.5">
              You still need to set aside <span className="text-amber-400 font-bold">₹{totalAllocated.toLocaleString()}</span> for unpaid budget items but only have{' '}
              <span className="text-game-text font-bold">₹{totalAvailable.toLocaleString()}</span> in cash + bank.{' '}
              Over by <span className="text-red-400 font-bold">₹{(totalAllocated - totalAvailable).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Allowance Hero */}
      <div className={`${panelBase} border-amber-500/40 bg-gradient-to-br from-game-panel to-slate-900`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-game-dim mb-1">Daily Budget · {daysLeftIncludingToday} days left</div>
            <div className={`text-4xl font-black text-glow ${effectiveDailyRemaining >= 0 ? 'text-amber-300' : 'text-red-400'}`}>
              ₹{Math.abs(effectiveDailyRemaining).toFixed(0)}
              <span className="text-lg ml-1 font-normal text-game-dim">/day</span>
            </div>
            <div className="text-sm text-game-dim mt-1">
              ₹{remainingBudget.toFixed(0)} remaining ÷ {daysLeftIncludingToday} days
              {totalSpentThisMonth > 0 && (
                <span className="ml-2 text-amber-400">· ₹{totalSpentThisMonth.toLocaleString()} spent so far</span>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs uppercase tracking-widest text-game-dim mb-1">This Month</div>
            <div className="text-2xl font-black text-game-text">₹{monthTotal.toLocaleString()}</div>
            <div className="text-sm text-game-dim">of ₹{monthlyDailyPool.toLocaleString()} pool</div>
            {monthlyDailyPool > 0 && (
              <div className="mt-1 h-2 bg-slate-700 rounded-full w-48 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${monthTotal / monthlyDailyPool > 1 ? 'bg-red-500' : monthTotal / monthlyDailyPool > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (monthTotal / monthlyDailyPool) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Salary */}
      <div className={panelBase}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Monthly Salary</h2>
        </div>
        <p className="text-xs text-game-dim mb-4">Auto-credited to Bank on the last working day of each month — funds next month's budget.</p>
        {incomeEditing ? (
          <div className="space-y-3 max-w-sm">
            <div>
              <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Monthly salary (₹)</label>
              <input type="number" value={income} onChange={(e) => setIncome(e.target.value)}
                className={inputBase} placeholder="e.g. 80000" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome()} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveIncome} className={btnPrimary}>Save</button>
              <button onClick={() => { setIncome(config.budgetSetting?.monthlyIncome || ''); setIncomeEditing(false); }} className={btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div>
              <div className="text-3xl font-black text-game-gold text-glow">
                {totalIncome ? `₹${totalIncome.toLocaleString()}` : <span className="text-game-dim text-xl">Not set</span>}
              </div>
              {totalIncome > 0 && (
                <div className="text-xs text-game-dim mt-1">
                  Auto-credited on the <span className="text-amber-400 font-bold">last working day</span> of each month
                  {config.budgetSetting?.lastSalaryCredit && (
                    <span className="ml-2 text-emerald-400 font-bold">· Last credited {config.budgetSetting.lastSalaryCredit}</span>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setIncomeEditing(true)} className="p-1.5 rounded text-game-dim hover:text-amber-400 hover:bg-amber-400/10 transition">
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Money I Have */}
      <div className={panelBase}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Money I Have</h2>
          {!balanceEditing && (
            <button onClick={() => setBalanceEditing(true)} className="p-1.5 rounded text-game-dim hover:text-amber-400 hover:bg-amber-400/10 transition">
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-game-dim mb-4">Set your real balance here once — Bank auto-adjusts as you log daily spend, fixed spend, and CC payments from then on.</p>

        {balanceEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Cash in hand (₹)</label>
                <input type="number" value={cashBalance} onChange={(e) => setCashBalance(e.target.value)}
                  className={inputBase} placeholder="e.g. 2000" autoFocus />
              </div>
              <div>
                <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Bank balance (₹)</label>
                <input type="number" value={bankBalance} onChange={(e) => setBankBalance(e.target.value)}
                  className={inputBase} placeholder="e.g. 18000" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveBalance} className={btnPrimary}>Save</button>
              <button onClick={() => { setCashBalance(config.budgetSetting?.cashBalance ?? ''); setBankBalance(config.budgetSetting?.bankBalance ?? ''); setBalanceEditing(false); }} className={btnGhost}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Cash</div>
              <div className="text-2xl font-black text-emerald-400">
                {cashVal !== null ? `₹${cashVal.toLocaleString()}` : <span className="text-game-dim text-base">—</span>}
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Bank</div>
              <div className="text-2xl font-black text-emerald-400 mb-2">
                {bankVal !== null ? `₹${bankVal.toLocaleString()}` : <span className="text-game-dim text-base">—</span>}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  placeholder="+ Add"
                  className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-game-text outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => { const n = parseFloat(quickAdd); if (n) handleQuickAdd(n); }}
                  disabled={!quickAdd || isNaN(parseFloat(quickAdd))}
                  className="text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 px-2 py-1 rounded transition disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {hasBalanceSet && !balanceEditing && (
          <div className={`rounded-xl p-4 border ${ccExceedsBalance ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/60 border-slate-700'}`}>
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Total available</div>
                <div className={`text-2xl font-black ${ccExceedsBalance ? 'text-red-400' : 'text-emerald-400'}`}>₹{totalAvailable.toLocaleString()}</div>
                {totalCcDebt > 0 && (
                  <div className="text-sm text-game-dim mt-0.5">
                    − ₹{totalCcDebt.toLocaleString()} CC = <span className={availableAfterCc >= 0 ? 'text-emerald-400' : 'text-red-400'}>₹{availableAfterCc.toLocaleString()}</span> free
                  </div>
                )}
              </div>
              {dailyFromBudget !== null && daysLeft > 0 && (
                <div className="text-right">
                  <div className="text-xs text-game-dim uppercase tracking-wide mb-1">Daily budget · {daysLeft}d left</div>
                  <div className={`text-2xl font-black text-glow ${dailyFromBudget >= 0 ? 'text-amber-300' : 'text-red-400'}`}>
                    ₹{Math.abs(dailyFromBudget).toFixed(0)}<span className="text-base font-normal text-game-dim">/day</span>
                  </div>
                  <div className="text-xs text-game-dim mt-0.5">
                    ₹{remainingBudget.toFixed(0)} left ÷ {daysLeft} days
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Budget Categories */}
      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-1">Budget Categories</h2>
        <p className="text-xs text-game-dim mb-4">
          Allocations for this month. For fixed items, click the spent amount to log actual spending.
        </p>

        {/* Allocation summary — balance-based */}
        {hasBalanceSet && (
          <div className="mb-5 p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-2">
            <div className="text-xs text-game-dim uppercase tracking-widest font-bold mb-2">Balance Allocation</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-xs text-game-dim w-28">Cash + Bank</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-game-gold/40 rounded-full" />
                </div>
                <span className="text-xs font-bold text-game-gold w-24 text-right">₹{totalAvailable.toLocaleString()}</span>
              </div>
              {unpaidFixed > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-blue-400 w-28">Fixed unpaid ({fixedCategories.length})</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (unpaidFixed / totalAvailable) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-blue-400 w-24 text-right">−₹{unpaidFixed.toLocaleString()}</span>
                </div>
              )}
              {unspentDailyPool > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-emerald-400 w-28">Daily pool left</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (unspentDailyPool / totalAvailable) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 w-24 text-right">−₹{unspentDailyPool.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1 border-t border-slate-700">
                <span className="text-xs text-game-dim w-28">Free / Savings</span>
                <div className="flex-1" />
                <span className={`text-xs font-black w-24 text-right ${(balanceAfterAllocations ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {balanceAfterAllocations !== null ? `${balanceAfterAllocations >= 0 ? '+' : ''}₹${balanceAfterAllocations.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {fixedCategories.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-blue-400 uppercase tracking-widest mb-2 font-bold">Fixed Monthly</div>
            <div className="space-y-1">
              {fixedCategories.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} onSave={onSaveBudgetCategory} onDelete={onDeleteBudgetCategory} />
              ))}
            </div>
            <div className="flex justify-between text-sm text-game-dim mt-2 pr-3">
              <span>Spent: <span className="text-blue-300 font-bold">₹{totalFixedSpent.toLocaleString()}</span></span>
              <span>Allocated: <span className="text-blue-400 font-bold">₹{totalFixed.toLocaleString()}</span></span>
            </div>
          </div>
        )}

        {dailyCategories.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-emerald-400 uppercase tracking-widest mb-2 font-bold">Daily Pool</div>
            <div className="space-y-1">
              {dailyCategories.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} autoSpent={totalSpentThisMonth} onSave={onSaveBudgetCategory} onDelete={onDeleteBudgetCategory} />
              ))}
            </div>
            <div className="text-right text-sm text-game-dim mt-2 pr-3">
              <span className="text-emerald-400 font-bold">₹{remainingBudget.toFixed(0)} remaining</span>
              <span className="ml-2 text-amber-400">· ₹{effectiveDailyRemaining.toFixed(0)}/day for {daysLeftIncludingToday} days</span>
            </div>
          </div>
        )}

        <AddCategoryRow onAdd={onSaveBudgetCategory} />
      </div>

      {/* Credit Cards */}
      <div className={panelBase}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Credit Card Debt</h2>
            <p className="text-xs text-game-dim mt-0.5">Tick the checkmark once the bill is paid — zeroes the balance.</p>
          </div>
          <div className="text-right">
            {totalCcDebt > 0 && <div className="text-xl font-black text-red-400">₹{totalCcDebt.toLocaleString()} due</div>}
            {hasBalanceSet && ccDebtDueThisMonth > 0 && (
              <div className={`text-xs font-bold ${ccExceedsBalance ? 'text-red-400' : 'text-emerald-400'}`}>
                {ccExceedsBalance
                  ? `Short by ₹${(ccDebtDueThisMonth - totalAvailable).toLocaleString()} this month`
                  : `₹${(totalAvailable - ccDebtDueThisMonth).toLocaleString()} gap this month`}
              </div>
            )}
            {totalRewardPoints > 0 && <div className="text-sm font-bold text-amber-400">{totalRewardPoints.toLocaleString()} pts total</div>}
          </div>
        </div>
        <div className="space-y-3 mb-4">
          {creditCards.map((card) => (
            <CreditCardItem
              key={card.id}
              card={card}
              onSave={async (updatedCard) => {
                const wasUnpaid = !card.isPaid;
                const nowPaid = updatedCard.isPaid;
                await onSaveCreditCard(updatedCard);
                if (wasUnpaid && nowPaid && card.currentBalance > 0) {
                  const currentBank = config.budgetSetting?.bankBalance ?? 0;
                  const newBank = currentBank - card.currentBalance;
                  setBankBalance(String(newBank));
                  await onSaveBudget({ bankBalance: newBank });
                }
              }}
              onDelete={onDeleteCreditCard}
            />
          ))}
        </div>
        <AddCreditCardButton onAdd={onSaveCreditCard} />
      </div>

      {/* Spending Chart - collapsible */}
      <div className={panelBase}>
        <button
          className="w-full flex items-center justify-between text-lg font-black uppercase tracking-wide text-game-text mb-0"
          onClick={() => setShowChart((v) => !v)}
        >
          Daily Spend Chart
          {showChart ? <ChevronUp className="w-5 h-5 text-game-dim" /> : <ChevronDown className="w-5 h-5 text-game-dim" />}
        </button>
        {showChart && (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${v}`, 'Spent']} />
                {baseDaily > 0 && <ReferenceLine y={baseDaily} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Daily', fill: '#f59e0b', fontSize: 11 }} />}
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Spending Log */}
      <div className={panelBase}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Spending Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Spent</th>
                <th className="px-4 py-3">Allowance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...thisMonthEntries].reverse().map((e) => {
                const spent = parseFloat(e.money) || 0;
                const allowanceForRow = dailyFromBudget != null ? Math.round(dailyFromBudget) : Math.round(baseDaily);
                const over = allowanceForRow > 0 && spent > allowanceForRow;
                return (
                  <tr key={e.date} className={`hover:bg-slate-900/40 transition ${e.date === todayStr ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-4 py-3 text-game-text font-bold">
                      {format(parseISO(e.date), 'dd MMM')}
                      {e.date === todayStr && <span className="ml-2 text-xs text-amber-400 font-bold">TODAY</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-game-text">₹{spent.toLocaleString()}</td>
                    <td className="px-4 py-3 text-game-dim">₹{allowanceForRow}</td>
                    <td className="px-4 py-3">
                      {spent === 0 ? <span className="text-game-dim">No entry</span>
                        : over ? <span className="text-red-400 font-bold">Over by ₹{(spent - allowanceForRow).toFixed(0)}</span>
                        : <span className="text-emerald-400 font-bold">Saved ₹{(allowanceForRow - spent).toFixed(0)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
