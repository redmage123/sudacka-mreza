import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the missing payload_locked_documents_rels.attorneys_id column.
 *
 * The Attorneys collection is registered in the Payload config but its rel
 * column on the locked-documents pivot table was never added by an earlier
 * migration. Every DELETE on any other collection (e.g. expert-witnesses)
 * runs a "are there any admin previews locking this doc?" query that joins
 * across ALL registered collection ids — and crashes with
 *   "column attorneys_id does not exist"
 * when this column is missing. See bug log 2026-06-11 18:00 UTC.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "attorneys_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_attorneys_id_idx"
      ON "payload_locked_documents_rels" ("attorneys_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_attorneys_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "attorneys_id";
  `)
}
