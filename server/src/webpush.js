import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@xorlabs.dev';

const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

export async function sendWebPush(subscription, { title, body }) {
  if (!configured) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured');
  }
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify({ title, body }), { urgency: 'high' });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      const goneError = new Error('Subscription expired');
      goneError.gone = true;
      throw goneError;
    }
    throw err;
  }
}
