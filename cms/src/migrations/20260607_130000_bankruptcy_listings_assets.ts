import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Structures the BankruptcyListings assets surface so SM-REDESIGN section
 * 3.7.2 search params work end-to-end:
 *   - description    text  — free-text search ("Pretraži u tekstu")
 *   - assetCategory  enum  — immovable / movable / rights / mixed
 *   - assetType      text  — concrete kind (stan, kuća, vozilo …)
 *
 * Adds GIN/B-tree indexes for the filters and a pg_trgm index on description
 * so substring search stays fast.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_bankruptcy_listings_asset_category"
        AS ENUM ('immovable','movable','rights','mixed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "bankruptcy_listings"
      ADD COLUMN IF NOT EXISTS "description"     text,
      ADD COLUMN IF NOT EXISTS "asset_category"  "enum_bankruptcy_listings_asset_category",
      ADD COLUMN IF NOT EXISTS "asset_type"      varchar(255);

    CREATE INDEX IF NOT EXISTS "bankruptcy_listings_asset_category_idx"
      ON "bankruptcy_listings" ("asset_category");

    CREATE INDEX IF NOT EXISTS "bankruptcy_listings_asset_type_idx"
      ON "bankruptcy_listings" ("asset_type");

    -- pg_trgm should already be enabled by the 20260321 migration; gracefully
    -- skip the index if it isn't.
    DO $$ BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "bankruptcy_listings_description_trgm_idx" '
           || 'ON "bankruptcy_listings" USING gin ("description" gin_trgm_ops)';
    EXCEPTION
      WHEN undefined_object THEN NULL;
      WHEN feature_not_supported THEN NULL;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "bankruptcy_listings_description_trgm_idx";
    DROP INDEX IF EXISTS "bankruptcy_listings_asset_type_idx";
    DROP INDEX IF EXISTS "bankruptcy_listings_asset_category_idx";
    ALTER TABLE "bankruptcy_listings"
      DROP COLUMN IF EXISTS "asset_type",
      DROP COLUMN IF EXISTS "asset_category",
      DROP COLUMN IF EXISTS "description";
    DROP TYPE IF EXISTS "enum_bankruptcy_listings_asset_category";
  `)
}
