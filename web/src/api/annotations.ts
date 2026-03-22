import { apiFetch } from './client'
import {
  AnnotationSchema,
  PayloadDocResponseSchema,
  PayloadListSchema,
  PayloadDeleteResponseSchema,
  type Annotation,
} from './types'

/** Fetch all annotations the current user has on a specific decision */
export async function getAnnotations(decisionId: string): Promise<Annotation[]> {
  const result = await apiFetch(
    '/annotations',
    PayloadListSchema(AnnotationSchema),
    {
      params: {
        'where[decision][equals]': decisionId,
        limit: 100,
      },
    },
  )
  return result.docs
}

export interface CreateAnnotationInput {
  decision: string
  text_selection: { start: number; end: number }
  highlight_color: 'yellow' | 'green' | 'blue' | 'pink'
  note?: string
}

/** Create a new annotation. The user field is auto-populated by the CMS hook. */
export async function createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
  const result = await apiFetch(
    '/annotations',
    PayloadDocResponseSchema(AnnotationSchema),
    {
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    },
  )
  return result.doc
}

/** Delete an annotation by ID */
export async function deleteAnnotation(id: string): Promise<void> {
  await apiFetch(`/annotations/${id}`, PayloadDeleteResponseSchema, {
    init: { method: 'DELETE' },
  })
}
