/**
 * Seed script — E2-20
 *
 * Populates the database with demo data for local development:
 *   - 5 courts (referenced by decisions, experts, interpreters)
 *   - 5 court decisions
 *   - 5 expert witnesses
 *   - 5 interpreters
 *   - 1 bankruptcy administrator
 *   - 2 bankruptcy listings
 *   - 2 news posts
 *   - 1 admin user (dev only)
 *
 * Idempotent: safe to run twice. Records are looked up by a unique field
 * (slug, email, case number) before inserting; no duplicates are created.
 *
 * Usage:
 *   npx tsx src/seed/index.ts
 *
 * Or add to package.json scripts:
 *   "seed": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts tsx src/seed/index.ts"
 */

import { getPayload, type Payload } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Module-level payload instance — initialised in main() before any seed functions run
let payload: Payload

// ─── helpers ──────────────────────────────────────────────────────────────────

async function findBySlug<T>(
  collection: string,
  slug: string,
): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload as any).find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as T) ?? null
}

async function findByCaseNumber(caseNumber: string): Promise<Record<string, unknown> | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (payload as any).find({
    collection: 'bankruptcy-listings',
    where: { caseNumber: { equals: caseNumber } },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as unknown as Record<string, unknown>) ?? null
}

// ─── courts ───────────────────────────────────────────────────────────────────

const COURTS = [
  {
    name: 'Općinski građanski sud u Zagrebu',
    type: 'municipal',
    address: 'Trg pravde 1',
    city: 'Zagreb',
    county: 'Grad Zagreb',
    phone: '+385 1 4890 200',
    email: 'pisarnica@ogs-zagreb.pravosudje.hr',
    website: 'https://ogs-zagreb.pravosudje.hr',
    president: 'Ivica Horvat',
    lat: 45.8150,
    lng: 15.9819,
    slug: 'opcinski-gradjanski-sud-u-zagrebu',
  },
  {
    name: 'Visoki trgovački sud Republike Hrvatske',
    type: 'high_commercial',
    address: 'Berislavićeva 11',
    city: 'Zagreb',
    county: 'Grad Zagreb',
    phone: '+385 1 4896 888',
    email: 'sud@vts.hr',
    website: 'https://vts.hr',
    president: 'Marija Novak',
    lat: 45.8130,
    lng: 15.9780,
    slug: 'visoki-trgovacki-sud-republike-hrvatske',
  },
  {
    name: 'Županijski sud u Splitu',
    type: 'county',
    address: 'Gundulićeva 24a',
    city: 'Split',
    county: 'Splitsko-dalmatinska županija',
    phone: '+385 21 387 333',
    email: 'zs-st@zs-st.pravosudje.hr',
    president: 'Ante Petrić',
    lat: 43.5081,
    lng: 16.4402,
    slug: 'zupanijski-sud-u-splitu',
  },
  {
    name: 'Trgovački sud u Rijeci',
    type: 'commercial',
    address: 'Žrtava fašizma 4',
    city: 'Rijeka',
    county: 'Primorsko-goranska županija',
    phone: '+385 51 355 888',
    email: 'ts-ri@ts-ri.pravosudje.hr',
    president: 'Vesna Jurić',
    lat: 45.3271,
    lng: 14.4422,
    slug: 'trgovacki-sud-u-rijeci',
  },
  {
    name: 'Prekršajni sud u Osijeku',
    type: 'misdemeanour',
    address: 'Trg Ante Starčevića 5',
    city: 'Osijek',
    county: 'Osječko-baranjska županija',
    phone: '+385 31 207 222',
    email: 'ps-os@ps-os.pravosudje.hr',
    president: 'Drago Miletić',
    lat: 45.5550,
    lng: 18.6955,
    slug: 'prekrsajni-sud-u-osijeku',
  },
]

