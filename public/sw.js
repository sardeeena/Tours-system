// Online-first service worker: preserves PWA installation while leaving all
// navigation, assets, API calls and customer data on the network. No offline
// fallback or application content is cached.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          // Remove only the obsolete cache namespace previously used by this app.
          .filter((key) => key.startsWith('kemet-spirit-'))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Intentionally no fetch handler: the browser uses the network normally.
