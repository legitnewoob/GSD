const CACHE_NAME = 'life-rpg-v4';
const SHELL_ASSETS = ['/manifest.json', '/favicon.svg', '/icons.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => {
        const isUpgrade = names.some((name) => name !== CACHE_NAME);
        return Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
          .then(() => isUpgrade);
      })
      .then((isUpgrade) => self.clients.claim().then(() => isUpgrade))
      // Older workers served index.html from cache first. Reload open clients once
      // when replacing one so the new worker can fetch the latest release.
      .then((isUpgrade) => {
        if (!isUpgrade) return undefined;
        return self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => Promise.allSettled(clients.map((client) => client.navigate(client.url))));
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: go to network, don't cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets: cache first, then network
  if (request.method !== 'GET') {
    return;
  }

  // HTML must come from the network first so a newly deployed index.html can
  // point browsers at the latest Vite-generated asset files. Keep a cached
  // copy only as an offline fallback.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
