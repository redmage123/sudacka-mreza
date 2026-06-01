import { apiFetch } from './client'
import { InterpreterSchema, PayloadListSchema, type Interpreter, type PayloadList } from './types'

export interface GetInterpretersParams {
  company?: string
  q?: string
  languagePair?: string
  language2?: string
  county?: string
  city?: string
  hasCv?: boolean
  hasWorks?: boolean
  page?: number
  locale?: string
  limit?: number
}

export async function getInterpreters(
  params: GetInterpretersParams = {},
): Promise<PayloadList<Interpreter>> {
  const queryParams: Record<string, string | number | undefined> = {
    sort: 'name',
    limit: params.limit ?? 20,
    locale: params.locale ?? 'hr',
  }

  if (params.q !== undefined && params.q !== '') {
    // SM-REDESIGN §3.3.2 — keyword matches name / company / address
    queryParams['where[or][0][name][like]'] = params.q
    queryParams['where[or][1][company][like]'] = params.q
    queryParams['where[or][2][address][like]'] = params.q
  }
  // languagePair is an exact pair (e.g. 'hr-de'); language2 is a "must also
  // include this language in some pair" filter. They combine with AND so the
  // interpreter must satisfy both.
  if (params.languagePair !== undefined && params.languagePair !== '') {
    queryParams['where[and][0][languagePairs.pair][equals]'] = params.languagePair
  }
  if (params.language2 !== undefined && params.language2 !== '') {
    queryParams['where[and][1][languagePairs.pair][like]'] = params.language2
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

  return apiFetch('/interpreters', PayloadListSchema(InterpreterSchema), {
    params: queryParams,
  })
}

export async function getInterpreterById(id: string, locale = 'hr'): Promise<Interpreter> {
  return apiFetch(`/interpreters/${id}`, InterpreterSchema, {
    params: { locale },
  })
}
