import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, LayoutDashboard, Trophy, BarChart2, Crown, Wallet, Save, Settings, GraduationCap, Menu, X } from 'lucide-react';

const tabs = [
  { key: 'daily', label: 'Daily Quest', icon: Calendar },
  { key: 'dashboard', label: 'Stats', icon: LayoutDashboard },
  { key: 'game', label: 'Hero', icon: Trophy },
  { key: 'budget', label: 'Budget', icon: Wallet },
  { key: 'weekly', label: 'Log', icon: BarChart2 },
  { key: 'learning', label: 'Learning', icon: GraduationCap },
  { key: 'admin', label: 'Settings', icon: Settings },
];

export function Navigation({ active, onChange, entries = [], saving = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const last = entries[entries.length - 1];
  const level = last?.level ?? 1;
  const xp = last ? last.cumulativeXp % 500 : 0;

  const selectTab = (key) => {
    onChange(key);
    setMenuOpen(false);
  };

  return (
    <nav className="bg-game-panel border-b border-game-border px-4 py-3 shadow-glow relative">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="font-bold text-game-gold text-lg leading-none tracking-wide">LIFE RPG</div>
            <div className="text-xs text-game-dim uppercase tracking-wider">Daily Level Up</div>
          </div>
          {saving && <Save className="w-4 h-4 text-amber-400 animate-pulse md:hidden" />}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden md:block">
            <div className="text-xs text-game-dim uppercase tracking-wider">Hero Level</div>
            <div className="text-xl font-bold text-game-gold leading-none">{level}</div>
          </div>
          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 hidden md:block">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-300"
              style={{ width: `${(xp / 500) * 100}%` }}
            />
          </div>

          {/* Desktop tab row */}
          <div className="hidden md:flex items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => selectTab(tab.key)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition border',
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-glow'
                      : 'border-transparent hover:bg-slate-800 text-game-dim hover:text-game-text',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            {saving && <Save className="w-4 h-4 text-amber-400 animate-pulse" title="Saving..." />}
          </div>

          {/* Mobile burger toggle */}
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-slate-700 text-game-dim hover:text-amber-400 hover:border-amber-500/50 transition"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden absolute inset-x-0 top-full z-30 bg-game-panel border-b border-game-border shadow-2xl overflow-hidden"
          >
            <div className="max-w-6xl mx-auto flex flex-col gap-1 px-4 py-3">
              {tabs.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = active === tab.key;
                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => selectTab(tab.key)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.08 + i * 0.05, ease: 'easeOut' }}
                    className={[
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors border text-left',
                      isActive
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'border-transparent hover:bg-slate-800 text-game-dim hover:text-game-text',
                    ].join(' ')}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
