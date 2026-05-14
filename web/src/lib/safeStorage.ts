/**
 * Crash-proof wrappers around localStorage / sessionStorage.
 *
 * Web Storage access can THROW (not just return null) in common situations:
 *   - Safari "Private Browsing" — setItem throws QuotaExceededError
 *   - iOS / mobile browsers with "Block all cookies" or low free storage
 *   - Browser "block site data" privacy settings
 *   - Quota exceeded
 *
 * An unguarded `localStorage.setItem(...)` in a render path or a top-level
 * hook effect therefore takes down the whole React tree (the error bubbles
 * to the router's error boundary and the user sees a dead page). This module
 * centralises the try/catch so no call site can reintroduce that crash.
 *
 * All methods are no-throw: reads return null on failure, writes are
 * best-effort. Callers that need persistence guarantees must keep their own
 * in-memory fallback (see api/client.ts for the auth token).
 */

type StorageKind = 'local' | 'session'

function backing(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    // Accessing the property itself can throw when storage is disabled.
    return null
  }
}

function makeSafeStorage(kind: StorageKind) {
  return {
    getItem(key: string): string | null {
      try {
        return backing(kind)?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    setItem(key: string, value: string): boolean {
      try {
        backing(kind)?.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
    removeItem(key: string): void {
      try {
        backing(kind)?.removeItem(key)
      } catch {
        // ignore — nothing we can do, and it must not throw
      }
    },
  }
}

export const safeLocalStorage = makeSafeStorage('local')
export const safeSessionStorage = makeSafeStorage('session')
