const CACHE_NAME = 'bluepin-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/bluepin-32.webp',
  '/bluepin-48.webp',
  '/bluepin-64.webp',
  '/bluepin-96.webp',
  '/Bluepin.webp',
  '/Bluepin.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/maskable-icon-512x512.png',
  '/apple-touch-icon.png',
  '/Bluepin PWA logo 128 x 128.png',
  '/Bluepin PWA logo 256 x 256.png',
  '/Bluepin PWA logo 512 x 512.png'
];

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to pre-cache:', err);
      });
    })
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith('bluepin-cache-') && cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or Chrome extensions / non-http schemas
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // API Requests: Network-First with graceful offline response.
  // Also passthrough Firebase's internal auth handler (/__/auth/) used by signInWithRedirect.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/auth')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'You are currently offline. Please check your internet connection.'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Navigation Requests (App Shell): Network-First, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch((err) => {
          // Silent fallback if network fetch fails while offline
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────────
// Delivered by Firebase Cloud Messaging. Payloads arrive as a JSON object; the
// server controls the shape via server/routes/cron.ts.

// Push Event - Show a system notification when a message arrives
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // A malformed payload should not discard the notification entirely; fall
    // back to the raw text so the user still sees something.
    console.warn('[SW] Push payload was not JSON:', err);
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }

  const notification = payload.notification || {};
  const title = notification.title || 'Bluepin';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/pwa-192x192.png',
    badge: '/bluepin-96.webp',
    // Tag collapses repeat nudges for the same reminder instead of stacking.
    tag: payload.data?.tag || undefined,
    data: payload.data || {},
    vibrate: [100, 50, 100],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click - Focus an open tab, or open a fresh one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open tab so the user doesn't accumulate new ones.
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== targetUrl) {
            return client.navigate(targetUrl).then((navigated) => client.focus())
              .catch(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Listen for message events (e.g. skipWaiting trigger from UI update banner)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
