import { z } from 'zod'
import { apiFetch } from './client'

const StatisticsSchema = z.object({
  totals: z.object({
    decisions: z.number(),
    courts: z.number(),
    experts: z.number(),
    interpreters: z.number(),
  }),
  decisionsByType: z.array(
    z.object({
      type: z.string(),
      count: z.number(),
    }),
  ),
  monthlyTrend: z.array(
    z.object({
      month: z.string(), // 'YYYY-MM'
      count: z.number(),
    }),
  ),
  topCourts: z.array(
    z.object({
      court: z.string(),
      courtType: z.string().nullable(),
      count: z.number(),
    }),
  ),
  decisionsPerCourtPerYear: z.array(
    z.object({
      court: z.string(),
      year: z.number(),
      count: z.number(),
    }),
  ),
  expertsBySpecialty: z.array(
    z.object({
      specialty: z.string(),
      count: z.number(),
    }),
  ),
})

export type Statistics = z.infer<typeof StatisticsSchema>

export function getStatistics(): Promise<Statistics> {
  return apiFetch('/statistics', StatisticsSchema)
}
