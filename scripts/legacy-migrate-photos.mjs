#!/usr/bin/env node
// Copy `suci.slika` photo URLs from legacy directory into Payload's
// `media` table, then set `judges.photo_id` for any judge that doesn't
// already have one.
//
// Idempotent — re-running skips judges that already have a photo. Match
// from legacy → new is name-based (judges.name = suci.ime0 ' ' suci.prezime0),
// which is the same convention the original 20260327_judges migration used.
//
// Usage (from Toronto):
//   node scripts/legacy-migrate-photos.mjs --dry-run
//   node scripts/legacy-migrate-photos.mjs
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry-run')
const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F\\t -q'

const ts = () => new Date().toISOString()
const log = (...a) => console.log(ts(), ...a)

const psql = (sqlText) =>
  execSync(`${PG} -c "${sqlText.replaceAll('"', '\\"')}"`, { encoding: 'utf8' })

// 1. Find legacy photos that don't yet have a Payload counterpart.
const rows = psql(`
  SELECT s.id, s.ime0, s.prezime0, s.slika
  FROM suci s
  WHERE s.slika IS NOT NULL AND s.slika <> ''
    AND NOT EXISTS (
      SELECT 1 FROM judges j
       WHERE j.photo_id IS NOT NULL
         AND lower(j.name) = lower(trim(coalesce(s.ime0,'') || ' ' || coalesce(s.prezime0,'')))
    )
`).trim().split('\n').filter(Boolean)

log(`legacy photos to migrate: ${rows.length}`)
if (DRY) {
  log('dry-run — first 5:', rows.slice(0, 5))
  process.exit(0)
}

let migrated = 0
let skipped = 0
for (const row of rows) {
  const [, ime0, prezime0, slika] = row.split('\t')
  const fullName = `${ime0 || ''} ${prezime0 || ''}`.trim()
  if (!fullName) {
    skipped++
    continue
  }
  // Find the matching judge (by lowercase name).
  const judgeIds = psql(
    `SELECT id FROM judges WHERE lower(name) = lower('${fullName.replaceAll("'", "''")}') AND photo_id IS NULL LIMIT 1`,
  ).trim()
  if (!judgeIds) {
    skipped++
    continue
  }
  const judgeId = judgeIds.split('\n')[0]
  // Insert media row pointing at the legacy URL. We don't download — the
  // legacy URLs are still served; Media.url is what the frontend renders.
  const filename = slika.split('/').pop() || `legacy-judge-${judgeId}.jpg`
  const mediaId = psql(`
    INSERT INTO media (filename, mime_type, url, alt, updated_at, created_at)
    VALUES (
      '${filename.replaceAll("'", "''")}',
      'image/jpeg',
      '${slika.replaceAll("'", "''")}',
      'Sudac ${fullName.replaceAll("'", "''")}',
      now(), now()
    )
    RETURNING id
  `).trim()
  psql(`UPDATE judges SET photo_id = ${mediaId} WHERE id = ${judgeId}`)
  migrated++
  if (migrated % 50 === 0) log(`migrated ${migrated}/${rows.length}`)
}
log(`done — migrated=${migrated} skipped=${skipped}`)
