import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'member');
  CREATE TYPE "public"."enum_courts_type" AS ENUM('municipal', 'county', 'commercial', 'misdemeanour', 'high_commercial', 'supreme', 'administrative', 'constitutional');
  CREATE TYPE "public"."enum_court_decisions_decision_type" AS ENUM('civil', 'criminal', 'commercial', 'administrative', 'constitutional', 'ecj', 'ecthr');
  CREATE TYPE "public"."enum_court_decisions_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_expert_witnesses_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_interpreters_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_bankruptcy_listings_status" AS ENUM('active', 'completed', 'withdrawn');
  CREATE TYPE "public"."enum_laws_type" AS ENUM('zakon', 'pravilnik', 'uredba', 'odluka', 'europski');
  CREATE TYPE "public"."enum_laws_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_news_posts_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_pages_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_galleries_type" AS ENUM('photo', 'video', 'audio');
  CREATE TYPE "public"."enum_galleries_lang" AS ENUM('hr', 'en');
  CREATE TYPE "public"."enum_documents_lang" AS ENUM('hr', 'en');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"profile_bio" varchar,
  	"profile_phone" varchar,
  	"profile_organisation" varchar,
  	"role" "enum_users_role" DEFAULT 'member' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "courts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_courts_type" NOT NULL,
  	"address" varchar,
  	"city" varchar NOT NULL,
  	"county" varchar,
  	"phone" varchar,
  	"fax" varchar,
  	"email" varchar,
  	"website" varchar,
  	"president" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"jurisdiction_area" jsonb,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "court_decisions_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "court_decisions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"court_id" integer NOT NULL,
  	"decision_type" "enum_court_decisions_decision_type" NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"case_number" varchar NOT NULL,
  	"full_text" jsonb,
  	"full_text_plain" varchar,
  	"summary" varchar,
  	"category" varchar,
  	"lang" "enum_court_decisions_lang" DEFAULT 'hr' NOT NULL,
  	"search_vector" varchar,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "court_decisions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "expert_witnesses_speciality_areas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"area" varchar NOT NULL
  );
  
  CREATE TABLE "expert_witnesses_languages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"language" varchar NOT NULL
  );
  
  CREATE TABLE "expert_witnesses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"county" varchar,
  	"city" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"verified" boolean DEFAULT false,
  	"notes" jsonb,
  	"lang" "enum_expert_witnesses_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expert_witnesses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courts_id" integer
  );
  
  CREATE TABLE "interpreters_language_pairs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pair" varchar NOT NULL
  );
  
  CREATE TABLE "interpreters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"county" varchar,
  	"city" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"verified" boolean DEFAULT false,
  	"lang" "enum_interpreters_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "interpreters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courts_id" integer
  );
  
  CREATE TABLE "state_attorneys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"address" varchar,
  	"city" varchar NOT NULL,
  	"county" varchar,
  	"phone" varchar,
  	"fax" varchar,
  	"email" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bankruptcy_administrators" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"licence_number" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"address" varchar,
  	"city" varchar,
  	"county" varchar,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bankruptcy_administrators_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"bankruptcy_listings_id" integer
  );
  
  CREATE TABLE "bankruptcy_listings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"case_number" varchar NOT NULL,
  	"debtor_name" varchar NOT NULL,
  	"court_id" integer NOT NULL,
  	"administrator_id" integer,
  	"assets" jsonb,
  	"deadline" timestamp(3) with time zone,
  	"status" "enum_bankruptcy_listings_status" DEFAULT 'active' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bankruptcy_listings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "laws" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "enum_laws_type" NOT NULL,
  	"year" numeric,
  	"description" varchar,
  	"full_text" jsonb,
  	"file_id" integer,
  	"external_url" varchar,
  	"effective_date" timestamp(3) with time zone,
  	"superseded_by_id" integer,
  	"category" varchar,
  	"lang" "enum_laws_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "news_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"content" jsonb NOT NULL,
  	"excerpt" varchar,
  	"featured_image_id" integer,
  	"category" varchar,
  	"published_at" timestamp(3) with time zone,
  	"author_id" integer,
  	"lang" "enum_news_posts_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"content" jsonb NOT NULL,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"lang" "enum_pages_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "galleries_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"video_url" varchar,
  	"caption" varchar
  );
  
  CREATE TABLE "galleries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "enum_galleries_type" DEFAULT 'photo' NOT NULL,
  	"description" varchar,
  	"published_at" timestamp(3) with time zone,
  	"lang" "enum_galleries_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"category" varchar NOT NULL,
  	"file_id" integer NOT NULL,
  	"description" varchar,
  	"published_at" timestamp(3) with time zone,
  	"lang" "enum_documents_lang" DEFAULT 'hr' NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"courts_id" integer,
  	"court_decisions_id" integer,
  	"expert_witnesses_id" integer,
  	"interpreters_id" integer,
  	"state_attorneys_id" integer,
  	"bankruptcy_administrators_id" integer,
  	"bankruptcy_listings_id" integer,
  	"laws_id" integer,
  	"news_posts_id" integer,
  	"pages_id" integer,
  	"galleries_id" integer,
  	"documents_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'Sudačka Mreža',
  	"site_tagline_hr" varchar,
  	"site_tagline_en" varchar,
  	"contact_email" varchar,
  	"donate_url" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "navigation_main_nav_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label_hr" varchar NOT NULL,
  	"label_en" varchar,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_main_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label_hr" varchar NOT NULL,
  	"label_en" varchar,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation_footer_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label_hr" varchar NOT NULL,
  	"label_en" varchar,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "court_decisions_tags" ADD CONSTRAINT "court_decisions_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."court_decisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "court_decisions" ADD CONSTRAINT "court_decisions_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "court_decisions_rels" ADD CONSTRAINT "court_decisions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."court_decisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "court_decisions_rels" ADD CONSTRAINT "court_decisions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_witnesses_speciality_areas" ADD CONSTRAINT "expert_witnesses_speciality_areas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expert_witnesses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_witnesses_languages" ADD CONSTRAINT "expert_witnesses_languages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expert_witnesses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_witnesses_rels" ADD CONSTRAINT "expert_witnesses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."expert_witnesses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expert_witnesses_rels" ADD CONSTRAINT "expert_witnesses_rels_courts_fk" FOREIGN KEY ("courts_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpreters_language_pairs" ADD CONSTRAINT "interpreters_language_pairs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpreters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpreters_rels" ADD CONSTRAINT "interpreters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."interpreters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpreters_rels" ADD CONSTRAINT "interpreters_rels_courts_fk" FOREIGN KEY ("courts_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bankruptcy_administrators_rels" ADD CONSTRAINT "bankruptcy_administrators_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bankruptcy_administrators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bankruptcy_administrators_rels" ADD CONSTRAINT "bankruptcy_administrators_rels_bankruptcy_listings_fk" FOREIGN KEY ("bankruptcy_listings_id") REFERENCES "public"."bankruptcy_listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bankruptcy_listings" ADD CONSTRAINT "bankruptcy_listings_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bankruptcy_listings" ADD CONSTRAINT "bankruptcy_listings_administrator_id_bankruptcy_administrators_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."bankruptcy_administrators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bankruptcy_listings_rels" ADD CONSTRAINT "bankruptcy_listings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bankruptcy_listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bankruptcy_listings_rels" ADD CONSTRAINT "bankruptcy_listings_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "laws" ADD CONSTRAINT "laws_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "laws" ADD CONSTRAINT "laws_superseded_by_id_laws_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."laws"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "galleries_items" ADD CONSTRAINT "galleries_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "galleries_items" ADD CONSTRAINT "galleries_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courts_fk" FOREIGN KEY ("courts_id") REFERENCES "public"."courts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_court_decisions_fk" FOREIGN KEY ("court_decisions_id") REFERENCES "public"."court_decisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expert_witnesses_fk" FOREIGN KEY ("expert_witnesses_id") REFERENCES "public"."expert_witnesses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interpreters_fk" FOREIGN KEY ("interpreters_id") REFERENCES "public"."interpreters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_state_attorneys_fk" FOREIGN KEY ("state_attorneys_id") REFERENCES "public"."state_attorneys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bankruptcy_administrators_fk" FOREIGN KEY ("bankruptcy_administrators_id") REFERENCES "public"."bankruptcy_administrators"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bankruptcy_listings_fk" FOREIGN KEY ("bankruptcy_listings_id") REFERENCES "public"."bankruptcy_listings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_laws_fk" FOREIGN KEY ("laws_id") REFERENCES "public"."laws"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_posts_fk" FOREIGN KEY ("news_posts_id") REFERENCES "public"."news_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_galleries_fk" FOREIGN KEY ("galleries_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_social_links" ADD CONSTRAINT "settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_main_nav_children" ADD CONSTRAINT "navigation_main_nav_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation_main_nav"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_main_nav" ADD CONSTRAINT "navigation_main_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_footer_nav" ADD CONSTRAINT "navigation_footer_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE UNIQUE INDEX "courts_slug_idx" ON "courts" USING btree ("slug");
  CREATE INDEX "courts_updated_at_idx" ON "courts" USING btree ("updated_at");
  CREATE INDEX "courts_created_at_idx" ON "courts" USING btree ("created_at");
  CREATE INDEX "court_decisions_tags_order_idx" ON "court_decisions_tags" USING btree ("_order");
  CREATE INDEX "court_decisions_tags_parent_id_idx" ON "court_decisions_tags" USING btree ("_parent_id");
  CREATE INDEX "court_decisions_court_idx" ON "court_decisions" USING btree ("court_id");
  CREATE INDEX "court_decisions_search_vector_idx" ON "court_decisions" USING btree ("search_vector");
  CREATE UNIQUE INDEX "court_decisions_slug_idx" ON "court_decisions" USING btree ("slug");
  CREATE INDEX "court_decisions_updated_at_idx" ON "court_decisions" USING btree ("updated_at");
  CREATE INDEX "court_decisions_created_at_idx" ON "court_decisions" USING btree ("created_at");
  CREATE INDEX "court_decisions_rels_order_idx" ON "court_decisions_rels" USING btree ("order");
  CREATE INDEX "court_decisions_rels_parent_idx" ON "court_decisions_rels" USING btree ("parent_id");
  CREATE INDEX "court_decisions_rels_path_idx" ON "court_decisions_rels" USING btree ("path");
  CREATE INDEX "court_decisions_rels_media_id_idx" ON "court_decisions_rels" USING btree ("media_id");
  CREATE INDEX "expert_witnesses_speciality_areas_order_idx" ON "expert_witnesses_speciality_areas" USING btree ("_order");
  CREATE INDEX "expert_witnesses_speciality_areas_parent_id_idx" ON "expert_witnesses_speciality_areas" USING btree ("_parent_id");
  CREATE INDEX "expert_witnesses_languages_order_idx" ON "expert_witnesses_languages" USING btree ("_order");
  CREATE INDEX "expert_witnesses_languages_parent_id_idx" ON "expert_witnesses_languages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "expert_witnesses_slug_idx" ON "expert_witnesses" USING btree ("slug");
  CREATE INDEX "expert_witnesses_updated_at_idx" ON "expert_witnesses" USING btree ("updated_at");
  CREATE INDEX "expert_witnesses_created_at_idx" ON "expert_witnesses" USING btree ("created_at");
  CREATE INDEX "expert_witnesses_rels_order_idx" ON "expert_witnesses_rels" USING btree ("order");
  CREATE INDEX "expert_witnesses_rels_parent_idx" ON "expert_witnesses_rels" USING btree ("parent_id");
  CREATE INDEX "expert_witnesses_rels_path_idx" ON "expert_witnesses_rels" USING btree ("path");
  CREATE INDEX "expert_witnesses_rels_courts_id_idx" ON "expert_witnesses_rels" USING btree ("courts_id");
  CREATE INDEX "interpreters_language_pairs_order_idx" ON "interpreters_language_pairs" USING btree ("_order");
  CREATE INDEX "interpreters_language_pairs_parent_id_idx" ON "interpreters_language_pairs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "interpreters_slug_idx" ON "interpreters" USING btree ("slug");
  CREATE INDEX "interpreters_updated_at_idx" ON "interpreters" USING btree ("updated_at");
  CREATE INDEX "interpreters_created_at_idx" ON "interpreters" USING btree ("created_at");
  CREATE INDEX "interpreters_rels_order_idx" ON "interpreters_rels" USING btree ("order");
  CREATE INDEX "interpreters_rels_parent_idx" ON "interpreters_rels" USING btree ("parent_id");
  CREATE INDEX "interpreters_rels_path_idx" ON "interpreters_rels" USING btree ("path");
  CREATE INDEX "interpreters_rels_courts_id_idx" ON "interpreters_rels" USING btree ("courts_id");
  CREATE UNIQUE INDEX "state_attorneys_slug_idx" ON "state_attorneys" USING btree ("slug");
  CREATE INDEX "state_attorneys_updated_at_idx" ON "state_attorneys" USING btree ("updated_at");
  CREATE INDEX "state_attorneys_created_at_idx" ON "state_attorneys" USING btree ("created_at");
  CREATE UNIQUE INDEX "bankruptcy_administrators_slug_idx" ON "bankruptcy_administrators" USING btree ("slug");
  CREATE INDEX "bankruptcy_administrators_updated_at_idx" ON "bankruptcy_administrators" USING btree ("updated_at");
  CREATE INDEX "bankruptcy_administrators_created_at_idx" ON "bankruptcy_administrators" USING btree ("created_at");
  CREATE INDEX "bankruptcy_administrators_rels_order_idx" ON "bankruptcy_administrators_rels" USING btree ("order");
  CREATE INDEX "bankruptcy_administrators_rels_parent_idx" ON "bankruptcy_administrators_rels" USING btree ("parent_id");
  CREATE INDEX "bankruptcy_administrators_rels_path_idx" ON "bankruptcy_administrators_rels" USING btree ("path");
  CREATE INDEX "bankruptcy_administrators_rels_bankruptcy_listings_id_idx" ON "bankruptcy_administrators_rels" USING btree ("bankruptcy_listings_id");
  CREATE INDEX "bankruptcy_listings_court_idx" ON "bankruptcy_listings" USING btree ("court_id");
  CREATE INDEX "bankruptcy_listings_administrator_idx" ON "bankruptcy_listings" USING btree ("administrator_id");
  CREATE INDEX "bankruptcy_listings_updated_at_idx" ON "bankruptcy_listings" USING btree ("updated_at");
  CREATE INDEX "bankruptcy_listings_created_at_idx" ON "bankruptcy_listings" USING btree ("created_at");
  CREATE INDEX "bankruptcy_listings_rels_order_idx" ON "bankruptcy_listings_rels" USING btree ("order");
  CREATE INDEX "bankruptcy_listings_rels_parent_idx" ON "bankruptcy_listings_rels" USING btree ("parent_id");
  CREATE INDEX "bankruptcy_listings_rels_path_idx" ON "bankruptcy_listings_rels" USING btree ("path");
  CREATE INDEX "bankruptcy_listings_rels_media_id_idx" ON "bankruptcy_listings_rels" USING btree ("media_id");
  CREATE INDEX "laws_file_idx" ON "laws" USING btree ("file_id");
  CREATE INDEX "laws_superseded_by_idx" ON "laws" USING btree ("superseded_by_id");
  CREATE UNIQUE INDEX "laws_slug_idx" ON "laws" USING btree ("slug");
  CREATE INDEX "laws_updated_at_idx" ON "laws" USING btree ("updated_at");
  CREATE INDEX "laws_created_at_idx" ON "laws" USING btree ("created_at");
  CREATE INDEX "news_posts_featured_image_idx" ON "news_posts" USING btree ("featured_image_id");
  CREATE INDEX "news_posts_author_idx" ON "news_posts" USING btree ("author_id");
  CREATE UNIQUE INDEX "news_posts_slug_idx" ON "news_posts" USING btree ("slug");
  CREATE INDEX "news_posts_updated_at_idx" ON "news_posts" USING btree ("updated_at");
  CREATE INDEX "news_posts_created_at_idx" ON "news_posts" USING btree ("created_at");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "galleries_items_order_idx" ON "galleries_items" USING btree ("_order");
  CREATE INDEX "galleries_items_parent_id_idx" ON "galleries_items" USING btree ("_parent_id");
  CREATE INDEX "galleries_items_media_idx" ON "galleries_items" USING btree ("media_id");
  CREATE UNIQUE INDEX "galleries_slug_idx" ON "galleries" USING btree ("slug");
  CREATE INDEX "galleries_updated_at_idx" ON "galleries" USING btree ("updated_at");
  CREATE INDEX "galleries_created_at_idx" ON "galleries" USING btree ("created_at");
  CREATE INDEX "documents_file_idx" ON "documents" USING btree ("file_id");
  CREATE UNIQUE INDEX "documents_slug_idx" ON "documents" USING btree ("slug");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_courts_id_idx" ON "payload_locked_documents_rels" USING btree ("courts_id");
  CREATE INDEX "payload_locked_documents_rels_court_decisions_id_idx" ON "payload_locked_documents_rels" USING btree ("court_decisions_id");
  CREATE INDEX "payload_locked_documents_rels_expert_witnesses_id_idx" ON "payload_locked_documents_rels" USING btree ("expert_witnesses_id");
  CREATE INDEX "payload_locked_documents_rels_interpreters_id_idx" ON "payload_locked_documents_rels" USING btree ("interpreters_id");
  CREATE INDEX "payload_locked_documents_rels_state_attorneys_id_idx" ON "payload_locked_documents_rels" USING btree ("state_attorneys_id");
  CREATE INDEX "payload_locked_documents_rels_bankruptcy_administrators__idx" ON "payload_locked_documents_rels" USING btree ("bankruptcy_administrators_id");
  CREATE INDEX "payload_locked_documents_rels_bankruptcy_listings_id_idx" ON "payload_locked_documents_rels" USING btree ("bankruptcy_listings_id");
  CREATE INDEX "payload_locked_documents_rels_laws_id_idx" ON "payload_locked_documents_rels" USING btree ("laws_id");
  CREATE INDEX "payload_locked_documents_rels_news_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("news_posts_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_galleries_id_idx" ON "payload_locked_documents_rels" USING btree ("galleries_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "settings_social_links_order_idx" ON "settings_social_links" USING btree ("_order");
  CREATE INDEX "settings_social_links_parent_id_idx" ON "settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "navigation_main_nav_children_order_idx" ON "navigation_main_nav_children" USING btree ("_order");
  CREATE INDEX "navigation_main_nav_children_parent_id_idx" ON "navigation_main_nav_children" USING btree ("_parent_id");
  CREATE INDEX "navigation_main_nav_order_idx" ON "navigation_main_nav" USING btree ("_order");
  CREATE INDEX "navigation_main_nav_parent_id_idx" ON "navigation_main_nav" USING btree ("_parent_id");
  CREATE INDEX "navigation_footer_nav_order_idx" ON "navigation_footer_nav" USING btree ("_order");
  CREATE INDEX "navigation_footer_nav_parent_id_idx" ON "navigation_footer_nav" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "courts" CASCADE;
  DROP TABLE "court_decisions_tags" CASCADE;
  DROP TABLE "court_decisions" CASCADE;
  DROP TABLE "court_decisions_rels" CASCADE;
  DROP TABLE "expert_witnesses_speciality_areas" CASCADE;
  DROP TABLE "expert_witnesses_languages" CASCADE;
  DROP TABLE "expert_witnesses" CASCADE;
  DROP TABLE "expert_witnesses_rels" CASCADE;
  DROP TABLE "interpreters_language_pairs" CASCADE;
  DROP TABLE "interpreters" CASCADE;
  DROP TABLE "interpreters_rels" CASCADE;
  DROP TABLE "state_attorneys" CASCADE;
  DROP TABLE "bankruptcy_administrators" CASCADE;
  DROP TABLE "bankruptcy_administrators_rels" CASCADE;
  DROP TABLE "bankruptcy_listings" CASCADE;
  DROP TABLE "bankruptcy_listings_rels" CASCADE;
  DROP TABLE "laws" CASCADE;
  DROP TABLE "news_posts" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "galleries_items" CASCADE;
  DROP TABLE "galleries" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings_social_links" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TABLE "navigation_main_nav_children" CASCADE;
  DROP TABLE "navigation_main_nav" CASCADE;
  DROP TABLE "navigation_footer_nav" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_courts_type";
  DROP TYPE "public"."enum_court_decisions_decision_type";
  DROP TYPE "public"."enum_court_decisions_lang";
  DROP TYPE "public"."enum_expert_witnesses_lang";
  DROP TYPE "public"."enum_interpreters_lang";
  DROP TYPE "public"."enum_bankruptcy_listings_status";
  DROP TYPE "public"."enum_laws_type";
  DROP TYPE "public"."enum_laws_lang";
  DROP TYPE "public"."enum_news_posts_lang";
  DROP TYPE "public"."enum_pages_lang";
  DROP TYPE "public"."enum_galleries_type";
  DROP TYPE "public"."enum_galleries_lang";
  DROP TYPE "public"."enum_documents_lang";`)
}
