/**
 * Phase 1 — judge-dashboard collection shape tests.
 *
 * Verifies the new fields and relationships needed by the analytics
 * dashboard mockup. No DB roundtrip — just collection-config validation.
 */
import { describe, it, expect } from 'vitest'
import { Judges } from '../collections/Judges.js'
import { Attorneys } from '../collections/Attorneys.js'
import { CourtDecisions } from '../collections/CourtDecisions.js'

// Loose helper — Payload's CollectionConfig.fields is a discriminated union
// covering presentational fields without `name`. We just want to find named
// data fields, so cast at the boundary.
function findField(collection: { fields: unknown[] }, name: string) {
  return collection.fields.find(
    (f): f is { name: string; type: string } & Record<string, unknown> =>
      typeof f === 'object' && f !== null && 'name' in f && (f as { name: unknown }).name === name,
  )
}

describe('Judges collection — Phase 1 dashboard fields', () => {
  it('has photo as upload relationship to media', () => {
    const photo = findField(Judges, 'photo')
    expect(photo?.type).toBe('upload')
    expect(photo?.relationTo).toBe('media')
  })

  it('has firstName, lastName, yearsOfExperience scalars', () => {
    expect(findField(Judges, 'firstName')?.type).toBe('text')
    expect(findField(Judges, 'lastName')?.type).toBe('text')
    expect(findField(Judges, 'yearsOfExperience')?.type).toBe('number')
  })

  it('has department enum aligned with court_decisions.decisionType', () => {
    const dept = findField(Judges, 'department') as { type: string; options: Array<{ value: string }> } | undefined
    expect(dept?.type).toBe('select')
    const values = dept?.options.map((o) => o.value) ?? []
    expect(values).toContain('civil')
    expect(values).toContain('criminal')
    expect(values).toContain('commercial')
    expect(values).toContain('administrative')
  })
})

describe('Attorneys collection', () => {
  it('has the expected base shape', () => {
    expect(Attorneys.slug).toBe('attorneys')
    expect(findField(Attorneys, 'name')?.type).toBe('text')
    expect(findField(Attorneys, 'firm')?.type).toBe('text')
    expect(findField(Attorneys, 'photo')?.type).toBe('upload')
    expect(findField(Attorneys, 'legacyId')?.type).toBe('number')
  })

  it('has aliases array for legacy ime1..9/prezime1..9 dedupe', () => {
    const aliases = findField(Attorneys, 'aliases') as { type: string; fields: Array<{ name: string }> } | undefined
    expect(aliases?.type).toBe('array')
    expect(aliases?.fields.find((f) => f.name === 'fullName')).toBeDefined()
  })
})

describe('CourtDecisions — Phase 1 analytics fields', () => {
  it('has hasMany relationships for judges, expertWitnesses, attorneys', () => {
    const judges = findField(CourtDecisions, 'judges')
    expect(judges?.type).toBe('relationship')
    expect(judges?.hasMany).toBe(true)
    expect(judges?.relationTo).toBe('judges')

    expect(findField(CourtDecisions, 'expertWitnesses')?.relationTo).toBe('expert-witnesses')
    expect(findField(CourtDecisions, 'plaintiffAttorneys')?.relationTo).toBe('attorneys')
    expect(findField(CourtDecisions, 'defendantAttorneys')?.relationTo).toBe('attorneys')
  })

  it('has outcome enums (appealOutcome, winningParty)', () => {
    const appealOutcome = findField(CourtDecisions, 'appealOutcome') as { type: string; options: Array<{ value: string }> } | undefined
    expect(appealOutcome?.type).toBe('select')
    const values = appealOutcome?.options.map((o) => o.value) ?? []
    expect(values).toEqual(expect.arrayContaining(['upheld', 'modified', 'overturned', 'na']))

    const winning = findField(CourtDecisions, 'winningParty') as { type: string; options: Array<{ value: string }> } | undefined
    const winValues = winning?.options.map((o) => o.value) ?? []
    expect(winValues).toEqual(expect.arrayContaining(['plaintiff', 'defendant', 'partial', 'settled', 'dismissed']))
  })

  it('has dispute type/value with currency', () => {
    expect(findField(CourtDecisions, 'disputeType')?.type).toBe('select')
    expect(findField(CourtDecisions, 'disputeValue')?.type).toBe('number')
    expect(findField(CourtDecisions, 'currency')?.type).toBe('select')
  })

  it('has analyticsExtractedAt watermark for idempotent backfill', () => {
    expect(findField(CourtDecisions, 'analyticsExtractedAt')?.type).toBe('date')
  })

  it('has self-relation appealedDecision for cite-chasing', () => {
    const appealed = findField(CourtDecisions, 'appealedDecision')
    expect(appealed?.type).toBe('relationship')
    expect(appealed?.relationTo).toBe('court-decisions')
  })
})
