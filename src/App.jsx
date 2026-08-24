import { useState, useEffect, useMemo } from 'react';
import { useLifeRpg } from './hooks/useLifeRpg';
import { api } from './lib/api';
import { Navigation } from './components/Navigation';
import { DailyJournal } from './components/DailyJournal';
import { Dashboard } from './components/Dashboard';
import { GameDashboard } from './components/GameDashboard';
import { WeeklyReview } from './components/WeeklyReview';
import { Budget } from './components/Budget';
import { Admin } from './components/Admin';
import { Login } from './components/Login';

const TAB_KEY = 'life-rpg-tab';
const VALID_TABS = ['daily', 'dashboard', 'game', 'budget', 'weekly', 'admin'];

function AppContent() {
  const [activeTab, setActiveTabState] = useState(() => {
    const saved = localStorage.getItem(TAB_KEY);
    return VALID_TABS.includes(saved) ? saved : 'daily';
  });
  const setActiveTab = (tab) => {
    localStorage.setItem(TAB_KEY, tab);
    setActiveTabState(tab);
  };
  const [selectedDate, setSelectedDate] = useState(new Date());
  const {
    config,
    entries,
    loading,
    saving,
    error,
    save,
    startFresh,
    getOrCreate,
    addHabit,
    deleteHabit,
    addCategory,
    updateCategory,
    deleteCategory,
    saveBudget,
    saveBudgetCategory,
    deleteBudgetCategory,
    saveCreditCard,
    deleteCreditCard,
    addTodo,
    toggleTodo,
    deleteTodo,
    refreshEntries,
  } = useLifeRpg();

  const todayAllowance = useMemo(() => {
    const budgetCategories = config.budgetCategories || [];
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const daysLeft = daysInMonth - dayOfMonth + 1; // remaining days including today
    const dailyCats = budgetCategories.filter((c) => c.type === 'daily' && c.isActive !== false);
    const monthlyDailyPool = dailyCats.reduce((s, c) => s + (c.budgetedAmount || 0), 0);
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const totalSpent = entries
      .filter((e) => e.date >= monthStart && e.date <= todayStr)
      .reduce((s, e) => s + (parseFloat(e.money) || 0), 0);
    const remaining = monthlyDailyPool - totalSpent;
    return daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;
  }, [entries, config.budgetCategories]);

  const fallbackEntry = getOrCreate(selectedDate);

  const handleDateChange = (date) => setSelectedDate(date);

  const handleSave = (entry) => save(entry);

  const renderWelcome = () => (
    <div className="max-w-xl mx-auto mt-12 sm:mt-20 p-6 sm:p-8 bg-game-panel rounded-2xl border border-game-border shadow-glow text-center mx-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
        <span className="text-4xl">🛡️</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-game-gold mb-2 text-glow tracking-wide">BEGIN YOUR QUEST</h1>
      <p className="text-game-dim mb-8">
        Track your daily habits, sleep, power and time to level up your hero. Data is saved to your Supabase backend.
      </p>
      <div className="flex justify-center">
        <button
          onClick={() => startFresh(new Date())}
          className="bg-slate-800 border border-slate-600 hover:border-amber-500/50 hover:bg-slate-700 text-game-text font-bold px-6 py-3 rounded-lg transition"
        >
          Start fresh
        </button>
      </div>
      {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}
    </div>
  );

  const renderTab = () => {
    if (activeTab === 'daily') {
      if (!entries.length) return renderWelcome();
      return (
        <DailyJournal
          config={config}
          entry={fallbackEntry}
          onSave={handleSave}
          onDateChange={handleDateChange}
          onAddHabit={addHabit}
          onAddCategory={addCategory}
          onUpdateCategory={updateCategory}
          onAddTodo={addTodo}
          onToggleTodo={toggleTodo}
          onDeleteTodo={deleteTodo}
          todayAllowance={todayAllowance}
        />
      );
    }
    if (activeTab === 'dashboard') return <Dashboard config={config} entries={entries} />;
    if (activeTab === 'game') return <GameDashboard entries={entries} />;
    if (activeTab === 'budget') return (
      <Budget
        config={config}
        entries={entries}
        onSaveBudget={saveBudget}
        onSaveBudgetCategory={saveBudgetCategory}
        onDeleteBudgetCategory={deleteBudgetCategory}
        onSaveCreditCard={saveCreditCard}
        onDeleteCreditCard={deleteCreditCard}
      />
    );
    if (activeTab === 'weekly') return <WeeklyReview config={config} entries={entries} />;
    if (activeTab === 'admin') {
      return (
        <Admin
          config={config}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
          onDeleteHabit={deleteHabit}
          onRefreshEntries={refreshEntries}
        />
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-game-bg flex items-center justify-center">
        <div className="text-game-gold font-black text-xl text-glow">Loading hero data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      <Navigation active={activeTab} onChange={setActiveTab} entries={entries} saving={saving} />
      <main className="flex-1 pb-12">{renderTab()}</main>
      {entries.length > 0 && (
        <footer className="bg-game-panel border-t border-game-border py-4 px-6">
          <div className="max-w-6xl mx-auto text-center text-sm text-game-dim">
            <span>Connected to Supabase via backend.</span>
          </div>
        </footer>
      )}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(api.getToken());
  const [requiresAuth, setRequiresAuth] = useState(null);

  // If the API tells us the token has expired,
  // clear the React auth state and show the login screen.
  useEffect(() => {
    return api.onAuthExpired(() => {
      setToken('');
    });
  }, []);

  useEffect(() => {
    api.authStatus()
      .then((status) => setRequiresAuth(status.requiresAuth))
      .catch(() => setRequiresAuth(false));
  }, []);

  const handleLogin = async (password) => {
    const { token } = await api.login(password);
    api.setToken(token);
    setToken(token);
  };

  if (requiresAuth === null) {
    return (
      <div className="min-h-screen bg-game-bg flex items-center justify-center">
        <div className="text-game-gold font-black text-xl text-glow">
          Checking realm gate...
        </div>
      </div>
    );
  }

  if (requiresAuth && !token) {
    return <Login onLogin={handleLogin} />;
  }

  return <AppContent />;
}
export default App
