import { useEffect, useState } from 'react'
import { AUTH_TOKEN_EVENT, AUTH_TOKEN_KEY, getAuthToken } from '@/api/client'
import { fetchMe, type AuthUser } from '@/api/auth'

export interface AuthState {
  user: AuthUser | null
  loading: boolean
}

// Subscribes to two channels:
//   1. AUTH_TOKEN_EVENT — fires synchronously in the same tab when login,
//      register, or logout calls setAuthToken. This is what fixes the
//      "login requires page refresh" bug: post-login navigate() lands on a
//      protected route, the new useAuth instance there sees the token at
//      mount and fetchMe fills `user`. The event also re-loads existing
//      mounted hooks so AppShell-level guards update without a refresh.
//   2. native storage event — login/logout in another tab propagates here.
export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(() => getAuthToken() != null)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!getAuthToken()) {
        if (alive) { setUser(null); setLoading(false) }
        return
      }
      if (alive) setLoading(true)
      const me = await fetchMe()
      if (alive) { setUser(me); setLoading(false) }
    }

    load()

    function onStorage(e: StorageEvent) {
      if (e.key === AUTH_TOKEN_KEY) load()
    }
    function onAuthEvent() {
      load()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(AUTH_TOKEN_EVENT, onAuthEvent)
    return () => {
      alive = false
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(AUTH_TOKEN_EVENT, onAuthEvent)
    }
  }, [])

  return { user, loading }
}
