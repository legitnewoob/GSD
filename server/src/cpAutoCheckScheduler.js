import { syncCpProblemSolvingHabit } from './cpAutoCheck.js';

const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

export function startCpAutoCheckScheduler(prisma) {
  const run = async () => {
    try {
      const result = await syncCpProblemSolvingHabit(prisma, DEFAULT_USER_ID);
      if (result.checked) console.log('[cp-autocheck] Problem Solving marked done for today');
    } catch (err) {
      console.error('[cp-autocheck] Sync failed:', err.message);
    }
  };

  setInterval(run, SYNC_INTERVAL_MS);
  run();
}
