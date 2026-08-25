const SHELL_CACHE = 'gsd-shell-v9';
const ASSET_CACHE = 'gsd-assets-v9';
const APP_SHELL_URLS = ['/', '/manifest.json', '/favicon.svg', '/icons.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== SHELL_CACHE && name !== ASSET_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(async () => {
        if ('navigationPreload' in self.registration) {
          await self.registration.navigationPreload.enable();
        }
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  if (APP_SHELL_URLS.includes(url.pathname)) {
    event.respondWith(handleShellRequest(request));
  }
});

async function handleNavigationRequest(event) {
  const preloadResponse = await event.preloadResponse;

  if (preloadResponse) {
    await updateShellCache(preloadResponse.clone());
    return preloadResponse;
  }

  try {
    const networkResponse = await fetch(event.request);

    if (networkResponse.ok) {
      await updateShellCache(networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(event.request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const appShell = await caches.match('/');

    if (appShell) {
      return appShell;
    }

    throw error;
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

async function handleShellRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function updateShellCache(response) {
  const cache = await caches.open(SHELL_CACHE);
  await cache.put('/', response);
}

self.addEventListener('push', (event) => {
  let payload = { title: 'GSD', body: 'You have a reminder' };
  try {
    payload = event.data.json();
  } catch {
    // fall back to default payload above
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      tag: payload.title,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
