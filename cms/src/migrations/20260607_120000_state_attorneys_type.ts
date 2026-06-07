import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds a `type` enum to state_attorneys so the public DORH page can offer the
 * "Vrsta odvjetništva" filter required by SM-REDESIGN section 3.5
 * (municipal / county / state / special).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_state_attorneys_type" AS ENUM ('municipal','county','state','special');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "state_attorneys"
      ADD COLUMN IF NOT EXISTS "type" "enum_state_attorneys_type";

    CREATE INDEX IF NOT EXISTS "state_attorneys_type_idx"
      ON "state_attorneys" ("type");

    -- Best-effort backfill from the name. Naziv patterns in HR:
    --   "Općinsko državno odvjetništvo u …"   -> municipal
    --   "Županijsko državno odvjetništvo u …" -> county
    --   "Državno odvjetništvo RH"             -> state
    UPDATE "state_attorneys"
      SET "type" = 'municipal'
      WHERE "type" IS NULL AND lower("name") LIKE 'op%inskoj%dr%avno odvjetni%';
    UPDATE "state_attorneys"
      SET "type" = 'municipal'
      WHERE "type" IS NULL AND lower("name") LIKE 'op%insko%dr%avno odvjetni%';
    UPDATE "state_attorneys"
      SET "type" = 'county'
      WHERE "type" IS NULL AND lower("name") LIKE '%upanijsko%dr%avno odvjetni%';
    UPDATE "state_attorneys"
      SET "type" = 'state'
      WHERE "type" IS NULL AND lower("name") LIKE 'dr%avno odvjetni%tvo republike hrvatske%';
    UPDATE "state_attorneys"
      SET "type" = 'state'
      WHERE "type" IS NULL AND lower("name") LIKE 'dr%avno odvjetni%tvo rh%';
    UPDATE "state_attorneys"
      SET "type" = 'special'
      WHERE "type" IS NULL AND (lower("name") LIKE '%uskok%' OR lower("name") LIKE '%posebno%');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "state_attorneys_type_idx";
    ALTER TABLE "state_attorneys" DROP COLUMN IF EXISTS "type";
    DROP TYPE IF EXISTS "enum_state_attorneys_type";
  `)
}
