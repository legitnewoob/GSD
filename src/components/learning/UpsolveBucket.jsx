import { useState, useEffect } from 'react';
import { BookMarked, Plus, Trash2, ExternalLink, CheckCircle2, Circle, Edit3, Check, X } from 'lucide-react';
import { api } from '../../lib/api';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const btnPrimary = 'bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-40';
const btnGhost = 'border border-slate-600 hover:border-amber-500/50 hover:bg-slate-800 text-game-dim hover:text-game-text font-bold px-3 py-1.5 rounded-lg text-sm transition';

function AddProblemForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (!url.trim()) return;
    onAdd({ url: url.trim() });
    setUrl('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-game-dim hover:text-amber-400 transition py-1 px-3">
        <Plus className="w-4 h-4" /> Add problem
      </button>
    );
  }

  return (
    <div className="bg-slate-900/60 rounded-xl border border-amber-500/30 p-4 space-y-3">
      <div>
        <label className="text-xs text-game-dim uppercase tracking-wide mb-1 block">Codeforces problem link</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className={inputBase}
          placeholder="https://codeforces.com/contest/1234/problem/C"
          autoFocus
        />
        <p className="text-[11px] text-game-dim mt-1">Name is looked up automatically from the link — you can edit it after.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={!url.trim()} className={btnPrimary}>Add</button>
        <button onClick={() => { setOpen(false); setUrl(''); }} className={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function ProblemRow({ problem, onSave, onDelete }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(problem.name || '');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesInput, setNotesInput] = useState(problem.notes || '');

  const handleSaveName = () => {
    onSave({ ...problem, name: nameInput.trim() || null });
    setEditingName(false);
  };

  const handleSaveNotes = () => {
    onSave({ ...problem, notes: notesInput.trim() || null });
    setNotesOpen(false);
  };

  const label = problem.name || (problem.contestId && problem.problemIndex ? `${problem.contestId}${problem.problemIndex}` : 'Untitled problem');

  return (
    <div className="py-2.5 px-3 rounded-lg hover:bg-slate-900/40 transition group">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" title={problem.solved ? 'Solved on Codeforces' : 'Not solved yet'}>
          {problem.solved ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-game-dim" />}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-game-text outline-none focus:border-amber-500"
                placeholder="Problem name"
                autoFocus
              />
              <button onClick={handleSaveName} className="p-1 rounded text-emerald-400 hover:bg-emerald-400/10 transition"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingName(false)} className="p-1 rounded text-game-dim hover:bg-slate-700 transition"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${problem.solved ? 'text-emerald-400' : 'text-game-text'}`}>{label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Codeforces</span>
              <button onClick={() => { setNameInput(problem.name || ''); setEditingName(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-game-dim hover:text-amber-400 transition">
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
          <a href={problem.url} target="_blank" rel="noopener noreferrer" className="text-xs text-game-dim hover:text-amber-400 transition flex items-center gap-1 mt-0.5 truncate">
            <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{problem.url}</span>
          </a>

          {notesOpen ? (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={3}
                className={`${inputBase} resize-none text-xs`}
                placeholder="Your observations, what you missed, the trick, etc."
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNotes} className={btnPrimary}>Save note</button>
                <button onClick={() => { setNotesInput(problem.notes || ''); setNotesOpen(false); }} className={btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNotesOpen(true)} className="mt-1.5 text-xs text-game-dim hover:text-amber-400 transition text-left">
              {problem.notes ? (
                <span className="italic">"{problem.notes}"</span>
              ) : (
                <span className="flex items-center gap-1"><Edit3 className="w-3 h-3" /> Add note</span>
              )}
            </button>
          )}
        </div>
        <button onClick={() => onDelete(problem.id)} className="p-1.5 rounded text-game-dim hover:text-red-400 hover:bg-red-400/10 transition shrink-0 opacity-0 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function UpsolveBucket() {
  const [problems, setProblems] = useState(null);

  const load = async () => {
    const data = await api.getUpsolveProblems();
    setProblems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = (payload) => {
    const optimistic = { id: `temp-${Date.now()}`, url: payload.url, name: null, notes: null, solved: false, contestId: null, problemIndex: null };
    setProblems((prev) => [...(prev || []), optimistic]);
    api.saveUpsolveProblem(payload)
      .then((saved) => setProblems((prev) => prev.map((p) => (p.id === optimistic.id ? saved : p))))
      .catch(() => setProblems((prev) => prev.filter((p) => p.id !== optimistic.id)));
  };

  const handleSave = (problem) => {
    setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, ...problem } : p)));
    api.saveUpsolveProblem(problem).then((saved) => {
      setProblems((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    });
  };

  const handleDelete = (id) => {
    setProblems((prev) => prev.filter((p) => p.id !== id));
    api.deleteUpsolveProblem(id);
  };

  const unsolvedCount = problems?.filter((p) => !p.solved).length ?? 0;

  return (
    <div className={panelBase}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text flex items-center gap-2">
          <BookMarked className="w-5 h-5 text-amber-400" /> Upsolve Bucket
        </h2>
        {problems && problems.length > 0 && (
          <span className="text-xs text-game-dim">{unsolvedCount} to upsolve</span>
        )}
      </div>
      <p className="text-xs text-game-dim mb-4">
        Problems you didn't crack — paste the link, jot your notes, come back later. Solved status checks your Codeforces profile automatically.
      </p>

      {problems === null ? (
        <p className="text-sm text-game-dim">Loading…</p>
      ) : problems.length === 0 ? (
        <p className="text-sm text-game-dim mb-3">Nothing here yet.</p>
      ) : (
        <div className="space-y-1 mb-3">
          {problems.map((p) => (
            <ProblemRow key={p.id} problem={p} onSave={handleSave} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AddProblemForm onAdd={handleAdd} />
    </div>
  );
}
