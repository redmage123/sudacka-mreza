import { apiFetch } from './client'
import { InterpreterSchema, PayloadListSchema, type Interpreter, type PayloadList } from './types'

export interface GetInterpretersParams {
  q?: string
  languagePair?: string
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
    queryParams['where[_search][like]'] = params.q
  }
  if (params.languagePair !== undefined && params.languagePair !== '') {
    queryParams['where[languagePairs.pair][equals]'] = params.languagePair
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
