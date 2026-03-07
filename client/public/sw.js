const CACHE_VERSION = 4;
const STATIC_CACHE = 'baltyckie-static-v' + CACHE_VERSION;
const API_CACHE = 'baltyckie-api-v' + CACHE_VERSION;
const API_CACHE_LIMIT = 100;

const STATIC_ASSETS = [
  '/favicon.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
  '/offline.html',
];

const AUTH_PATHS = ['/api/login', '/api/logout', '/api/callback', '/api/auth/'];

function isHashedAsset(url) {
  return /\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot)$/.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot)$/.test(url.pathname);
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  let data = { title: 'Bałtyckie', body: 'Nowe powiadomienie', url: '/' };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {}

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

const OFFLINE_DB_NAME = 'baltyckie-offline';
const OFFLINE_STORE = 'pending-requests';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readonly');
    const store = tx.objectStore(OFFLINE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replayOfflineQueue() {
  let db;
  try {
    db = await openOfflineDB();
  } catch (_e) {
    return;
  }

  const pending = await getAllPending(db);
  for (const req of pending) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      if (response.ok || response.status < 500) {
        await deletePending(db, req.id);
      }
    } catch (_e) {
    }
  }
  db.close();

  const allClients = await self.clients.matchAll();
  allClients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'replay-offline-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (AUTH_PATHS.some((p) => url.pathname.startsWith(p))) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(event.request, clone);
              trimCache(API_CACHE, API_CACHE_LIMIT);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          })
        )
    );
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });

        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
