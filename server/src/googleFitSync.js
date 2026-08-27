const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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

  // Fetch steps and distance separately so a missing scope on one doesn't break the other
  const endMs = Date.now();
  const startMs = endMs - days * 24 * 60 * 60 * 1000;
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
    const d = new Date(parseInt(bucket.startTimeMillis));
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let s = 0;
    for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) s += (v.intVal || 0);
    stepsMap[ds] = s;
  }
  for (const bucket of distData.bucket || []) {
    const d = new Date(parseInt(bucket.startTimeMillis));
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let m = 0;
    for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) m += (v.fpVal || 0);
    distMap[ds] = parseFloat((m / 1000).toFixed(2));
  }

  const allDates = new Set([...Object.keys(stepsMap), ...Object.keys(distMap)]);
  let synced = 0;
  for (const dateStr of allDates) {
    const steps = stepsMap[dateStr] > 0 ? stepsMap[dateStr] : null;
    const distanceKm = distMap[dateStr] > 0 ? distMap[dateStr] : null;
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
