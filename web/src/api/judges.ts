import { z } from 'zod'
import { apiFetch } from './client'
import { PayloadListSchema, type PayloadList } from './types'

const IdSchema = z.union([z.string(), z.number()]).transform(String)

export const JudgeSchema = z.object({
  id: IdSchema,
  name: z.string(),
  court: z
    .union([
      z.null(),
      z.object({
        id: IdSchema,
        name: z.string(),
        type: z.string().optional(),
        city: z.string().nullable().optional(),
        county: z.string().nullable().optional(),
      }).passthrough(),
    ])
    .nullable()
    .optional(),
  appointmentDate: z.string().nullable().optional(),
  specialization: z.string().nullable().optional(),
  status: z.string().optional(),
  email: z.string().nullable().optional(),
  slug: z.string().optional(),
})
export type Judge = z.infer<typeof JudgeSchema>

export interface GetJudgesParams {
  q?: string
  court?: string
  page?: number
  locale?: string
}

export async function getJudgeById(id: string, locale = 'hr'): Promise<Judge> {
  return apiFetch(`/judges/${id}`, JudgeSchema, { params: { locale } })
}

export async function getJudges(
  params: GetJudgesParams = {},
): Promise<PayloadList<Judge>> {
  // Hybrid (semantic + keyword) when a query is set.
  if (params.q !== undefined && params.q !== '') {
    const SearchListSchema = z.object({ docs: z.array(z.any()), totalDocs: z.number() })
    const r = await apiFetch('/entity/hybrid-search', SearchListSchema, {
      params: { type: 'judges', q: params.q, limit: 50, locale: params.locale ?? 'hr' },
    })
    return { docs: r.docs as Judge[], totalDocs: r.totalDocs, limit: 50, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }
  }

  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: 20,
    locale: params.locale ?? 'hr',
  }

  if (params.q !== undefined && params.q !== '') {
    queryParams['where[name][like]'] = params.q
  }
  if (params.court !== undefined && params.court !== '') {
    queryParams['where[court.name][equals]'] = params.court
  }
  if (params.page !== undefined) {
    queryParams['page'] = params.page
  }

  return apiFetch('/judges', PayloadListSchema(JudgeSchema), { params: queryParams })
}
