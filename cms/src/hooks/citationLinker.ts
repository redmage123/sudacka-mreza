import type { CollectionAfterChangeHook } from 'payload'

// Matches Croatian court citation formats:
//   Rev-123/2024   — revision cases (Vrhovni sud)
//   Gž-456/2023    — civil appeals (Županijski sud)
//   Kž-789/2022    — criminal appeals
//   Pž-012/2021    — commercial appeals (Visoki trgovački sud)
//   Us-I-345/2020  — administrative (Visoki upravni sud)
//   U-III-678/2019 — constitutional (Ustavni sud)
const CITATION_REGEX_SOURCE = '(Rev|G\u017e|K\u017e|P\u017e|Us-I|U-III)-\\d+\\/\\d{4}'

function extractCitations(text: string): string[] {
  const regex = new RegExp(CITATION_REGEX_SOURCE, 'g')
  const found = new Set<string>()
  for (const match of text.matchAll(regex)) {
    found.add(match[0])
  }
  return Array.from(found)
}

function toIdArray(field: unknown): string[] {
  if (!Array.isArray(field)) return []
  return field.map((item) =>
    typeof item === 'string' ? item : (item as { id: string }).id,
  )
}

export const citationLinker: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  // Prevent recursive updates triggered by this hook itself
  if (context.skipCitationLinker) return doc

  // Scan fullTextPlain and summary for citation patterns
  const text = [
    typeof doc.fullTextPlain === 'string' ? doc.fullTextPlain : '',
    typeof doc.summary === 'string' ? doc.summary : '',
  ].join(' ')

  const citationStrings = extractCitations(text)

  // Resolve citation strings to document IDs via caseNumber lookup
  let citedIds: string[] = []
  if (citationStrings.length > 0) {
    const results = await req.payload.find({
      collection: 'court-decisions',
      where: { caseNumber: { in: citationStrings } },
      limit: 200,
      depth: 0,
      context: { skipCitationLinker: true },
    })
    citedIds = results.docs
      .map((d) => String(d.id))
      .filter((id) => id !== String(doc.id)) // no self-references
  }

  // Diff against previous state to determine added / removed citations
  const prevCitedIds = toIdArray(previousDoc?.cited_decisions)
  const added = citedIds.filter((id) => !prevCitedIds.includes(id))
  const removed = prevCitedIds.filter((id) => !citedIds.includes(id))

  const hasChanged =
    added.length > 0 || removed.length > 0 || citedIds.length !== prevCitedIds.length

  // Persist forward links on the current document
  if (hasChanged) {
    await req.payload.update({
      collection: 'court-decisions',
      id: doc.id,
      data: { cited_decisions: citedIds.map(Number) } as any,
      context: { skipCitationLinker: true },
    })
  }

  // Add reverse link (cited_by) on newly cited decisions
  for (const citedId of added) {
    const citedDoc = await req.payload.findByID({
      collection: 'court-decisions',
      id: Number(citedId),
      depth: 0,
      context: { skipCitationLinker: true },
    })
    if (!citedDoc) continue

    const existing = toIdArray((citedDoc as any).cited_by)
    const docId = String(doc.id)
    if (!existing.includes(docId)) {
      await req.payload.update({
        collection: 'court-decisions',
        id: Number(citedId),
        data: { cited_by: [...existing, docId].map(Number) } as any,
        context: { skipCitationLinker: true },
      })
    }
  }

  // Remove reverse link (cited_by) from decisions no longer cited
  for (const removedId of removed) {
    const removedDoc = await req.payload.findByID({
      collection: 'court-decisions',
      id: Number(removedId),
      depth: 0,
      context: { skipCitationLinker: true },
    })
    if (!removedDoc) continue

    const docId = String(doc.id)
    const newCitedBy = toIdArray((removedDoc as any).cited_by).filter((id) => id !== docId)
    await req.payload.update({
      collection: 'court-decisions',
      id: Number(removedId),
      data: { cited_by: newCitedBy.map(Number) } as any,
      context: { skipCitationLinker: true },
    })
  }

  return doc
}
