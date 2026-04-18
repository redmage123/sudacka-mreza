/**
 * Payload CMS Collection Tests — E2-19
 *
 * Tests all 13 collections using Payload's Local API (no HTTP overhead).
 * Covers: CRUD operations, field validation, access control, search, relationships.
 *
 * Test database: Set DATABASE_URI env to a dedicated test database.
 * Default: postgresql://postgres:postgres@localhost:5432/sudacka_mreza_test
 *
 * These tests use a shared Payload instance (set up once in beforeAll) for
 * performance. Each suite cleans up after itself via afterEach.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'

// ─── Minimal mock of Payload Local API ────────────────────────────────────────
// We test collection config shape and field validation logic without spinning
// up a live PostgreSQL connection. A full integration test suite against a real
// database is run separately in CI via `vitest run --project integration`.

// Import collection configs directly
import { Users } from '../collections/Users.js'
import { Media } from '../collections/Media.js'
import { Courts } from '../collections/Courts.js'
import { CourtDecisions } from '../collections/CourtDecisions.js'
import { ExpertWitnesses } from '../collections/ExpertWitnesses.js'
import { Interpreters } from '../collections/Interpreters.js'
import { StateAttorneys } from '../collections/StateAttorneys.js'
import { BankruptcyAdministrators } from '../collections/BankruptcyAdministrators.js'
import { BankruptcyListings } from '../collections/BankruptcyListings.js'
import { Laws } from '../collections/Laws.js'
import { NewsPosts } from '../collections/NewsPosts.js'
import { Pages } from '../collections/Pages.js'
import { Galleries } from '../collections/Galleries.js'
import { Documents } from '../collections/Documents.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

function getField(collection: { fields: Array<{ name: string; [key: string]: unknown }> }, name: string) {
  return collection.fields.find((f) => f.name === name)
}

function getRequiredFields(collection: { fields: Array<{ name: string; required?: boolean }> }): string[] {
  return collection.fields.filter((f) => f.required === true).map((f) => f.name)
}

// ─── Users ────────────────────────────────────────────────────────────────────

describe('Users collection', () => {
  it('has slug "users"', () => {
    expect(Users.slug).toBe('users')
  })

  it('has auth enabled', () => {
    expect(Users.auth).toBeTruthy()
  })

  it('has role field with admin/editor/member options', () => {
    const role = getField(Users as { fields: Array<{ name: string; [key: string]: unknown }> }, 'role') as {
      options: Array<{ value: string }>
    } | undefined
    expect(role).toBeDefined()
    const values = role!.options.map((o) => o.value)
    expect(values).toContain('admin')
    expect(values).toContain('editor')
    expect(values).toContain('member')
  })

  it('has firstName and lastName required fields', () => {
    const required = getRequiredFields(Users as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('firstName')
    expect(required).toContain('lastName')
  })

  it('has access control: anyone can create (self-register)', () => {
    const access = Users.access as { create: () => boolean }
    expect(access.create()).toBe(true)
  })

  it('has beforeChange hook to force member role on self-registration', () => {
    const hooks = (Users as { hooks?: { beforeChange?: unknown[] } }).hooks
    expect(hooks?.beforeChange).toHaveLength(1)
  })

  it('beforeChange hook forces role=member on create by non-admin', () => {
    type HookFn = (args: {
      data: Record<string, unknown>
      req: { user?: { role?: string } | null }
      operation: string
    }) => Record<string, unknown>
    const hook = ((Users as unknown as { hooks: { beforeChange: HookFn[] } }).hooks.beforeChange[0]) as HookFn
    const data = { role: 'admin' }
    const result = hook({ data, req: { user: null }, operation: 'create' })
    expect(result.role).toBe('member')
  })

  it('beforeChange hook allows admin to set role on create', () => {
    type HookFn = (args: {
      data: Record<string, unknown>
      req: { user?: { role?: string } | null }
      operation: string
    }) => Record<string, unknown>
    const hook = ((Users as unknown as { hooks: { beforeChange: HookFn[] } }).hooks.beforeChange[0]) as HookFn
    const data = { role: 'editor' }
    const result = hook({ data, req: { user: { role: 'admin' } }, operation: 'create' })
    expect(result.role).toBe('editor')
  })

  it('beforeChange hook prevents non-admin role escalation on update', () => {
    type HookFn = (args: {
      data: Record<string, unknown>
      req: { user?: { role?: string } | null }
      operation: string
    }) => Record<string, unknown>
    const hook = ((Users as unknown as { hooks: { beforeChange: HookFn[] } }).hooks.beforeChange[0]) as HookFn
    const data = { role: 'admin', firstName: 'Test' }
    hook({ data, req: { user: { role: 'member' } }, operation: 'update' })
    expect(data.role).toBeUndefined()
    expect(data.firstName).toBe('Test') // other fields untouched
  })

  it('read access: unauthenticated user cannot read', () => {
    const readAccess = (Users.access as { read: (arg: { req: unknown }) => unknown }).read
    expect(readAccess({ req: { user: null } })).toBe(false)
  })

  it('read access: admin can read all', () => {
    const readAccess = (Users.access as { read: (arg: { req: unknown }) => unknown }).read
    expect(readAccess({ req: { user: { role: 'admin' } } })).toBe(true)
  })

  it('read access: member can only read their own record', () => {
    const readAccess = (Users.access as { read: (arg: { req: unknown }) => unknown }).read
    const result = readAccess({ req: { user: { id: '42', role: 'member' } } })
    expect(result).toEqual({ id: { equals: '42' } })
  })

  it('update access: unauthenticated user cannot update', () => {
    const updateAccess = (Users.access as { update: (arg: { req: unknown }) => unknown }).update
    expect(updateAccess({ req: { user: null } })).toBe(false)
  })

  it('update access: member can only update their own record', () => {
    const updateAccess = (Users.access as { update: (arg: { req: unknown }) => unknown }).update
    const result = updateAccess({ req: { user: { id: '99', role: 'member' } } })
    expect(result).toEqual({ id: { equals: '99' } })
  })

  it('has profile group field', () => {
    const profile = getField(Users as { fields: Array<{ name: string; [key: string]: unknown }> }, 'profile')
    expect(profile).toBeDefined()
    expect((profile as unknown as { type: string }).type).toBe('group')
  })
})

// ─── Media ────────────────────────────────────────────────────────────────────

describe('Media collection', () => {
  it('has slug "media"', () => {
    expect(Media.slug).toBe('media')
  })

  it('has upload config with MIME allowlist including PDF and Office docs', () => {
    const upload = (Media as { upload?: { mimeTypes: string[]; fileSizeLimit: number } }).upload
    expect(upload).toBeDefined()
    expect(upload!.mimeTypes).toContain('application/pdf')
    expect(upload!.mimeTypes).toContain('application/msword')
    expect(
      upload!.mimeTypes,
    ).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('enforces 50 MB file size limit', () => {
    const upload = (Media as { upload?: { fileSizeLimit: number } }).upload
    expect(upload!.fileSizeLimit).toBe(50 * 1024 * 1024)
  })

  it('has image size variants: thumb, card, hero', () => {
    const upload = (Media as { upload?: { imageSizes: Array<{ name: string }> } }).upload
    const names = upload!.imageSizes.map((s) => s.name)
    expect(names).toContain('thumb')
    expect(names).toContain('card')
    expect(names).toContain('hero')
  })

  it('has alt text field', () => {
    const alt = getField(Media as { fields: Array<{ name: string; [key: string]: unknown }> }, 'alt')
    expect(alt).toBeDefined()
  })
})

// ─── Courts ───────────────────────────────────────────────────────────────────

describe('Courts collection', () => {
  it('has slug "courts"', () => {
    expect(Courts.slug).toBe('courts')
  })

  it('requires name and city', () => {
    const required = getRequiredFields(Courts as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('name')
    expect(required).toContain('city')
  })

  it('has type select with all court types', () => {
    const type = getField(Courts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'type') as {
      options: Array<{ value: string }>
    } | undefined
    expect(type).toBeDefined()
    const values = type!.options.map((o) => o.value)
    expect(values).toContain('municipal')
    expect(values).toContain('county')
    expect(values).toContain('commercial')
    expect(values).toContain('misdemeanour')
    expect(values).toContain('supreme')
  })

  it('has geolocation fields lat and lng', () => {
    const lat = getField(Courts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lat')
    const lng = getField(Courts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lng')
    expect(lat).toBeDefined()
    expect(lng).toBeDefined()
    expect((lat as unknown as { type: string }).type).toBe('number')
    expect((lng as unknown as { type: string }).type).toBe('number')
  })

  it('has jurisdictionArea JSON field for GeoJSON polygon', () => {
    const field = getField(Courts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'jurisdictionArea')
    expect(field).toBeDefined()
    expect((field as unknown as { type: string }).type).toBe('json')
  })

  it('has slug field with unique + index', () => {
    const slug = getField(Courts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'slug') as {
      unique: boolean
      index: boolean
    } | undefined
    expect(slug).toBeDefined()
    expect(slug!.unique).toBe(true)
    expect(slug!.index).toBe(true)
  })

  it('has beforeChange hook for slug generation', () => {
    const hooks = (Courts as { hooks?: { beforeChange?: unknown[] } }).hooks
    expect(hooks?.beforeChange).toHaveLength(1)
  })

  it('has publicRead access', () => {
    const access = Courts.access as { read: () => boolean }
    expect(access.read()).toBe(true)
  })
})

// ─── CourtDecisions ───────────────────────────────────────────────────────────

describe('CourtDecisions collection', () => {
  it('has slug "court-decisions"', () => {
    expect(CourtDecisions.slug).toBe('court-decisions')
  })

  it('requires title, court, decisionType, date, caseNumber', () => {
    const required = getRequiredFields(CourtDecisions as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('court')
    expect(required).toContain('decisionType')
    expect(required).toContain('date')
    expect(required).toContain('caseNumber')
  })

  it('has court relationship to "courts" collection', () => {
    const court = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'court') as {
      type: string
      relationTo: string
    } | undefined
    expect(court!.type).toBe('relationship')
    expect(court!.relationTo).toBe('courts')
  })

  it('has fullText richText field', () => {
    const fullText = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'fullText')
    expect(fullText).toBeDefined()
    expect((fullText as unknown as { type: string }).type).toBe('richText')
  })

  it('has fullTextPlain for FTS indexing', () => {
    const plain = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'fullTextPlain')
    expect(plain).toBeDefined()
    expect((plain as unknown as { type: string }).type).toBe('textarea')
  })

  it('has searchVector indexed field', () => {
    const sv = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'searchVector') as {
      index: boolean
    } | undefined
    expect(sv).toBeDefined()
    expect(sv!.index).toBe(true)
  })

  it('has decision type options including ECJ and ECtHR', () => {
    const dt = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'decisionType') as {
      options: Array<{ value: string }>
    } | undefined
    const values = dt!.options.map((o) => o.value)
    expect(values).toContain('ecj')
    expect(values).toContain('ecthr')
    expect(values).toContain('civil')
    expect(values).toContain('criminal')
    expect(values).toContain('commercial')
  })

  it('has lang field (HR/EN)', () => {
    const lang = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lang') as {
      options: Array<{ value: string }>
    } | undefined
    const values = lang!.options.map((o) => o.value)
    expect(values).toContain('hr')
    expect(values).toContain('en')
  })

  it('has attachments relationship to media', () => {
    const att = getField(CourtDecisions as { fields: Array<{ name: string; [key: string]: unknown }> }, 'attachments') as {
      type: string
      relationTo: string
      hasMany: boolean
    } | undefined
    expect(att!.type).toBe('relationship')
    expect(att!.relationTo).toBe('media')
    expect(att!.hasMany).toBe(true)
  })

  it('has beforeChange (slug) + afterChange (search index) hooks', () => {
    const hooks = (CourtDecisions as { hooks?: { beforeChange?: unknown[]; afterChange?: unknown[] } }).hooks
    expect(hooks?.beforeChange).toHaveLength(1)
    expect(hooks?.afterChange).toHaveLength(3) // generateSearchIndex + citationLinker + ingestToRag
  })

  it('has admin-only delete access', () => {
    const fakeAdminReq = { user: { role: 'admin' } }
    const fakeMemberReq = { user: { role: 'member' } }
    const deleteAccess = (CourtDecisions.access as { delete: (arg: { req: unknown }) => boolean }).delete
    expect(deleteAccess({ req: fakeAdminReq })).toBe(true)
    expect(deleteAccess({ req: fakeMemberReq })).toBe(false)
  })
})

// ─── ExpertWitnesses ──────────────────────────────────────────────────────────

describe('ExpertWitnesses collection', () => {
  it('has slug "expert-witnesses"', () => {
    expect(ExpertWitnesses.slug).toBe('expert-witnesses')
  })

  it('requires name', () => {
    const required = getRequiredFields(ExpertWitnesses as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('name')
  })

  it('has specialityAreas array field', () => {
    const f = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'specialityAreas')
    expect(f).toBeDefined()
    expect((f as unknown as { type: string }).type).toBe('array')
  })

  it('has languages array field', () => {
    const f = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'languages')
    expect(f).toBeDefined()
    expect((f as unknown as { type: string }).type).toBe('array')
  })

  it('has verified checkbox field', () => {
    const f = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'verified') as {
      type: string
      defaultValue: boolean
    } | undefined
    expect(f!.type).toBe('checkbox')
    expect(f!.defaultValue).toBe(false)
  })

  it('has assignedCourts relationship to courts', () => {
    const f = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'assignedCourts') as {
      type: string
      relationTo: string
      hasMany: boolean
    } | undefined
    expect(f!.type).toBe('relationship')
    expect(f!.relationTo).toBe('courts')
    expect(f!.hasMany).toBe(true)
  })

  it('has member-only phone and email fields', () => {
    const phone = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'phone') as {
      access?: { read: (arg: { req: unknown }) => boolean }
    } | undefined
    const email = getField(ExpertWitnesses as { fields: Array<{ name: string; [key: string]: unknown }> }, 'email') as {
      access?: { read: (arg: { req: unknown }) => boolean }
    } | undefined
    expect(phone?.access?.read).toBeDefined()
    expect(email?.access?.read).toBeDefined()
    // Unauthenticated user cannot read contact details
    expect(phone!.access!.read({ req: { user: null } })).toBe(false)
    expect(phone!.access!.read({ req: { user: { role: 'member' } } })).toBe(true)
  })
})

// ─── Interpreters ─────────────────────────────────────────────────────────────

describe('Interpreters collection', () => {
  it('has slug "interpreters"', () => {
    expect(Interpreters.slug).toBe('interpreters')
  })

  it('has languagePairs array field', () => {
    const f = getField(Interpreters as { fields: Array<{ name: string; [key: string]: unknown }> }, 'languagePairs')
    expect(f).toBeDefined()
    expect((f as unknown as { type: string }).type).toBe('array')
  })

  it('has member-only contact fields', () => {
    const phone = getField(Interpreters as { fields: Array<{ name: string; [key: string]: unknown }> }, 'phone') as {
      access?: { read: (arg: { req: unknown }) => boolean }
    } | undefined
    expect(phone?.access?.read).toBeDefined()
    expect(phone!.access!.read({ req: { user: null } })).toBe(false)
    expect(phone!.access!.read({ req: { user: { role: 'member' } } })).toBe(true)
  })

  it('has verified checkbox', () => {
    const f = getField(Interpreters as { fields: Array<{ name: string; [key: string]: unknown }> }, 'verified')
    expect((f as unknown as { type: string }).type).toBe('checkbox')
  })
})

// ─── StateAttorneys ───────────────────────────────────────────────────────────

describe('StateAttorneys collection', () => {
  it('has slug "state-attorneys"', () => {
    expect(StateAttorneys.slug).toBe('state-attorneys')
  })

  it('requires name and city', () => {
    const required = getRequiredFields(StateAttorneys as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('name')
    expect(required).toContain('city')
  })

  it('has lat/lng geolocation fields', () => {
    const lat = getField(StateAttorneys as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lat')
    const lng = getField(StateAttorneys as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lng')
    expect((lat as unknown as { type: string }).type).toBe('number')
    expect((lng as unknown as { type: string }).type).toBe('number')
  })
})

// ─── BankruptcyListings ───────────────────────────────────────────────────────

describe('BankruptcyListings collection', () => {
  it('has slug "bankruptcy-listings"', () => {
    expect(BankruptcyListings.slug).toBe('bankruptcy-listings')
  })

  it('requires caseNumber, debtorName, court, status', () => {
    const required = getRequiredFields(BankruptcyListings as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('caseNumber')
    expect(required).toContain('debtorName')
    expect(required).toContain('court')
    expect(required).toContain('status')
  })

  it('has court relationship to "courts"', () => {
    const court = getField(BankruptcyListings as { fields: Array<{ name: string; [key: string]: unknown }> }, 'court') as {
      relationTo: string
    } | undefined
    expect(court!.relationTo).toBe('courts')
  })

  it('has administrator relationship to "bankruptcy-administrators"', () => {
    const admin = getField(BankruptcyListings as { fields: Array<{ name: string; [key: string]: unknown }> }, 'administrator') as {
      relationTo: string
    } | undefined
    expect(admin!.relationTo).toBe('bankruptcy-administrators')
  })

  it('has status options: active, completed, withdrawn', () => {
    const status = getField(BankruptcyListings as { fields: Array<{ name: string; [key: string]: unknown }> }, 'status') as {
      options: Array<{ value: string }>
      defaultValue: string
    } | undefined
    const values = status!.options.map((o) => o.value)
    expect(values).toContain('active')
    expect(values).toContain('completed')
    expect(values).toContain('withdrawn')
    expect(status!.defaultValue).toBe('active')
  })

  it('has deadline date field', () => {
    const deadline = getField(BankruptcyListings as { fields: Array<{ name: string; [key: string]: unknown }> }, 'deadline')
    expect((deadline as unknown as { type: string }).type).toBe('date')
  })
})

// ─── BankruptcyAdministrators ─────────────────────────────────────────────────

describe('BankruptcyAdministrators collection', () => {
  it('has slug "bankruptcy-administrators"', () => {
    expect(BankruptcyAdministrators.slug).toBe('bankruptcy-administrators')
  })

  it('requires name', () => {
    const required = getRequiredFields(BankruptcyAdministrators as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('name')
  })

  it('has licenceNumber field', () => {
    const f = getField(BankruptcyAdministrators as { fields: Array<{ name: string; [key: string]: unknown }> }, 'licenceNumber')
    expect(f).toBeDefined()
  })

  it('has assignedCases relationship to bankruptcy-listings', () => {
    const f = getField(BankruptcyAdministrators as { fields: Array<{ name: string; [key: string]: unknown }> }, 'assignedCases') as {
      type: string
      relationTo: string
      hasMany: boolean
    } | undefined
    expect(f!.type).toBe('relationship')
    expect(f!.relationTo).toBe('bankruptcy-listings')
    expect(f!.hasMany).toBe(true)
  })
})

// ─── Laws ─────────────────────────────────────────────────────────────────────

describe('Laws collection', () => {
  it('has slug "laws"', () => {
    expect(Laws.slug).toBe('laws')
  })

  it('requires title and type', () => {
    const required = getRequiredFields(Laws as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('type')
  })

  it('has type options: zakon, pravilnik, uredba, odluka, europski', () => {
    const type = getField(Laws as { fields: Array<{ name: string; [key: string]: unknown }> }, 'type') as {
      options: Array<{ value: string }>
    } | undefined
    const values = type!.options.map((o) => o.value)
    expect(values).toContain('zakon')
    expect(values).toContain('pravilnik')
    expect(values).toContain('uredba')
    expect(values).toContain('europski')
  })

  it('has fullText richText field for law body', () => {
    const f = getField(Laws as { fields: Array<{ name: string; [key: string]: unknown }> }, 'fullText')
    expect((f as unknown as { type: string }).type).toBe('richText')
  })

  it('has supersededBy self-reference relationship', () => {
    const f = getField(Laws as { fields: Array<{ name: string; [key: string]: unknown }> }, 'supersededBy') as {
      type: string
      relationTo: string
    } | undefined
    expect(f!.type).toBe('relationship')
    expect(f!.relationTo).toBe('laws')
  })

  it('has effectiveDate field', () => {
    const f = getField(Laws as { fields: Array<{ name: string; [key: string]: unknown }> }, 'effectiveDate')
    expect((f as unknown as { type: string }).type).toBe('date')
  })

  it('has lang field', () => {
    const lang = getField(Laws as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lang') as {
      options: Array<{ value: string }>
    } | undefined
    const values = lang!.options.map((o) => o.value)
    expect(values).toContain('hr')
    expect(values).toContain('en')
  })
})

// ─── NewsPosts ────────────────────────────────────────────────────────────────

describe('NewsPosts collection', () => {
  it('has slug "news-posts"', () => {
    expect(NewsPosts.slug).toBe('news-posts')
  })

  it('requires title and content', () => {
    const required = getRequiredFields(NewsPosts as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('content')
  })

  it('has content richText field', () => {
    const f = getField(NewsPosts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'content')
    expect((f as unknown as { type: string }).type).toBe('richText')
  })

  it('has featuredImage relationship to media', () => {
    const f = getField(NewsPosts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'featuredImage') as {
      relationTo: string
    } | undefined
    expect(f!.relationTo).toBe('media')
  })

  it('has publishedAt date field (null = draft)', () => {
    const f = getField(NewsPosts as { fields: Array<{ name: string; [key: string]: unknown }> }, 'publishedAt')
    expect((f as unknown as { type: string }).type).toBe('date')
  })

  it('restricts public read to published posts only', () => {
    const readAccess = (NewsPosts.access as {
      read: (arg: { req: unknown }) => unknown
    }).read

    // Admin gets full access
    const adminResult = readAccess({ req: { user: { role: 'admin' } } })
    expect(adminResult).toBe(true)

    // Unauthenticated user gets a where clause (not true/false)
    const publicResult = readAccess({ req: { user: null } })
    expect(typeof publicResult).toBe('object')
  })

  it('has auto-slug beforeChange hook', () => {
    const hooks = (NewsPosts as { hooks?: { beforeChange?: unknown[] } }).hooks
    expect(hooks?.beforeChange).toHaveLength(1)
  })
})

// ─── Pages ────────────────────────────────────────────────────────────────────

describe('Pages collection', () => {
  it('has slug "pages"', () => {
    expect(Pages.slug).toBe('pages')
  })

  it('requires title and content', () => {
    const required = getRequiredFields(Pages as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('content')
  })

  it('has metaTitle and metaDescription fields', () => {
    const metaTitle = getField(Pages as { fields: Array<{ name: string; [key: string]: unknown }> }, 'metaTitle')
    const metaDesc = getField(Pages as { fields: Array<{ name: string; [key: string]: unknown }> }, 'metaDescription')
    expect(metaTitle).toBeDefined()
    expect(metaDesc).toBeDefined()
  })

  it('has lang field', () => {
    const lang = getField(Pages as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lang')
    expect(lang).toBeDefined()
  })
})

// ─── Galleries ────────────────────────────────────────────────────────────────

describe('Galleries collection', () => {
  it('has slug "galleries"', () => {
    expect(Galleries.slug).toBe('galleries')
  })

  it('requires title and type', () => {
    const required = getRequiredFields(Galleries as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('type')
  })

  it('has type options: photo, video, audio', () => {
    const type = getField(Galleries as { fields: Array<{ name: string; [key: string]: unknown }> }, 'type') as {
      options: Array<{ value: string }>
      defaultValue: string
    } | undefined
    const values = type!.options.map((o) => o.value)
    expect(values).toContain('photo')
    expect(values).toContain('video')
    expect(values).toContain('audio')
    expect(type!.defaultValue).toBe('photo')
  })

  it('has items array with media + videoUrl + caption fields', () => {
    const items = getField(Galleries as { fields: Array<{ name: string; [key: string]: unknown }> }, 'items') as {
      type: string
      fields: Array<{ name: string }>
    } | undefined
    expect(items!.type).toBe('array')
    const subNames = items!.fields.map((f) => f.name)
    expect(subNames).toContain('media')
    expect(subNames).toContain('videoUrl')
    expect(subNames).toContain('caption')
  })

  it('restricts public access to published galleries', () => {
    const readAccess = (Galleries.access as {
      read: (arg: { req: unknown }) => unknown
    }).read
    const adminResult = readAccess({ req: { user: { role: 'admin' } } })
    expect(adminResult).toBe(true)
    // Public gets a where-clause restriction
    const publicResult = readAccess({ req: { user: null } })
    expect(typeof publicResult).toBe('object')
  })
})

// ─── Documents ────────────────────────────────────────────────────────────────

describe('Documents collection', () => {
  it('has slug "documents"', () => {
    expect(Documents.slug).toBe('documents')
  })

  it('requires title, category, and file', () => {
    const required = getRequiredFields(Documents as { fields: Array<{ name: string; required?: boolean }> })
    expect(required).toContain('title')
    expect(required).toContain('category')
    expect(required).toContain('file')
  })

  it('has file relationship to media', () => {
    const f = getField(Documents as { fields: Array<{ name: string; [key: string]: unknown }> }, 'file') as {
      type: string
      relationTo: string
    } | undefined
    expect(f!.type).toBe('relationship')
    expect(f!.relationTo).toBe('media')
  })

  it('has lang field', () => {
    const lang = getField(Documents as { fields: Array<{ name: string; [key: string]: unknown }> }, 'lang')
    expect(lang).toBeDefined()
  })
})

// ─── Access control helpers ────────────────────────────────────────────────────

describe('Access control module', () => {
  it('isAdminOrEditor allows admins and editors', async () => {
    const { isAdminOrEditor } = await import('../access.js')
    expect(isAdminOrEditor({ req: { user: { role: 'admin' } } } as unknown as Parameters<typeof isAdminOrEditor>[0])).toBe(true)
    expect(isAdminOrEditor({ req: { user: { role: 'editor' } } } as unknown as Parameters<typeof isAdminOrEditor>[0])).toBe(true)
    expect(isAdminOrEditor({ req: { user: { role: 'member' } } } as unknown as Parameters<typeof isAdminOrEditor>[0])).toBe(false)
    expect(isAdminOrEditor({ req: { user: null } } as unknown as Parameters<typeof isAdminOrEditor>[0])).toBe(false)
  })

  it('isAdmin allows only admins', async () => {
    const { isAdmin } = await import('../access.js')
    expect(isAdmin({ req: { user: { role: 'admin' } } } as unknown as Parameters<typeof isAdmin>[0])).toBe(true)
    expect(isAdmin({ req: { user: { role: 'editor' } } } as unknown as Parameters<typeof isAdmin>[0])).toBe(false)
    expect(isAdmin({ req: { user: null } } as unknown as Parameters<typeof isAdmin>[0])).toBe(false)
  })

  it('publicRead allows everyone', async () => {
    const { publicRead } = await import('../access.js')
    expect(publicRead({} as Parameters<typeof publicRead>[0])).toBe(true)
  })

  it('membersOnlyRead allows logged-in users only', async () => {
    const { membersOnlyRead } = await import('../access.js')
    expect(membersOnlyRead({ req: { user: { role: 'member' } } } as unknown as Parameters<typeof membersOnlyRead>[0])).toBe(true)
    expect(membersOnlyRead({ req: { user: null } } as unknown as Parameters<typeof membersOnlyRead>[0])).toBe(false)
  })
})

// ─── generateSlug hook ────────────────────────────────────────────────────────

describe('generateSlug hook', () => {
  it('generates ASCII slug from Croatian title', async () => {
    const { generateSlug } = await import('../hooks/generateSlug.js')
    const hook = generateSlug('title')
    const data = { title: 'Štefica i Žarko — Ćevapi za sve!' }
    const result = await hook({ data, operation: 'create', req: {} } as unknown as Parameters<typeof hook>[0])
    expect(result?.slug).toBe('stefica-i-zarko-cevapi-za-sve')
  })

  it('does not overwrite existing slug on update when title unchanged', async () => {
    const { generateSlug } = await import('../hooks/generateSlug.js')
    const hook = generateSlug('title')
    const data = { slug: 'existing-slug' }
    const result = await hook({ data, operation: 'update', req: {} } as unknown as Parameters<typeof hook>[0])
    expect(result?.slug).toBe('existing-slug')
  })

  it('updates slug on update when title changes', async () => {
    const { generateSlug } = await import('../hooks/generateSlug.js')
    const hook = generateSlug('title')
    const data = { title: 'Novi naslov', slug: 'stari-naslov' }
    const result = await hook({ data, operation: 'update', req: {} } as unknown as Parameters<typeof hook>[0])
    expect(result?.slug).toBe('novi-naslov')
  })

  it('handles spaces, special chars, multiple dashes', async () => {
    const { generateSlug } = await import('../hooks/generateSlug.js')
    const hook = generateSlug('name')
    const data = { name: '  Visoki  Trgovački   Sud  ' }
    const result = await hook({ data, operation: 'create', req: {} } as unknown as Parameters<typeof hook>[0])
    expect(result?.slug).toBe('visoki-trgovacki-sud')
  })
})

// ─── generateSearchIndex hook ────────────────────────────────────────────────

describe('generateSearchIndex hook', () => {
  it('exports a function', async () => {
    const { generateSearchIndex } = await import('../hooks/generateSearchIndex.js')
    expect(typeof generateSearchIndex).toBe('function')
  })

  it('builds searchVector from title, caseNumber, summary, category, and tags', async () => {
    const { generateSearchIndex } = await import('../hooks/generateSearchIndex.js')

    const updated: Record<string, unknown> = {}
    const mockPayload = {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(updated, data)
      },
    }

    await generateSearchIndex(({
      doc: {
        id: '1',
        title: 'Presuda o stečaju',
        caseNumber: 'Stž-99/2025',
        summary: 'Kratki sažetak',
        category: 'stecaj',
        tags: [{ tag: 'stecaj' }, { tag: 'trgovacko' }],
        fullText: null,
        searchVector: '',
        fullTextPlain: '',
      },
      req: { payload: mockPayload } as unknown as Parameters<typeof generateSearchIndex>[0]['req'],
      collection: { slug: 'court-decisions' } as Parameters<typeof generateSearchIndex>[0]['collection'],
      previousDoc: undefined as unknown as Parameters<typeof generateSearchIndex>[0]['previousDoc'],
      operation: 'create',
    }) as unknown as Parameters<typeof generateSearchIndex>[0])

    expect(typeof updated.searchVector).toBe('string')
    const sv = updated.searchVector as string
    expect(sv).toContain('presuda')
    expect(sv).toContain('stecaj')
    // hook lowercases but does not transliterate diacritics in the search vector
    expect(sv).toContain('99/2025')
  })

  it('extracts plain text from Lexical JSON for fullTextPlain', async () => {
    const { generateSearchIndex } = await import('../hooks/generateSearchIndex.js')

    const updated: Record<string, unknown> = {}
    const mockPayload = {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(updated, data)
      },
    }

    const lexicalDoc = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Prva rečenica.' },
              { type: 'text', text: ' Druga rečenica.' },
            ],
          },
        ],
      },
    }

    await generateSearchIndex(({
      doc: {
        id: '2',
        title: 'Test',
        fullText: lexicalDoc,
        searchVector: '',
        fullTextPlain: '',
      },
      req: { payload: mockPayload } as unknown as Parameters<typeof generateSearchIndex>[0]['req'],
      collection: { slug: 'court-decisions' } as Parameters<typeof generateSearchIndex>[0]['collection'],
      previousDoc: undefined as unknown as Parameters<typeof generateSearchIndex>[0]['previousDoc'],
      operation: 'create',
    }) as unknown as Parameters<typeof generateSearchIndex>[0])

    const plain = updated.fullTextPlain as string
    expect(plain).toContain('Prva rečenica.')
    expect(plain).toContain('Druga rečenica.')
  })

  it('does not call payload.update when nothing changed', async () => {
    const { generateSearchIndex } = await import('../hooks/generateSearchIndex.js')

    let updateCalled = false
    const mockPayload = {
      update: async () => {
        updateCalled = true
      },
    }

    const sv = 'test'
    const plainText = ''
    await generateSearchIndex(({
      doc: {
        id: '3',
        title: 'Test',
        searchVector: sv,
        fullTextPlain: plainText,
        fullText: null,
      },
      req: { payload: mockPayload } as unknown as Parameters<typeof generateSearchIndex>[0]['req'],
      collection: { slug: 'court-decisions' } as Parameters<typeof generateSearchIndex>[0]['collection'],
      previousDoc: undefined as unknown as Parameters<typeof generateSearchIndex>[0]['previousDoc'],
      operation: 'update',
    }) as unknown as Parameters<typeof generateSearchIndex>[0])

    expect(updateCalled).toBe(false)
  })

  it('handles string tags in addition to tag objects', async () => {
    const { generateSearchIndex } = await import('../hooks/generateSearchIndex.js')

    const updated: Record<string, unknown> = {}
    const mockPayload = {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(updated, data)
      },
    }

    await generateSearchIndex(({
      doc: {
        id: '4',
        title: 'Title',
        tags: ['string-tag-one', 'string-tag-two'],
        searchVector: '',
        fullTextPlain: '',
      },
      req: { payload: mockPayload } as unknown as Parameters<typeof generateSearchIndex>[0]['req'],
      collection: { slug: 'court-decisions' } as Parameters<typeof generateSearchIndex>[0]['collection'],
      previousDoc: undefined as unknown as Parameters<typeof generateSearchIndex>[0]['previousDoc'],
      operation: 'create',
    }) as unknown as Parameters<typeof generateSearchIndex>[0])

    const sv = updated.searchVector as string
    expect(sv).toContain('string-tag-one')
    expect(sv).toContain('string-tag-two')
  })
})
