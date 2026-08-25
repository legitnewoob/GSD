import { useState, useEffect } from 'react';
import { ListChecks, Plus, Trash2, X, Check } from 'lucide-react';
import { api } from '../../lib/api';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-40';

const STATUSES = [
  { key: 'todo', label: 'To Do', dot: 'bg-slate-500' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-amber-400' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-400' },
];

function StatusSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs font-bold text-game-text outline-none focus:border-amber-500"
    >
      {STATUSES.map((s) => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
  );
}

export function TopicTracker({ category }) {
  const [topics, setTopics] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const data = await api.getLearningTopics(category);
    setTopics(data);
  };

  useEffect(() => {
    setTopics(null);
    load();
  }, [category]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await api.saveLearningTopic({ category, name: newName.trim(), status: 'todo', order: (topics?.length || 0) });
    setNewName('');
    setAdding(false);
    await load();
  };

  const handleStatusChange = async (topic, status) => {
    setTopics((ts) => ts.map((t) => (t.id === topic.id ? { ...t, status } : t)));
    await api.saveLearningTopic({ ...topic, status });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this topic?')) return;
    await api.deleteLearningTopic(id);
    await load();
  };

  return (
    <div className={panelBase}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Topic Tracker</h2>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className={btnPrimary + ' flex items-center gap-2'}>
            <Plus className="w-4 h-4" /> Add topic
          </button>
        )}
      </div>

      {topics === null && <div className="text-game-dim text-sm">Loading…</div>}

      {topics !== null && (
        <div className="space-y-2">
          {adding && (
            <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg p-2">
              <input
                autoFocus
                className={inputBase}
                placeholder="Topic name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button onClick={handleAdd} disabled={!newName.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 transition">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setAdding(false); setNewName(''); }} className="text-slate-500 hover:text-red-400 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {topics.map((topic) => (
            <div key={topic.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUSES.find((s) => s.key === topic.status)?.dot}`} />
                <span className="text-sm text-game-text font-bold truncate">{topic.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusSelect value={topic.status} onChange={(status) => handleStatusChange(topic, status)} />
                <button onClick={() => handleDelete(topic.id)} className="text-slate-500 hover:text-red-400 transition" title="Remove topic">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {topics.length === 0 && !adding && (
            <p className="text-game-dim text-sm">No topics yet — add one to start tracking.</p>
          )}
        </div>
      )}
    </div>
  );
}
