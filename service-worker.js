// Build It!++ PWA offline shell. No Nitrado API responses or credentials are cached.
// Map tiles and live Nitrado information still require network access.
const CACHE_NAME = 'buildit-shell-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './event-manager.js', './ui-layout.js', './locations-fallback.js', './file-manager.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/app-icon.svg'
];
const LEAFLET_CDN = new Set([
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
]);
const shellPaths = new Set(SHELL.map(p => new URL(p, self.registration.scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(SHELL.map(async file => {
      const url = new URL(file, self.registration.scope);
      const response = await fetch(url, {cache:'no-cache'});
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('buildit-shell-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin && shellPaths.has(url.pathname);
  const leaflet = LEAFLET_CDN.has(url.href);
  // Never intercept authentication, log requests, Nitrado Worker calls or map tiles.
  if (!local && !leaflet) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (leaflet) {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
      return response;
    }
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request, {ignoreSearch: true});
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const index = await cache.match(new URL('./index.html', self.registration.scope));
        if (index) return index;
      }
      throw error;
    }
  })());
});
