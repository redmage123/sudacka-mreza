import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 mockup §1 — judge profile header gains `firstName`, `lastName`,
 * `photo`, `department` (enum), and `years_of_experience` (number).
 *
 * `firstName`/`lastName` are auto-populated from the existing `name` field
 * by naive split-on-last-space; corrections happen in the admin UI.
 *
 * All additions are nullable so existing 4,832 judge rows stay valid.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_judges_department" AS ENUM (
      'civil', 'criminal', 'commercial', 'administrative',
      'constitutional', 'misdemeanor', 'family', 'labour', 'other'
    );

    ALTER TABLE "judges"
      ADD COLUMN IF NOT EXISTS "first_name" varchar,
      ADD COLUMN IF NOT EXISTS "last_name" varchar,
      ADD COLUMN IF NOT EXISTS "photo_id" integer,
      ADD COLUMN IF NOT EXISTS "department" "public"."enum_judges_department",
      ADD COLUMN IF NOT EXISTS "years_of_experience" numeric;

    CREATE INDEX IF NOT EXISTS "judges_photo_id_idx"
      ON "judges" USING btree ("photo_id");
    CREATE INDEX IF NOT EXISTS "judges_department_idx"
      ON "judges" USING btree ("department");

    ALTER TABLE "judges"
      ADD CONSTRAINT "judges_photo_id_fk"
      FOREIGN KEY ("photo_id") REFERENCES "media"("id") ON DELETE SET NULL;

    -- Note: backfilling first_name/last_name from existing name is done by
    -- scripts/legacy-migrate-appointments.mjs (row-by-row, so it can skip
    -- the handful of rows where a pre-existing duplicate slug would trigger
    -- a re-index violation). Doing it inline here would fail because some
    -- legacy rows share a slug.
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "judges"
      DROP CONSTRAINT IF EXISTS "judges_photo_id_fk";
    DROP INDEX IF EXISTS "judges_department_idx";
    DROP INDEX IF EXISTS "judges_photo_id_idx";
    ALTER TABLE "judges"
      DROP COLUMN IF EXISTS "years_of_experience",
      DROP COLUMN IF EXISTS "department",
      DROP COLUMN IF EXISTS "photo_id",
      DROP COLUMN IF EXISTS "last_name",
      DROP COLUMN IF EXISTS "first_name";
    DROP TYPE IF EXISTS "public"."enum_judges_department";
  `)
}
