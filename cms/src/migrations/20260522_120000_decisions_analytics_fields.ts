import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 mockup §2–§4 — judge-dashboard analytics fields on
 * court_decisions. Adds outcome/parties/dispute scalars plus rels-table
 * columns for hasMany relationships (judges, expert_witnesses, attorneys).
 *
 * Backfill flow:
 *   - scripts/extract-decision-analytics.mjs fills judges, winningParty,
 *     disputeType/value, expertWitnesses, and plaintiff/defendant attorneys
 *   - scripts/extract-appeal-outcomes.mjs links appealedDecision +
 *     appealOutcome by cite-chasing case_number across decisions
 *
 * All additions nullable so the 12,830 existing rows stay valid.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums ──────────────────────────────────────────────────────────
    CREATE TYPE "public"."enum_court_decisions_appeal_outcome" AS ENUM (
      'upheld', 'modified', 'overturned', 'na'
    );
    CREATE TYPE "public"."enum_court_decisions_winning_party" AS ENUM (
      'plaintiff', 'defendant', 'partial', 'settled', 'dismissed'
    );
    CREATE TYPE "public"."enum_court_decisions_appeal_type" AS ENUM (
      'zalba', 'revizija', 'ustavnaTuzba', 'ponavljanjePostupka'
    );
    CREATE TYPE "public"."enum_court_decisions_dispute_type" AS ENUM (
      'naknadaStete', 'isplata', 'vlasnistvo', 'razvod', 'radniSpor',
      'ugovorni', 'nasljednistvo', 'obiteljski', 'kaznenoDjelo',
      'prekrsaj', 'drugo'
    );
    CREATE TYPE "public"."enum_court_decisions_currency" AS ENUM (
      'EUR', 'HRK', 'USD'
    );

    -- ── Scalar additions ───────────────────────────────────────────────
    ALTER TABLE "court_decisions"
      ADD COLUMN IF NOT EXISTS "appeal_outcome"  "public"."enum_court_decisions_appeal_outcome",
      ADD COLUMN IF NOT EXISTS "winning_party"   "public"."enum_court_decisions_winning_party",
      ADD COLUMN IF NOT EXISTS "appeal_filed"    boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "appeal_type"     "public"."enum_court_decisions_appeal_type",
      ADD COLUMN IF NOT EXISTS "case_duration_days" integer,
      ADD COLUMN IF NOT EXISTS "dispute_type"    "public"."enum_court_decisions_dispute_type",
      ADD COLUMN IF NOT EXISTS "dispute_value"   numeric,
      ADD COLUMN IF NOT EXISTS "currency"        "public"."enum_court_decisions_currency" DEFAULT 'EUR',
      ADD COLUMN IF NOT EXISTS "appealed_decision_id" integer,
      ADD COLUMN IF NOT EXISTS "analytics_extracted_at" timestamp(3) with time zone;

    -- ── Rels-table columns for hasMany relationships ──────────────────
    -- court_decisions_rels already exists with media_id, legal_categories_id,
    -- court_decisions_id (the existing cited_decisions/cited_by self-rel).
    -- Add three more FK columns for the new hasMany relations.
    ALTER TABLE "court_decisions_rels"
      ADD COLUMN IF NOT EXISTS "judges_id" integer,
      ADD COLUMN IF NOT EXISTS "expert_witnesses_id" integer,
      ADD COLUMN IF NOT EXISTS "attorneys_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS "court_decisions_winning_party_idx"
      ON "court_decisions" USING btree ("winning_party");
    CREATE INDEX IF NOT EXISTS "court_decisions_appeal_outcome_idx"
      ON "court_decisions" USING btree ("appeal_outcome");
    CREATE INDEX IF NOT EXISTS "court_decisions_dispute_type_idx"
      ON "court_decisions" USING btree ("dispute_type");
    CREATE INDEX IF NOT EXISTS "court_decisions_appealed_decision_id_idx"
      ON "court_decisions" USING btree ("appealed_decision_id");
    CREATE INDEX IF NOT EXISTS "court_decisions_analytics_extracted_at_idx"
      ON "court_decisions" USING btree ("analytics_extracted_at");
    -- Composite index for "outcome by date range" aggregation (mockup §2).
    -- EXTRACT(YEAR FROM ...) isn't IMMUTABLE so we index date instead and
    -- queries use date >= 'YYYY-01-01' / < 'YYYY+1-01-01' which uses this.
    CREATE INDEX IF NOT EXISTS "court_decisions_date_outcome_idx"
      ON "court_decisions" ("date", "appeal_outcome", "winning_party");

    CREATE INDEX IF NOT EXISTS "court_decisions_rels_judges_id_idx"
      ON "court_decisions_rels" USING btree ("judges_id");
    CREATE INDEX IF NOT EXISTS "court_decisions_rels_expert_witnesses_id_idx"
      ON "court_decisions_rels" USING btree ("expert_witnesses_id");
    CREATE INDEX IF NOT EXISTS "court_decisions_rels_attorneys_id_idx"
      ON "court_decisions_rels" USING btree ("attorneys_id");
    -- Composite for aggregating "decisions where judge X is on the panel"
    CREATE INDEX IF NOT EXISTS "court_decisions_rels_judges_lookup_idx"
      ON "court_decisions_rels" ("judges_id", "parent_id")
      WHERE "judges_id" IS NOT NULL;

    -- ── Foreign keys ───────────────────────────────────────────────────
    ALTER TABLE "court_decisions"
      ADD CONSTRAINT "court_decisions_appealed_decision_id_fk"
      FOREIGN KEY ("appealed_decision_id")
      REFERENCES "court_decisions"("id") ON DELETE SET NULL;

    ALTER TABLE "court_decisions_rels"
      ADD CONSTRAINT "court_decisions_rels_judges_fk"
      FOREIGN KEY ("judges_id") REFERENCES "judges"("id") ON DELETE CASCADE;
    ALTER TABLE "court_decisions_rels"
      ADD CONSTRAINT "court_decisions_rels_expert_witnesses_fk"
      FOREIGN KEY ("expert_witnesses_id") REFERENCES "expert_witnesses"("id") ON DELETE CASCADE;
    ALTER TABLE "court_decisions_rels"
      ADD CONSTRAINT "court_decisions_rels_attorneys_fk"
      FOREIGN KEY ("attorneys_id") REFERENCES "attorneys"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "court_decisions_rels"
      DROP CONSTRAINT IF EXISTS "court_decisions_rels_attorneys_fk",
      DROP CONSTRAINT IF EXISTS "court_decisions_rels_expert_witnesses_fk",
      DROP CONSTRAINT IF EXISTS "court_decisions_rels_judges_fk";
    DROP INDEX IF EXISTS "court_decisions_rels_judges_lookup_idx";
    DROP INDEX IF EXISTS "court_decisions_rels_attorneys_id_idx";
    DROP INDEX IF EXISTS "court_decisions_rels_expert_witnesses_id_idx";
    DROP INDEX IF EXISTS "court_decisions_rels_judges_id_idx";
    ALTER TABLE "court_decisions_rels"
      DROP COLUMN IF EXISTS "attorneys_id",
      DROP COLUMN IF EXISTS "expert_witnesses_id",
      DROP COLUMN IF EXISTS "judges_id";

    ALTER TABLE "court_decisions"
      DROP CONSTRAINT IF EXISTS "court_decisions_appealed_decision_id_fk";
    DROP INDEX IF EXISTS "court_decisions_date_outcome_idx";
    DROP INDEX IF EXISTS "court_decisions_analytics_extracted_at_idx";
    DROP INDEX IF EXISTS "court_decisions_appealed_decision_id_idx";
    DROP INDEX IF EXISTS "court_decisions_dispute_type_idx";
    DROP INDEX IF EXISTS "court_decisions_appeal_outcome_idx";
    DROP INDEX IF EXISTS "court_decisions_winning_party_idx";
    ALTER TABLE "court_decisions"
      DROP COLUMN IF EXISTS "analytics_extracted_at",
      DROP COLUMN IF EXISTS "appealed_decision_id",
      DROP COLUMN IF EXISTS "currency",
      DROP COLUMN IF EXISTS "dispute_value",
      DROP COLUMN IF EXISTS "dispute_type",
      DROP COLUMN IF EXISTS "case_duration_days",
      DROP COLUMN IF EXISTS "appeal_type",
      DROP COLUMN IF EXISTS "appeal_filed",
      DROP COLUMN IF EXISTS "winning_party",
      DROP COLUMN IF EXISTS "appeal_outcome";

    DROP TYPE IF EXISTS "public"."enum_court_decisions_currency";
    DROP TYPE IF EXISTS "public"."enum_court_decisions_dispute_type";
    DROP TYPE IF EXISTS "public"."enum_court_decisions_appeal_type";
    DROP TYPE IF EXISTS "public"."enum_court_decisions_winning_party";
    DROP TYPE IF EXISTS "public"."enum_court_decisions_appeal_outcome";
  `)
}
