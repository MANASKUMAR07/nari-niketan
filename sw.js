// ============================================================================
// NARI NIKETAN — Progressive Web App (PWA) Service Worker
// Version: 1.0.0
// ============================================================================

const CACHE_NAME = 'nari-niketan-v5.9';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './shop.html',
  './cart.html',
  './grievance-redressal.html',
  './terms-and-conditions.html',
  './privacy-policy.html',
  './return-policy.html',
  './offline.html',
  './css/style.css?v=4.0',
  './js/app.js',
  './js/store.js',
  './js/products.js',
  './js/auth.js',
  './js/pwa-install.js',
  './manifest.webmanifest',
  './manifest.json',
  './images/logo.png',
  './images/logo-circle.png',
  './images/favicon.png',
  './images/icons/icon-192x192.png',
  './images/icons/icon-512x512.png',
  './images/icons/icon-maskable-192x192.png',
  './images/icons/icon-maskable-512x512.png',
  './images/icons/apple-touch-icon.png'
];

// INSTALL — Pre-cache critical core application assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[NariNiketan SW] Pre-caching offline shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[NariNiketan SW] Some assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ACTIVATE — Clean up outdated caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[NariNiketan SW] Deleting obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH — Handle network requests with tailored caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests, Chrome extension URLs, and Firebase/external API traffic
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('google-analytics.com')) {
    return;
  }

  // Strategy 1: HTML Pages (Navigation) — Network-First with Offline Fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const offlinePage = await caches.match('./offline.html');
          return offlinePage || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // Strategy 2: Static Assets (CSS, JS, Fonts, Images) — Stale-While-Revalidate
  const isStaticAsset = (
    url.pathname.match(/\.(css|js|woff2?|ttf|png|jpg|jpeg|svg|webp|ico|json|webmanifest)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// MESSAGE — Allow UI to trigger skipWaiting for seamless instant updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// PUSH NOTIFICATIONS — Handle promotional & order updates
self.addEventListener('push', (event) => {
  let data = { title: 'Nari Niketan', body: 'New arrivals in our ethnic collection! ✨', icon: 'images/icons/icon-192x192.png' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'images/icons/icon-192x192.png',
    badge: 'images/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './index.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// NOTIFICATION CLICK — Focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// BACKGROUND SYNC — Sync offline orders / cart changes when online
self.addEventListener('sync', (event) => {
  console.log('[NariNiketan SW] Background sync event triggered:', event.tag);
  if (event.tag === 'sync-orders') {
    event.waitUntil(Promise.resolve());
  }
});

// PERIODIC BACKGROUND SYNC — Periodically refresh catalog cache
self.addEventListener('periodicsync', (event) => {
  console.log('[NariNiketan SW] Periodic sync event triggered:', event.tag);
  if (event.tag === 'update-catalog') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.add('./index.html');
      })
    );
  }
});

