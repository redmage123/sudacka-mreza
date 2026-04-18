import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "legal_categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name_hr" varchar NOT NULL,
      "name_en" varchar,
      "slug" varchar UNIQUE,
      "icon" varchar,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "legal_categories"
      ADD COLUMN "parent_id" integer
      REFERENCES "public"."legal_categories"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "legal_categories_slug_idx" ON "legal_categories" USING btree ("slug");
    CREATE INDEX "legal_categories_parent_idx" ON "legal_categories" USING btree ("parent_id");
    CREATE INDEX "legal_categories_created_at_idx" ON "legal_categories" USING btree ("created_at");
    CREATE INDEX "legal_categories_updated_at_idx" ON "legal_categories" USING btree ("updated_at");

    ALTER TABLE "court_decisions_rels"
      ADD COLUMN "legal_categories_id" integer;

    ALTER TABLE "court_decisions_rels"
      ADD CONSTRAINT "court_decisions_rels_legal_categories_fk"
      FOREIGN KEY ("legal_categories_id")
      REFERENCES "public"."legal_categories"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "court_decisions_rels_legal_categories_id_idx"
      ON "court_decisions_rels" USING btree ("legal_categories_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "court_decisions_rels_legal_categories_id_idx";
    ALTER TABLE "court_decisions_rels"
      DROP CONSTRAINT IF EXISTS "court_decisions_rels_legal_categories_fk";
    ALTER TABLE "court_decisions_rels"
      DROP COLUMN IF EXISTS "legal_categories_id";

    DROP INDEX IF EXISTS "legal_categories_updated_at_idx";
    DROP INDEX IF EXISTS "legal_categories_created_at_idx";
    DROP INDEX IF EXISTS "legal_categories_parent_idx";
    DROP INDEX IF EXISTS "legal_categories_slug_idx";
    DROP TABLE IF EXISTS "legal_categories" CASCADE;
  `)
}