async function seedCourts(): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {}
  console.log('Seeding courts...')
  for (const court of COURTS) {
    const existing = await findBySlug('courts', court.slug)
    if (existing) {
      idMap[court.slug] = (existing as { id: string }).id
      console.log(`  SKIP  courts: ${court.name}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await (payload as any).create({ collection: 'courts', data: court })
      idMap[court.slug] = String(created.id)
      console.log(`  CREATE courts: ${court.name}`)
    }
  }
  return idMap
}

// ─── court decisions ──────────────────────────────────────────────────────────

function makeDecisions(courtIds: Record<string, string>) {
  const vtsId = courtIds['visoki-trgovacki-sud-republike-hrvatske']
  const ogszId = courtIds['opcinski-gradjanski-sud-u-zagrebu']
  const splitId = courtIds['zupanijski-sud-u-splitu']

  return [
    {
      title: 'Presuda u predmetu stečaja trgovačkog društva Alfa d.o.o.',
      court: vtsId,
      decisionType: 'commercial',
      date: '2025-09-12T00:00:00.000Z',
      caseNumber: 'Stž-123/2025',
      summary:
        'Visoki trgovački sud potvrdio prvostupanjsku presudu o pokretanju stečajnog postupka nad dužnikom Alfa d.o.o. Utvrđena je nesposobnost plaćanja i prezaduženost.',
      category: 'stecaj',
      lang: 'hr',
      slug: 'presuda-stecaj-alfa-doo-stz-123-2025',
    },
    {
      title: 'Rješenje o utvrđivanju roditeljske skrbi',
      court: ogszId,
      decisionType: 'civil',
      date: '2025-11-03T00:00:00.000Z',
      caseNumber: 'R1-456/2025',
      summary:
        'Općinski građanski sud donio rješenje o povjeravanju maloljetnog djeteta majci uz pravo oca na susrete i druženje.',
      category: 'obiteljsko',
      lang: 'hr',
      slug: 'rjesenje-roditeljska-skrb-r1-456-2025',
    },
    {
      title: 'Presuda u predmetu tjelesne ozljede — odgovornost poslodavca',
      court: splitId,
      decisionType: 'civil',
      date: '2025-08-27T00:00:00.000Z',
      caseNumber: 'Gž-789/2025',
      summary:
        'Splitski županijski sud potvrdio presudu kojom je poslodavac obvezan isplatiti naknadu štete radniku ozlijeđenom na radnom mjestu.',
      category: 'gradjansko',
      lang: 'hr',
      slug: 'presuda-tjelesna-ozljeda-gz-789-2025',
    },
    {
      title: 'Ruling on breach of commercial contract — supply agreement',
      court: vtsId,
      decisionType: 'commercial',
      date: '2025-10-15T00:00:00.000Z',
      caseNumber: 'Pž-321/2025',
      summary:
        'High Commercial Court confirmed liability of the supplier for failure to deliver goods under an annual supply agreement. Damages awarded.',
      category: 'commercial',
      lang: 'en',
      slug: 'ruling-breach-commercial-contract-pz-321-2025',
    },
    {
      title: 'Odluka o zastari tražbine iz ugovora o zajmu',
      court: ogszId,
      decisionType: 'civil',
      date: '2025-07-19T00:00:00.000Z',
      caseNumber: 'P-654/2025',
      summary:
        'Sud je utvrdio da je tražbina iz ugovora o zajmu zastarjela jer vjerovnik nije pokrenuo postupak u zakonskom roku od pet godina.',
      category: 'gradjansko',
      lang: 'hr',
      slug: 'odluka-zastara-zajam-p-654-2025',
    },
  ]
}

async function seedDecisions(courtIds: Record<string, string>): Promise<void> {
  console.log('Seeding court decisions...')
  for (const decision of makeDecisions(courtIds)) {
    const existing = await findBySlug('court-decisions', decision.slug)
    if (existing) {
      console.log(`  SKIP  court-decisions: ${decision.caseNumber}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).create({ collection: 'court-decisions', data: decision })
      console.log(`  CREATE court-decisions: ${decision.caseNumber}`)
    }
  }
}

// ─── expert witnesses ─────────────────────────────────────────────────────────

