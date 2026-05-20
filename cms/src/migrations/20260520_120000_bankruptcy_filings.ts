import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Creates the `bankruptcy_filings` table for the editor-submitted filings
 * review workflow. Without this table the admin "Bankruptcy filings" page
 * (/[lang]/admin/filings) errors with HTTP 404 "Route not found
 * /api/bankruptcy-filings" — the collection is referenced in the frontend
 * but has no backing table.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_bankruptcy_filings_filing_type" AS ENUM(
      'motion-to-open',
      'prijava-trazbine',
      'asset-inventory',
      'asset-sale',
      'trustee-report',
      'distribution-proposal',
      'final-accounting',
      'restructuring-plan',
      'pre-bankruptcy-settlement'
    );
    CREATE TYPE "public"."enum_bankruptcy_filings_status" AS ENUM(
      'pending_review',
      'approved',
      'rejected'
    );

    CREATE TABLE "bankruptcy_filings" (
      "id" serial PRIMARY KEY NOT NULL,
      "filing_type" "enum_bankruptcy_filings_filing_type" NOT NULL,
      "case_number" varchar,
      "status" "enum_bankruptcy_filings_status" DEFAULT 'pending_review' NOT NULL,
      "submitted_by" varchar,
      "data" jsonb,
      "attachment_base64" varchar,
      "attachment_filename" varchar,
      "review_notes" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "bankruptcy_filings_status_idx" ON "bankruptcy_filings" USING btree ("status");
    CREATE INDEX "bankruptcy_filings_filing_type_idx" ON "bankruptcy_filings" USING btree ("filing_type");
    CREATE INDEX "bankruptcy_filings_submitted_by_idx" ON "bankruptcy_filings" USING btree ("submitted_by");
    CREATE INDEX "bankruptcy_filings_updated_at_idx" ON "bankruptcy_filings" USING btree ("updated_at");
    CREATE INDEX "bankruptcy_filings_created_at_idx" ON "bankruptcy_filings" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "bankruptcy_filings" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_bankruptcy_filings_filing_type";
    DROP TYPE IF EXISTS "public"."enum_bankruptcy_filings_status";
  `)
}
