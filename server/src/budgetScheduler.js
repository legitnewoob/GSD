const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const monthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit' });

function currentMonthStr() {
  const parts = Object.fromEntries(monthFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

// Fixed-category spend (Rent, Subscriptions, etc.) is a manually-entered "have I paid this
// yet" tracker, scoped to the current calendar month. It doesn't reset itself — this zeroes
// it out once a new month actually starts. Credit card balances are untouched; they're real
// running debt, not part of the monthly budget allocation.
export function startBudgetResetScheduler(prisma) {
  const run = async () => {
    try {
      const thisMonth = currentMonthStr();
      const settings = await prisma.budgetSetting.findMany();
      for (const bs of settings) {
        if (bs.lastFixedResetMonth === thisMonth) continue;

        if (bs.lastFixedResetMonth !== null) {
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
