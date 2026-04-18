import { apiFetch } from './client'
import { NewsPostSummarySchema, PayloadListSchema, type NewsPostSummary, type PayloadList } from './types'

export interface GetNewsPostsParams {
  limit?: number
  page?: number
  locale?: string
}

export async function getNewsPosts(
  params: GetNewsPostsParams = {},
): Promise<PayloadList<NewsPostSummary>> {
  return apiFetch('/news-posts', PayloadListSchema(NewsPostSummarySchema), {
    params: {
      sort: '-published_at',
      limit: params.limit ?? 5,
      locale: params.locale ?? 'hr',
      ...(params.page !== undefined ? { page: params.page } : {}),
    },
  })
}
