# ADR-0002: Database — PostgreSQL 16
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The platform stores and queries several data types with different access patterns:

1. **Case law decisions** — thousands of documents, each with long-form rich text; primary access pattern is full-text search with filters (court, date, decision type)
2. **Expert witnesses / Interpreters** — hundreds to thousands of records; primary access pattern is name search with fuzzy matching (users frequently misspell Croatian names) and filter by speciality/language
3. **Courts, State Attorneys** — ~130 records total; relatively static; simple lookup
4. **Bankruptcy listings** — active listings with time-sensitive status; need filter by date, court, status
5. **News posts, Galleries, Documents** — standard CMS content; sequential access, pagination
6. **User accounts** — standard relational model with roles

The owner specified PostgreSQL 16.

---

## Decision

**PostgreSQL 16** as the sole database, accessed exclusively via Payload CMS's `@payloadcms/db-postgres` adapter (which uses Drizzle ORM internally).

Key PostgreSQL features in use:
- **`tsvector` + `ts_rank`** — full-text search for court decisions, with Croatian language configuration via `unaccent` extension
- **`pg_trgm`** — trigram similarity indexing for fuzzy name search on expert witnesses and interpreters (handles partial names and common Croatian spelling errors)
- **`unaccent`** — accent-insensitive search (so searching "Zupanijski" also matches "Županijski")
- **GIN indexes** — on `tsvector` column (decisions) and `name` column (experts/interpreters)
- **JSONB** — used by Payload for flexible fields and rich text storage

No separate search engine (Meilisearch, Elasticsearch) is needed for MVP. PostgreSQL's full-text search is sufficient for this volume (thousands, not millions, of documents). Meilisearch can be added later if search performance degrades.

---

## Alternatives Considered

**Microsoft SQL Server**
- The current site runs on SQL Server. Keeping it would allow a simpler migration (no schema translation).
- Rejected: Expensive licensing for a pro-bono project; poor Docker support compared to PostgreSQL; Payload CMS's SQL Server adapter is not officially supported; Croatian full-text search (`pg_trgm`, `unaccent`) is not available in SQL Server's free tier

**SQLite**
- Pros: Zero-config, single file, simple backups
- Cons: No `pg_trgm` for fuzzy name search; limited concurrent write performance; Payload's SQLite adapter is less mature than the PostgreSQL adapter; not appropriate for thousands of case law documents with full-text search
- Rejected: Cannot meet the full-text search requirements

**MongoDB**
- Pros: Flexible document model fits the varied content types
- Cons: Payload CMS supports MongoDB but the PostgreSQL adapter is more mature and better supported; MongoDB's full-text search is limited compared to PostgreSQL; no trigram search for fuzzy matching
- Rejected: PostgreSQL handles both structured data and full-text search better for this use case

**PostgreSQL + Meilisearch**
- Adding Meilisearch for search while keeping PostgreSQL for storage
- Pros: Excellent search performance, typo tolerance built in
- Cons: Additional service to run and maintain; sync complexity between PostgreSQL and Meilisearch; overkill for the current volume
- Deferred: Add Meilisearch in Phase 2 if PostgreSQL full-text search proves insufficient. Design the search service layer (`cms/src/endpoints/search.ts`) to be swappable.

---

## Consequences

**Positive:**
- Single database handles all data including search — no sync required
- `pg_trgm` provides production-quality fuzzy name search with no additional infrastructure
- Croatian full-text search with `unaccent` is a first-class PostgreSQL feature
- Payload CMS's PostgreSQL adapter is the most mature and tested of all Payload database adapters
- Drizzle generates typed migrations — no raw SQL management
- Standard PostgreSQL backup/restore (pg_dump) for disaster recovery

**Negative:**
- PostgreSQL has more operational overhead than SQLite (requires a separate container, connection pooling consideration)
- Full-text search configuration for Croatian requires careful setup of the `hr` text search configuration
- tsvector columns must be kept in sync with source text via triggers or Payload afterChange hooks

**Risk:**
- If the client has thousands of case law decisions with very long full text, search performance must be monitored. Mitigation: GIN index is already planned; add `pg_stat_activity` monitoring and consider materialized views for expensive search queries if needed.
