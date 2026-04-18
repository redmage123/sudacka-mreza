import { useRouteError, isRouteErrorResponse, Link } from 'react-router'

export default function RouterErrorPage() {
  const error = useRouteError()

  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  const title = isNotFound ? 'Page not found' : 'Something went wrong'
  const message = isNotFound
    ? 'The page you were looking for does not exist.'
    : 'An unexpected error occurred. Please try reloading the page.'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center bg-[color:var(--color-bg)]">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">{title}</h1>
      <p className="text-[color:var(--color-text-muted)] max-w-sm">{message}</p>
      <div className="flex gap-3">
        <Link
          to="/hr"
          className="px-4 py-2 text-sm font-medium bg-[color:var(--color-brand-navy)] text-white rounded hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium border border-[color:var(--color-border)] text-[color:var(--color-text)] rounded hover:bg-[color:var(--color-surface-subtle)] transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
