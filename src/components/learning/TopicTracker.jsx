import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListChecks, Plus, Trash2, X, Check } from 'lucide-react';
import { api } from '../../lib/api';

const STATUS_RANK = { in_progress: 0, todo: 1, done: 2 };
const sortByStatus = (topics) =>
  [...topics].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.order - b.order);

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
    const tempId = `temp-${Date.now()}`;
    const payload = { category, name: newName.trim(), status: 'todo', order: (topics?.length || 0) };
    setTopics((ts) => [...ts, { ...payload, id: tempId }]);
    setNewName('');
    setAdding(false);
    try {
      const saved = await api.saveLearningTopic(payload);
      setTopics((ts) => ts.map((t) => (t.id === tempId ? saved : t)));
    } catch (err) {
      setTopics((ts) => ts.filter((t) => t.id !== tempId));
      alert(`Failed to add topic: ${err.message}`);
    }
  };

  const handleStatusChange = async (topic, status) => {
    const previous = topics;
    setTopics((ts) => ts.map((t) => (t.id === topic.id ? { ...t, status } : t)));
    try {
      await api.saveLearningTopic({ ...topic, status });
    } catch (err) {
      setTopics(previous);
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this topic?')) return;
    const previous = topics;
    setTopics((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteLearningTopic(id);
    } catch (err) {
      setTopics(previous);
      alert(`Failed to delete: ${err.message}`);
    }
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

          <AnimatePresence initial={false}>
            {sortByStatus(topics).map((topic) => (
              <motion.div
                key={topic.id}
                layout
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
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
              </motion.div>
            ))}
          </AnimatePresence>

          {topics.length === 0 && !adding && (
            <p className="text-game-dim text-sm">No topics yet — add one to start tracking.</p>
          )}
        </div>
      )}
    </div>
  );
}
