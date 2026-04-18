import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_judges_status" AS ENUM('active', 'inactive');
    CREATE TYPE "public"."enum_judges_lang" AS ENUM('hr', 'en', 'sr', 'mk');

    CREATE TABLE "judges" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "court_id" integer,
      "appointment_date" timestamp(3) with time zone,
      "specialization" varchar,
      "status" "enum_judges_status" DEFAULT 'active',
      "email" varchar,
      "lang" "enum_judges_lang" DEFAULT 'hr' NOT NULL,
      "slug" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "judges"
      ADD CONSTRAINT "judges_court_id_courts_id_fk"
      FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE UNIQUE INDEX "judges_slug_idx" ON "judges" USING btree ("slug");
    CREATE INDEX "judges_court_idx" ON "judges" USING btree ("court_id");
    CREATE INDEX "judges_updated_at_idx" ON "judges" USING btree ("updated_at");
    CREATE INDEX "judges_created_at_idx" ON "judges" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "judges_id" integer;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_judges_fk"
      FOREIGN KEY ("judges_id") REFERENCES "public"."judges"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_judges_id_idx"
      ON "payload_locked_documents_rels" USING btree ("judges_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_judges_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "judges_id";
    DROP TABLE IF EXISTS "judges" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_judges_status";
    DROP TYPE IF EXISTS "public"."enum_judges_lang";
  `)
}
