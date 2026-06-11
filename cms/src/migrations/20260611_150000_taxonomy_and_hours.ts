import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * NEDOSTACI items 2, 4, 5, 6 + REDESIGN §3.2 / §3.3 schema work:
 *   - normalize county values across courts / experts / interpreters
 *     (strip " županija" suffix that crept in from inconsistent scraping)
 *   - add Experts.expertType + Experts.educationLevel columns
 *   - add per-weekday workingHours arrays to Experts, Interpreters,
 *     Courts (operating + public-service), and Courts.departments
 *   - introduce Interpreters.languages (replaces free-text languagePairs)
 *
 * Columns are kept as varchar (Payload select stores values as text;
 * we constrain via field options in the schema, not via PG enums, since
 * the expertise list is ~230 entries and would make enum management painful).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ============================================================
    -- 1. Normalize county values
    -- ============================================================
    UPDATE "courts"
      SET "county" = REGEXP_REPLACE(TRIM("county"), '\\s+županija$', '', 'i')
      WHERE "county" IS NOT NULL;
    UPDATE "expert_witnesses"
      SET "county" = REGEXP_REPLACE(TRIM("county"), '\\s+županija$', '', 'i')
      WHERE "county" IS NOT NULL;
    UPDATE "interpreters"
      SET "county" = REGEXP_REPLACE(TRIM("county"), '\\s+županija$', '', 'i')
      WHERE "county" IS NOT NULL;

    -- ============================================================
    -- 2. Expert Witnesses: expertType + educationLevel columns
    -- ============================================================
    ALTER TABLE "expert_witnesses"
      ADD COLUMN IF NOT EXISTS "expert_type" varchar,
      ADD COLUMN IF NOT EXISTS "education_level" varchar;

    -- ============================================================
    -- 3. Working hours arrays (one table per parent location)
    -- ============================================================
    -- Experts
    CREATE TABLE IF NOT EXISTS "expert_witnesses_working_hours" (
      "_order"            integer NOT NULL,
      "_parent_id"        integer NOT NULL,
      "id"                varchar NOT NULL,
      "weekday"           varchar NOT NULL,
      "closed"            boolean DEFAULT false,
      "open_time"         varchar,
      "close_time"        varchar,
      "second_open_time"  varchar,
      "second_close_time" varchar,
      "note"              varchar,
      CONSTRAINT "expert_witnesses_working_hours_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "expert_witnesses_working_hours_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "expert_witnesses"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "expert_witnesses_working_hours_order_idx"
      ON "expert_witnesses_working_hours" ("_order");
    CREATE INDEX IF NOT EXISTS "expert_witnesses_working_hours_parent_id_idx"
      ON "expert_witnesses_working_hours" ("_parent_id");

    -- Interpreters
    CREATE TABLE IF NOT EXISTS "interpreters_working_hours" (
      "_order"            integer NOT NULL,
      "_parent_id"        integer NOT NULL,
      "id"                varchar NOT NULL,
      "weekday"           varchar NOT NULL,
      "closed"            boolean DEFAULT false,
      "open_time"         varchar,
      "close_time"        varchar,
      "second_open_time"  varchar,
      "second_close_time" varchar,
      "note"              varchar,
      CONSTRAINT "interpreters_working_hours_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "interpreters_working_hours_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "interpreters"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "interpreters_working_hours_order_idx"
      ON "interpreters_working_hours" ("_order");
    CREATE INDEX IF NOT EXISTS "interpreters_working_hours_parent_id_idx"
      ON "interpreters_working_hours" ("_parent_id");

    -- Courts (top-level operating hours)
    CREATE TABLE IF NOT EXISTS "courts_operating_hours" (
      "_order"            integer NOT NULL,
      "_parent_id"        integer NOT NULL,
      "id"                varchar NOT NULL,
      "weekday"           varchar NOT NULL,
      "closed"            boolean DEFAULT false,
      "open_time"         varchar,
      "close_time"        varchar,
      "second_open_time"  varchar,
      "second_close_time" varchar,
      "note"              varchar,
      CONSTRAINT "courts_operating_hours_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "courts_operating_hours_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "courts"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "courts_operating_hours_order_idx"
      ON "courts_operating_hours" ("_order");
    CREATE INDEX IF NOT EXISTS "courts_operating_hours_parent_id_idx"
      ON "courts_operating_hours" ("_parent_id");

    -- Courts (public-service hours — separate from operating)
    CREATE TABLE IF NOT EXISTS "courts_public_service_hours" (
      "_order"            integer NOT NULL,
      "_parent_id"        integer NOT NULL,
      "id"                varchar NOT NULL,
      "weekday"           varchar NOT NULL,
      "closed"            boolean DEFAULT false,
      "open_time"         varchar,
      "close_time"        varchar,
      "second_open_time"  varchar,
      "second_close_time" varchar,
      "note"              varchar,
      CONSTRAINT "courts_public_service_hours_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "courts_public_service_hours_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "courts"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "courts_public_service_hours_order_idx"
      ON "courts_public_service_hours" ("_order");
    CREATE INDEX IF NOT EXISTS "courts_public_service_hours_parent_id_idx"
      ON "courts_public_service_hours" ("_parent_id");

    -- Courts.departments[].workingHours — nested array.
    -- Parent is courts_departments.id (varchar), not courts.id.
    CREATE TABLE IF NOT EXISTS "courts_departments_working_hours" (
      "_order"            integer NOT NULL,
      "_parent_id"        varchar NOT NULL,
      "id"                varchar NOT NULL,
      "weekday"           varchar NOT NULL,
      "closed"            boolean DEFAULT false,
      "open_time"         varchar,
      "close_time"        varchar,
      "second_open_time"  varchar,
      "second_close_time" varchar,
      "note"              varchar,
      CONSTRAINT "courts_departments_working_hours_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "courts_departments_working_hours_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "courts_departments"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "courts_departments_working_hours_order_idx"
      ON "courts_departments_working_hours" ("_order");
    CREATE INDEX IF NOT EXISTS "courts_departments_working_hours_parent_id_idx"
      ON "courts_departments_working_hours" ("_parent_id");

    -- ============================================================
    -- 4. Interpreters.languages (replaces languagePairs[].pair)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS "interpreters_languages" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar NOT NULL,
      "language"   varchar NOT NULL,
      CONSTRAINT "interpreters_languages_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "interpreters_languages_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "interpreters"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "interpreters_languages_order_idx"
      ON "interpreters_languages" ("_order");
    CREATE INDEX IF NOT EXISTS "interpreters_languages_parent_id_idx"
      ON "interpreters_languages" ("_parent_id");

    -- Migrate existing pairs: take the side that isn't 'hr', else first half.
    -- pair examples: 'hr-en' → 'en', 'en-de' → 'en', 'hr' → 'hr'
    INSERT INTO "interpreters_languages" ("_order", "_parent_id", "id", "language")
    SELECT
      p."_order",
      p."_parent_id",
      p."id",
      CASE
        WHEN p."pair" ILIKE 'hr-%' THEN LOWER(SPLIT_PART(p."pair", '-', 2))
        WHEN p."pair" ILIKE '%-hr' THEN LOWER(SPLIT_PART(p."pair", '-', 1))
        ELSE LOWER(SPLIT_PART(p."pair", '-', 1))
      END
    FROM "interpreters_language_pairs" p
    WHERE p."pair" IS NOT NULL AND TRIM(p."pair") <> ''
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "interpreters_languages" CASCADE;
    DROP TABLE IF EXISTS "courts_departments_working_hours" CASCADE;
    DROP TABLE IF EXISTS "courts_public_service_hours" CASCADE;
    DROP TABLE IF EXISTS "courts_operating_hours" CASCADE;
    DROP TABLE IF EXISTS "interpreters_working_hours" CASCADE;
    DROP TABLE IF EXISTS "expert_witnesses_working_hours" CASCADE;
    ALTER TABLE "expert_witnesses"
      DROP COLUMN IF EXISTS "expert_type",
      DROP COLUMN IF EXISTS "education_level";
  `)
}
