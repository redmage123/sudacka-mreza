import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Convert ExpertWitnesses.specialityAreas[].subArea (single text field) into
 * an array of sub-areas so each branch can carry multiple narrow specializations.
 *
 *   before:  expert_witnesses_speciality_areas.sub_area  varchar?
 *   after:   expert_witnesses_speciality_areas_sub_areas (nested array)
 *              _order   int
 *              _parent_id varchar  -> expert_witnesses_speciality_areas.id
 *              id        varchar primary key
 *              value     varchar not null
 *
 * sub_area column is kept (for safety) but no longer surfaced by the schema.
 * Existing rows with a non-null sub_area get one starter sub-areas entry.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
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
    CREATE INDEX IF NOT EXISTS "expert_witnesses_speciality_areas_sub_areas_order_idx"
      ON "expert_witnesses_speciality_areas_sub_areas" ("_order");
    CREATE INDEX IF NOT EXISTS "expert_witnesses_speciality_areas_sub_areas_parent_id_idx"
      ON "expert_witnesses_speciality_areas_sub_areas" ("_parent_id");

    -- Backfill: any existing speciality-areas row with a populated sub_area
    -- gets one starter entry. id is the parent id with a -1 suffix so we stay
    -- deterministic and unique.
    INSERT INTO "expert_witnesses_speciality_areas_sub_areas"
      ("_order", "_parent_id", "id", "value")
    SELECT
      1, sa."id", sa."id" || '-1', TRIM(sa."sub_area")
    FROM "expert_witnesses_speciality_areas" sa
    WHERE sa."sub_area" IS NOT NULL AND TRIM(sa."sub_area") <> ''
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "expert_witnesses_speciality_areas_sub_areas" CASCADE;
  `)
}
