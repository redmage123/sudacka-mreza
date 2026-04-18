import type { CollectionAfterChangeHook } from 'payload'
import { lexicalToText } from '../utils/lexicalToText.js'

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
  const plainText = lexicalToText(doc.fullText)

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
