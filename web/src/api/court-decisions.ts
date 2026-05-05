import { apiFetch } from './client'
import {
  CourtDecisionSummarySchema,
  CourtSchema,
  PayloadListSchema,
  type CourtDecisionSummary,
  type PayloadList,
} from './types'

export interface SearchDecisionsParams {
  q?: string
  court?: string
  from?: string
  to?: string
  type?: string
  page?: number
  locale?: string
}

export async function searchDecisions(
  params: SearchDecisionsParams,
): Promise<PayloadList<CourtDecisionSummary>> {
  const page = params.page ?? 1
  const limit = 20

  // Use the hybrid search endpoint which combines PostgreSQL FTS with RAG
  // semantic search (pgvector cosine similarity via the local RAG API).
  // Supports natural-language queries like "slučajevi o imovinskim sporovima".
  const queryParams: Record<string, string | number | undefined> = {
    limit,
    page,
  }

  if (params.q !== undefined && params.q.trim() !== '') {
    queryParams['q'] = params.q.trim()
  }
  if (params.court !== undefined && params.court !== '') {
    queryParams['court'] = params.court
  }
  if (params.from !== undefined && params.from !== '') {
    queryParams['from'] = params.from
  }
  if (params.to !== undefined && params.to !== '') {
    queryParams['to'] = params.to
  }
  if (params.type !== undefined && params.type !== '') {
    queryParams['decisionType'] = params.type
  }
  if (params.locale !== undefined && params.locale !== '') {
    // Backend translates title + excerpt of the page slice when lang ≠ hr.
    queryParams['lang'] = params.locale
  }

  return apiFetch('/decisions/hybrid-search', PayloadListSchema(CourtDecisionSummarySchema), {
    params: queryParams,
  })
}

export interface CourtFilterOption {
  id: string
  name: string
  type?: string
}

export async function getCourts_forFilter(locale?: string): Promise<CourtFilterOption[]> {
  const result = await apiFetch('/courts', PayloadListSchema(CourtSchema), {
    params: {
      limit: 1000,
      locale: locale ?? 'hr',
      sort: 'name',
    },
  })
  const seen = new Map<string, CourtFilterOption>()
  for (const c of result.docs) {
    if (!c.name || c.id == null) continue
    if (!seen.has(c.name)) seen.set(c.name, { id: c.id, name: c.name, type: c.type })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}
