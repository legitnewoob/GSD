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
        const [cfg, rawEntries] = await Promise.all([api.getConfig(), api.getEntries()]);
        if (cancelled) return;

        // Auto-credit salary when salary day arrives and not yet credited this month
        const bs = cfg.budgetSetting;
        if (bs?.salaryDay && bs?.monthlyIncome) {
          const today = new Date();
          const thisMonth = format(today, 'yyyy-MM');
          // Find effective salary day — shift to previous Friday if it falls on weekend
          const salaryDate = new Date(today.getFullYear(), today.getMonth(), bs.salaryDay);
          const dow = salaryDate.getDay();
          if (dow === 0) salaryDate.setDate(salaryDate.getDate() - 2); // Sunday → Friday
          else if (dow === 6) salaryDate.setDate(salaryDate.getDate() - 1); // Saturday → Friday
          const effectiveSalaryDay = salaryDate.getDate();

          if (today.getDate() >= effectiveSalaryDay && bs.lastSalaryCredit !== thisMonth) {
            const newBank = (bs.bankBalance || 0) + bs.monthlyIncome;
            await api.saveBudget({ bankBalance: newBank, lastSalaryCredit: thisMonth });
            cfg.budgetSetting = { ...bs, bankBalance: newBank, lastSalaryCredit: thisMonth };
          }
        }

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
      if (saved.bankBalance !== undefined) {
        setConfig((c) => ({ ...c, budgetSetting: { ...c.budgetSetting, bankBalance: saved.bankBalance } }));
      }
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
    if (result?.bankBalance !== undefined) {
      setConfig((c) => ({ ...c, budgetSetting: { ...c.budgetSetting, bankBalance: result.bankBalance } }));
    }
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

  const addHabit = useCallback(
    async (name) => {
      const habit = await api.saveHabit({ name, order: config.habits.length });
      setConfig((c) => ({ ...c, habits: [...c.habits, habit] }));
    },
    [config.habits]
  );

  const updateHabit = useCallback(async (habit) => {
    const saved = await api.saveHabit(habit);
    setConfig((c) => ({ ...c, habits: c.habits.map((h) => (h.id === saved.id ? saved : h)) }));
  }, []);

  const addCategory = useCallback(
    async (name) => {
      const category = await api.saveCategory({ name, order: config.categories.length });
      setConfig((c) => ({ ...c, categories: [...c.categories, category] }));
    },
    [config.categories]
  );

  const updateCategory = useCallback(async (category) => {
    const saved = await api.saveCategory(category);
    setConfig((c) => ({ ...c, categories: c.categories.map((x) => (x.id === saved.id ? saved : x)) }));
  }, []);

  const deleteCategory = useCallback(async (id) => {
    await api.deleteCategory(id);
    setConfig((c) => ({ ...c, categories: c.categories.filter((x) => x.id !== id) }));
  }, []);

  const deleteHabit = useCallback(async (id) => {
    await api.deleteHabit(id);
    setConfig((c) => ({ ...c, habits: c.habits.filter((h) => h.id !== id) }));
  }, []);

  const saveBudget = useCallback(async (settings) => {
    const saved = await api.saveBudget(settings);
    setConfig((c) => ({ ...c, budgetSetting: saved, budgetCategories: saved.budgetCategories || c.budgetCategories, creditCards: saved.creditCards || c.creditCards }));
  }, []);

  const saveBudgetSettings = saveBudget;

  const saveBudgetCategory = useCallback(async (category) => {
    const saved = await api.saveBudgetCategory(category);
    setConfig((c) => {
      const existing = c.budgetCategories.find((x) => x.id === saved.id);
      const budgetCategories = existing
        ? c.budgetCategories.map((x) => (x.id === saved.id ? saved : x))
        : [...c.budgetCategories, saved];
      const budgetSetting = saved.bankBalance !== undefined ? { ...c.budgetSetting, bankBalance: saved.bankBalance } : c.budgetSetting;
      return { ...c, budgetCategories, budgetSetting };
    });
    return saved;
  }, []);

  const deleteBudgetCategory = useCallback(async (id) => {
    await api.deleteBudgetCategory(id);
    setConfig((c) => ({ ...c, budgetCategories: c.budgetCategories.filter((x) => x.id !== id) }));
  }, []);

  const saveCreditCard = useCallback(async (card) => {
    const saved = await api.saveCreditCard(card);
    setConfig((c) => {
      const existing = c.creditCards.find((x) => x.id === saved.id);
      const creditCards = existing
        ? c.creditCards.map((x) => (x.id === saved.id ? saved : x))
        : [...c.creditCards, saved];
      const budgetSetting = saved.bankBalance !== undefined ? { ...c.budgetSetting, bankBalance: saved.bankBalance } : c.budgetSetting;
      return { ...c, creditCards, budgetSetting };
    });
    return saved;
  }, []);

  const deleteCreditCard = useCallback(async (id) => {
    await api.deleteCreditCard(id);
    setConfig((c) => ({ ...c, creditCards: c.creditCards.filter((x) => x.id !== id) }));
  }, []);

  const addTodo = useCallback(async (text) => {
    const todo = await api.addTodo({ text });
    setConfig((c) => ({ ...c, todos: [...(c.todos || []), todo] }));
  }, []);

  const toggleTodo = useCallback(async (id) => {
    const todo = config.todos.find((t) => t.id === id);
    if (!todo) return;
    const saved = await api.updateTodo(id, { completed: !todo.completed });
    setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === saved.id ? saved : t)) }));
  }, [config.todos]);

  const updateTodo = useCallback(async (id, text) => {
    const saved = await api.updateTodo(id, { text });
    setConfig((c) => ({ ...c, todos: c.todos.map((t) => (t.id === saved.id ? saved : t)) }));
  }, []);

  const deleteTodo = useCallback(async (id) => {
    await api.deleteTodo(id);
    setConfig((c) => ({ ...c, todos: c.todos.filter((t) => t.id !== id) }));
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
