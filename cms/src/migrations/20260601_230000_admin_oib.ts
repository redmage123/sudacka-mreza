import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds an `oib` column to bankruptcy_administrators so the official
 * Croatian tax-id from the Ministry registry can be stored. OIBs are
 * 11-digit numbers and uniquely identify a person/entity in Croatia, so
 * this also serves as a natural deduplication key when re-syncing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bankruptcy_administrators"
      ADD COLUMN IF NOT EXISTS "oib" varchar(11);
    CREATE INDEX IF NOT EXISTS "bankruptcy_administrators_oib_idx"
      ON "bankruptcy_administrators" ("oib");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "bankruptcy_administrators_oib_idx";
    ALTER TABLE "bankruptcy_administrators"
      DROP COLUMN IF EXISTS "oib";
  `)
}
