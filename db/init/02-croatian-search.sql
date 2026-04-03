-- Croatian full-text search configuration
-- Depends on: 01-extensions.sql (pg_trgm + unaccent must be installed first)
--
-- Creates a `croatian` text search configuration that:
--   1. Strips diacritics via unaccent  (č/ć→c, š→s, đ→d, ž→z)
--   2. Lowercases via simple dictionary (no stemming)
--   3. Optionally upgrades to Hunspell lemmatisation if hr_HR dict files exist
--
-- The postgres:16-alpine image ships without Hunspell dictionaries, so the DO
-- block silently falls back to unaccent+simple when the files are absent.
-- To enable Hunspell, copy hr_HR.dict + hr_HR.affix into
--   /usr/share/postgresql/16/tsearch_data/
-- and rebuild / restart the database container.

-- ---------------------------------------------------------------------------
-- 1.  pg_trgm similarity threshold for fuzzy name matching
--     (applied database-wide so all sessions benefit; GUC is idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET pg_trgm.similarity_threshold = 0.3',
    current_database()
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.  Croatian text search configuration — unaccent + simple baseline
--
--     Exact spec from task:
--       CREATE TEXT SEARCH CONFIGURATION croatian (COPY = simple);
--       ALTER TEXT SEARCH CONFIGURATION croatian
--         ALTER MAPPING FOR word WITH unaccent, simple;
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TEXT SEARCH CONFIGURATION croatian (COPY = simple);
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already exists, idempotent
END;
$$;

ALTER TEXT SEARCH CONFIGURATION croatian
  ALTER MAPPING FOR word
  WITH unaccent, simple;

-- ---------------------------------------------------------------------------
-- 3.  Optional Hunspell lemmatisation
--     Requires hr_HR.dict + hr_HR.affix in $SHAREDIR/tsearch_data/.
--     Falls back silently to the unaccent+simple mapping set above.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Attempt to create a Hunspell dictionary using Croatian morphological files.
  CREATE TEXT SEARCH DICTIONARY croatian_hunspell (
    TEMPLATE = ispell,
    DictFile = hr_HR,
    AffFile  = hr_HR
  );
  -- Dict files present: upgrade the `word` mapping to use Hunspell before
  -- falling through to simple as the catch-all.
  ALTER TEXT SEARCH CONFIGURATION croatian
    ALTER MAPPING FOR word
    WITH unaccent, croatian_hunspell, simple;
EXCEPTION WHEN OTHERS THEN
  -- Hunspell files not installed; keep the unaccent + simple mapping above.
  NULL;
END;
$$;
