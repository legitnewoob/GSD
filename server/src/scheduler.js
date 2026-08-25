import { sendWebPush } from './webpush.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';

const reminderFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REMINDER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// en-CA gives "YYYY-MM-DD, HH:MM"; split into date + time parts.
function nowInReminderTimezone() {
  const parts = reminderFormatter.formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: REMINDER_TIMEZONE, weekday: 'short' });

function todayWeekdayIndex() {
  return WEEKDAY_INDEX[weekdayFormatter.format(new Date())];
}

export async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured');
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
  return res.json();
}

export function startReminderScheduler(prisma) {
  const check = async () => {
    try {
      const { date, time } = nowInReminderTimezone();
      const weekday = todayWeekdayIndex();
      const candidates = await prisma.notificationRule.findMany({
        where: {
          isActive: true,
          time,
          OR: [{ lastSentDate: null }, { lastSentDate: { not: date } }],
        },
      });
      const due = candidates.filter((rule) =>
        rule.daysOfWeek.split(',').map(Number).includes(weekday)
      );
      for (const rule of due) {
        try {
          await sendTelegramMessage(rule.message);
        } catch (err) {
          console.error(`[scheduler] Telegram send failed for "${rule.name}":`, err.message);
        }

        const subs = await prisma.pushSubscription.findMany({ where: { userId: rule.userId } });
        for (const sub of subs) {
          try {
            await sendWebPush(sub, { title: rule.name, body: rule.message });
          } catch (err) {
            if (err.gone) await prisma.pushSubscription.delete({ where: { id: sub.id } });
            else console.error(`[scheduler] Push send failed for "${rule.name}":`, err.message);
          }
        }

        await prisma.notificationRule.update({
          where: { id: rule.id },
          data: { lastSentDate: date },
        });
      }
    } catch (err) {
      console.error('[scheduler] Reminder check failed:', err.message);
    }
  };

  setInterval(check, 60 * 1000);
  check();
}
