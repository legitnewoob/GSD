const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const monthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit' });

function currentMonthStr() {
  const parts = Object.fromEntries(monthFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

function todayStrIST() {
  const parts = Object.fromEntries(dateFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { year: parseInt(parts.year, 10), month: parseInt(parts.month, 10), day: parseInt(parts.day, 10), str: `${parts.year}-${parts.month}-${parts.day}` };
}

// Weekday of a given calendar date, independent of server timezone — a Y-M-D triple's
// day-of-week doesn't depend on what instant "midnight" is at, so constructing it as UTC
// midnight and reading getUTCDay() is safe regardless of where this process runs.
function weekdayOf(year, month1to12, day) {
  return new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay(); // 0=Sun..6=Sat
}

function lastWorkingDayStr(year, month1to12) {
  let day = new Date(Date.UTC(year, month1to12, 0)).getUTCDate(); // last calendar day of month
  while (weekdayOf(year, month1to12, day) === 0 || weekdayOf(year, month1to12, day) === 6) day -= 1;
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Salary auto-credits on the last working day of each month (no manual "salary day" needed).
// Checks the previous month too so a month missed for any reason (app not opened, feature
// broken, etc.) self-heals instead of silently staying uncredited — lastSalaryCredit is the
// idempotency guard so a month is never credited twice.
async function checkAndCreditSalary(prisma, bs) {
  if (!bs.monthlyIncome) return;
  const today = todayStrIST();
  const thisMonthKey = `${today.year}-${String(today.month).padStart(2, '0')}`;
  const prevYear = today.month === 1 ? today.year - 1 : today.year;
  const prevMonth = today.month === 1 ? 12 : today.month - 1;
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  const candidates = [
    { key: prevMonthKey, payday: lastWorkingDayStr(prevYear, prevMonth) },
    { key: thisMonthKey, payday: lastWorkingDayStr(today.year, today.month) },
  ];

  let current = bs;
  for (const { key, payday } of candidates) {
    if ((!current.lastSalaryCredit || current.lastSalaryCredit < key) && today.str >= payday) {
      current = await prisma.budgetSetting.update({
        where: { id: current.id },
        data: { bankBalance: (current.bankBalance || 0) + current.monthlyIncome, lastSalaryCredit: key },
      });
      console.log(`[salary-scheduler] Credited ₹${current.monthlyIncome} salary for ${key} (budget ${current.id})`);
    }
  }
}

export async function captureSnapshot(prisma, bs, closingMonth) {
  const categories = await prisma.budgetCategory.findMany({ where: { budgetSettingId: bs.id, isActive: true } });
  const fixedCats = categories.filter((c) => c.type === 'fixed');
  const dailyCats = categories.filter((c) => c.type === 'daily');

  const totalFixed = fixedCats.reduce((s, c) => s + (c.budgetedAmount || 0), 0);
  const totalFixedSpent = fixedCats.reduce((s, c) => s + (c.spentAmount || 0), 0);
  const totalDailyPool = dailyCats.reduce((s, c) => s + (c.budgetedAmount || 0), 0);

  const entries = await prisma.entry.findMany({
    where: { userId: bs.userId, date: { startsWith: closingMonth } },
    select: { money: true },
  });
  const totalDailySpent = entries.reduce((s, e) => s + (parseFloat(e.money) || 0), 0);

  // Credit cards aren't part of the monthly budget allocation and never reset — this just
  // records each card's paid/balance state as of the snapshot moment, for the monthly log.
  const cards = await prisma.creditCard.findMany({ where: { budgetSettingId: bs.id, isActive: true } });
  const creditCards = cards.map((c) => ({ name: c.name, currentBalance: c.currentBalance, creditLimit: c.creditLimit, isPaid: c.isPaid }));

  const categoriesJson = categories.map((c) => ({ name: c.name, type: c.type, budgetedAmount: c.budgetedAmount, spentAmount: c.type === 'fixed' ? c.spentAmount : undefined }));

  await prisma.budgetSnapshot.upsert({
    where: { userId_month: { userId: bs.userId, month: closingMonth } },
    create: {
      userId: bs.userId,
      month: closingMonth,
      monthlyIncome: bs.monthlyIncome,
      cashBalance: bs.cashBalance,
      bankBalance: bs.bankBalance,
      totalFixed,
      totalFixedSpent,
      totalDailyPool,
      totalDailySpent,
      categories: categoriesJson,
      creditCards,
    },
    update: {
      monthlyIncome: bs.monthlyIncome,
      cashBalance: bs.cashBalance,
      bankBalance: bs.bankBalance,
      totalFixed,
      totalFixedSpent,
      totalDailyPool,
      totalDailySpent,
      categories: categoriesJson,
      creditCards,
    },
  });
  console.log(`[budget-scheduler] Snapshot captured for ${closingMonth} (budget ${bs.id})`);
}

// Fixed-category spend (Rent, Subscriptions, etc.) is a manually-entered "have I paid this
// yet" tracker, scoped to the current calendar month. It doesn't reset itself — this snapshots
// the closing month (for historical tracking) then zeroes it out once a new month actually
// starts. Credit card balances are untouched; they're real running debt, not part of the
// monthly budget allocation.
export function startBudgetResetScheduler(prisma) {
  const run = async () => {
    try {
      const thisMonth = currentMonthStr();
      const settings = await prisma.budgetSetting.findMany();
      for (const bs of settings) {
        await checkAndCreditSalary(prisma, bs);

        if (bs.lastFixedResetMonth === thisMonth) continue;

        if (bs.lastFixedResetMonth !== null) {
          await captureSnapshot(prisma, bs, bs.lastFixedResetMonth);
          await prisma.budgetCategory.updateMany({
            where: { budgetSettingId: bs.id, type: 'fixed' },
            data: { spentAmount: 0 },
          });
          console.log(`[budget-scheduler] Reset fixed category spend for budget ${bs.id} (${thisMonth})`);
        }

        await prisma.budgetSetting.update({
          where: { id: bs.id },
          data: { lastFixedResetMonth: thisMonth },
        });
      }
    } catch (err) {
      console.error('[budget-scheduler] Reset check failed:', err.message);
    }
  };

  setInterval(run, CHECK_INTERVAL_MS);
  run();
}
