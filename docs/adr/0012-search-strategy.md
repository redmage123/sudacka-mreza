# ADR-0012: Search Strategy — PostgreSQL Full-Text Search
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

Search is the primary feature of this platform. The core use cases are:

1. **Case law full-text search** — a lawyer searches for decisions by keyword, ruling type, court, and date range. The decision texts are long-form legal documents in Croatian. Results must be ranked by relevance, not just recency.

2. **Expert witness name search** — a judge or attorney types a partial name to find experts. Croatian names have diacritics (Đurđević, Šarić, Žužul). The search must be fuzzy/accent-insensitive.

3. **Interpreter name + language search** — same as expert witness search, plus filter by language pair.

4. **Global search bar** — a single search box in the header that searches across all content types simultaneously and returns categorised results.

The owner specified PostgreSQL for full-text search.

---

## Decision

**PostgreSQL 16 full-text search** via `tsvector` + `ts_rank` for court decisions, and `pg_trgm` for name-based fuzzy search on experts/interpreters.

**Implementation:**

**Court Decisions (full-text):**
```sql
-- Custom Croatian text search config (accent-insensitive)
CREATE TEXT SEARCH CONFIGURATION hr (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION hr
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, simple;

-- GIN index on tsvector column
CREATE INDEX court_decisions_search_idx ON court_decisions USING GIN(search_vector);
```

The `search_vector` column is populated by a Payload `afterChange` hook that runs:
```sql
UPDATE court_decisions
SET search_vector = to_tsvector('hr',
  coalesce(title, '') || ' ' ||
  coalesce(case_number, '') || ' ' ||
  coalesce(full_text_plain, '')  -- plain text version of Lexical rich text
)
WHERE id = $1;
```

Search query:
```sql
SELECT id, title, court_id, date, ts_rank(search_vector, query) AS rank
FROM court_decisions
WHERE search_vector @@ plainto_tsquery('hr', $1)
  AND ($2::text IS NULL OR decision_type = $2)
  AND ($3::date IS NULL OR date >= $3)
  AND ($4::date IS NULL OR date <= $4)
ORDER BY rank DESC
LIMIT $5 OFFSET $6;
```

**Expert Witnesses / Interpreters (trigram fuzzy name search):**
```sql
CREATE INDEX expert_witnesses_name_trgm_idx
  ON expert_witnesses USING GIN(name gin_trgm_ops);

-- Query: find names similar to input, accent-insensitive
SELECT *, similarity(unaccent(name), unaccent($1)) AS sim
FROM expert_witnesses
WHERE unaccent(name) % unaccent($1)  -- trigram similarity threshold 0.3
ORDER BY sim DESC, name ASC
LIMIT 20;
```

**Global Search:** The `/api/search?q=` custom endpoint in `cms/src/endpoints/search.ts` runs four parallel queries:
1. Court decisions full-text search (top 5)
2. Expert witnesses trigram search (top 5)
3. Courts name search (top 3)
4. News posts title search (top 3)

Returns a categorised response. Total query time target: <200ms.

---

## Alternatives Considered

**Meilisearch**
- A dedicated search engine with excellent typo tolerance and Croatian language support
- Pros: Better ranking than PostgreSQL FTS; built-in typo tolerance; faceted search; search-as-you-type
- Cons: Additional Docker service; data synchronisation required (PostgreSQL is the source of truth; Meilisearch must be kept in sync via webhooks or polling); operational overhead of maintaining an additional service; for thousands of records, PostgreSQL FTS is adequate
- **Deferred:** Add Meilisearch in Phase 3 if PostgreSQL search quality proves insufficient for the case law corpus. The search service layer is designed to be swappable — `cms/src/endpoints/search.ts` is the single entry point.

**Elasticsearch / OpenSearch**
- Enterprise-grade full-text search
- Pros: Excellent for large corpora; rich query DSL; vector search support
- Cons: Heavyweight (minimum 1GB RAM for Elasticsearch); operational complexity far exceeds the needs of this project; overkill for thousands of documents
- Rejected: Disproportionate to the scale

**Algolia (hosted)**
- Excellent search experience; simple integration
- Cons: Monthly cost; US-hosted data (sovereignty concern); free tier (10k operations/month) would likely be exceeded by the case law search volume
- Rejected: Cost and data sovereignty

**pg_search (Rails gem equivalent — not applicable)**
- Not applicable; this is not a Rails project

---

## Consequences

**Positive:**
- Zero additional infrastructure — search is in PostgreSQL, which we already have
- `pg_trgm` handles Croatian name fuzzy matching extremely well (handles transpositions, missing diacritics, partial names)
- The `unaccent` extension makes `Duric` match `Đurić` — critical for Croatian name search
- GIN indexes make full-text search fast even for large tables
- All search logic is in SQL — easy to debug, test, and optimise with `EXPLAIN ANALYSE`

**Negative:**
- PostgreSQL full-text search has simpler ranking than Meilisearch (no BM25; uses `ts_rank` which is adequate but not sophisticated)
- No built-in search highlighting in the first iteration — must be added via `ts_headline()` function
- The `search_vector` column must stay in sync with source text via Payload hooks — a bug in the hook means stale search results

**Risk:**
- Croatian language stemming: PostgreSQL's `simple` text search config (which we use with `unaccent`) does NOT stem Croatian words. Searching "sud" will not find "sudski" or "sudbeni". This is a known limitation. Mitigation: use phrase search and rely on `pg_trgm` for partial matching. A proper Croatian stemmer would require a custom PostgreSQL dictionary; document this as a known limitation and potential Phase 3 enhancement.
- `full_text_plain` column: the Lexical rich text is stored as JSON. The `afterChange` hook must extract plain text from the Lexical JSON before updating `search_vector`. This requires a plain-text serialiser — implement `utils/lexicalToPlainText.ts` in the CMS service.
