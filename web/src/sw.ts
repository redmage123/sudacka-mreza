/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

// Background Sync API — not yet in all TS WebWorker lib versions
interface SyncEvent extends ExtendableEvent {
  readonly tag: string
  readonly lastChance: boolean
}

// ─── Cache names (bump CACHE_VERSION to invalidate all) ─────────────────────
const CACHE_VERSION = 'v3'
const STATIC_CACHE = `sm-static-${CACHE_VERSION}`
const API_CACHE = `sm-api-${CACHE_VERSION}`
const DECISIONS_CACHE = `sm-decisions-${CACHE_VERSION}`

const KNOWN_CACHES = [STATIC_CACHE, API_CACHE, DECISIONS_CACHE]

// Static asset extensions eligible for cache-first
const STATIC_EXT = /\.(js|css|woff2?|ttf|otf|eot|png|svg|ico|gif|jpe?g|webp|avif)$/i

// ─── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting()),
  )
})

// ─── Activate: evict stale caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// ─── Fetch routing ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Court-decision API responses → dedicate cache for offline reading
  if (
    url.pathname.startsWith('/api/') &&
    (url.pathname.includes('/court-decisions') || url.pathname.includes('/bankruptcy-decisions'))
  ) {
    event.respondWith(networkFirst(request, DECISIONS_CACHE))
    return
  }

  // Other API calls → network-first, short-lived cache for resilience
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // Static assets (JS, CSS, fonts, images) → cache-first
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Navigation / HTML → network-first, fall back to cached index.html (SPA shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(() =>
        caches.match('/index.html').then((r) => r ?? offlineResponse()),
      ),
    )
    return
  }
})

// ─── Background sync ─────────────────────────────────────────────────────────
// Cast to string overload since SyncEvent is not in all TS WebWorker lib versions
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncPending('bookmarks', '/api/v1/bookmarks'))
  }
  if (event.tag === 'sync-annotations') {
    event.waitUntil(syncPending('annotations', '/api/v1/annotations'))
  }
}) as EventListener)

// ─── Strategies ──────────────────────────────────────────────────────────────

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    void cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      void cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return offlineResponse()
  }
}

function offlineResponse(): Response {
  return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── IndexedDB helpers for background sync ───────────────────────────────────

interface PendingRecord {
  id: string
  payload: unknown
  createdAt: number
}

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sm-sync', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('bookmarks')) {
        db.createObjectStore('bookmarks', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('annotations')) {
        db.createObjectStore('annotations', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll(db: IDBDatabase, store: string): Promise<PendingRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as PendingRecord[])
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, store: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function syncPending(store: string, endpoint: string): Promise<void> {
  const db = await openSyncDB()
  const pending = await idbGetAll(db, store)

  for (const record of pending) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(record.payload),
      })
      if (res.ok) {
        await idbDelete(db, store, record.id)
      }
    } catch {
      // Network still down — leave record, retry on next sync
      break
    }
  }
}
