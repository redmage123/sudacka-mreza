#!/usr/bin/env bash
# SQL-direct KG citation backfill (bypasses Payload's update path which was
# blowing up on a payload_locked_documents JOIN in this build of Payload).
# Idempotent: re-running drops + reinserts cited_decisions edges only.
set -euo pipefail

cd "$(dirname "$0")/.."
log(){ echo "[$(date +%H:%M:%S)] $*"; }

log "STEP1 build citation -> id index in a temp table"
docker compose exec -T db psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- Citation pattern lookup: case_number -> FULL citation key. Group must wrap
-- the whole token, otherwise regexp_match returns only the prefix capture
-- group and every "Rev-…" matches every other "Rev-…".
CREATE TEMP TABLE _decision_keys AS
SELECT id::int AS id,
       (regexp_match(case_number, '((?:Rev|Gž|Kž|Pž|Us-I|U-III)-\d+/\d{4})'))[1] AS key
FROM court_decisions
WHERE case_number IS NOT NULL;
CREATE INDEX ON _decision_keys (key);

-- Citation edges extracted from full_text_plain: (citing_id, cited_key)
CREATE TEMP TABLE _edges AS
SELECT cd.id::int AS citing_id,
       (regexp_matches(cd.full_text_plain, '((?:Rev|Gž|Kž|Pž|Us-I|U-III)-\d+/\d{4})', 'g'))[1] AS cited_key
FROM court_decisions cd
WHERE cd.full_text_plain IS NOT NULL
  AND cd.full_text_plain ~ '((?:Rev|Gž|Kž|Pž|Us-I|U-III)-\d+/\d{4})';

-- Resolve cited_key -> cited_id; drop self-loops
CREATE TEMP TABLE _resolved AS
SELECT DISTINCT e.citing_id, k.id AS cited_id
FROM _edges e
JOIN _decision_keys k ON k.key = e.cited_key
WHERE k.id <> e.citing_id;
CREATE INDEX ON _resolved (citing_id);
CREATE INDEX ON _resolved (cited_id);

-- Report what we'd insert
\echo --STATS_BEGIN--
SELECT COUNT(*)             AS total_edges,
       COUNT(DISTINCT citing_id) AS unique_citing,
       COUNT(DISTINCT cited_id)  AS unique_cited
FROM _resolved;
\echo --STATS_END--

-- Clear existing cited_decisions edges (idempotency); we leave cited_by
-- alone — those are the reverse path and we'll rederive them from the
-- same forward edges below so both directions stay consistent.
DELETE FROM court_decisions_rels WHERE path IN ('cited_decisions','cited_by');

-- Insert forward edges (cited_decisions)
INSERT INTO court_decisions_rels (parent_id, path, court_decisions_id, "order")
SELECT citing_id, 'cited_decisions', cited_id,
       row_number() OVER (PARTITION BY citing_id ORDER BY cited_id) - 1
FROM _resolved;

-- Insert reverse edges (cited_by) — citing→cited becomes cited.cited_by←citing
INSERT INTO court_decisions_rels (parent_id, path, court_decisions_id, "order")
SELECT cited_id, 'cited_by', citing_id,
       row_number() OVER (PARTITION BY cited_id ORDER BY citing_id) - 1
FROM _resolved;

-- Final tally
\echo --FINAL_BEGIN--
SELECT path, COUNT(*) AS edges
FROM court_decisions_rels
WHERE path IN ('cited_decisions','cited_by')
GROUP BY path
ORDER BY path;
\echo --FINAL_END--

COMMIT;
SQL
log "BACKFILL_KG_SQL_DONE rc=$?"
