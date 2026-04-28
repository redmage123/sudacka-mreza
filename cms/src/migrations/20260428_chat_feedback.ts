import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_chat_feedback_verdict" AS ENUM('good', 'bad');
    CREATE TYPE "public"."enum_chat_feedback_status" AS ENUM('pending', 'approved', 'rejected');

    CREATE TABLE "chat_feedback" (
      "id" serial PRIMARY KEY NOT NULL,
      "conversation_id" varchar NOT NULL,
      "question" varchar NOT NULL,
      "lang" varchar NOT NULL,
      "model_answer" varchar NOT NULL,
      "model_version" varchar,
      "verdict" "enum_chat_feedback_verdict" NOT NULL,
      "correction" varchar,
      "reason" varchar,
      "citations" jsonb,
      "user_id" integer,
      "ip" varchar,
      "user_agent" varchar,
      "status" "enum_chat_feedback_status" DEFAULT 'pending' NOT NULL,
      "reviewer_id" integer,
      "reviewed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "chat_feedback"
      ADD CONSTRAINT "chat_feedback_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "chat_feedback"
      ADD CONSTRAINT "chat_feedback_reviewer_id_users_id_fk"
      FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "chat_feedback_conversation_id_idx"
      ON "chat_feedback" USING btree ("conversation_id");
    CREATE INDEX "chat_feedback_lang_idx"
      ON "chat_feedback" USING btree ("lang");
    CREATE INDEX "chat_feedback_verdict_idx"
      ON "chat_feedback" USING btree ("verdict");
    CREATE INDEX "chat_feedback_status_idx"
      ON "chat_feedback" USING btree ("status");
    CREATE INDEX "chat_feedback_updated_at_idx"
      ON "chat_feedback" USING btree ("updated_at");
    CREATE INDEX "chat_feedback_created_at_idx"
      ON "chat_feedback" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "chat_feedback_id" integer;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_chat_feedback_fk"
      FOREIGN KEY ("chat_feedback_id") REFERENCES "public"."chat_feedback"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_chat_feedback_id_idx"
      ON "payload_locked_documents_rels" USING btree ("chat_feedback_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_chat_feedback_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "chat_feedback_id";

    DROP TABLE IF EXISTS "chat_feedback";
    DROP TYPE IF EXISTS "public"."enum_chat_feedback_verdict";
    DROP TYPE IF EXISTS "public"."enum_chat_feedback_status";
  `)
}
