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

function computeStreak(entryByDate, todayStr) {
  const today = parseISO(todayStr);
  let anchor = isManuallyLogged(entryByDate.get(todayStr)) ? today : subDays(today, 1);
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

  return (
    <div className="bg-game-panel rounded-2xl border border-game-border p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {streak > 0 ? (
            <>
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-black text-amber-400">{streak} day{streak === 1 ? '' : 's'} logged</span>
            </>
          ) : (
            <span className="text-sm font-bold text-game-dim">No current logging streak</span>
          )}
        </div>
        <span className="text-xs text-game-dim uppercase tracking-wide">Last {DAYS_SHOWN} days</span>
      </div>
      <div className="flex gap-1.5 justify-between">
        {days.map(({ date, dateStr, logged }) => {
          const isToday = dateStr === todayStr;
          const isSelected = isSameDay(date, parseISO(selectedDate));
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(date)}
              title={format(date, 'EEEE, MMMM d')}
              className={[
                'flex-1 aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition',
                logged ? 'bg-emerald-500/80 text-slate-950 hover:bg-emerald-400' : 'bg-slate-800 text-game-dim hover:bg-slate-700',
                isSelected ? 'ring-2 ring-amber-400' : '',
                isToday && !isSelected ? 'ring-1 ring-amber-500/50' : '',
              ].join(' ')}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
