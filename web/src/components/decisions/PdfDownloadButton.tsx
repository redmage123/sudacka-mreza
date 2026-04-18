import { useState } from 'react'
import { Download } from 'lucide-react'

interface Props {
  decisionId: string
  caseNumber?: string
}

/**
 * Downloads the court decision as a formatted PDF via the CMS PDF export endpoint.
 * GET /api/decisions/:id/pdf
 */
export function PdfDownloadButton({ decisionId, caseNumber }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)

    try {
      const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:4094/api').replace(/\/$/, '')
      const res = await fetch(`${base}/decisions/${decisionId}/pdf`)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = caseNumber
        ? `odluka-${caseNumber.replace(/[^a-zA-Z0-9\-_]/g, '-')}.pdf`
        : `odluka-${decisionId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Preuzimanje nije uspjelo. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        aria-label="Preuzmi odluku kao PDF"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Generiranje…' : 'Preuzmi PDF'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
