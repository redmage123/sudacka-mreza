import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Creates the tables for four collections that were registered in
 * payload.config.ts but never had a migration generated: `subscriptions`,
 * `annotations`, `bookmarks`, and `api_keys`. Without these tables every
 * request to /api/{bookmarks,annotations,subscriptions,api-keys} 500s with
 * `relation "..." does not exist` (e.g. MyLibraryPage after login).
 *
 * The `*_id` columns on `payload_locked_documents_rels` already exist in the
 * database, so this migration only adds the matching FK constraints + indexes
 * for them — it does not re-add the columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_subscriptions_subscription_type" AS ENUM('decisions', 'news', 'experts');
    CREATE TYPE "public"."enum_subscriptions_frequency" AS ENUM('daily', 'weekly');
    CREATE TYPE "public"."enum_annotations_highlight_color" AS ENUM('yellow', 'green', 'blue', 'pink');

    CREATE TABLE "subscriptions" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL,
      "subscription_type" "enum_subscriptions_subscription_type" NOT NULL,
      "filters_court" varchar,
      "filters_category" varchar,
      "filters_keyword" varchar,
      "frequency" "enum_subscriptions_frequency" DEFAULT 'daily' NOT NULL,
      "confirmed" boolean DEFAULT false,
      "token" varchar,
      "last_notified_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "annotations" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "decision_id" integer NOT NULL,
      "text_selection_start" numeric NOT NULL,
      "text_selection_end" numeric NOT NULL,
      "highlight_color" "enum_annotations_highlight_color" DEFAULT 'yellow' NOT NULL,
      "note" varchar,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "bookmarks" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "decision_id" integer NOT NULL,
      "folder" varchar DEFAULT 'Opće',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "api_keys" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar,
      "name" varchar NOT NULL,
      "organization" varchar,
      "email" varchar,
      "rate_limit" numeric DEFAULT 1000,
      "active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "annotations" ADD CONSTRAINT "annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "annotations" ADD CONSTRAINT "annotations_decision_id_court_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."court_decisions"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_decision_id_court_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."court_decisions"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_annotations_fk" FOREIGN KEY ("annotations_id") REFERENCES "public"."annotations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookmarks_fk" FOREIGN KEY ("bookmarks_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_api_keys_fk" FOREIGN KEY ("api_keys_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
    CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
    CREATE INDEX "annotations_user_idx" ON "annotations" USING btree ("user_id");
    CREATE INDEX "annotations_decision_idx" ON "annotations" USING btree ("decision_id");
    CREATE INDEX "annotations_updated_at_idx" ON "annotations" USING btree ("updated_at");
    CREATE INDEX "annotations_created_at_idx" ON "annotations" USING btree ("created_at");
    CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");
    CREATE INDEX "bookmarks_decision_idx" ON "bookmarks" USING btree ("decision_id");
    CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks" USING btree ("updated_at");
    CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks" USING btree ("created_at");
    CREATE UNIQUE INDEX "api_keys_key_idx" ON "api_keys" USING btree ("key");
    CREATE INDEX "api_keys_updated_at_idx" ON "api_keys" USING btree ("updated_at");
    CREATE INDEX "api_keys_created_at_idx" ON "api_keys" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
    CREATE INDEX "payload_locked_documents_rels_annotations_id_idx" ON "payload_locked_documents_rels" USING btree ("annotations_id");
    CREATE INDEX "payload_locked_documents_rels_bookmarks_id_idx" ON "payload_locked_documents_rels" USING btree ("bookmarks_id");
    CREATE INDEX "payload_locked_documents_rels_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("api_keys_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_subscriptions_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_annotations_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_bookmarks_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_api_keys_id_idx";

    DROP TABLE IF EXISTS "subscriptions" CASCADE;
    DROP TABLE IF EXISTS "annotations" CASCADE;
    DROP TABLE IF EXISTS "bookmarks" CASCADE;
    DROP TABLE IF EXISTS "api_keys" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_subscriptions_subscription_type";
    DROP TYPE IF EXISTS "public"."enum_subscriptions_frequency";
    DROP TYPE IF EXISTS "public"."enum_annotations_highlight_color";
  `)
}
