import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Corrections-doc item 7: distinguish user types so a "pravno lice" (legal
 * entity) can act on the platform with permissions distinct from a regular
 * member but narrower than an internal editor.
 *
 * - Adds 'legal_entity' to the existing enum_users_role enum.
 * - Adds nullable organisation_name + organisation_oib columns on users
 *   (visible in the admin UI only when role=legal_entity).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Postgres 12+ allows ALTER TYPE ADD VALUE inside a transaction as long as
    -- the new value isn't used in the same transaction; we only add it here.
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'legal_entity';

    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "organisation_name" varchar,
      ADD COLUMN IF NOT EXISTS "organisation_oib" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reversing ALTER TYPE ADD VALUE in Postgres is not supported without
  // recreating the enum (which would require migrating all dependent columns).
  // The organisation_* columns can be dropped safely.
  await db.execute(sql`
    ALTER TABLE "users"
      DROP COLUMN IF EXISTS "organisation_oib",
      DROP COLUMN IF EXISTS "organisation_name";
  `)
}
