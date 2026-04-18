# ADR-0009: Search Strategy
## Status: Accepted
## Date: 2026-03-21

## Context

Full-text search is the primary user interaction on this platform. The core mission of Sudačka Mreža is to be the definitive searchable Croatian court practice database. Search requirements:
1. Keyword search across thousands of court decisions (Croatian legal text)
2. Search across expert witness names and speciality areas
3. Search across interpreter names and language pairs
4. Global search bar returning ranked results across all collections
5. Filter by: court, date range, decision type, speciality, language pair
6. Handle Croatian diacritics (č, ć, đ, š, ž) and partial-word matches

## Decision

**PostgreSQL full-text search as the primary search engine (MVP). Meilisearch in the backlog.**

Implementation:
- `CREATE EXTENSION pg_trgm` — enables trigram similarity search (handles typos and partial matches in Croatian names)
- `tsvector` columns on `court_decisions.full_text`, `expert_witnesses.name`, `interpreters.name` — populated by Payload `beforeChange` hooks
- GIN indexes on all `tsvector` and `tsvector`-candidate columns
- Payload's built-in `?where[_search][like]=keyword` query uses the tsvector columns for ranked full-text search
- For the global `SearchBar`, the frontend calls `/api/search?q=keyword` (Payload search plugin) which fans out across enabled collections and returns grouped results

Meilisearch is listed in the backlog (B5) as a future upgrade path if FTS performance becomes insufficient at scale.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Meilisearch (as primary, from day 1)** | Meilisearch would add an 6th Docker service, ~500 MB RAM, and an index synchronisation job. For the expected initial load (thousands of records, moderate concurrent users), PostgreSQL FTS is more than sufficient. Adding Meilisearch for MVP is premature optimisation. |
| **Elasticsearch / OpenSearch** | Excellent search engine but heavyweight (JVM, 1+ GB RAM minimum). Completely unjustified at this scale. Would consume the entire server RAM budget. |
| **Algolia** | SaaS with per-search billing. Not appropriate for a self-hosted non-profit platform. |
| **LIKE queries only** | `LIKE '%keyword%'` has O(n) performance (full table scan) and no ranking. Unacceptable for a table with tens of thousands of court decisions. |
| **SQLite FTS5** | Not applicable — PostgreSQL is the chosen database. |
| **Client-side search (Fuse.js)** | Fuse.js would require loading the entire dataset into the browser. With thousands of court decisions, this is impractical. |

## Consequences

**Positive:**
- PostgreSQL FTS eliminates the need for a separate search service at MVP — simpler Docker Compose, lower RAM usage, no index sync latency
- `pg_trgm` handles Croatian diacritics correctly — searching for "curic" finds "Ćurić"; trigram similarity is robust for name searches
- GIN indexes on `tsvector` columns give O(log n) search performance — satisfactory for tens of thousands of records
- Payload's `?where[_search][like]=keyword` syntax is a first-class API query — no custom endpoints needed for basic collection search
- If Meilisearch is added later (backlog B5), it can be introduced without changing the Payload API interface — the frontend search calls remain the same

**Negative / Risks:**
- Croatian morphology is complex; `tsvector` uses the `simple` dictionary by default (no stemming). Searching "sud" may not match "sudovima" without a Croatian language dictionary. Mitigated by pg_trgm trigram similarity as a fallback.
- Ranking quality from tsvector is adequate but not as sophisticated as Meilisearch's BM25-based ranking. For a legal database used by professionals who know what they're searching for, precision matters more than recall — acceptable.
- The `buildTsvector` Payload `beforeChange` hook must run synchronously on every save — adds ~10–50ms to write operations. Acceptable for a low-write, high-read platform.
- `pg_trgm` extension must be enabled before Payload runs migrations — enforced by `db/init.sql` in Docker Compose. If the init SQL does not run (e.g., existing volume), migrations will fail on tsvector GIN index creation. Documented in `DEPLOYMENT.md`.
