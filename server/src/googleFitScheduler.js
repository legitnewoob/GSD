import { syncGoogleFit } from './googleFitSync.js';
import { deliverReminder } from './scheduler.js';

const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

export function startGoogleFitScheduler(prisma) {
  const run = async () => {
    try {
      const gToken = await prisma.googleFitToken.findUnique({ where: { userId: DEFAULT_USER_ID } });
      if (!gToken) return; // not connected — nothing to sync
      const result = await syncGoogleFit(prisma, DEFAULT_USER_ID, 7);
      console.log(`[gfit-scheduler] Synced ${result.synced} days`);
    } catch (err) {
      console.error('[gfit-scheduler] Sync failed:', err.message);
      try {
        await deliverReminder(prisma, {
          userId: DEFAULT_USER_ID,
          name: 'Google Fit Sync Failed',
          message: `Google Fit auto-sync failed: ${err.message}. Check Admin → Google Fit.`,
        });
      } catch (notifyErr) {
        console.error('[gfit-scheduler] Failed to send failure notification:', notifyErr.message);
      }
    }
  };

  setInterval(run, SYNC_INTERVAL_MS);
  run();
}
