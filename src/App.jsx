import { useState, useEffect } from 'react';
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

function AppContent() {
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const {
    config,
    entries,
    loading,
    saving,
    error,
    save,
    startFresh,
    clearAll,
    getOrCreate,
    addHabit,
    updateHabit,
    deleteHabit,
    addCategory,
    updateCategory,
    deleteCategory,
    saveBudget,
    addTodo,
    toggleTodo,
    deleteTodo,
  } = useLifeRpg();

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
        />
      );
    }
    if (activeTab === 'dashboard') return <Dashboard config={config} entries={entries} />;
    if (activeTab === 'game') return <GameDashboard entries={entries} />;
    if (activeTab === 'budget') return <Budget config={config} entries={entries} onSaveBudget={saveBudget} />;
    if (activeTab === 'weekly') return <WeeklyReview config={config} entries={entries} />;
    if (activeTab === 'admin') {
      return (
        <Admin
          config={config}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
          onDeleteHabit={deleteHabit}
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
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-game-dim">
            <span>Connected to Supabase via backend.</span>
            <button
              onClick={clearAll}
              className="text-red-500 hover:text-red-400 font-medium"
            >
              Reset Adventure
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(api.getToken());
  const [requiresAuth, setRequiresAuth] = useState(null);

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
        <div className="text-game-gold font-black text-xl text-glow">Checking realm gate...</div>
      </div>
    );
  }

  if (requiresAuth && !token) {
    return <Login onLogin={handleLogin} />;
  }

  return <AppContent />;
}

export default App
