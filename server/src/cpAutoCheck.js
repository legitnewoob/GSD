const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function toDateStr(ms) {
  return dateFormatter.format(new Date(ms));
}

// Auto-checks the "Problem Solving" habit for today whenever the user has an accepted
// Codeforces submission today (in REMINDER_TIMEZONE), so it doesn't need manual ticking.
export async function syncCpProblemSolvingHabit(prisma, userId) {
  const profile = await prisma.codingProfile.findUnique({ where: { userId_platform: { userId, platform: 'codeforces' } } });
  if (!profile) return { checked: false, reason: 'no Codeforces profile connected' };

  const habit = await prisma.habit.findFirst({ where: { userId, name: 'Problem Solving', isActive: true } });
  if (!habit) return { checked: false, reason: 'no "Problem Solving" habit found' };

  const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(profile.username)}&count=50`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(data.comment || 'Codeforces request failed');

  const todayStr = toDateStr(Date.now());
  const solvedToday = data.result.some(
    (sub) => sub.verdict === 'OK' && toDateStr(sub.creationTimeSeconds * 1000) === todayStr
  );
  if (!solvedToday) return { checked: false };

  const entry = await prisma.entry.upsert({
    where: { userId_date: { userId, date: todayStr } },
    create: { userId, date: todayStr },
    update: {},
  });
  // Respect a soft-deleted day — don't silently resurrect it via a background sync.
  if (entry.deletedAt) return { checked: false, reason: 'entry soft-deleted' };

  await prisma.entryHabit.upsert({
    where: { entryId_habitId: { entryId: entry.id, habitId: habit.id } },
    create: { entryId: entry.id, habitId: habit.id, completed: true },
    update: { completed: true },
  });

  return { checked: true };
}
