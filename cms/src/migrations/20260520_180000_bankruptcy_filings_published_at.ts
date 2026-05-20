import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `published_at` column to `bankruptcy_filings`. The bankruptcy-ingest
 * FastAPI service (separate Python container) inserts this column on every
 * editor submission via /api/editor/filing, so the table must carry it or every
 * submission errors with `column "published_at" does not exist`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bankruptcy_filings"
      ADD COLUMN IF NOT EXISTS "published_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bankruptcy_filings" DROP COLUMN IF EXISTS "published_at";
  `)
}
