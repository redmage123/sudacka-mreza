import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drazen QA: courts need a human-readable jurisdiction description
 * (separate from the GeoJSON polygon) and per-weekday working hours
 * so visitors know when the court is open to the public.
 *
 * Adds:
 *  - courts.jurisdiction_scope  (jsonb, Payload richText)
 *  - courts.time_availability_{monday..sunday}  (varchar)
 *  - courts.time_availability_notes (varchar)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courts"
      ADD COLUMN IF NOT EXISTS "jurisdiction_scope"            jsonb,
      ADD COLUMN IF NOT EXISTS "time_availability_monday"      varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_tuesday"     varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_wednesday"   varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_thursday"    varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_friday"      varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_saturday"    varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_sunday"      varchar,
      ADD COLUMN IF NOT EXISTS "time_availability_notes"       varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courts"
      DROP COLUMN IF EXISTS "time_availability_notes",
      DROP COLUMN IF EXISTS "time_availability_sunday",
      DROP COLUMN IF EXISTS "time_availability_saturday",
      DROP COLUMN IF EXISTS "time_availability_friday",
      DROP COLUMN IF EXISTS "time_availability_thursday",
      DROP COLUMN IF EXISTS "time_availability_wednesday",
      DROP COLUMN IF EXISTS "time_availability_tuesday",
      DROP COLUMN IF EXISTS "time_availability_monday",
      DROP COLUMN IF EXISTS "jurisdiction_scope";
  `)
}
