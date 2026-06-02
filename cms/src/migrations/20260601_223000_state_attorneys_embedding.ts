import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Extends the previous embedding migration to state_attorneys so DORH
 * gets the same semantic+keyword hybrid search the experts/interpreters/
 * judges tables already support.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "state_attorneys"
      ADD COLUMN IF NOT EXISTS "embedding" vector(768),
      ADD COLUMN IF NOT EXISTS "embedded_at" timestamp with time zone;
    CREATE INDEX IF NOT EXISTS "state_attorneys_embedding_idx"
      ON "state_attorneys" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 30);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "state_attorneys_embedding_idx";
    ALTER TABLE "state_attorneys"
      DROP COLUMN IF EXISTS "embedded_at",
      DROP COLUMN IF EXISTS "embedding";
  `)
}
