// Cache-first for same-origin static assets only. Never cache HTML,
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
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return;
  if (!STATIC_FILE.test(url.pathname) || request.destination === 'document') return;

  const cachePromise = caches.open(STATIC_CACHE);
  const updatePromise = cachePromise.then(async (cache) => {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_CACHED_ASSETS) await cache.delete(keys[0]);
    }
    return response;
  });

  // Register the refresh synchronously with the fetch event; cached assets are
  // returned immediately while the latest copy is stored for the next visit.
  event.waitUntil(updatePromise.catch(() => undefined));
  event.respondWith(cachePromise.then(async (cache) => {
    const cached = await cache.match(request);
    return cached || updatePromise;
  }));
});
