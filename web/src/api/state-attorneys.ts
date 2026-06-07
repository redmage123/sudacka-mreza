import { z } from 'zod'
import { apiFetch } from './client'
import { PayloadListSchema, type PayloadList } from './types'

const IdSchema = z.union([z.string(), z.number()]).transform(String)

export const StateAttorneySchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  slug: z.string().optional(),
})
export type StateAttorney = z.infer<typeof StateAttorneySchema>

export interface GetStateAttorneysParams {
  q?: string
  type?: string
  page?: number
  locale?: string
}

export async function getStateAttorneys(
  params: GetStateAttorneysParams = {},
): Promise<PayloadList<StateAttorney>> {
    if (params.q !== undefined && params.q !== '') {
    const SearchListSchema = z.object({ docs: z.array(z.any()), totalDocs: z.number() })
    const r = await apiFetch('/entity/hybrid-search', SearchListSchema, {
      params: { type: 'state-attorneys', q: params.q, limit: 50, locale: params.locale ?? 'hr' },
    })
    return { docs: r.docs as StateAttorney[], totalDocs: r.totalDocs, limit: 50, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }
  }

  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: 20,
    locale: params.locale ?? 'hr',
  }

  if (params.q !== undefined && params.q !== '') {
    queryParams['where[name][like]'] = params.q
  }
  if (params.type !== undefined && params.type !== '') {
    queryParams['where[type][equals]'] = params.type
  }
  if (params.page !== undefined) {
    queryParams['page'] = params.page
  }

  return apiFetch('/state-attorneys', PayloadListSchema(StateAttorneySchema), { params: queryParams })
}
