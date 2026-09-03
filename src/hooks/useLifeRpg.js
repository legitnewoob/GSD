import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { computeLevels } from '../utils/xp';
import { MOOD_OPTIONS, ENERGY_OPTIONS, POWER_OPTIONS } from '../utils/constants';

function sortByDate(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function toOption(optionList, labelOrValue) {
  if (!labelOrValue) return null;
  if (typeof labelOrValue === 'object') return labelOrValue;
  const byValue = optionList.find((o) => String(o.value) === String(labelOrValue));
  if (byValue) return byValue;
  return optionList.find((o) => o.label === labelOrValue) || null;
}

function fromApiEntry(raw) {
  return {
    id: raw.id,
    userId: raw.userId,
    date: raw.date,
    day: raw.day,
    mood: toOption(MOOD_OPTIONS, raw.moodScore ?? raw.moodLabel),
    energy: toOption(ENERGY_OPTIONS, raw.energyScore ?? raw.energyLabel),
    power: toOption(POWER_OPTIONS, raw.powerScore ?? raw.powerLabel),
    screenTime: raw.screenTime ?? '',
    money: raw.money ?? '',
    moneySource: raw.moneySource || 'bank',
    runWalk: raw.runWalk ?? '',
    steps: raw.steps ?? '',
    bigWin: raw.bigWin || '',
    drain: raw.drain || '',
    tomorrow: raw.tomorrow || '',
    notes: raw.notes || '',
    habits: Object.fromEntries(
      (raw.habits || []).map((h) => [h.habitId || h.habit?.id, h.completed])
    ),
    categories: Object.fromEntries(
      (raw.categories || []).map((c) => [
        c.categoryId || c.category?.id,
        { hours: c.hours ?? '', key: c.category?.key, name: c.category?.name, color: c.category?.color },
      ])
    ),
  };
}

function toApiPayload(entry) {
  return {
    date: entry.date,
    day: entry.day,
    mood: entry.mood,
    energy: entry.energy,
    power: entry.power,
    screenTime: entry.screenTime,
    money: entry.money,
    moneySource: entry.moneySource || 'bank',
    runWalk: entry.runWalk,
    steps: entry.steps,
    bigWin: entry.bigWin,
    drain: entry.drain,
    tomorrow: entry.tomorrow,
    notes: entry.notes,
    habits: entry.habits,
    categories: Object.fromEntries(
      Object.entries(entry.categories || {}).map(([id, c]) => [id, c?.hours ?? c])
    ),
  };
}

function blankEntry(date, config) {
  const iso = format(date, 'yyyy-MM-dd');
  return {
    id: '',
    date: iso,
    day: format(date, 'EEEE'),
    mood: null,
    energy: null,
    power: null,
    screenTime: '',
    money: '',
    moneySource: 'bank',
    runWalk: '',
    steps: '',
    bigWin: '',
    drain: '',
    tomorrow: '',
    notes: '',
    habits: Object.fromEntries((config.habits || []).map((h) => [h.id, false])),
    categories: Object.fromEntries(
      (config.categories || []).map((c) => [c.id, { hours: '', key: c.key, name: c.name, color: c.color }])
    ),
  };
}

// Backend responses carry whichever balances actually changed (Bank/Cash), so a payment
// source switch is reflected live instead of needing a reload.
function withUpdatedBalances(budgetSetting, saved) {
  if (saved?.bankBalance === undefined && saved?.cashBalance === undefined) return budgetSetting;
  return {
    ...budgetSetting,
    ...(saved.bankBalance !== undefined ? { bankBalance: saved.bankBalance } : {}),
    ...(saved.cashBalance !== undefined ? { cashBalance: saved.cashBalance } : {}),
  };
}

export function useLifeRpg() {
  const [config, setConfig] = useState({ habits: [], categories: [], budgetSetting: null, budgetCategories: [], creditCards: [], todos: [] });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveQueue = useRef({});

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Salary auto-crediting runs server-side hourly (last working day of the month,
        // self-healing any missed month) — see server/src/budgetScheduler.js.
        const [cfg, rawEntries] = await Promise.all([api.getConfig(), api.getEntries()]);
        if (cancelled) return;

        setConfig({
          habits: cfg.habits,
          categories: cfg.categories,
          budgetSetting: cfg.budgetSetting,
          budgetCategories: cfg.budgetSetting?.budgetCategories || [],
          creditCards: cfg.budgetSetting?.creditCards || [],
          todos: cfg.todos || [],
        });
        setEntries(rawEntries.map(fromApiEntry));
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const entriesWithXp = useMemo(
    () => computeLevels(sortByDate(entries), config.habits || [], config.categories || []),
    [entries, config.habits, config.categories]
  );

  const persist = useCallback(async (entry) => {
    setSaving(true);
    try {
      const saved = await api.saveEntry(toApiPayload(entry));
      setEntries((prev) => {
        const index = prev.findIndex((e) => e.date === saved.date);
        const mapped = fromApiEntry(saved);
        if (index >= 0) {
          const next = [...prev];
          next[index] = mapped;
          return next;
        }
        return [...prev, mapped];
      });
      setConfig((c) => ({ ...c, budgetSetting: withUpdatedBalances(c.budgetSetting, saved) }));
    } catch (err) {
      console.error('Save failed', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback((entry) => {
    const key = entry.date;
    if (saveQueue.current[key]) clearTimeout(saveQueue.current[key].timer);
    const timer = setTimeout(() => {
      delete saveQueue.current[key];
      persist(entry);
    }, 800);
    saveQueue.current[key] = { timer, entry };
  }, [persist]);

  // If the tab is backgrounded, closed, or navigated away from while a debounced
  // save is still pending, the setTimeout above may never fire (browsers throttle
  // or kill timers in hidden/closed tabs). Flush immediately so the edit isn't lost.
  const flushPendingSaves = useCallback(() => {
    Object.entries(saveQueue.current).forEach(([key, pending]) => {
      clearTimeout(pending.timer);
      delete saveQueue.current[key];
      persist(pending.entry);
    });
  }, [persist]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushPendingSaves();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flushPendingSaves);
    window.addEventListener('beforeunload', flushPendingSaves);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flushPendingSaves);
      window.removeEventListener('beforeunload', flushPendingSaves);
    };
  }, [flushPendingSaves]);

  const save = useCallback(
    (entry) => {
      setEntries((prev) => {
        const index = prev.findIndex((e) => e.date === entry.date);
        if (index >= 0) {
          const next = [...prev];
          next[index] = entry;
          scheduleSave(entry);
          return next;
        }
        scheduleSave(entry);
        return [...prev, entry];
      });
    },
    [scheduleSave]
  );

  const remove = useCallback(async (id) => {
    const result = await api.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setConfig((c) => ({ ...c, budgetSetting: withUpdatedBalances(c.budgetSetting, result) }));
  }, []);

  const getOrCreate = useCallback(
    (date) => {
      const iso = format(date, 'yyyy-MM-dd');
      const existing = entries.find((e) => e.date === iso);
      if (existing) return existing;
      return blankEntry(date, config);
    },
    [entries, config]
  );

  const startFresh = useCallback(
    (date = new Date()) => {
      const entry = blankEntry(date, config);
      save(entry);
    },
    [config, save]
  );

  const seedDemo = useCallback(async () => {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const entry = blankEntry(d, config);
      entry.power = POWER_OPTIONS[Math.floor(Math.random() * 5)];
      entry.mood = MOOD_OPTIONS[Math.floor(Math.random() * 5)];
      entry.energy = ENERGY_OPTIONS[Math.floor(Math.random() * 5)];
      entry.money = Math.floor(Math.random() * 300) + 50;
      entry.screenTime = (Math.random() * 4 + 1).toFixed(1);
      entry.runWalk = Math.random() > 0.3 ? (Math.random() * 5).toFixed(1) : 0;
      entry.steps = Math.floor(Math.random() * 10000) + 2000;
      entry.bigWin = 'Demo win';
      entry.drain = 'Demo drain';
      entry.tomorrow = 'Demo target';
      config.habits.forEach((h) => (entry.habits[h.id] = Math.random() > 0.4));
      config.categories.forEach((c) => {
        entry.categories[c.id] = { hours: (Math.random() * 3).toFixed(1), key: c.key, name: c.name, color: c.color };
      });
      await persist(entry);
    }
  }, [config, persist]);

  const refreshEntries = useCallback(async () => {
    const rawEntries = await api.getEntries();
    setEntries(rawEntries.map(fromApiEntry));
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all(entries.map((e) => api.deleteEntry(e.id)));
    setEntries([]);
  }, [entries]);

  // Interactions should never wait on a network round-trip to feel responsive: every
  // mutation below updates local state synchronously (optimistic) before the API call
  // even starts, then reconciles with the server's response (real id, computed fields,
  // synced balances) once it lands — same pattern as `save()` above for Daily Quest.
  // A failure rolls the optimistic change back and surfaces it via `error`.
  const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addHabit = useCallback(
    (name) => {
      const optimistic = { id: tempId(), name, order: config.habits.length, xpValue: 5 };
      setConfig((c) => ({ ...c, habits: [...c.habits, optimistic] }));
      return api.saveHabit({ name, order: config.habits.length })
        .then((saved) => {
          setConfig((c) => ({ ...c, habits: c.habits.map((h) => (h.id === optimistic.id ? saved : h)) }));
          return saved;
        })
        .catch((err) => {
          setError(err.message);
          setConfig((c) => ({ ...c, habits: c.habits.filter((h) => h.id !== optimistic.id) }));
          throw err;
        });
    },
    [config.habits]
  );

  const updateHabit = useCallback((habit) => {
    setConfig((c) => ({ ...c, habits: c.habits.map((h) => (h.id === habit.id ? { ...h, ...habit } : h)) }));
    return api.saveHabit(habit)
      .then((saved) => {
        setConfig((c) => ({ ...c, habits: c.habits.map((h) => (h.id === saved.id ? saved : h)) }));
        return saved;
      })
      .catch((err) => { setError(err.message); throw err; });
  }, []);

  const addCategory = useCallback(
    (name) => {
      const optimistic = { id: tempId(), name, order: config.categories.length };
      setConfig((c) => ({ ...c, categories: [...c.categories, optimistic] }));
      return api.saveCategory({ name, order: config.categories.length })
        .then((saved) => {
          setConfig((c) => ({ ...c, categories: c.categories.map((x) => (x.id === optimistic.id ? saved : x)) }));
          return saved;
        })
        .catch((err) => {
          setError(err.message);
          setConfig((c) => ({ ...c, categories: c.categories.filter((x) => x.id !== optimistic.id) }));
          throw err;
        });
    },
    [config.categories]
  );

  const updateCategory = useCallback((category) => {
    setConfig((c) => ({ ...c, categories: c.categories.map((x) => (x.id === category.id ? { ...x, ...category } : x)) }));
    return api.saveCategory(category)
      .then((saved) => {
        setConfig((c) => ({ ...c, categories: c.categories.map((x) => (x.id === saved.id ? saved : x)) }));
        return saved;
      })
      .catch((err) => { setError(err.message); throw err; });
  }, []);

  const deleteCategory = useCallback((id) => {
    let removed;
    setConfig((c) => {
      removed = c.categories.find((x) => x.id === id);
      return { ...c, categories: c.categories.filter((x) => x.id !== id) };
    });
    return api.deleteCategory(id).catch((err) => {
      setError(err.message);
      if (removed) setConfig((c) => ({ ...c, categories: [...c.categories, removed] }));
      throw err;
    });
  }, []);

  const deleteHabit = useCallback((id) => {
    let removed;
    setConfig((c) => {
      removed = c.habits.find((h) => h.id === id);
      return { ...c, habits: c.habits.filter((h) => h.id !== id) };
    });
    return api.deleteHabit(id).catch((err) => {
      setError(err.message);
      if (removed) setConfig((c) => ({ ...c, habits: [...c.habits, removed] }));
      throw err;
    });
  }, []);

  const saveBudget = useCallback((settings) => {
    setConfig((c) => ({ ...c, budgetSetting: { ...c.budgetSetting, ...settings } }));
    return api.saveBudget(settings)
      .then((saved) => {
        setConfig((c) => ({ ...c, budgetSetting: saved, budgetCategories: saved.budgetCategories || c.budgetCategories, creditCards: saved.creditCards || c.creditCards }));
        return saved;
      })
      .catch((err) => { setError(err.message); throw err; });
  }, []);

  const saveBudgetSettings = saveBudget;

  const saveBudgetCategory = useCallback((category) => {
    const isNew = !category.id;
    const optimisticId = category.id || tempId();
    setConfig((c) => {
      const existing = c.budgetCategories.find((x) => x.id === category.id);
      const budgetCategories = existing
        ? c.budgetCategories.map((x) => (x.id === category.id ? { ...x, ...category } : x))
        : [...c.budgetCategories, { ...category, id: optimisticId }];
      return { ...c, budgetCategories };
    });
    return api.saveBudgetCategory(category)
      .then((saved) => {
        setConfig((c) => {
          const budgetCategories = c.budgetCategories.map((x) => (x.id === optimisticId ? saved : x));
          const budgetSetting = withUpdatedBalances(c.budgetSetting, saved);
          return { ...c, budgetCategories, budgetSetting };
        });
        return saved;
      })
      .catch((err) => {
        setError(err.message);
        if (isNew) setConfig((c) => ({ ...c, budgetCategories: c.budgetCategories.filter((x) => x.id !== optimisticId) }));
        throw err;
      });
  }, []);

  const deleteBudgetCategory = useCallback((id) => {
    let removed;
    setConfig((c) => {
      removed = c.budgetCategories.find((x) => x.id === id);
      return { ...c, budgetCategories: c.budgetCategories.filter((x) => x.id !== id) };
    });
    return api.deleteBudgetCategory(id)
      .then((result) => {
        setConfig((c) => ({ ...c, budgetSetting: withUpdatedBalances(c.budgetSetting, result) }));
        return result;
      })
      .catch((err) => {
        setError(err.message);
        if (removed) setConfig((c) => ({ ...c, budgetCategories: [...c.budgetCategories, removed] }));
        throw err;
      });
  }, []);

  const saveCreditCard = useCallback((card) => {
    const isNew = !card.id;
    const optimisticId = card.id || tempId();
    setConfig((c) => {
      const existing = c.creditCards.find((x) => x.id === card.id);
      const creditCards = existing
        ? c.creditCards.map((x) => (x.id === card.id ? { ...x, ...card } : x))
        : [...c.creditCards, { ...card, id: optimisticId }];
      return { ...c, creditCards };
    });
    return api.saveCreditCard(card)
      .then((saved) => {
        setConfig((c) => {
          const creditCards = c.creditCards.map((x) => (x.id === optimisticId ? saved : x));
          const budgetSetting = withUpdatedBalances(c.budgetSetting, saved);
          return { ...c, creditCards, budgetSetting };
        });
        return saved;
      })
      .catch((err) => {
        setError(err.message);
        if (isNew) setConfig((c) => ({ ...c, creditCards: c.creditCards.filter((x) => x.id !== optimisticId) }));
        throw err;
      });
  }, []);

  const deleteCreditCard = useCallback((id) => {
    let removed;
    setConfig((c) => {
      removed = c.creditCards.find((x) => x.id === id);
      return { ...c, creditCards: c.creditCards.filter((x) => x.id !== id) };
    });
    return api.deleteCreditCard(id).catch((err) => {
      setError(err.message);
      if (removed) setConfig((c) => ({ ...c, creditCards: [...c.creditCards, removed] }));
      throw err;
    });
  }, []);

  const addTodo = useCallback((text) => {
    const optimistic = { id: tempId(), text, completed: false };
    setConfig((c) => ({ ...c, todos: [...(c.todos || []), optimistic] }));
    return api.addTodo({ text })
      .then((todo) => {
        setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === optimistic.id ? todo : t)) }));
        return todo;
      })
      .catch((err) => {
        setError(err.message);
        setConfig((c) => ({ ...c, todos: c.todos.filter((t) => t.id !== optimistic.id) }));
        throw err;
      });
  }, []);

  const toggleTodo = useCallback((id) => {
    const todo = config.todos.find((t) => t.id === id);
    if (!todo) return undefined;
    setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)) }));
    return api.updateTodo(id, { completed: !todo.completed })
      .then((saved) => {
        setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === saved.id ? saved : t)) }));
        return saved;
      })
      .catch((err) => {
        setError(err.message);
        setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === id ? todo : t)) }));
        throw err;
      });
  }, [config.todos]);

  const updateTodo = useCallback((id, text) => {
    setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === id ? { ...t, text } : t)) }));
    return api.updateTodo(id, { text })
      .then((saved) => {
        setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === saved.id ? saved : t)) }));
        return saved;
      })
      .catch((err) => { setError(err.message); throw err; });
  }, []);

  const deleteTodo = useCallback((id) => {
    let removed;
    setConfig((c) => {
      removed = c.todos.find((t) => t.id === id);
      return { ...c, todos: c.todos.filter((t) => t.id !== id) };
    });
    return api.deleteTodo(id).catch((err) => {
      setError(err.message);
      if (removed) setConfig((c) => ({ ...c, todos: [...c.todos, removed] }));
      throw err;
    });
  }, []);

  return {
    config,
    entries: entriesWithXp,
    loading,
    saving,
    error,
    save,
    remove,
    getOrCreate,
    startFresh,
    seedDemo,
    clearAll,
    addHabit,
    updateHabit,
    deleteHabit,
    addCategory,
    updateCategory,
    deleteCategory,
    saveBudget,
    saveBudgetSettings,
    saveBudgetCategory,
    deleteBudgetCategory,
    saveCreditCard,
    deleteCreditCard,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    refreshEntries,
  };
}
