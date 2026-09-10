import { format, isSameDay, parseISO, subDays } from 'date-fns';
import { Check, Flame, Sparkles } from 'lucide-react';

const DAYS_SHOWN = 14;

// "Logged" means you actually filled something in yourself — mood, a habit, a note, money,
// time categories, whatever. Google Fit's hourly sync writes steps/runWalk on its own, so a
// day with only those (nothing manual) should still read as "not logged" here.
function isManuallyLogged(entry) {
  if (!entry) return false;
  if (entry.mood || entry.energy || entry.power) return true;
  if (entry.bigWin || entry.drain || entry.tomorrow || entry.notes) return true;
  if (entry.money !== '' && entry.money != null) return true;
  if (Object.values(entry.habits || {}).some(Boolean)) return true;
  if (Object.values(entry.categories || {}).some((c) => c?.hours !== '' && c?.hours != null)) return true;
  return false;
}

// Consecutive logged days counting back from today (or yesterday, if today isn't logged yet
// so a fresh day doesn't instantly read as "streak broken"). This is a recency measure, not
// a tally — it can be small even right after a long run if there's a single gap right before
// today, which is why the strip also shows a separate "X of 14 logged" count.
function computeStreak(entryByDate, todayStr) {
  const today = parseISO(todayStr);
  const anchor = isManuallyLogged(entryByDate.get(todayStr)) ? today : subDays(today, 1);
  let days = 0;
  let cursor = anchor;
  while (isManuallyLogged(entryByDate.get(format(cursor, 'yyyy-MM-dd')))) {
    days++;
    cursor = subDays(cursor, 1);
  }
  return days;
}

export function LogStreak({ entries, selectedDate, onSelectDate }) {
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const streak = computeStreak(entryByDate, todayStr);

  const days = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    days.push({ date, dateStr, logged: isManuallyLogged(entryByDate.get(dateStr)) });
  }
  const loggedCount = days.filter((d) => d.logged).length;
  const progress = Math.round((loggedCount / DAYS_SHOWN) * 100);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-game-panel p-4 shadow-lg sm:p-5" aria-label="Logging streak">
      <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-amber-400/[0.07] blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${streak > 0 ? 'border-amber-400/40 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.16)]' : 'border-slate-700 bg-slate-800'}`}>
              <Flame className={`h-5 w-5 ${streak > 0 ? 'text-amber-400' : 'text-slate-500'}`} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-game-dim">Logging streak</p>
              {streak > 0 ? (
                <p className="mt-0.5 text-lg font-black leading-tight text-amber-400 sm:text-xl">{streak} {streak === 1 ? 'day' : 'days'} in a row</p>
              ) : (
                <p className="mt-0.5 text-lg font-black leading-tight text-game-text sm:text-xl">Start today&apos;s run</p>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/30 px-2.5 py-1.5 text-right">
            <span className="block text-sm font-black leading-none text-game-text">{loggedCount}<span className="text-game-dim">/{DAYS_SHOWN}</span></span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-game-dim">days logged</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-game-dim">
            <span>Last 14 days</span>
            <span className="text-amber-400">{progress}% complete</span>
          </div>
          <div className="flex h-1.5 gap-1" aria-hidden="true">
            {days.map(({ dateStr, logged }) => (
              <span key={dateStr} className={`h-full flex-1 rounded-full ${logged ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map(({ date, dateStr, logged }) => {
            const isToday = dateStr === todayStr;
            const isSelected = isSameDay(date, parseISO(selectedDate));
            const label = format(date, 'EEEE, MMMM d');
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(date)}
                title={label}
                aria-label={`${label}${logged ? ', logged' : ', not logged'}${isToday ? ', today' : ''}`}
                aria-pressed={isSelected}
                className={[
                  'group relative flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-game-panel',
                  logged
                    ? 'border-emerald-400/25 bg-emerald-400/[0.09] text-emerald-300 hover:-translate-y-0.5 hover:border-emerald-400/60 hover:bg-emerald-400/[0.15]'
                    : isToday
                      ? 'border-dashed border-amber-400/60 bg-amber-400/[0.06] text-amber-300 hover:-translate-y-0.5 hover:bg-amber-400/[0.12]'
                      : 'border-slate-800 bg-slate-900/40 text-game-dim hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800',
                  isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-game-panel' : '',
                ].join(' ')}
              >
                <span className={`text-[9px] font-black uppercase tracking-wide ${isToday ? 'text-amber-400' : 'text-game-dim'}`}>{isToday ? 'Now' : format(date, 'EEE')}</span>
                <span className="mt-0.5 text-sm font-black leading-none">{format(date, 'd')}</span>
                <span className={`mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ${logged ? 'bg-emerald-400 text-slate-950' : isToday ? 'border border-amber-400/80' : 'bg-slate-700/80'}`}>
                  {logged ? <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" /> : isToday ? <Sparkles className="h-2 w-2" aria-hidden="true" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
