import { apiFetch } from './client'
import { CourtSchema, PayloadListSchema, type Court, type PayloadList } from './types'

// Actual enum values from cms/src/collections/Courts.ts (verified G-09)
export type CourtType =
  | 'municipal'
  | 'county'
  | 'commercial'
  | 'misdemeanour'
  | 'high_commercial'
  | 'supreme'
  | 'administrative'
  | 'constitutional'
  | 'echr'

export interface GetCourtsParams {
  type?: CourtType
  q?: string
  page?: number
  locale?: string
}

export async function getCourts(params: GetCourtsParams = {}): Promise<PayloadList<Court>> {
  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: 20,
    locale: params.locale ?? 'hr',
  }

  if (params.type !== undefined) {
    queryParams['where[type][equals]'] = params.type
  }
  if (params.q) {
    // OR across name and address — matches the SM-REDESIGN search bar §3.4.2
    // ("Naziv / adresa suda").
    queryParams['where[or][0][name][like]'] = params.q
    queryParams['where[or][1][address][like]'] = params.q
  }
  if (params.page !== undefined) {
    queryParams['page'] = params.page
  }

  return apiFetch('/courts', PayloadListSchema(CourtSchema), { params: queryParams })
}

export async function getCourt(id: string, locale?: string): Promise<Court> {
  return apiFetch(`/courts/${id}`, CourtSchema, {
    params: { locale: locale ?? 'hr' },
  })
}
