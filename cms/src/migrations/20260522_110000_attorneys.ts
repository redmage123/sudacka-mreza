import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 mockup §3.5 — new `attorneys` collection (parallel to
 * expert_witnesses). The Payload `attorneys_rels` table backs the future
 * hasMany `aliases` array; it's created here so Payload's relationship
 * resolver finds it on first boot.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_attorneys_bar_chamber" AS ENUM ('hok', 'other');
    CREATE TYPE "public"."enum_attorneys_department" AS ENUM (
      'civil', 'criminal', 'commercial', 'administrative',
      'constitutional', 'misdemeanor', 'family', 'labour', 'other'
    );
    CREATE TYPE "public"."enum_attorneys_lang" AS ENUM ('hr', 'en');

    CREATE TABLE "attorneys" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "first_name" varchar,
      "last_name" varchar,
      "oib" varchar,
      "photo_id" integer,
      "firm" varchar,
      "bar_chamber" "public"."enum_attorneys_bar_chamber" DEFAULT 'hok',
      "department" "public"."enum_attorneys_department",
      "cv_id" integer,
      "address" varchar,
      "city" varchar,
      "county" varchar,
      "phone" varchar,
      "email" varchar,
      "website" varchar,
      "verified" boolean DEFAULT false,
      "verified_at" timestamp(3) with time zone,
      "legacy_id" integer,
      "lang" "public"."enum_attorneys_lang" DEFAULT 'hr' NOT NULL,
      "slug" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "attorneys_aliases" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "full_name" varchar NOT NULL
    );

    CREATE UNIQUE INDEX "attorneys_slug_idx"
      ON "attorneys" USING btree ("slug");
    CREATE INDEX "attorneys_name_idx"
      ON "attorneys" USING btree ("name");
    CREATE INDEX "attorneys_legacy_id_idx"
      ON "attorneys" USING btree ("legacy_id");
    CREATE INDEX "attorneys_department_idx"
      ON "attorneys" USING btree ("department");
    CREATE INDEX "attorneys_county_idx"
      ON "attorneys" USING btree ("county");
    CREATE INDEX "attorneys_city_idx"
      ON "attorneys" USING btree ("city");
    CREATE INDEX "attorneys_photo_id_idx"
      ON "attorneys" USING btree ("photo_id");
    CREATE INDEX "attorneys_cv_id_idx"
      ON "attorneys" USING btree ("cv_id");
    CREATE INDEX "attorneys_created_at_idx"
      ON "attorneys" USING btree ("created_at");
    CREATE INDEX "attorneys_updated_at_idx"
      ON "attorneys" USING btree ("updated_at");

    CREATE INDEX "attorneys_aliases_parent_id_idx"
      ON "attorneys_aliases" USING btree ("_parent_id");
    CREATE INDEX "attorneys_aliases_order_idx"
      ON "attorneys_aliases" USING btree ("_order");

    ALTER TABLE "attorneys"
      ADD CONSTRAINT "attorneys_photo_id_fk"
      FOREIGN KEY ("photo_id") REFERENCES "media"("id") ON DELETE SET NULL;
    ALTER TABLE "attorneys"
      ADD CONSTRAINT "attorneys_cv_id_fk"
      FOREIGN KEY ("cv_id") REFERENCES "media"("id") ON DELETE SET NULL;
    ALTER TABLE "attorneys_aliases"
      ADD CONSTRAINT "attorneys_aliases_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "attorneys"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "attorneys_aliases" CASCADE;
    DROP TABLE IF EXISTS "attorneys" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_attorneys_lang";
    DROP TYPE IF EXISTS "public"."enum_attorneys_department";
    DROP TYPE IF EXISTS "public"."enum_attorneys_bar_chamber";
  `)
}
