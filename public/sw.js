// Cache-first for versioned/static same-origin assets only. Never cache HTML,
// Supabase/API responses, authentication, bookings, availability or customer data.
const STATIC_CACHE = 'aat-static-v2';
const MAX_CACHED_ASSETS = 120;
const STATIC_FILE = /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?)$/i;
const PRIVATE_PATH = /^\/(?:api|auth|rest|mcp|admin)(?:\/|$)/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('aat-static-') && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || PRIVATE_PATH.test(url.pathname)) return;
  if (!STATIC_FILE.test(url.pathname) || request.destination === 'document') return;

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    const update = fetch(request).then(async (response) => {
      if (response && response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_CACHED_ASSETS) await cache.delete(keys[0]);
      }
      return response;
    });

    if (cached) {
      event.waitUntil(update.catch(() => undefined));
      return cached;
    }
    return update;
  })());
});
