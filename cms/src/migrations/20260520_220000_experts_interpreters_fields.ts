import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Corrections-doc item 4 — schema additions to expert_witnesses and
 * interpreters per SM-REDESIGN §3.2.2 and §3.3.2:
 *
 * - `address`, `company`, `cv_id` (→ media), and a sub-area on speciality
 *   areas for expert_witnesses
 * - `address`, `company`, `cv_id` (→ media) for interpreters
 * - Adds `media_id` to each rels table to back the new `works` hasMany
 *   relationship (existing `path` column distinguishes it from other rels)
 *
 * All additions are nullable so existing rows stay valid.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── expert_witnesses scalars + cv FK ──────────────────────────────────
    ALTER TABLE "expert_witnesses"
      ADD COLUMN IF NOT EXISTS "address" varchar,
      ADD COLUMN IF NOT EXISTS "company" varchar,
      ADD COLUMN IF NOT EXISTS "cv_id" integer;
    CREATE INDEX IF NOT EXISTS "expert_witnesses_cv_id_idx"
      ON "expert_witnesses" USING btree ("cv_id");
    ALTER TABLE "expert_witnesses"
      ADD CONSTRAINT "expert_witnesses_cv_id_fk"
      FOREIGN KEY ("cv_id") REFERENCES "media"("id") ON DELETE SET NULL;

    -- ── expert_witnesses_speciality_areas: sub-branch ────────────────────
    ALTER TABLE "expert_witnesses_speciality_areas"
      ADD COLUMN IF NOT EXISTS "sub_area" varchar;

    -- ── expert_witnesses_rels: media_id for works hasMany ─────────────────
    ALTER TABLE "expert_witnesses_rels"
      ADD COLUMN IF NOT EXISTS "media_id" integer;
    CREATE INDEX IF NOT EXISTS "expert_witnesses_rels_media_id_idx"
      ON "expert_witnesses_rels" USING btree ("media_id");
    ALTER TABLE "expert_witnesses_rels"
      ADD CONSTRAINT "expert_witnesses_rels_media_fk"
      FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;

    -- ── interpreters scalars + cv FK ─────────────────────────────────────
    ALTER TABLE "interpreters"
      ADD COLUMN IF NOT EXISTS "address" varchar,
      ADD COLUMN IF NOT EXISTS "company" varchar,
      ADD COLUMN IF NOT EXISTS "cv_id" integer;
    CREATE INDEX IF NOT EXISTS "interpreters_cv_id_idx"
      ON "interpreters" USING btree ("cv_id");
    ALTER TABLE "interpreters"
      ADD CONSTRAINT "interpreters_cv_id_fk"
      FOREIGN KEY ("cv_id") REFERENCES "media"("id") ON DELETE SET NULL;

    -- ── interpreters_rels: media_id for works hasMany ────────────────────
    ALTER TABLE "interpreters_rels"
      ADD COLUMN IF NOT EXISTS "media_id" integer;
    CREATE INDEX IF NOT EXISTS "interpreters_rels_media_id_idx"
      ON "interpreters_rels" USING btree ("media_id");
    ALTER TABLE "interpreters_rels"
      ADD CONSTRAINT "interpreters_rels_media_fk"
      FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "interpreters_rels"
      DROP CONSTRAINT IF EXISTS "interpreters_rels_media_fk";
    DROP INDEX IF EXISTS "interpreters_rels_media_id_idx";
    ALTER TABLE "interpreters_rels" DROP COLUMN IF EXISTS "media_id";

    ALTER TABLE "interpreters"
      DROP CONSTRAINT IF EXISTS "interpreters_cv_id_fk";
    DROP INDEX IF EXISTS "interpreters_cv_id_idx";
    ALTER TABLE "interpreters"
      DROP COLUMN IF EXISTS "cv_id",
      DROP COLUMN IF EXISTS "company",
      DROP COLUMN IF EXISTS "address";

    ALTER TABLE "expert_witnesses_rels"
      DROP CONSTRAINT IF EXISTS "expert_witnesses_rels_media_fk";
    DROP INDEX IF EXISTS "expert_witnesses_rels_media_id_idx";
    ALTER TABLE "expert_witnesses_rels" DROP COLUMN IF EXISTS "media_id";

    ALTER TABLE "expert_witnesses_speciality_areas"
      DROP COLUMN IF EXISTS "sub_area";

    ALTER TABLE "expert_witnesses"
      DROP CONSTRAINT IF EXISTS "expert_witnesses_cv_id_fk";
    DROP INDEX IF EXISTS "expert_witnesses_cv_id_idx";
    ALTER TABLE "expert_witnesses"
      DROP COLUMN IF EXISTS "cv_id",
      DROP COLUMN IF EXISTS "company",
      DROP COLUMN IF EXISTS "address";
  `)
}
