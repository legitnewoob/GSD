import { useState, useEffect } from 'react';
import { Settings, Clock, ListChecks, Trash2 } from 'lucide-react';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';

export function Admin({ config, onUpdateCategory, onDeleteCategory, onDeleteHabit }) {
  const [expectedMap, setExpectedMap] = useState({});

  useEffect(() => {
    const map = {};
    (config.categories || []).forEach((c) => {
      map[c.id] = c.expectedHours ?? '';
    });
    setExpectedMap(map);
  }, [config.categories]);

  const handleExpectedChange = (id, value) => {
    setExpectedMap((m) => ({ ...m, [id]: value }));
  };

  const saveCategory = (category) => {
    const value = expectedMap[category.id];
    const num = value === '' ? null : parseFloat(value);
    onUpdateCategory({ ...category, expectedHours: num });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow flex items-center gap-2">
          <Settings className="w-7 h-7" /> QUEST SETTINGS
        </h1>
        <p className="text-game-dim text-sm">Tune categories, expected hours and habits.</p>
      </div>

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Time Categories</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Expected Hours</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(config.categories || []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40 transition">
                  <td className="px-4 py-3 font-bold text-game-text">{c.name}</td>
                  <td className="px-4 py-3 text-game-dim font-mono text-xs">{c.key || '-'}</td>
                  <td className="px-4 py-3 w-40">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={expectedMap[c.id] ?? ''}
                      onChange={(e) => handleExpectedChange(c.id, e.target.value)}
                      onBlur={() => saveCategory(c)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCategory(c)}
                      className={`${inputBase} w-24`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-600"
                        style={{ backgroundColor: c.color || '#94a3b8' }}
                      />
                      <span className="text-game-dim text-xs">{c.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDeleteCategory(c.id)}
                      className="text-slate-500 hover:text-red-400 transition"
                      title="Remove category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={panelBase}>
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-black uppercase tracking-wide text-game-text">Daily Habits</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {(config.habits || []).map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-game-text font-bold">{h.name}</span>
              <button
                onClick={() => onDeleteHabit(h.id)}
                className="text-slate-500 hover:text-red-400 transition"
                title="Remove habit"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-game-dim text-xs mt-3">Add new habits from the Daily Quest page.</p>
      </div>
    </div>
  );
}
