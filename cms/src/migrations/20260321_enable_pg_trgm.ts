/**
 * Migration: Enable pg_trgm extension and add GIN indexes for full-text search
 *
 * E2-14 acceptance criteria:
 *   - CREATE EXTENSION pg_trgm in migration
 *   - GIN indexes visible in \d+
 *
 * pg_trgm provides:
 *   - similarity() for fuzzy name search (diacritic handling via unaccent)
 *   - GIN indexes for fast LIKE/ILIKE queries
 *
 * Additional extensions enabled:
 *   - unaccent: strip diacritics (Štefica → stefica) for search
 *   - uuid-ossp: UUID generation (Payload default)
 */
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ─── Extensions ──────────────────────────────────────────────────────────
  await db.execute(
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  )
  await db.execute(
    `CREATE EXTENSION IF NOT EXISTS unaccent`,
  )
  await db.execute(
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  )

  // ─── court_decisions: full-text GIN on full_text_plain + trigram on title ─
  // Payload CMS stores fields in snake_case in the DB
  await db.execute(`
    CREATE INDEX IF NOT EXISTS court_decisions_full_text_plain_gin
    ON court_decisions
    USING GIN (to_tsvector('simple', COALESCE(full_text_plain, '')))
  `)

  await db.execute(`
    CREATE INDEX IF NOT EXISTS court_decisions_title_trgm
    ON court_decisions
    USING GIN (title gin_trgm_ops)
  `)

  await db.execute(`
    CREATE INDEX IF NOT EXISTS court_decisions_case_number_trgm
    ON court_decisions
    USING GIN (case_number gin_trgm_ops)
  `)

  await db.execute(`
    CREATE INDEX IF NOT EXISTS court_decisions_search_vector_trgm
    ON court_decisions
    USING GIN (COALESCE(search_vector, '') gin_trgm_ops)
  `)

  // ─── expert_witnesses: trigram on name + speciality_areas search ──────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS expert_witnesses_name_trgm
    ON expert_witnesses
    USING GIN (name gin_trgm_ops)
  `)

  // ─── interpreters: trigram on name ───────────────────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS interpreters_name_trgm
    ON interpreters
    USING GIN (name gin_trgm_ops)
  `)

  // ─── courts: trigram on name ─────────────────────────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS courts_name_trgm
    ON courts
    USING GIN (name gin_trgm_ops)
  `)

  // ─── news_posts: trigram on title ─────────────────────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS news_posts_title_trgm
    ON news_posts
    USING GIN (title gin_trgm_ops)
  `)

  // ─── bankruptcy_listings: trigram on debtor_name + case_number ───────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS bankruptcy_listings_debtor_name_trgm
    ON bankruptcy_listings
    USING GIN (debtor_name gin_trgm_ops)
  `)

  await db.execute(`
    CREATE INDEX IF NOT EXISTS bankruptcy_listings_case_number_trgm
    ON bankruptcy_listings
    USING GIN (case_number gin_trgm_ops)
  `)

  // ─── bankruptcy_administrators: trigram on name ───────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS bankruptcy_administrators_name_trgm
    ON bankruptcy_administrators
    USING GIN (name gin_trgm_ops)
  `)

  // ─── laws: trigram on title ───────────────────────────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS laws_title_trgm
    ON laws
    USING GIN (title gin_trgm_ops)
  `)

  // ─── state_attorneys: trigram on name ────────────────────────────────────
  await db.execute(`
    CREATE INDEX IF NOT EXISTS state_attorneys_name_trgm
    ON state_attorneys
    USING GIN (name gin_trgm_ops)
  `)

  // ─── Set pg_trgm similarity threshold ────────────────────────────────────
  // 0.3 is a good default for Croatian names with diacritics
  await db.execute(`SELECT set_limit(0.3)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const indexes = [
    'court_decisions_full_text_plain_gin',
    'court_decisions_title_trgm',
    'court_decisions_case_number_trgm',
    'court_decisions_search_vector_trgm',
    'expert_witnesses_name_trgm',
    'interpreters_name_trgm',
    'courts_name_trgm',
    'news_posts_title_trgm',
    'bankruptcy_listings_debtor_name_trgm',
    'bankruptcy_listings_case_number_trgm',
    'bankruptcy_administrators_name_trgm',
    'laws_title_trgm',
    'state_attorneys_name_trgm',
  ]

  for (const idx of indexes) {
    await db.execute(`DROP INDEX IF EXISTS ${idx}`)
  }
  // Note: we intentionally do not DROP EXTENSION pg_trgm or unaccent
  // as other database objects may depend on them.
}
