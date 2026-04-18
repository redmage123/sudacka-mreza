/** Recursively walk a Lexical JSON tree and collect all text nodes into a plain string. */
export function lexicalToText(lexicalJson: unknown): string {
  if (!lexicalJson || typeof lexicalJson !== 'object') return ''
  const parts: string[] = []

  function walk(node: Record<string, unknown>): void {
    if (typeof node.text === 'string' && node.text.trim()) {
      parts.push(node.text)
    }
    if (Array.isArray(node.children)) {
      ;(node.children as Record<string, unknown>[]).forEach(walk)
    }
  }

  const root = (lexicalJson as Record<string, unknown>).root
  if (root && typeof root === 'object') {
    walk(root as Record<string, unknown>)
  }
  return parts.join(' ')
}
