import type { CollectionAfterChangeHook } from 'payload'

/** Recursively walk a Lexical JSON tree and collect all text nodes */
function extractPlainText(lexicalJson: unknown): string {
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

export const generateSearchIndex: CollectionAfterChangeHook = async ({
  doc,
  req,
  collection,
}) => {
  const parts: string[] = []

  if (doc.title) parts.push(doc.title)
  if (doc.caseNumber) parts.push(doc.caseNumber)
  if (doc.summary) parts.push(doc.summary)
  if (doc.category) parts.push(doc.category)

  if (doc.tags && Array.isArray(doc.tags)) {
    for (const tag of doc.tags) {
      if (typeof tag === 'string') {
        parts.push(tag)
      } else if (tag?.tag) {
        parts.push(tag.tag)
      }
    }
  }

  const searchVector = parts.join(' ').toLowerCase()
  const plainText = extractPlainText(doc.fullText)

  const updates: Record<string, string> = {}

  if (searchVector !== doc.searchVector) {
    updates.searchVector = searchVector
  }
  if (plainText !== doc.fullTextPlain) {
    updates.fullTextPlain = plainText
  }

  if (Object.keys(updates).length > 0) {
    await req.payload.update({
      collection: collection.slug as 'court-decisions',
      id: doc.id,
      data: updates,
      depth: 0,
    })
  }

  return doc
}
