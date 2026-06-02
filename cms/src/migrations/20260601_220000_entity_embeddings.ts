import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds vector(768) embedding columns (nomic-embed-text dimension) to
 * expert_witnesses, interpreters, and judges, plus IVFFlat indexes so
 * cosine similarity searches don't sequential-scan. Each row's embedding
 * is computed by a backfill script after the migration runs.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS vector;

    ALTER TABLE "expert_witnesses"
      ADD COLUMN IF NOT EXISTS "embedding" vector(768),
      ADD COLUMN IF NOT EXISTS "embedded_at" timestamp with time zone;

    ALTER TABLE "interpreters"
      ADD COLUMN IF NOT EXISTS "embedding" vector(768),
      ADD COLUMN IF NOT EXISTS "embedded_at" timestamp with time zone;

    ALTER TABLE "judges"
      ADD COLUMN IF NOT EXISTS "embedding" vector(768),
      ADD COLUMN IF NOT EXISTS "embedded_at" timestamp with time zone;

    -- Cosine-distance IVFFlat indexes. lists=10 is a reasonable default
    -- for sub-10k row sets; the judges table at ~5k still benefits.
    CREATE INDEX IF NOT EXISTS "expert_witnesses_embedding_idx"
      ON "expert_witnesses" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
    CREATE INDEX IF NOT EXISTS "interpreters_embedding_idx"
      ON "interpreters" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
    CREATE INDEX IF NOT EXISTS "judges_embedding_idx"
      ON "judges" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "expert_witnesses_embedding_idx";
    DROP INDEX IF EXISTS "interpreters_embedding_idx";
    DROP INDEX IF EXISTS "judges_embedding_idx";
    ALTER TABLE "expert_witnesses"
      DROP COLUMN IF EXISTS "embedded_at",
      DROP COLUMN IF EXISTS "embedding";
    ALTER TABLE "interpreters"
      DROP COLUMN IF EXISTS "embedded_at",
      DROP COLUMN IF EXISTS "embedding";
    ALTER TABLE "judges"
      DROP COLUMN IF EXISTS "embedded_at",
      DROP COLUMN IF EXISTS "embedding";
  `)
}