function makeExperts(courtIds: Record<string, string>) {
  const vtsId = courtIds['visoki-trgovacki-sud-republike-hrvatske']
  const ogszId = courtIds['opcinski-gradjanski-sud-u-zagrebu']

  return [
    {
      name: 'Prof. dr. sc. Ivan Šimić',
      specialityAreas: [{ area: 'Financijska forenzika' }, { area: 'Računovodstvo' }],
      languages: [{ language: 'hr' }, { language: 'en' }],
      county: 'Grad Zagreb',
      city: 'Zagreb',
      verified: true,
      assignedCourts: [vtsId, ogszId],
      lang: 'hr',
      slug: 'prof-dr-sc-ivan-simic',
    },
    {
      name: 'Dr. sc. Marija Horvat',
      specialityAreas: [{ area: 'Medicina' }, { area: 'Sudska psihijatrija' }],
      languages: [{ language: 'hr' }, { language: 'de' }],
      county: 'Splitsko-dalmatinska županija',
      city: 'Split',
      verified: true,
      assignedCourts: [courtIds['zupanijski-sud-u-splitu']],
      lang: 'hr',
      slug: 'dr-sc-marija-horvat',
    },
    {
      name: 'Ante Jurić, dipl. ing.',
      specialityAreas: [{ area: 'Graditeljstvo' }, { area: 'Procjena nekretnina' }],
      languages: [{ language: 'hr' }],
      county: 'Primorsko-goranska županija',
      city: 'Rijeka',
      verified: false,
      assignedCourts: [courtIds['trgovacki-sud-u-rijeci']],
      lang: 'hr',
      slug: 'ante-juric-dipl-ing',
    },
    {
      name: 'Vesna Petrović, magistra psihologije',
      specialityAreas: [{ area: 'Psihologija' }, { area: 'Neuropsihologijsko vještačenje' }],
      languages: [{ language: 'hr' }, { language: 'en' }],
      county: 'Osječko-baranjska županija',
      city: 'Osijek',
      verified: true,
      assignedCourts: [courtIds['prekrsajni-sud-u-osijeku']],
      lang: 'hr',
      slug: 'vesna-petrovic-magistra-psihologije',
    },
    {
      name: 'Drago Knežević, dipl. oec.',
      specialityAreas: [{ area: 'Ekonomija' }, { area: 'Financijska analiza' }, { area: 'Procjena vrijednosti poduzeća' }],
      languages: [{ language: 'hr' }, { language: 'en' }, { language: 'de' }],
      county: 'Grad Zagreb',
      city: 'Zagreb',
      verified: true,
      assignedCourts: [vtsId],
      lang: 'hr',
      slug: 'drago-knezevic-dipl-oec',
    },
  ]
}

async function seedExperts(courtIds: Record<string, string>): Promise<void> {
  console.log('Seeding expert witnesses...')
  for (const expert of makeExperts(courtIds)) {
    const existing = await findBySlug('expert-witnesses', expert.slug)
    if (existing) {
      console.log(`  SKIP  expert-witnesses: ${expert.name}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).create({ collection: 'expert-witnesses', data: expert })
      console.log(`  CREATE expert-witnesses: ${expert.name}`)
    }
  }
}

// ─── interpreters ─────────────────────────────────────────────────────────────

const INTERPRETERS = [
  {
    name: 'Anna Schmidt',
    languagePairs: [{ pair: 'hr-de' }, { pair: 'de-hr' }],
    county: 'Grad Zagreb',
    city: 'Zagreb',
    verified: true,
    lang: 'hr',
    slug: 'anna-schmidt',
  },
  {
    name: 'John Williams',
    languagePairs: [{ pair: 'hr-en' }, { pair: 'en-hr' }],
    county: 'Splitsko-dalmatinska županija',
    city: 'Split',
    verified: true,
    lang: 'hr',
    slug: 'john-williams',
  },
  {
    name: 'Marie Dupont',
    languagePairs: [{ pair: 'hr-fr' }, { pair: 'fr-hr' }, { pair: 'en-fr' }],
    county: 'Grad Zagreb',
    city: 'Zagreb',
    verified: false,
    lang: 'hr',
    slug: 'marie-dupont',
  },
  {
    name: 'Giuseppe Ferraro',
    languagePairs: [{ pair: 'hr-it' }, { pair: 'it-hr' }],
    county: 'Istarska županija',
    city: 'Pula',
    verified: true,
    lang: 'hr',
    slug: 'giuseppe-ferraro',
  },
  {
    name: 'Petra Novák',
    languagePairs: [{ pair: 'hr-sk' }, { pair: 'hr-cs' }, { pair: 'sk-cs' }],
    county: 'Grad Zagreb',
    city: 'Zagreb',
    verified: false,
    lang: 'hr',
    slug: 'petra-novak',
  },
]

async function seedInterpreters(): Promise<void> {
  console.log('Seeding interpreters...')
  for (const interpreter of INTERPRETERS) {
    const existing = await findBySlug('interpreters', interpreter.slug)
    if (existing) {
      console.log(`  SKIP  interpreters: ${interpreter.name}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).create({ collection: 'interpreters', data: interpreter })
      console.log(`  CREATE interpreters: ${interpreter.name}`)
    }
  }
}

// ─── bankruptcy ───────────────────────────────────────────────────────────────

