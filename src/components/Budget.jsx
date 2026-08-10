import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Wallet, Coins, TrendingDown, Target } from 'lucide-react';

const panelBase = 'bg-game-panel rounded-2xl border border-game-border p-5 shadow-lg';
const inputBase =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-game-text placeholder-slate-600 focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500 outline-none transition';
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #1f2937', color: '#e2e8f0' };

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className={`${panelBase} flex items-start gap-4`}>
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-glow">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-black text-game-gold text-glow">{value}</div>
        <div className="text-xs text-game-dim uppercase tracking-wide">{label}</div>
        {sub && <div className="text-sm text-game-dim mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export function Budget({ config, entries, onSaveBudget }) {
  const [limits, setLimits] = useState({
    dailyLimit: config.budgetSetting?.dailyLimit || '',
    monthlyLimit: config.budgetSetting?.monthlyLimit || '',
  });

  const data = entries.map((e) => ({
    date: format(parseISO(e.date), 'dd MMM'),
    amount: parseFloat(e.money) || 0,
  }));

  const total = data.reduce((s, d) => s + d.amount, 0);
  const avg = data.length ? (total / data.length).toFixed(0) : 0;
  const max = data.reduce((s, d) => Math.max(s, d.amount), 0);
  const dailyLimit = parseFloat(limits.dailyLimit) || 0;
  const overDays = dailyLimit ? data.filter((d) => d.amount > dailyLimit).length : 0;

  const handleSave = () => {
    onSaveBudget({
      dailyLimit: limits.dailyLimit === '' ? null : parseFloat(limits.dailyLimit),
      monthlyLimit: limits.monthlyLimit === '' ? null : parseFloat(limits.monthlyLimit),
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-game-gold tracking-wide text-glow">TREASURY</h1>
        <p className="text-game-dim text-sm">Track gold spent and set quest spending limits.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={Coins} label="Total spent" value={`₹${total.toLocaleString()}`} sub={`${data.length} days logged`} />
        <Stat icon={TrendingDown} label="Daily average" value={`₹${avg}`} />
        <Stat icon={Target} label="Over daily limit" value={overDays} sub={dailyLimit ? `Limit: ₹${dailyLimit}` : 'No limit set'} />
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Budget limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-game-dim uppercase tracking-wide mb-2">Daily limit (₹)</label>
            <input
              type="number"
              min={0}
              value={limits.dailyLimit}
              onChange={(e) => setLimits((l) => ({ ...l, dailyLimit: e.target.value }))}
              onBlur={handleSave}
              className={inputBase}
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-game-dim uppercase tracking-wide mb-2">Monthly limit (₹)</label>
            <input
              type="number"
              min={0}
              value={limits.monthlyLimit}
              onChange={(e) => setLimits((l) => ({ ...l, monthlyLimit: e.target.value }))}
              onBlur={handleSave}
              className={inputBase}
              placeholder="e.g. 15000"
            />
          </div>
        </div>
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Daily spend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${v}`, 'Spent']} />
              {dailyLimit > 0 && <ReferenceLine y={dailyLimit} stroke="#ef4444" strokeDasharray="4 4" label="Limit" />}
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={panelBase}>
        <h2 className="text-lg font-black uppercase tracking-wide text-game-text mb-4">Spending log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-game-dim uppercase text-xs font-black tracking-wide">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...data].reverse().map((row) => {
                const over = dailyLimit && row.amount > dailyLimit;
                return (
                  <tr key={row.date} className="hover:bg-slate-900/40 transition">
                    <td className="px-4 py-3 text-game-text font-bold">{row.date}</td>
                    <td className="px-4 py-3 text-game-dim">₹{row.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {over ? <span className="text-red-400 font-bold">Over limit</span> : <span className="text-emerald-400 font-bold">Within limit</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
