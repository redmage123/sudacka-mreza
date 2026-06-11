import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Revert the sub-areas nested-array shape introduced in
 * 20260611_180000_expert_sub_areas_array.
 *
 * UX feedback: a flat list of (area, subArea) pairs is what's wanted; the
 * nested array editor was confusing. The original sub_area varchar column on
 * expert_witnesses_speciality_areas was never dropped, so reverting is a
 * simple table drop — no data loss because sub_area still holds the canonical
 * single value per speciality row.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "expert_witnesses_speciality_areas_sub_areas" CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "expert_witnesses_speciality_areas_sub_areas" (
      "_order"     integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id"         varchar NOT NULL,
      "value"      varchar NOT NULL,
      CONSTRAINT "expert_witnesses_speciality_areas_sub_areas_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "expert_witnesses_speciality_areas_sub_areas_parent_id_fk"
        FOREIGN KEY ("_parent_id")
        REFERENCES "expert_witnesses_speciality_areas"("id") ON DELETE CASCADE
    );
  `)
}
