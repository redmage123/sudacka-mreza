import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Annotation } from '@/api/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

interface Props {
  /** Plain text of the decision used for offset calculation and rendering */
  text: string
  decisionId: string
  annotations: Annotation[]
  onAnnotationCreate: (annotation: Annotation) => void
  onAnnotationDelete: (id: string) => void
}

interface PendingSelection {
  start: number
  end: number
  excerpt: string
}

// ─── Color palette ───────────────────────────────────────────────────────────

const COLOR_BG: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-200 dark:bg-yellow-600/40',
  green:  'bg-green-200 dark:bg-green-600/40',
  blue:   'bg-blue-200 dark:bg-blue-600/40',
  pink:   'bg-pink-200 dark:bg-pink-600/40',
}

const COLORS: Array<{ value: HighlightColor; label: string; swatch: string }> = [
  { value: 'yellow', label: 'Žuta',  swatch: 'bg-yellow-300' },
  { value: 'green',  label: 'Zelena', swatch: 'bg-green-300' },
  { value: 'blue',   label: 'Plava',  swatch: 'bg-blue-300' },
  { value: 'pink',   label: 'Roza',   swatch: 'bg-pink-300' },
]

// ─── Offset helpers ───────────────────────────────────────────────────────────

/**
 * Walk all text nodes inside `root` and return the cumulative char offset
 * of (node, nodeOffset) relative to `root`.
 */
function charOffsetInRoot(root: HTMLElement, node: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let current: Node | null = walker.nextNode()
  while (current) {
    if (current === node) {
      return total + nodeOffset
    }
    total += (current.textContent ?? '').length
    current = walker.nextNode()
  }
  // Fallback: node not found inside root — return nodeOffset as-is
  return nodeOffset
}

// ─── Text rendering with highlights ──────────────────────────────────────────

type Segment =
  | { type: 'text'; content: string }
  | { type: 'highlight'; content: string; annotation: Annotation }

function buildSegments(text: string, annotations: Annotation[]): Segment[] {
  // Sort by start; skip overlapping (keep earlier one)
  const sorted = [...annotations]
    .sort((a, b) => a.text_selection.start - b.text_selection.start)
    .filter((ann) => ann.text_selection.start < ann.text_selection.end)

  const segments: Segment[] = []
  let pos = 0

  for (const ann of sorted) {
    const { start, end } = ann.text_selection
    if (start < pos) continue // overlapping — skip
    if (start > pos) {
      segments.push({ type: 'text', content: text.slice(pos, start) })
    }
    segments.push({
      type: 'highlight',
      content: text.slice(start, Math.min(end, text.length)),
      annotation: ann,
    })
    pos = Math.min(end, text.length)
  }

  if (pos < text.length) {
    segments.push({ type: 'text', content: text.slice(pos) })
  }

  return segments
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnnotationLayer({
  text,
  decisionId,
  annotations,
  onAnnotationCreate,
  onAnnotationDelete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [color, setColor] = useState<HighlightColor>('yellow')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)

  // ── Detect text selection ─────────────────────────────────────────────────

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !containerRef.current) return

    const range = selection.getRangeAt(0)

    // Ensure selection is inside our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) return

    const start = charOffsetInRoot(
      containerRef.current,
      range.startContainer,
      range.startOffset,
    )
    const end = charOffsetInRoot(
      containerRef.current,
      range.endContainer,
      range.endOffset,
    )

    if (end <= start) return

    const excerpt = text.slice(start, end)
    setPending({ start, end, excerpt })
    setColor('yellow')
    setNote('')

    // Clear browser selection so it doesn't interfere with the modal
    selection.removeAllRanges()
  }, [text])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('mouseup', handleMouseUp)
    return () => el.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  // ── Save new annotation ───────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!pending) return
    setSaving(true)
    try {
      const { createAnnotation } = await import('@/api/annotations')
      const created = await createAnnotation({
        decision: decisionId,
        text_selection: { start: pending.start, end: pending.end },
        highlight_color: color,
        note: note.trim() || undefined,
      })
      onAnnotationCreate(created)
      setPending(null)
    } finally {
      setSaving(false)
    }
  }, [pending, decisionId, color, note, onAnnotationCreate])

  // ── Delete annotation ─────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    const { deleteAnnotation } = await import('@/api/annotations')
    await deleteAnnotation(id)
    onAnnotationDelete(id)
    setActiveAnnotation(null)
  }, [onAnnotationDelete])

  // ── Render ────────────────────────────────────────────────────────────────

  const segments = buildSegments(text, annotations)

  return (
    <>
      {/* Decision text with inline highlights */}
      <div
        ref={containerRef}
        className="relative leading-relaxed text-[color:var(--color-text)] whitespace-pre-wrap select-text"
        aria-label="Tekst odluke s bilješkama"
      >
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <span key={i}>{seg.content}</span>
          }
          const ann = seg.annotation
          const bgClass = COLOR_BG[ann.highlight_color] ?? COLOR_BG.yellow
          return (
            <mark
              key={ann.id}
              className={`${bgClass} cursor-pointer rounded-sm px-0.5 transition-opacity hover:opacity-80`}
              title={ann.note ?? 'Kliknite za detalje'}
              onClick={() => setActiveAnnotation(ann)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActiveAnnotation(ann)
              }}
              aria-label={ann.note ? `Istaknuto: ${ann.note}` : 'Istaknuto'}
            >
              {seg.content}
            </mark>
          )
        })}
      </div>

      {/* Create annotation modal */}
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Dodaj bilješku"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Odustani
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              Spremi
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            {/* Excerpt preview */}
            <blockquote className="border-l-2 border-[color:var(--color-border)] pl-3 text-sm italic text-[color:var(--color-text-muted)] line-clamp-3">
              „{pending.excerpt}"
            </blockquote>

            {/* Color picker */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[color:var(--color-text)]">
                Boja isticanja
              </legend>
              <div className="flex gap-3" role="group" aria-label="Odabir boje">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-pressed={color === c.value}
                    aria-label={c.label}
                    className={[
                      'h-8 w-8 rounded-full transition-all',
                      c.swatch,
                      color === c.value
                        ? 'ring-2 ring-offset-2 ring-[color:var(--color-brand-navy)] scale-110'
                        : 'hover:scale-105',
                    ].join(' ')}
                  />
                ))}
              </div>
            </fieldset>

            {/* Note textarea */}
            <div>
              <label
                htmlFor="annotation-note"
                className="mb-1 block text-sm font-medium text-[color:var(--color-text)]"
              >
                Bilješka <span className="text-[color:var(--color-text-muted)]">(neobavezno)</span>
              </label>
              <textarea
                id="annotation-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Dodajte komentar uz ovaj odlomak…"
                className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-border-focus)] resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* View / delete annotation modal */}
      <Modal
        open={Boolean(activeAnnotation)}
        onClose={() => setActiveAnnotation(null)}
        title="Bilješka"
        size="sm"
        footer={
          <Button
            variant="danger"
            size="sm"
            onClick={() => activeAnnotation && handleDelete(activeAnnotation.id)}
          >
            Obriši bilješku
          </Button>
        }
      >
        {activeAnnotation && (
          <div className="space-y-3">
            <blockquote className="border-l-2 border-[color:var(--color-border)] pl-3 text-sm italic text-[color:var(--color-text-muted)] line-clamp-4">
              „{text.slice(activeAnnotation.text_selection.start, activeAnnotation.text_selection.end)}"
            </blockquote>
            {activeAnnotation.note ? (
              <p className="text-sm text-[color:var(--color-text)]">{activeAnnotation.note}</p>
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)] italic">Bez bilješke.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
