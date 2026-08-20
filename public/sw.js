// Keep the app installable without serving releases from Cache Storage.
// The previous worker cached the HTML shell and could trap installed clients
// on an old release. Cache migration version: v5.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients
          .matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => Promise.allSettled(clients.map((client) => client.navigate(client.url))))
      )
  );
});
