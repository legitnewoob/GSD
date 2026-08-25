import { useMemo } from 'react';
import { subDays, startOfWeek, addDays, format, isAfter } from 'date-fns';

function levelClass(count) {
  if (count === 0) return 'bg-slate-800';
  if (count <= 2) return 'bg-emerald-900';
  if (count <= 5) return 'bg-emerald-700';
  if (count <= 9) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

export function Heatmap({ data }) {
  const { weeks, monthLabels } = useMemo(() => {
    const countByDate = new Map((data || []).map((d) => [d.date, d.count]));
    const today = new Date();
    const gridStart = startOfWeek(subDays(today, 364), { weekStartsOn: 0 });

    const weeksArr = [];
    let cursor = gridStart;
    while (!isAfter(cursor, today)) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(cursor, i);
        const dateStr = format(day, 'yyyy-MM-dd');
        week.push({ date: dateStr, count: isAfter(day, today) ? null : (countByDate.get(dateStr) || 0) });
      }
      weeksArr.push(week);
      cursor = addDays(cursor, 7);
    }

    const labels = [];
    let lastMonth = null;
    weeksArr.forEach((week, i) => {
      const month = format(new Date(week[0].date), 'MMM');
      if (month !== lastMonth) {
        labels.push({ index: i, label: month });
        lastMonth = month;
      }
    });

    return { weeks: weeksArr, monthLabels: labels };
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-[3px] mb-1 text-[10px] text-game-dim" style={{ paddingLeft: '2px' }}>
          {weeks.map((_, i) => {
            const label = monthLabels.find((m) => m.index === i);
            return (
              <div key={i} className="w-[11px] shrink-0">
                {label ? label.label : ''}
              </div>
            );
          })}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={day.count === null ? undefined : `${day.date}: ${day.count} solve${day.count === 1 ? '' : 's'}`}
                  className={`w-[11px] h-[11px] rounded-sm ${day.count === null ? 'bg-transparent' : levelClass(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
