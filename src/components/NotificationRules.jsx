import { useState, useEffect, useRef } from 'react';
import { Bell, Send, Trash2, Pencil, Plus, X, Check, Loader2, Clock } from 'lucide-react';
import { api } from '../lib/api';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-40';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const emptyForm = { name: '', time: '23:30', message: '', daysOfWeek: ALL_DAYS };

function parseDays(daysOfWeek) {
  if (Array.isArray(daysOfWeek)) return daysOfWeek;
  return (daysOfWeek || '0,1,2,3,4,5,6').split(',').map(Number);
}

function formatDays(days) {
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort();
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays';
  if (JSON.stringify(sorted) === JSON.stringify([0, 6])) return 'Weekends';
  return sorted.map((d) => DAY_LABELS[d]).join(' ');
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function to24h(hour12, minute, period) {
  const h = (hour12 % 12) + (period === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime12(time) {
  const [h24, m] = (time || '00:00').split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((h24 + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function TimeColumn({ items, selected, onSelect, format }) {
  return (
    <div className="h-40 w-14 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          className={`w-full py-1.5 text-xs font-bold transition ${
            item === selected ? 'bg-amber-500 text-slate-950' : 'text-game-dim hover:bg-slate-800 hover:text-amber-300'
          }`}
        >
          {format(item)}
        </button>
      ))}
    </div>
  );
}

function QuestTimePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
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

  const [h24, m] = (value || '00:00').split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((h24 + 11) % 12) + 1;

  return (
    <div ref={pickerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-slate-900/90 px-3 py-2 text-sm font-bold text-game-text transition hover:border-amber-400/60 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
      >
        <Clock className="h-4 w-4 text-amber-400" />
        {formatTime12(value)}
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Choose reminder time" className="absolute z-20 mt-2 flex gap-1.5 rounded-2xl border border-slate-600/80 bg-slate-900 p-2 shadow-2xl shadow-black/50 ring-1 ring-amber-500/10">
          <TimeColumn items={HOURS_12} selected={hour12} format={String} onSelect={(h) => onChange(to24h(h, m, period))} />
          <TimeColumn items={MINUTES} selected={m} format={(x) => String(x).padStart(2, '0')} onSelect={(min) => onChange(to24h(hour12, min, period))} />
          <TimeColumn items={['AM', 'PM']} selected={period} format={(p) => p} onSelect={(p) => onChange(to24h(hour12, m, p))} />
        </div>
      )}
    </div>
  );
}

function DayToggle({ value, onChange }) {
  const toggle = (d) => {
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  };
  return (
    <div className="flex items-center gap-1">
      {DAY_LABELS.map((label, d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`w-6 h-6 rounded text-[11px] font-bold transition ${
            value.includes(d) ? 'bg-amber-500 text-black' : 'bg-slate-900 text-slate-500 border border-slate-700 hover:border-slate-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RuleForm({ value, onChange, onSubmit, onCancel, submitLabel }) {
  return (
    <tr className="bg-slate-900/60">
      <td className="px-4 py-3">
        <input
          className={inputBase}
          placeholder="Name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </td>
      <td className="px-4 py-3">
        <QuestTimePicker value={value.time} onChange={(time) => onChange({ ...value, time })} />
      </td>
      <td className="px-4 py-3">
        <input
          className={inputBase}
          placeholder="Message"
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </td>
      <td className="px-4 py-3">
        <DayToggle value={value.daysOfWeek} onChange={(daysOfWeek) => onChange({ ...value, daysOfWeek })} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onSubmit}
            disabled={!value.name || !value.time || !value.message || value.daysOfWeek.length === 0}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 transition"
            title={submitLabel}
          >
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="text-slate-500 hover:text-red-400 transition" title="Cancel">
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function NotificationRules({ onBack }) {
  const [rules, setRules] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editRule, setEditRule] = useState(emptyForm);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    const data = await api.getNotifications();
    setRules(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    await api.saveNotification(newRule);
    setNewRule(emptyForm);
    setAdding(false);
    await load();
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setEditRule({ name: rule.name, time: rule.time, message: rule.message, daysOfWeek: parseDays(rule.daysOfWeek) });
  };

  const handleSaveEdit = async (id) => {
    await api.saveNotification({ id, ...editRule });
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this reminder?')) return;
    await api.deleteNotification(id);
    await load();
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult(null);
    try {
      await api.testNotification(id);
      setTestResult({ id, ok: true });
    } catch (err) {
      setTestResult({ id, ok: false, error: err.message });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
            <Bell className="w-7 h-7" /> NOTIFICATIONS
          </h1>
          <p className="text-game-dim text-sm">Scheduled Telegram reminders (server timezone).</p>
        </div>
        <button onClick={onBack} className="text-xs text-game-dim hover:text-game-text border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition">
          ← Back to Settings
        </button>
      </div>

      <div className={panelBase}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Reminder Rules</h2>
          {!adding && (
            <button onClick={() => setAdding(true)} className={btnPrimary + ' flex items-center gap-2'}>
              <Plus className="w-4 h-4" /> Add reminder
            </button>
          )}
        </div>

        {rules === null && <div className="text-game-dim text-sm">Loading…</div>}

        {rules !== null && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rules.map((rule) =>
                  editingId === rule.id ? (
                    <RuleForm
                      key={rule.id}
                      value={editRule}
                      onChange={setEditRule}
                      onSubmit={() => handleSaveEdit(rule.id)}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  ) : (
                    <tr key={rule.id} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-3 font-bold text-game-text">{rule.name}</td>
                      <td className="px-4 py-3 text-game-dim font-mono text-xs">{formatTime12(rule.time)}</td>
                      <td className="px-4 py-3 text-game-dim">{rule.message}</td>
                      <td className="px-4 py-3 text-game-dim text-xs">{formatDays(parseDays(rule.daysOfWeek))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleTest(rule.id)} disabled={testingId === rule.id} className="text-slate-500 hover:text-amber-400 transition disabled:opacity-40" title="Send test">
                            {testingId === rule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                          <button onClick={() => startEdit(rule)} className="text-slate-500 hover:text-game-text transition" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(rule.id)} className="text-slate-500 hover:text-red-400 transition" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {testResult?.id === rule.id && (
                          <div className={`text-xs mt-1 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                            {testResult.ok ? 'Sent!' : `Error: ${testResult.error}`}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
                {adding && (
                  <RuleForm
                    value={newRule}
                    onChange={setNewRule}
                    onSubmit={handleAdd}
                    onCancel={() => {
                      setAdding(false);
                      setNewRule(emptyForm);
                    }}
                    submitLabel="Add"
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
