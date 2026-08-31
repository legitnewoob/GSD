const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const monthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit' });

function currentMonthStr() {
  const parts = Object.fromEntries(monthFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
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
      categories: categories.map((c) => ({ name: c.name, type: c.type, budgetedAmount: c.budgetedAmount, spentAmount: c.type === 'fixed' ? c.spentAmount : undefined })),
    },
    update: {
      monthlyIncome: bs.monthlyIncome,
      cashBalance: bs.cashBalance,
      bankBalance: bs.bankBalance,
      totalFixed,
      totalFixedSpent,
      totalDailyPool,
      totalDailySpent,
      categories: categories.map((c) => ({ name: c.name, type: c.type, budgetedAmount: c.budgetedAmount, spentAmount: c.type === 'fixed' ? c.spentAmount : undefined })),
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
