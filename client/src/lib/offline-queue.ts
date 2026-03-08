const DB_NAME = 'baltyckie-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-requests';

export interface PendingRequest {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  type: 'media-reading' | 'rcp-checkin' | 'rcp-checkout' | 'generic';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueRequest(req: Omit<PendingRequest, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ ...req, timestamp: Date.now() });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getPendingRequests(): Promise<PendingRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function removePendingRequest(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearPendingRequests(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

const CACHE_DB_NAME = 'baltyckie-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE = 'api-cache';

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedData(key: string, data: any, ttlMs = 5 * 60 * 1000): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      store.put({ key, data, expires: Date.now() + ttlMs });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (_e) {}
}

export async function getCachedData<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        db.close();
        const record = request.result;
        if (!record) return resolve(null);
        if (record.expires < Date.now()) return resolve(null);
        resolve(record.data as T);
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (_e) {
    return null;
  }
}

function detectRequestType(url: string, method: string): PendingRequest['type'] {
  if (url.includes('/api/meter-readings') || url.includes('/api/recepcja/readings')) return 'media-reading';
  if (url.includes('/api/time-entries') || url.includes('/api/rcp')) {
    if (url.includes('check-in') || method === 'POST') return 'rcp-checkin';
    if (url.includes('check-out') || method === 'PATCH') return 'rcp-checkout';
  }
  return 'generic';
}

export async function saveFailedRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null
): Promise<void> {
  const type = detectRequestType(url, method);
  await enqueueRequest({ url, method, headers, body, type });

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register('replay-offline-queue');
    } catch (_e) {
    }
  }
}

export async function replayQueue(): Promise<{ succeeded: number; failed: number }> {
  const pending = await getPendingRequests();
  let succeeded = 0;
  let failed = 0;

  for (const req of pending) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      if (response.ok || response.status < 500) {
        await removePendingRequest(req.id!);
        succeeded++;
      } else {
        failed++;
      }
    } catch (_e) {
      failed++;
    }
  }

  return { succeeded, failed };
}
