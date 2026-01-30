const CACHE_NAME = 'metronome-v1';
const ASSETS_TO_CACHE = [
  '.',
  '/index.html',
  '/style.css',
  '/metronome.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Cache-first strategy for navigation and asset requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cacheRes) => {
      if (cacheRes) return cacheRes;
      return fetch(event.request).then((networkRes) => {
        // Put a copy in cache for future offline use
        return caches.open(CACHE_NAME).then((cache) => {
          try { cache.put(event.request, networkRes.clone()); } catch (e) { /* some requests can't be cached (opaque) */ }
          return networkRes;
        });
      }).catch(() => {
        // fallback to cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
