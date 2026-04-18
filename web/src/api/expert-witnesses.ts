import { apiFetch } from './client'
import { ExpertWitnessSchema, PayloadListSchema, type ExpertWitness, type PayloadList } from './types'

export interface GetExpertWitnessesParams {
  q?: string
  speciality?: string
  county?: string
  page?: number
  locale?: string
  limit?: number
}

export async function getExpertWitnesses(
  params: GetExpertWitnessesParams = {},
): Promise<PayloadList<ExpertWitness>> {
  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: params.limit ?? 20,
    locale: params.locale ?? 'hr',
  }

  if (params.q !== undefined && params.q !== '') {
    queryParams['where[name][like]'] = params.q
  }
  if (params.speciality !== undefined && params.speciality !== '') {
    queryParams['where[specialityAreas.area][equals]'] = params.speciality
  }
  if (params.county !== undefined && params.county !== '') {
    queryParams['where[county][equals]'] = params.county
  }
  if (params.page !== undefined) {
    queryParams['page'] = params.page
  }

  return apiFetch('/expert-witnesses', PayloadListSchema(ExpertWitnessSchema), {
    params: queryParams,
  })
}

export async function getExpertWitnessById(id: string, locale = 'hr'): Promise<ExpertWitness> {
  return apiFetch(`/expert-witnesses/${id}`, ExpertWitnessSchema, {
    params: { locale },
  })
}
