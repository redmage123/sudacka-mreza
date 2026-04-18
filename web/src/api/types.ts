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
    pagingCounter: z.number().optional(),
  }).passthrough()

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

// Payload CMS returns numeric IDs for all collections
const IdSchema = z.union([z.string(), z.number()]).transform(String)

export const CourtDecisionSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  // court can be a string name or a nested object; normalise to string
  court: z.union([z.string(), z.object({ id: IdSchema, name: z.string() }).passthrough()]).transform(
    (v) => (typeof v === 'string' ? v : v.name),
  ),
  date: z.string().nullable().optional(),
  // API field is camelCase decisionType or snake_case decision_type
  decision_type: z.string().optional(),
  decisionType: z.string().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  // Hybrid search extras — present when using /api/decisions/hybrid-search
  excerpt: z.string().nullable().optional(),
  rank: z.number().optional(),
  searchMode: z.enum(['keyword', 'semantic', 'hybrid', 'browse']).optional(),
})
export type CourtDecisionSummary = z.infer<typeof CourtDecisionSummarySchema>

export const ExpertWitnessSchema = z.object({
  id: IdSchema,
  name: z.string(),
  // Payload CMS returns camelCase arrays of objects; normalise to string arrays
  specialityAreas: z.array(z.object({ id: z.string(), area: z.string() })).optional().default([]),
  speciality_areas: z.array(z.string()).optional(),
  languages: z.array(z.union([z.string(), z.object({ id: z.string(), language: z.string() })])).optional(),
  verified: z.boolean().optional(),
  county: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
}).transform((data) => ({
  ...data,
  speciality_areas: data.speciality_areas ?? data.specialityAreas.map((a) => a.area),
  languages: (data.languages ?? []).map((l) => (typeof l === 'string' ? l : l.language)),
}))
export type ExpertWitness = z.infer<typeof ExpertWitnessSchema>

export const InterpreterSchema = z.object({
  id: IdSchema,
  name: z.string(),
  // Payload CMS returns camelCase array of objects; normalise to string array
  languagePairs: z.array(z.object({ id: z.string(), pair: z.string() })).optional().default([]),
  language_pairs: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
}).transform((data) => ({
  ...data,
  language_pairs: data.language_pairs ?? data.languagePairs.map((lp) => lp.pair),
}))
export type Interpreter = z.infer<typeof InterpreterSchema>

export const CourtSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: z.string().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  president: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  geolocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
}).passthrough()
export type Court = z.infer<typeof CourtSchema>

export const NewsPostSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  slug: z.string(),
  published_at: z.string().optional(),
  category: z.string().nullable().optional(),
})
export type NewsPostSummary = z.infer<typeof NewsPostSummarySchema>

export const AnnotationSchema = z.object({
  id: IdSchema,
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
    id: IdSchema,
    title: z.string(),
    caseNumber: z.string().optional(),
  }),
])

export const BookmarkSchema = z.object({
  id: IdSchema,
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
