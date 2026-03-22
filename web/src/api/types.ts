import { z, type ZodTypeAny } from 'zod'

export const PayloadListSchema = <T extends ZodTypeAny>(docSchema: T) =>
  z.object({
    docs: z.array(docSchema),
    totalDocs: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    page: z.number(),
    hasPrevPage: z.boolean(),
    hasNextPage: z.boolean(),
    prevPage: z.number().nullable(),
    nextPage: z.number().nullable(),
  })

export type PayloadList<T> = {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

export const CourtDecisionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  court: z.string(),
  date: z.string(),
  decision_type: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
export type CourtDecisionSummary = z.infer<typeof CourtDecisionSummarySchema>

export const ExpertWitnessSchema = z.object({
  id: z.string(),
  name: z.string(),
  speciality_areas: z.array(z.string()),
  languages: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  county: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
})
export type ExpertWitness = z.infer<typeof ExpertWitnessSchema>

export const InterpreterSchema = z.object({
  id: z.string(),
  name: z.string(),
  language_pairs: z.array(z.string()),
  verified: z.boolean().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
})
export type Interpreter = z.infer<typeof InterpreterSchema>

export const CourtSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  president: z.string().optional(),
  county: z.string().optional(),
  geolocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
})
export type Court = z.infer<typeof CourtSchema>

export const NewsPostSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  published_at: z.string(),
  category: z.string().optional(),
})
export type NewsPostSummary = z.infer<typeof NewsPostSummarySchema>

export const AnnotationSchema = z.object({
  id: z.string(),
  user: z.string(),
  decision: z.string(),
  text_selection: z.object({
    start: z.number(),
    end: z.number(),
  }),
  highlight_color: z.enum(['yellow', 'green', 'blue', 'pink']),
  note: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type Annotation = z.infer<typeof AnnotationSchema>

export const BookmarkDecisionSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    title: z.string(),
    caseNumber: z.string().optional(),
  }),
])

export const BookmarkSchema = z.object({
  id: z.string(),
  user: z.string(),
  decision: BookmarkDecisionSchema,
  folder: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type Bookmark = z.infer<typeof BookmarkSchema>

export const PayloadDocResponseSchema = <T extends ZodTypeAny>(docSchema: T) =>
  z.object({ message: z.string().optional(), doc: docSchema })

export const PayloadDeleteResponseSchema = z.object({
  message: z.string().optional(),
  id: z.string().optional(),
})
