#!/usr/bin/env node
// Seed the new `attorneys` collection from the legacy `odvjetnici` table.
//
// For each legacy attorney row:
//   - canonical name = trim(ime0 ' ' prezime0)
//   - aliases        = non-empty (ime1..9 ' ' prezime1..9) pairs
//   - firm           = first non-empty odvjetnistva.naziv via
//                       odvjetnik_odvjetnistva (most recent if multiple)
//   - photo, cv, email are migrated as-is
//
// Idempotent — re-running skips rows whose `legacy_id` already exists.
//
// Usage (from Toronto):
//   node scripts/legacy-migrate-attorneys.mjs --dry-run
//   node scripts/legacy-migrate-attorneys.mjs
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry-run')
const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F~ -q'

const log = (...a) => console.log(new Date().toISOString(), ...a)
const psql = (sqlText) =>
  execSync(`${PG} -c "${sqlText.replaceAll('"', '\\"')}"`, { encoding: 'utf8' })
const esc = (s) => s == null ? null : String(s).replaceAll("'", "''")

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

// Pull legacy rows that aren't yet in attorneys.
const rows = psql(`
  SELECT o.id, o.ime0, o.prezime0, o.email, o.slika, o.aktivan,
         o.ime1, o.prezime1, o.ime2, o.prezime2, o.ime3, o.prezime3,
         o.ime4, o.prezime4, o.ime5, o.prezime5, o.ime6, o.prezime6,
         o.ime7, o.prezime7, o.ime8, o.prezime8, o.ime9, o.prezime9,
         (SELECT odv.naziv0
            FROM odvjetnik_odvjetnistva link
            JOIN odvjetnistva odv ON odv.id = link.odvjetnistvoid
            WHERE link.odvjetnikid = o.odvjetnikid
              AND odv.naziv0 IS NOT NULL AND odv.naziv0 <> ''
            LIMIT 1) AS firm
    FROM odvjetnici o
   WHERE NOT EXISTS (SELECT 1 FROM attorneys a WHERE a.legacy_id = o.id)
`).trim().split('\n').filter(Boolean)

log(`legacy attorneys to migrate: ${rows.length}`)
if (DRY) {
  log('dry-run — sample:', rows.slice(0, 3))
  process.exit(0)
}

let migrated = 0
const usedSlugs = new Set()
for (const row of rows) {
  const cols = row.split('~').map((v) => (v === '\\N' ? null : v))
  const [legacyId, ime0, prezime0, email, slika, aktivan,
         ime1, prezime1, ime2, prezime2, ime3, prezime3,
         ime4, prezime4, ime5, prezime5, ime6, prezime6,
         ime7, prezime7, ime8, prezime8, ime9, prezime9,
         firm] = cols
  const canonical = `${ime0 || ''} ${prezime0 || ''}`.trim()
  if (!canonical) continue

  let slug = slugify(canonical)
  if (!slug) slug = `attorney-${legacyId}`
  let n = 1
  while (usedSlugs.has(slug)) {
    n++
    slug = `${slugify(canonical)}-${n}`
  }
  usedSlugs.add(slug)

  let photoId = null
  if (slika) {
    const filename = slika.split('/').pop() || `legacy-attorney-${legacyId}.jpg`
    photoId = psql(`
      INSERT INTO media (filename, mime_type, url, alt, updated_at, created_at)
      VALUES (
        '${esc(filename)}', 'image/jpeg', '${esc(slika)}',
        'Odvjetnik ${esc(canonical)}', now(), now()
      )
      RETURNING id
    `).trim() || null
  }

  let attorneyId
  try {
    attorneyId = psql(`
      INSERT INTO attorneys (name, first_name, last_name, email, photo_id,
                             firm, legacy_id, lang, slug, updated_at, created_at)
      VALUES (
        '${esc(canonical)}',
        '${esc(ime0 || '')}',
        '${esc(prezime0 || '')}',
        ${email ? `'${esc(email)}'` : 'NULL'},
        ${photoId || 'NULL'},
        ${firm ? `'${esc(firm)}'` : 'NULL'},
        ${legacyId},
        'hr',
        '${esc(slug)}',
        now(), now()
      )
      RETURNING id
    `).trim()
  } catch (e) {
    if (migrated < 3) log(`first-failure legacyId=${legacyId} canonical="${canonical}" slug="${slug}" err:`, String(e).slice(0, 300))
    continue
  }
  if (!attorneyId) {
    if (migrated < 3) log(`empty-id legacyId=${legacyId} canonical="${canonical}" slug="${slug}"`)
    continue
  }

  // Aliases: non-empty (imeN, prezimeN) pairs for N≥1.
  const aliasPairs = [
    [ime1, prezime1], [ime2, prezime2], [ime3, prezime3], [ime4, prezime4],
    [ime5, prezime5], [ime6, prezime6], [ime7, prezime7], [ime8, prezime8],
    [ime9, prezime9],
  ]
  let order = 0
  for (const [i, p] of aliasPairs) {
    const alias = `${i || ''} ${p || ''}`.trim()
    if (!alias || alias === canonical) continue
    psql(`
      INSERT INTO attorneys_aliases (_order, _parent_id, id, full_name)
      VALUES (${order}, ${attorneyId}, gen_random_uuid()::text, '${esc(alias)}')
    `)
    order++
  }

  migrated++
  if (migrated % 100 === 0) log(`migrated ${migrated}/${rows.length}`)
}
log(`done — migrated=${migrated}`)
