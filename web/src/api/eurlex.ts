import { z } from 'zod'
import { apiFetch } from './client'

export const EurLexHitSchema = z.object({
  celex: z.string(),
  lang: z.string(),
  scope: z.string(),
  date: z.string().nullable(),
  title: z.string().nullable(),
  snippet: z.string(),
  score: z.number(),
  chunkIdx: z.number(),
  url: z.string(),
})
export type EurLexHit = z.infer<typeof EurLexHitSchema>

export const EurLexSearchResponseSchema = z.object({
  docs: z.array(EurLexHitSchema),
  total: z.number(),
  query: z.string(),
  scope: z.string(),
  lang: z.string().nullable(),
})
export type EurLexSearchResponse = z.infer<typeof EurLexSearchResponseSchema>

export interface EurLexSearchParams {
  q: string
  lang?: string
  scope?: 'caselaw' | 'legislation' | 'any'
  limit?: number
}

export async function eurlexSearch(p: EurLexSearchParams): Promise<EurLexSearchResponse> {
  return apiFetch('/eurlex-search', EurLexSearchResponseSchema, {
    params: {
      q: p.q,
      lang: p.lang,
      scope: p.scope ?? 'any',
      limit: p.limit ?? 10,
    },
  })
}