async function seedBankruptcy(courtIds: Record<string, string>): Promise<void> {
  console.log('Seeding bankruptcy administrators...')
  let adminId: string

  const existingAdmin = await findBySlug('bankruptcy-administrators', 'stjepan-kolar')
  if (existingAdmin) {
    adminId = (existingAdmin as { id: string }).id
    console.log('  SKIP  bankruptcy-administrators: Stjepan Kolar')
  } else {
    const created = await payload.create({
      collection: 'bankruptcy-administrators',
      data: {
        name: 'Stjepan Kolar',
        licenceNumber: 'SU-0042',
        phone: '+385 98 321 654',
        email: 'stjepan.kolar@stecaj.hr',
        address: 'Ilica 12',
        city: 'Zagreb',
        county: 'Grad Zagreb',
        slug: 'stjepan-kolar',
      },
    })
    adminId = String(created.id)
    console.log('  CREATE bankruptcy-administrators: Stjepan Kolar')
  }

  console.log('Seeding bankruptcy listings...')
  const listings = [
    {
      caseNumber: 'St-55/2025',
      debtorName: 'Beta tvornica d.o.o.',
      court: courtIds['visoki-trgovacki-sud-republike-hrvatske'],
      administrator: adminId,
      deadline: '2026-04-30T00:00:00.000Z',
      status: 'active',
      publishedAt: '2026-01-15T12:00:00.000Z',
    },
    {
      caseNumber: 'St-88/2024',
      debtorName: 'Gamma promet d.d.',
      court: courtIds['trgovacki-sud-u-rijeci'],
      administrator: adminId,
      deadline: '2025-12-31T00:00:00.000Z',
      status: 'completed',
      publishedAt: '2025-06-01T10:00:00.000Z',
    },
  ]

  for (const listing of listings) {
    const existing = await findByCaseNumber(listing.caseNumber)
    if (existing) {
      console.log(`  SKIP  bankruptcy-listings: ${listing.caseNumber}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).create({ collection: 'bankruptcy-listings', data: listing })
      console.log(`  CREATE bankruptcy-listings: ${listing.caseNumber}`)
    }
  }
}

// ─── news posts ───────────────────────────────────────────────────────────────

const NEWS_POSTS = [
  {
    title: 'Izmjene Stečajnog zakona — novo u 2026.',
    content: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Hrvatski sabor usvojio je izmjene i dopune Stečajnog zakona koje stupaju na snagu 1. ožujka 2026. Izmjene se odnose na skraćenje rokova u predstečajnim postupcima i uvođenje elektroničkog dosjea stečajnog postupka.',
              },
            ],
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    },
    excerpt: 'Sažetak izmjena Stečajnog zakona koje stupaju na snagu 1. ožujka 2026.',
    category: 'vijesti',
    publishedAt: '2026-02-10T09:00:00.000Z',
    lang: 'hr',
    slug: 'izmjene-stecajnog-zakona-novo-u-2026',
  },
  {
    title: 'Novi e-Spis sustav za daljinsko praćenje sudskih predmeta',
    content: {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Ministarstvo pravosuđa pokrenulo je nadogradnju sustava e-Spis koji strankama i odvjetnicima omogućuje uvid u stanje predmeta, rokove i podnesene dokumente putem interneta.',
              },
            ],
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    },
    excerpt: 'Novi e-Spis sustav omogućuje strankama daljinsko praćenje sudskih predmeta.',
    category: 'obavijesti',
    publishedAt: '2026-03-01T08:00:00.000Z',
    lang: 'hr',
    slug: 'novi-e-spis-sustav-pracenje-predmeta',
  },
]

async function seedNewsPosts(): Promise<void> {
  console.log('Seeding news posts...')
  for (const post of NEWS_POSTS) {
    const existing = await findBySlug('news-posts', post.slug)
    if (existing) {
      console.log(`  SKIP  news-posts: ${post.title}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload as any).create({ collection: 'news-posts', data: post })
      console.log(`  CREATE news-posts: ${post.title}`)
    }
  }
}

// ─── admin user ───────────────────────────────────────────────────────────────

async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@sudacka-mreza.hr'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Change-Me-In-Prod-2026!'

  console.log('Seeding admin user...')
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`  SKIP  users: ${adminEmail}`)
  } else {
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'Sudačka Mreža',
        role: 'admin',
      },
    })
    console.log(`  CREATE users: ${adminEmail}`)
    console.log(`  ⚠ Change admin password before going to production!`)
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const config = await import(
    path.resolve(__dirname, '../payload.config.js')
  )

  payload = await getPayload({
    config: config.default,
  })

  console.log('\n=== Sudačka Mreža — Seed Script ===\n')

  const courtIds = await seedCourts()
  await seedDecisions(courtIds)
  await seedExperts(courtIds)
  await seedInterpreters()
  await seedBankruptcy(courtIds)
  await seedNewsPosts()
  await seedAdminUser()

  console.log('\n=== Seed complete ===\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
