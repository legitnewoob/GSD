import { Calendar, LayoutDashboard, Trophy, BarChart2, Crown, Wallet, Save, Settings } from 'lucide-react';

const tabs = [
  { key: 'daily', label: 'Daily Quest', icon: Calendar },
  { key: 'dashboard', label: 'Stats', icon: LayoutDashboard },
  { key: 'game', label: 'Hero', icon: Trophy },
  { key: 'budget', label: 'Budget', icon: Wallet },
  { key: 'weekly', label: 'Log', icon: BarChart2 },
  { key: 'admin', label: 'Settings', icon: Settings },
];

export function Navigation({ active, onChange, entries = [], saving = false }) {
  const last = entries[entries.length - 1];
  const level = last?.level ?? 1;
  const xp = last ? last.cumulativeXp % 500 : 0;

  return (
    <nav className="bg-game-panel border-b border-game-border px-4 py-3 shadow-glow">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-game-gold text-lg leading-none tracking-wide">LIFE RPG</div>
              <div className="text-xs text-game-dim uppercase tracking-wider">Daily Level Up</div>
            </div>
          </div>
          {saving && <Save className="w-4 h-4 text-amber-400 animate-pulse sm:hidden" />}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-game-dim uppercase tracking-wider">Hero Level</div>
            <div className="text-xl font-bold text-game-gold leading-none">{level}</div>
          </div>
          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-300"
              style={{ width: `${(xp / 500) * 100}%` }}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onChange(tab.key)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition border',
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-glow'
                      : 'border-transparent hover:bg-slate-800 text-game-dim hover:text-game-text',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
            {saving && <Save className="w-4 h-4 text-amber-400 animate-pulse hidden sm:block" title="Saving..." />}
          </div>
        </div>
      </div>
    </nav>
  );
}
