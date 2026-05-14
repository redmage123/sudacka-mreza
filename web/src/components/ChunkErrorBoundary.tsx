import { Component, type ReactNode } from 'react'
import { safeSessionStorage } from '@/lib/safeStorage'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

function isChunkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.message.includes('Failed to fetch dynamically imported module') ||
    err.message.includes('Importing a module script failed') ||
    err.message.includes('Loading chunk') ||
    err.name === 'ChunkLoadError'
  )
}

/**
 * Catches dynamic-import (chunk load) failures that occur when a new deploy
 * invalidates previously-cached JS chunk hashes.
 *
 * On first catch: forces a full page reload (picks up new index.html + chunks).
 * If the page was just reloaded and the error persists, shows a friendly fallback
 * instead of an infinite reload loop.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (!isChunkError(error)) return

    const RELOAD_KEY = 'chunk_reload_attempted'
    const alreadyTried = safeSessionStorage.getItem(RELOAD_KEY) === '1'

    if (!alreadyTried) {
      safeSessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    // Chunk error but reload already tried (or non-chunk error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4 text-center">
        <p className="text-[color:var(--color-text-muted)] text-sm max-w-sm">
          A new version of this page is available. Please reload to continue.
        </p>
        <button
          type="button"
          onClick={() => {
            safeSessionStorage.removeItem('chunk_reload_attempted')
            window.location.reload()
          }}
          className="px-4 py-2 text-sm font-medium bg-[color:var(--color-brand-navy)] text-white rounded hover:opacity-90 transition-opacity"
        >
          Reload page
        </button>
      </div>
    )
  }
}
