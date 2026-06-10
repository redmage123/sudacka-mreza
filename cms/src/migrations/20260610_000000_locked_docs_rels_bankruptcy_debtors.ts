import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Backfill the bankruptcy_debtors_id rel on payload_locked_documents_rels.
 *
 * Payload v3 generates one <slug>_id column on payload_locked_documents_rels
 * per collection and joins all of them on every lock-status check. The
 * 20260520_210000_bankruptcy_debtors migration added the collection's own
 * table but missed wiring it into the locked-docs join, so any update on
 * any collection (via REST or local API) threw `column ... bankruptcy_
 * debtors_id does not exist` once the bankruptcy-debtors slug shipped.
 *
 * Idempotent — safe to re-run; safe on fresh DBs (matches the shape every
 * other collection already has).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "bankruptcy_debtors_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bankruptcy_debtors_id_idx"
      ON "payload_locked_documents_rels" ("bankruptcy_debtors_id");

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_bankruptcy_debtors_fk"
        FOREIGN KEY ("bankruptcy_debtors_id") REFERENCES "bankruptcy_debtors"("id") ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bankruptcy_debtors_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_bankruptcy_debtors_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "bankruptcy_debtors_id";
  `)
}
