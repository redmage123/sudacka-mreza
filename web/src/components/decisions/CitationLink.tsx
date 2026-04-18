import { useState, useRef } from 'react'
import { Link } from 'react-router'

interface Props {
  /** The raw citation string, e.g. "Gž-456/2023" */
  caseNumber: string
  /** Payload document ID of the referenced decision */
  decisionId: string
  locale?: string
}

interface DecisionPreview {
  title: string
  court: string
  date: string
  caseNumber: string
}

/**
 * Renders a legal citation as a hyperlink to the referenced court decision.
 * On hover, fetches and displays a tooltip preview (title, court, date).
 */
export function CitationLink({ caseNumber, decisionId, locale = 'hr' }: Props) {
  const [preview, setPreview] = useState<DecisionPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const fetchedRef = useRef(false)

  const handleMouseEnter = async () => {
    setVisible(true)
    if (fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    try {
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4094/api'
      const res = await fetch(
        `${base}/court-decisions/${decisionId}?depth=1&locale=${locale}`,
      )
      if (res.ok) {
        const data = await res.json()
        setPreview({
          title: data.title ?? '',
          court:
            typeof data.court === 'object' && data.court !== null
              ? (data.court as { name: string }).name
              : String(data.court ?? ''),
          date: data.date ?? '',
          caseNumber: data.caseNumber ?? caseNumber,
        })
      }
    } catch {
      // tooltip stays empty — link is still functional
    } finally {
      setLoading(false)
    }
  }

  const handleMouseLeave = () => setVisible(false)

  return (
    <span className="relative inline-block">
      <Link
        to={`/${locale}/sudska-praksa/${decisionId}`}
        className="font-mono text-sm text-blue-600 underline decoration-dotted hover:text-blue-800"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {caseNumber}
      </Link>

      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          {loading ? (
            <p className="text-xs text-gray-400">Učitavanje…</p>
          ) : preview ? (
            <>
              <p className="mb-1 line-clamp-2 text-xs font-semibold text-gray-800">
                {preview.title}
              </p>
              <p className="text-xs text-gray-500">{preview.court}</p>
              {preview.date && (
                <p className="text-xs text-gray-400">
                  {new Date(preview.date).toLocaleDateString('hr-HR')}
                </p>
              )}
              <p className="mt-1 font-mono text-xs text-blue-500">{preview.caseNumber}</p>
            </>
          ) : (
            <p className="text-xs text-gray-400">Odluka nije pronađena</p>
          )}
          {/* Tooltip arrow */}
          <span className="absolute left-4 top-full -mt-px border-4 border-transparent border-t-white" />
        </div>
      )}
    </span>
  )
}
