/**
 * seedTaxonomy.ts — Pre-seed Croatian legal taxonomy into LegalCategories.
 *
 * Idempotent: skips any category whose slug already exists.
 *
 * Usage:
 *   npx tsx src/migration/seedTaxonomy.ts
 *   # or via package.json:
 *   npm run seed:taxonomy
 *
 * Environment variables (optional):
 *   DATABASE_URI  — Postgres connection string (default: local dev)
 *   SERVER_URL    — Payload server URL (default: http://localhost:4094)
 *   PAYLOAD_SECRET — Payload secret (default: dev-secret-change-in-prod)
 */

import payload from 'payload'
import config from '../payload.config.js'

interface TaxonomySeed {
  name_hr: string
  name_en: string
  slug: string
  icon?: string
  description?: string
  parentSlug?: string
}

const TOP_LEVEL_CATEGORIES: TaxonomySeed[] = [
  {
    name_hr: 'Kazneno pravo',
    name_en: 'Criminal Law',
    slug: 'kazneno-pravo',
    icon: 'gavel',
    description: 'Pravo koje se bavi kaznenim djelima, kaznama i postupkom pred kaznenim sudovima.',
  },
  {
    name_hr: 'Građansko pravo',
    name_en: 'Civil Law',
    slug: 'gradjansko-pravo',
    icon: 'scale',
    description: 'Pravo kojim se uređuju privatnopravni odnosi između fizičkih i pravnih osoba.',
  },
  {
    name_hr: 'Trgovačko pravo',
    name_en: 'Commercial Law',
    slug: 'trgovacko-pravo',
    icon: 'briefcase',
    description: 'Pravo koje uređuje poslovanje trgovačkih društava, ugovore i tržišno natjecanje.',
  },
  {
    name_hr: 'Upravno pravo',
    name_en: 'Administrative Law',
    slug: 'upravno-pravo',
    icon: 'building-2',
    description: 'Pravo koje regulira odnos između državnih tijela i građana te pravnih osoba.',
  },
  {
    name_hr: 'Radno pravo',
    name_en: 'Labour Law',
    slug: 'radno-pravo',
    icon: 'users',
    description: 'Pravo koje uređuje radne odnose između poslodavaca i radnika.',
  },
  {
    name_hr: 'Obiteljsko pravo',
    name_en: 'Family Law',
    slug: 'obiteljsko-pravo',
    icon: 'heart',
    description: 'Pravo koje regulira brak, razvod, roditeljsku skrb i uzdržavanje.',
  },
  {
    name_hr: 'Stečajno pravo',
    name_en: 'Bankruptcy Law',
    slug: 'stecajno-pravo',
    icon: 'trending-down',
    description: 'Pravo koje uređuje postupak stečaja i likvidacije dužnika nesposobnih za plaćanje.',
  },
  {
    name_hr: 'Ustavno pravo',
    name_en: 'Constitutional Law',
    slug: 'ustavno-pravo',
    icon: 'landmark',
    description: 'Pravo koje se temelji na Ustavu RH i regulira temeljne državne institucije i ljudska prava.',
  },
  {
    name_hr: 'Europsko pravo',
    name_en: 'EU Law',
    slug: 'europsko-pravo',
    icon: 'globe',
    description: 'Pravo Europske unije — uredbe, direktive i odluke institucija EU.',
  },
  {
    name_hr: 'Prekršajno pravo',
    name_en: 'Misdemeanour Law',
    slug: 'prekrsajno-pravo',
    icon: 'alert-triangle',
    description: 'Pravo koje uređuje prekršaje i prekršajni postupak pred prekršajnim sudovima.',
  },
]

async function seedTaxonomy(): Promise<void> {
  await payload.init({ config })

  console.log('\n🌱  Seeding legal taxonomy...\n')

  let created = 0
  let skipped = 0

  for (const cat of TOP_LEVEL_CATEGORIES) {
    // Check if already exists by slug
    const existing = await payload.find({
      collection: 'legal-categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.totalDocs > 0) {
      console.log(`  SKIP  ${cat.slug}`)
      skipped++
      continue
    }

    await payload.create({
      collection: 'legal-categories',
      data: {
        name_hr: cat.name_hr,
        name_en: cat.name_en,
        slug: cat.slug,
        icon: cat.icon ?? null,
        description: cat.description ?? null,
      },
    })

    console.log(`  CREATE ${cat.slug}  (${cat.name_en})`)
    created++
  }

  console.log(`\n✅  Done — created: ${created}, skipped: ${skipped}\n`)
  process.exit(0)
}

seedTaxonomy().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
