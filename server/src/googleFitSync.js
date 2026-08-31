const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';

const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const wallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: REMINDER_TIMEZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function toDateStr(ms) {
  return dateFormatter.format(new Date(ms));
}

// How far REMINDER_TIMEZONE's wall clock is ahead of UTC, in ms, at the given instant.
function timezoneOffsetMs(date = new Date()) {
  const p = Object.fromEntries(wallClockFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

// Midnight in REMINDER_TIMEZONE, `daysAgo` days back, expressed as a UTC epoch ms.
function localMidnightMs(daysAgo) {
  const offsetMs = timezoneOffsetMs();
  const utcMidnightOfLocalDate = new Date(`${toDateStr(Date.now())}T00:00:00Z`).getTime();
  return utcMidnightOfLocalDate - offsetMs - daysAgo * 24 * 60 * 60 * 1000;
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

export async function syncGoogleFit(prisma, userId, days = 7) {
  let gToken = await prisma.googleFitToken.findUnique({ where: { userId } });
  if (!gToken) throw httpError('Not connected to Google Fit', 400);

  if (new Date() >= gToken.expiresAt) {
    if (!gToken.refreshToken) throw httpError('Token expired. Please reconnect Google Fit.', 400);
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: gToken.refreshToken, client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token',
      }),
    });
    const refreshed = await refreshRes.json();
    if (!refreshed.access_token) throw httpError('Failed to refresh token. Please reconnect.', 400);
    gToken = await prisma.googleFitToken.update({
      where: { userId },
      data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000) },
    });
  }

  // Fetch steps and distance separately so a missing scope on one doesn't break the other.
  // Buckets are aligned to REMINDER_TIMEZONE midnight, not an arbitrary "now - N days" instant —
  // otherwise the most recent bucket's start almost always falls on yesterday's calendar date,
  // and today's data gets mislabeled/merged into yesterday's entry instead of its own.
  const endMs = Date.now();
  const startMs = localMidnightMs(days - 1);
  const authHeader = { Authorization: `Bearer ${gToken.accessToken}`, 'Content-Type': 'application/json' };
  const body = (types) => JSON.stringify({ aggregateBy: types.map((t) => ({ dataTypeName: t })), bucketByTime: { durationMillis: 86400000 }, startTimeMillis: startMs, endTimeMillis: endMs });

  const [stepsRes, distRes] = await Promise.all([
    fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', { method: 'POST', headers: authHeader, body: body(['com.google.step_count.delta']) }),
    fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', { method: 'POST', headers: authHeader, body: body(['com.google.distance.delta']) }),
  ]);

  if (!stepsRes.ok) throw httpError(`Google Fit steps request failed: ${stepsRes.status}`, 502);

  const stepsData = await stepsRes.json();
  const distData = distRes.ok ? await distRes.json() : { bucket: [] };
  if (!distRes.ok) console.warn('[GFit] distance fetch failed (scope missing?):', await distRes.text().catch(() => ''));

  const stepsMap = {}, distMap = {};
  for (const bucket of stepsData.bucket || []) {
    const ds = toDateStr(parseInt(bucket.startTimeMillis));
    let s = 0;
    for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) s += (v.intVal || 0);
    stepsMap[ds] = s;
  }
  for (const bucket of distData.bucket || []) {
    const ds = toDateStr(parseInt(bucket.startTimeMillis));
    let m = 0;
    for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) m += (v.fpVal || 0);
    distMap[ds] = parseFloat((m / 1000).toFixed(2));
  }

  const allDates = new Set([...Object.keys(stepsMap), ...Object.keys(distMap)]);
  let synced = 0;
  for (const dateStr of allDates) {
    const steps = stepsMap[dateStr] > 0 ? stepsMap[dateStr] : null;
    const distanceKm = distMap[dateStr] > 0 ? distMap[dateStr] : null;
    // Respect a soft-deleted day — don't silently resurrect it via a background sync.
    const existing = await prisma.entry.findUnique({ where: { userId_date: { userId, date: dateStr } } });
    if (existing?.deletedAt) continue;
    await prisma.entry.upsert({
      where: { userId_date: { userId, date: dateStr } },
      create: { userId, date: dateStr, steps, runWalk: distanceKm },
      update: { steps, runWalk: distanceKm },
    });
    if (steps || distanceKm) synced++;
  }

  return {
    synced,
    days,
    stepsdays: Object.keys(stepsMap).filter((d) => stepsMap[d] > 0).length,
    distdays: Object.keys(distMap).filter((d) => distMap[d] > 0).length,
  };
}
