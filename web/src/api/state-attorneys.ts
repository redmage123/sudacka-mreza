import { z } from 'zod'
import { apiFetch } from './client'
import { PayloadListSchema, type PayloadList } from './types'

const IdSchema = z.union([z.string(), z.number()]).transform(String)

export const StateAttorneySchema = z.object({
  id: IdSchema,
  name: z.string(),
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
  page?: number
  locale?: string
}

export async function getStateAttorneys(
  params: GetStateAttorneysParams = {},
): Promise<PayloadList<StateAttorney>> {
  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: 20,
    locale: params.locale ?? 'hr',
  }

  if (params.q !== undefined && params.q !== '') {
    queryParams['where[name][like]'] = params.q
  }
  if (params.page !== undefined) {
    queryParams['page'] = params.page
  }

  return apiFetch('/state-attorneys', PayloadListSchema(StateAttorneySchema), { params: queryParams })
}
