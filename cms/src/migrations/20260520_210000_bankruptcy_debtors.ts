import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Corrections-doc item 1 — adds the bankruptcy_debtors collection so each
 * debtor (stečajni dužnik) is a first-class entity with its own profile and
 * a back-pointer from every bankruptcy_listing.
 *
 *  - CREATE TABLE bankruptcy_debtors with contact + OIB + slug
 *  - ALTER TABLE bankruptcy_listings ADD COLUMN debtor_id integer (nullable;
 *    listings keep the existing `debtor_name` text field for back-compat)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "bankruptcy_debtors" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "oib" varchar,
      "address" varchar,
      "city" varchar,
      "county" varchar,
      "phone" varchar,
      "email" varchar,
      "notes" varchar,
      "slug" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX "bankruptcy_debtors_slug_idx"
      ON "bankruptcy_debtors" USING btree ("slug");
    CREATE INDEX "bankruptcy_debtors_oib_idx"
      ON "bankruptcy_debtors" USING btree ("oib");
    CREATE INDEX "bankruptcy_debtors_name_idx"
      ON "bankruptcy_debtors" USING btree ("name");
    CREATE INDEX "bankruptcy_debtors_updated_at_idx"
      ON "bankruptcy_debtors" USING btree ("updated_at");
    CREATE INDEX "bankruptcy_debtors_created_at_idx"
      ON "bankruptcy_debtors" USING btree ("created_at");

    ALTER TABLE "bankruptcy_listings"
      ADD COLUMN IF NOT EXISTS "debtor_id" integer;
    CREATE INDEX "bankruptcy_listings_debtor_id_idx"
      ON "bankruptcy_listings" USING btree ("debtor_id");
    ALTER TABLE "bankruptcy_listings"
      ADD CONSTRAINT "bankruptcy_listings_debtor_id_fk"
      FOREIGN KEY ("debtor_id") REFERENCES "bankruptcy_debtors"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bankruptcy_listings"
      DROP CONSTRAINT IF EXISTS "bankruptcy_listings_debtor_id_fk";
    DROP INDEX IF EXISTS "bankruptcy_listings_debtor_id_idx";
    ALTER TABLE "bankruptcy_listings"
      DROP COLUMN IF EXISTS "debtor_id";

    DROP TABLE IF EXISTS "bankruptcy_debtors" CASCADE;
  `)
}
