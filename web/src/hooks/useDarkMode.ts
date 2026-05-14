import { useState, useEffect, useCallback } from 'react'
import { safeLocalStorage } from '@/lib/safeStorage'

type Theme = 'light' | 'dark'

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = safeLocalStorage.getItem('theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    safeLocalStorage.setItem('theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle, isDark: theme === 'dark' }
}
