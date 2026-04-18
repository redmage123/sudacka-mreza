# ADR-0002: Choice of Database
## Status: Accepted
## Date: 2026-03-21

## Context

The platform requires a database capable of:
1. Storing thousands of structured legal documents (court decisions, expert witness profiles, laws)
2. Full-text search across Croatian and English legal text
3. JSONB for flexible fields (geolocation coordinates, assets arrays, tag lists)
4. File/attachment metadata
5. Reliable transactions and referential integrity
6. Handling concurrent reads from anonymous public users without connection pool exhaustion

The client explicitly requested PostgreSQL 16.

## Decision

**PostgreSQL 16** as the sole database engine.

Accessed via Payload CMS 3's `@payloadcms/db-postgres` adapter (Drizzle ORM under the hood). The `pg_trgm` extension is enabled on first startup via an init SQL script. `tsvector` columns are added to the high-search-volume collections (`court-decisions`, `expert-witnesses`, `interpreters`) with GIN indexes for ranked full-text search.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **SQLite** | No concurrent write support adequate for a public multi-editor CMS. No pg_trgm / tsvector full-text search. Fine for dev mocking but not acceptable for a multi-thousand-record legal database. |
| **MongoDB** | No pg_trgm-equivalent built in; full-text search via Atlas requires additional cost/infra. Payload 3 supports MongoDB but the schema is looser — for a legal platform with strict data integrity requirements, relational constraints matter. Docker Compose with Mongo adds complexity for no benefit given client's explicit PostgreSQL preference. |
| **MySQL 8** | No native tsvector support; full-text search in MySQL is significantly weaker than PostgreSQL's. JSONB support inferior to PostgreSQL. Payload's MySQL adapter is less mature than its PostgreSQL adapter. |
| **Meilisearch (as primary DB)** | Meilisearch is a search engine, not a primary database. It has no transactions, no referential integrity, and no file/blob metadata storage. Suitable as a secondary search layer (listed in backlog) but not as the sole data store. |
| **Redis** | Cache layer only; not suitable as a primary relational store for this data. |

## Consequences

**Positive:**
- `pg_trgm` enables fast trigram-based similarity search (catches typos in Croatian names)
- `tsvector` + GIN indexes enable ranked full-text search on legal text without a separate search service
- `JSONB` handles geolocation fields (`{lat: 45.81, lng: 15.98}`) and dynamic tag arrays efficiently
- Drizzle ORM (via Payload) generates type-safe migration files — schema changes are versioned and auditable
- `pg_dump` produces standard SQL backups; any DBA can restore without proprietary tooling
- Well-understood by the Croatian hosting community; easy to hand off

**Negative / Risks:**
- Full-text search over thousands of court decisions may slow at scale; Meilisearch is in the backlog as a fallback
- `pg_trgm` is not enabled by default; the Docker Compose init SQL must run before Payload migrations — handled by `db/init.sql`
- Drizzle ORM abstraction means direct SQL for advanced pg_trgm queries must be written as raw SQL via `drizzle.execute()` — acceptable overhead
