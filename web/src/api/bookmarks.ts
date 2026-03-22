import { apiFetch } from './client'
import {
  BookmarkSchema,
  PayloadDocResponseSchema,
  PayloadListSchema,
  PayloadDeleteResponseSchema,
  type Bookmark,
} from './types'

/** Fetch all bookmarks for the current user, optionally filtered by decision */
export async function getBookmarks(decisionId?: string): Promise<Bookmark[]> {
  const params: Record<string, string | number> = { limit: 200 }
  if (decisionId) {
    params['where[decision][equals]'] = decisionId
  }
  const result = await apiFetch('/bookmarks', PayloadListSchema(BookmarkSchema), { params })
  return result.docs
}

/** Create a bookmark. The user field is auto-populated by the CMS hook. */
export async function createBookmark(decisionId: string, folder = 'Opće'): Promise<Bookmark> {
  const result = await apiFetch(
    '/bookmarks',
    PayloadDocResponseSchema(BookmarkSchema),
    {
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decisionId, folder }),
      },
    },
  )
  return result.doc
}

/** Delete a bookmark by ID */
export async function deleteBookmark(id: string): Promise<void> {
  await apiFetch(`/bookmarks/${id}`, PayloadDeleteResponseSchema, {
    init: { method: 'DELETE' },
  })
}
