import { apiFetch } from './client'
import { ExpertWitnessSchema, PayloadListSchema, type ExpertWitness, type PayloadList } from './types'

export interface GetExpertWitnessesParams {
  company?: string
  q?: string
  speciality?: string
  subSpeciality?: string
  county?: string
  city?: string
  hasCv?: boolean
  hasWorks?: boolean
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
    // Match the SM-REDESIGN expert search "name / company / address" — OR
    // across all three text columns.
    queryParams['where[or][0][name][like]'] = params.q
    queryParams['where[or][1][company][like]'] = params.q
    queryParams['where[or][2][address][like]'] = params.q
  }
  if (params.speciality !== undefined && params.speciality !== '') {
    queryParams['where[specialityAreas.area][equals]'] = params.speciality
  }
  if (params.subSpeciality !== undefined && params.subSpeciality !== '') {
    queryParams['where[specialityAreas.subArea][like]'] = params.subSpeciality
  }
  if (params.county !== undefined && params.county !== '') {
    queryParams['where[county][equals]'] = params.county
  }
  if (params.city !== undefined && params.city !== '') {
    queryParams['where[city][like]'] = params.city
  }
  if (params.hasCv) {
    queryParams['where[cv][exists]'] = 'true'
  }
  if (params.hasWorks) {
    queryParams['where[works][exists]'] = 'true'
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
