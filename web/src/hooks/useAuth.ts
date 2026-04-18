import { useEffect, useState } from 'react'
import { AUTH_TOKEN_KEY, getAuthToken } from '@/api/client'
import { fetchMe, type AuthUser } from '@/api/auth'

export interface AuthState {
  user: AuthUser | null
  loading: boolean
}

// Minimal auth hook — no context provider needed. Each caller gets its own
// subscription and syncs on storage events so login/logout in another tab
// propagates here, and same-tab flows that call setAuthToken notify too.
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
      const me = await fetchMe()
      if (alive) { setUser(me); setLoading(false) }
    }

    load()

    function onStorage(e: StorageEvent) {
      if (e.key === AUTH_TOKEN_KEY) {
        setLoading(true)
        load()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      alive = false
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return { user, loading }
}
