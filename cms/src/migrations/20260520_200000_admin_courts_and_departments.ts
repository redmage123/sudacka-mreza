import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two related schema additions driven by the SM-REDESIGN backend doc + the
 * client's corrections document:
 *
 * 1) bankruptcy_administrators.courts (hasMany → courts)
 *    The corrections doc calls out that trustees are missing "pripadnost sudu"
 *    (court affiliation). The redesign doc's trustee search bar (§3.7.c.2)
 *    requires filtering by court. Payload stores hasMany relationships on the
 *    existing `bankruptcy_administrators_rels` table — we just add the
 *    courts_id column + FK + index alongside the existing
 *    bankruptcy_listings_id one.
 *
 * 2) courts_departments (array field on courts)
 *    The corrections doc adds court sub-units (registry / president's office /
 *    secretary / spokesperson / other) that the original schema doesn't carry.
 *    Payload represents array fields as a child table named
 *    <parent>_<field-snake> keyed by (_parent_id, _order, id).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── 1) bankruptcy_administrators.courts hasMany ────────────────────────
    ALTER TABLE "bankruptcy_administrators_rels"
      ADD COLUMN IF NOT EXISTS "courts_id" integer;

    CREATE INDEX IF NOT EXISTS "bankruptcy_administrators_rels_courts_id_idx"
      ON "bankruptcy_administrators_rels" USING btree ("courts_id");

    ALTER TABLE "bankruptcy_administrators_rels"
      ADD CONSTRAINT "bankruptcy_administrators_rels_courts_fk"
      FOREIGN KEY ("courts_id") REFERENCES "courts"("id") ON DELETE CASCADE;

    -- ── 2) courts_departments array field ──────────────────────────────────
    CREATE TYPE "public"."enum_courts_departments_type" AS ENUM(
      'registry',
      'president',
      'secretary',
      'spokesperson',
      'other'
    );

    CREATE TABLE "courts_departments" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "type" "enum_courts_departments_type",
      "head" varchar,
      "phone" varchar,
      "email" varchar,
      "notes" varchar
    );

    CREATE INDEX "courts_departments_order_idx"
      ON "courts_departments" USING btree ("_order");
    CREATE INDEX "courts_departments_parent_id_idx"
      ON "courts_departments" USING btree ("_parent_id");

    ALTER TABLE "courts_departments"
      ADD CONSTRAINT "courts_departments_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "courts"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "courts_departments" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_courts_departments_type";

    ALTER TABLE "bankruptcy_administrators_rels"
      DROP CONSTRAINT IF EXISTS "bankruptcy_administrators_rels_courts_fk";
    DROP INDEX IF EXISTS "bankruptcy_administrators_rels_courts_id_idx";
    ALTER TABLE "bankruptcy_administrators_rels"
      DROP COLUMN IF EXISTS "courts_id";
  `)
}
