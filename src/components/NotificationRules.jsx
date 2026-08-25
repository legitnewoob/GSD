import { useState, useEffect, useRef } from 'react';
import { Bell, Send, Trash2, Pencil, Plus, X, Check, Loader2, Clock, Smartphone, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

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

function BrowserNotificationsPanel() {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [status, setStatus] = useState(supported ? 'checking' : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!supported) return;
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'enabled' : 'disabled'))
      .catch(() => setStatus('disabled'));
  }, [supported]);

  const handleEnable = async () => {
    setBusy(true);
    setResult(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'disabled');
        return;
      }
      const { publicKey } = await api.getPushPublicKey();
      if (!publicKey) throw new Error("Push isn't configured on the server yet");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.subscribePush(sub.toJSON());
      setStatus('enabled');
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setResult(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('disabled');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setResult(null);
    try {
      await api.testPush();
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={panelBase}>
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Browser Notifications</h2>
      </div>
      <p className="text-xs text-game-dim mb-4">Push reminders straight to this device, alongside Telegram.</p>

      {status === 'checking' && <div className="text-sm text-game-dim">Checking…</div>}
      {status === 'unsupported' && <div className="text-sm text-game-dim">Not supported in this browser.</div>}
      {status === 'denied' && (
        <div className="text-sm text-red-400">Blocked — enable notifications for this site in your browser settings.</div>
      )}
      {status === 'disabled' && (
        <button onClick={handleEnable} disabled={busy} className={btnPrimary}>
          {busy ? 'Enabling…' : 'Enable browser notifications'}
        </button>
      )}
      {status === 'enabled' && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> Enabled on this device
          </span>
          <button onClick={handleTest} disabled={busy} className="text-xs text-slate-500 hover:text-amber-400 border border-slate-700 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition">
            Send test
          </button>
          <button onClick={handleDisable} disabled={busy} className="text-xs text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg transition">
            Disable
          </button>
        </div>
      )}
      {result && (
        <div className={`text-xs mt-2 ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.ok ? 'Test sent — check your notifications!' : `Error: ${result.error}`}
        </div>
      )}
    </div>
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
      const result = await api.testNotification(id);
      const parts = [];
      parts.push(result.push.total === 0 ? 'Push: no devices enabled' : `Push: ${result.push.sent}/${result.push.total} devices`);
      if (!result.telegram.attempted) {
        parts.push('Telegram: skipped (push succeeded)');
      } else {
        parts.push(result.telegram.ok ? 'Telegram ✓ (fallback)' : `Telegram failed: ${result.telegram.error}`);
      }
      setTestResult({ id, ok: result.ok, summary: parts.join(' · ') });
    } catch (err) {
      setTestResult({ id, ok: false, summary: `Error: ${err.message}` });
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

      <BrowserNotificationsPanel />

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
                            {testResult.summary}
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
