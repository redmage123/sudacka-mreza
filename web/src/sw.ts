/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

// Background Sync API — not yet in all TS WebWorker lib versions
interface SyncEvent extends ExtendableEvent {
  readonly tag: string
  readonly lastChance: boolean
}

// v4 — rebuilt to make a deploy actually visible after the v3 cache pin.
// Trap in v3: install pre-cached '/' and '/index.html', so the cached shell
// kept pointing at the old hashed bundle even after a fresh deploy and the
// SPA could never recover without manual cache wipe (QA hit this).
//
// Rules in v4:
//   1. No install-time precache of the SPA shell. Navigations and HTML are
//      always network-first; only the network can introduce a new bundle hash
//      reference, so deploys are immediately visible on next navigation.
//   2. Cache-first ONLY for hashed /assets/*.<hash>.<ext> files. Those are
//      immutable per build, so the filename change naturally evicts stale.
//   3. skipWaiting + clients.claim + SKIP_WAITING message channel so a new SW
//      takes over without the user having to close every tab.
//   4. CACHE_VERSION bump to v4 — activate handler deletes every v3-named
//      cache, completing the kill-switch flush for any client still on v3.
const CACHE_VERSION = 'v11'
const STATIC_CACHE = `sm-static-${CACHE_VERSION}`
const API_CACHE = `sm-api-${CACHE_VERSION}`
const DECISIONS_CACHE = `sm-decisions-${CACHE_VERSION}`

const KNOWN_CACHES = [STATIC_CACHE, API_CACHE, DECISIONS_CACHE]

// Hashed Vite outputs only — e.g. /assets/main-DdEgwN-g.js. Unhashed top-level
// paths (favicon, logo, manifest, /index.html, /sw.js) are deliberately never
// SW-cached so they always re-validate against the network/HTTP cache.
const HASHED_ASSET = /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (
    url.pathname.startsWith('/api/') &&
    (url.pathname.includes('/court-decisions') || url.pathname.includes('/bankruptcy-decisions'))
  ) {
    event.respondWith(networkFirst(request, DECISIONS_CACHE))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  if (HASHED_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Everything else (HTML, /index.html, /sw.js, /manifest.json, top-level
  // favicons and unhashed media): straight through. Browser HTTP cache still
  // applies — that's nginx's job, not ours.
})

self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncPending('bookmarks', '/api/v1/bookmarks'))
  }
  if (event.tag === 'sync-annotations') {
    event.waitUntil(syncPending('annotations', '/api/v1/annotations'))
  }
}) as EventListener)

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
      if (res.ok) await idbDelete(db, store, record.id)
    } catch {
      break
    }
  }
}
