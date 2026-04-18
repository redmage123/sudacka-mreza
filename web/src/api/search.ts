import { z } from 'zod'
import { apiFetch } from './client'

export interface GlobalSearchResult {
  decisions: Array<{ id: string; title: string; court: string }>
  experts: Array<{ id: string; name: string; speciality_areas: string[] }>
  courts: Array<{ id: string; name: string; type: string }>
  news: Array<{ id: string; title: string; slug: string }>
}

const GlobalSearchResultSchema = z.object({
  decisions: z.array(z.object({ id: z.string(), title: z.string(), court: z.string() })),
  experts: z.array(
    z.object({ id: z.string(), name: z.string(), speciality_areas: z.array(z.string()) }),
  ),
  courts: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
  news: z.array(z.object({ id: z.string(), title: z.string(), slug: z.string() })),
})

export async function globalSearch(
  query: string,
  locale?: string,
): Promise<GlobalSearchResult> {
  if (query === '') {
    return { decisions: [], experts: [], courts: [], news: [] }
  }

  return apiFetch('/search', GlobalSearchResultSchema, {
    params: {
      q: query,
      locale: locale ?? 'hr',
      limit: 5,
    },
  })
}
