import { useState } from 'react'

// Minimal markdown-aware textarea with live preview.
// No third-party dep; the preview uses a simple allow-list HTML transform.
// Good enough for news-post bodies; not a full WYSIWYG.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function mdToHtml(md: string): string {
  // Escape first, then apply a small set of whitelisted transforms.
  let s = escapeHtml(md)
  // Headings
  s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
  // Bold and italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|\W)\*([^\s][^*]*?)\*(?=\W|$)/g, '$1<em>$2</em>')
  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // Bullet lists (simple, per line)
  s = s.replace(/(^|\n)-\s+(.+)(?=\n|$)/g, '$1<li>$2</li>')
  s = s.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
  // Paragraphs from blank-line separated blocks
  s = s
    .split(/\n{2,}/)
    .map((block) => (/^<(h\d|ul|ol|li|blockquote)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`))
    .join('\n')
  return s
}

export default function MarkdownEditor({
  value,
  onChange,
  rows = 12,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  disabled?: boolean
}) {
  const [preview, setPreview] = useState(false)
  return (
    <div>
      <div className="mb-2 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`rounded px-2 py-1 ${!preview ? 'bg-[color:var(--color-brand)] text-white' : 'bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)]'}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`rounded px-2 py-1 ${preview ? 'bg-[color:var(--color-brand)] text-white' : 'bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)]'}`}
        >
          Preview
        </button>
        <span className="self-center text-[color:var(--color-text-muted)]">
          Markdown: **bold**, *italic*, # heading, - list, [text](url)
        </span>
      </div>
      {preview ? (
        <div
          className="prose dark:prose-invert max-w-none min-h-[200px] rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) }}
        />
      ) : (
        <textarea
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-mono"
        />
      )}
    </div>
  )
}

export { mdToHtml }
