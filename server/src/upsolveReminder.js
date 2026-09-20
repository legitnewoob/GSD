import { sendTelegramMessage } from './scheduler.js';
import { getPlatformStats } from './cpStats.js';

const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

const MIN_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_TIMES = ['00:00', '12:00'];
const TELEGRAM_MAX_LENGTH = 4000; // Telegram caps messages at 4096 chars

// h23 (not hour12:false) so midnight is "00", never "24".
const slotFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REMINDER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function currentSlot() {
  const map = {};
  for (const p of slotFormatter.formatToParts(new Date())) map[p.type] = p.value;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

// Problems added at least `minAgeDays` ago that aren't solved on Codeforces yet.
// With no Codeforces profile connected nothing can be checked, so everything counts as
// unsolved (same as the Upsolve Bucket UI); a failed lookup throws so we never nag about
// problems that may already be solved.
export async function getDueUpsolveProblems(prisma, userId, minAgeDays = MIN_AGE_DAYS) {
  const cutoff = new Date(Date.now() - minAgeDays * DAY_MS);
  const problems = await prisma.upsolveProblem.findMany({
    where: { userId, createdAt: { lte: cutoff } },
    orderBy: { createdAt: 'asc' },
  });
  if (problems.length === 0) return [];

  let solvedSet = new Set();
  const profile = await prisma.codingProfile.findUnique({ where: { userId_platform: { userId, platform: 'codeforces' } } });
  if (profile) {
    const stats = await getPlatformStats('codeforces', profile.username);
    if (stats.error) throw new Error(`Codeforces lookup failed: ${stats.error}`);
    solvedSet = stats.solvedSet;
  }

  return problems.filter((p) => !(p.contestId && p.problemIndex && solvedSet.has(`${p.contestId}${p.problemIndex}`)));
}

export function buildUpsolveMessage(problems) {
  const header = `📚 Upsolve time! ${problems.length} problem${problems.length === 1 ? '' : 's'} waiting on Codeforces:\n`;
  const lines = [];
  let length = header.length;
  for (const [i, p] of problems.entries()) {
    const label = p.name || (p.contestId && p.problemIndex ? `${p.contestId}${p.problemIndex}` : 'Untitled problem');
    const ageDays = Math.floor((Date.now() - p.createdAt.getTime()) / DAY_MS);
    const line = `\n${i + 1}. ${label} (added ${ageDays}d ago)\n${p.url}`;
    if (length + line.length > TELEGRAM_MAX_LENGTH) {
      lines.push(`\n…and ${problems.length - i} more`);
      break;
    }
    lines.push(line);
    length += line.length;
  }
  return header + lines.join('');
}

// Sends the reminder to Telegram. `trial` skips the 7-day wait and lists every unsolved
// problem, so the message can be checked right away.
export async function sendUpsolveReminder(prisma, userId, { trial = false } = {}) {
  const problems = await getDueUpsolveProblems(prisma, userId, trial ? 0 : MIN_AGE_DAYS);
  if (problems.length === 0) return { sent: false, count: 0 };
  await sendTelegramMessage(buildUpsolveMessage(problems));
  return { sent: true, count: problems.length };
}

export function startUpsolveReminderScheduler(prisma) {
  let lastSlotKey = null;

  const check = async () => {
    const { date, time } = currentSlot();
    if (!REMINDER_TIMES.includes(time)) return;
    const slotKey = `${date} ${time}`;
    if (slotKey === lastSlotKey) return;
    lastSlotKey = slotKey;

    try {
      const result = await sendUpsolveReminder(prisma, DEFAULT_USER_ID);
      if (result.sent) console.log(`[upsolve-reminder] Sent reminder for ${result.count} problem(s)`);
    } catch (err) {
      console.error('[upsolve-reminder] Failed:', err.message);
    }
  };

  setInterval(check, 60 * 1000);
  check();
}
