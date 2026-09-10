import { format, isSameDay, parseISO, subDays } from 'date-fns';
import { Flame } from 'lucide-react';

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

  return (
    <div className="bg-game-panel rounded-2xl border border-game-border p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-y-1">
        <div className="flex items-center gap-1.5">
          {streak > 0 ? (
            <>
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-black text-amber-400">{streak}-day streak</span>
            </>
          ) : (
            <span className="text-sm font-bold text-game-dim">No active streak</span>
          )}
        </div>
        <span className="text-xs text-game-dim">
          <span className="font-bold text-game-text">{loggedCount}</span> of {DAYS_SHOWN} days logged
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ date, dateStr, logged }) => {
          const isToday = dateStr === todayStr;
          const isSelected = isSameDay(date, parseISO(selectedDate));
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold text-game-dim uppercase">{format(date, 'EEEEE')}</span>
              <button
                type="button"
                onClick={() => onSelectDate(date)}
                title={format(date, 'EEEE, MMMM d')}
                className={[
                  'w-full aspect-square rounded-lg flex items-center justify-center text-xs font-black transition border',
                  logged
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400'
                    : isToday
                      ? 'bg-slate-900 text-amber-400 border-dashed border-amber-500/60 hover:bg-slate-800'
                      : 'bg-slate-800/60 text-game-dim border-transparent hover:bg-slate-700',
                  isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-game-panel' : '',
                ].join(' ')}
              >
                {format(date, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
