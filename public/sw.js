const VERSION = 'kemet-spirit-v1';
const STATIC_CACHE = VERSION + '-static';
const IMAGE_CACHE = VERSION + '-images';
const FONT_CACHE = VERSION + '-fonts';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];
const PRIVATE_ROUTE = /^\/(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|support(?:\/|$))/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('kemet-spirit-') && ![STATIC_CACHE, IMAGE_CACHE, FONT_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheLimited(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  while (keys.length > maxEntries) await cache.delete(keys.shift());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith((async () => {
        const cache = await caches.open(FONT_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request).then((response) =>
          cacheLimited(FONT_CACHE, request, response, url.hostname === 'fonts.googleapis.com' ? 10 : 20))
          .catch(() => null);
        return cached || network.then((response) => response || Response.error());
      })());
    } else if (url.hostname === 'images.unsplash.com') {
      event.respondWith((async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => cacheLimited(IMAGE_CACHE, request, response, 50))
          .catch(() => null);
        return cached || network.then((response) => response || Response.error());
      })());
    }
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp') ||
      url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/') ||
      url.pathname.startsWith('/storage/') || PRIVATE_ROUTE.test(url.pathname)) return;

  if (url.pathname.startsWith('/assets/') ||
      /\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(request)) || (await cache.match('/')) ||
          new Response('You are offline. Reconnect to continue using Kemet Spirit.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
  }
});
