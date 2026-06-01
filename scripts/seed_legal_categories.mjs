// Seed the standard Croatian legal-area taxonomy into legal_categories.
// Roots + a few common sub-categories. Names taken from the Ministry of
// Justice published taxonomy.
import crypto from 'crypto'
import pg from 'pg'

function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[čć]/g, 'c').replace(/ž/g, 'z').replace(/š/g, 's').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

const ROOTS = [
  { hr: 'Kazneno pravo',                       en: 'Criminal law' },
  { hr: 'Građansko pravo',                     en: 'Civil law' },
  { hr: 'Upravno pravo',                       en: 'Administrative law' },
  { hr: 'Trgovačko pravo',                     en: 'Commercial law' },
  { hr: 'Radno pravo',                         en: 'Labor law' },
  { hr: 'Obiteljsko pravo',                    en: 'Family law' },
  { hr: 'Nasljedno pravo',                     en: 'Inheritance law' },
  { hr: 'Ovršno pravo',                        en: 'Enforcement law' },
  { hr: 'Stečajno pravo',                      en: 'Bankruptcy law' },
  { hr: 'Prekršajno pravo',                    en: 'Misdemeanor law' },
  { hr: 'Ustavno pravo',                       en: 'Constitutional law' },
  { hr: 'Europsko pravo',                      en: 'European Union law' },
  { hr: 'Pomorsko pravo',                      en: 'Maritime law' },
  { hr: 'Porezno pravo',                       en: 'Tax law' },
  { hr: 'Pravo intelektualnog vlasništva',     en: 'Intellectual property law' },
  { hr: 'Procesno pravo',                      en: 'Procedural law' },
  { hr: 'Međunarodno javno pravo',             en: 'Public international law' },
]
const CHILDREN_OF = {
  'Kazneno pravo':    [{ hr: 'Maloljetničko kazneno pravo', en: 'Juvenile criminal law' }],
  'Građansko pravo':  [
    { hr: 'Stvarno pravo',                  en: 'Property law' },
    { hr: 'Obvezno pravo',                  en: 'Law of obligations' },
    { hr: 'Stanarsko pravo',                en: 'Housing law' },
  ],
  'Procesno pravo':   [
    { hr: 'Parnični postupak',              en: 'Civil procedure' },
    { hr: 'Kazneni postupak',               en: 'Criminal procedure' },
    { hr: 'Upravni postupak',               en: 'Administrative procedure' },
  ],
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URI })
await c.connect()

let roots_inserted = 0, children_inserted = 0
const parentIds = new Map()

for (const r of ROOTS) {
  const slug = slugify(r.hr)
  const res = await c.query(
    `INSERT INTO legal_categories (name_hr, name_en, slug)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name_hr = EXCLUDED.name_hr, name_en = EXCLUDED.name_en
     RETURNING id`,
    [r.hr, r.en, slug],
  )
  parentIds.set(r.hr, res.rows[0].id)
  roots_inserted++
}

for (const [parentName, kids] of Object.entries(CHILDREN_OF)) {
  const parentId = parentIds.get(parentName)
  for (const k of kids) {
    const slug = slugify(`${parentName} ${k.hr}`)
    await c.query(
      `INSERT INTO legal_categories (name_hr, name_en, slug, parent_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name_hr = EXCLUDED.name_hr, name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id`,
      [k.hr, k.en, slug, parentId],
    )
    children_inserted++
  }
}

const total = await c.query('SELECT COUNT(*)::int AS n FROM legal_categories')
console.log(`roots upserted:    ${roots_inserted}`)
console.log(`children upserted: ${children_inserted}`)
console.log(`total in table:    ${total.rows[0].n}`)
await c.end()
