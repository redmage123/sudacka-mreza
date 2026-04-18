# Sudačka Mreža — Data Migration Schema Analysis

**Project:** GF-GFWEB-002
**Author:** Chris Novak, Lead Engineer
**Date:** 2026-03-26
**Status:** Phase 3 — Migration kickoff

---

## 1. Overview

This document maps the legacy Sudačka Mreža (sudacka-mreza.hr) content model to the
new target schema (PostgreSQL 16 + Payload CMS 3) and identifies all transformation
requirements, data quality risks, and import dependencies.

**Source system:** ASP.NET WebForms application, likely MS SQL Server backend
**Data acquisition strategy:** Web scraper (`cms/src/migration/scraper.ts`) — client
has not yet provided a direct SQL Server dump. Scraper is fully built and ready to run.
**Target system:** PostgreSQL 16 with Payload CMS 3, `pg_trgm` + Croatian full-text search

---

## 2. Target Schema Summary

The target database was applied via three ordered migrations:

| Migration | Applied | Contents |
|-----------|---------|----------|
| `20260321_191618` | ✅ | Full schema: all core tables, enums, FK constraints, indexes |
| `20260321_enable_pg_trgm` | ✅ | `pg_trgm` extension + trigram indexes on name/text fields |
| `20260322_legal_categories` | ✅ | `legal_categories` table + relation to `court_decisions` |
| `db/init/01-extensions.sql` | ✅ | `uuid-ossp`, `pg_trgm`, `unaccent` extensions |
| `db/init/02-croatian-search.sql` | ✅ | `croatian` text search config (unaccent + simple, optional Hunspell) |

PostgreSQL enums defined:

| Enum | Values |
|------|--------|
| `enum_courts_type` | municipal, county, commercial, misdemeanour, high_commercial, supreme, administrative, constitutional |
| `enum_court_decisions_decision_type` | civil, criminal, commercial, administrative, constitutional, ecj, ecthr |
| `enum_bankruptcy_listings_status` | active, completed, withdrawn |
| `enum_laws_type` | zakon, pravilnik, uredba, odluka, europski |
| `enum_*_lang` | hr, en |
| `enum_users_role` | admin, editor, member |
| `enum_galleries_type` | photo, video, audio |

---

## 3. Content Type Mapping

### 3.1 Courts (`courts`)

**Source:** `/sudovi.aspx` — paginated HTML table
**Target:** `courts` table
**Estimated volume:** ~100 records
**Scraper type:** `ScrapedCourt`

| Source field | Target column | Transform |
|---|---|---|
| Name (text) | `name` | Trim whitespace |
| Type (Croatian label) | `type` enum | Map Croatian label → enum value (see §4.1) |
| Address (text) | `address` | Trim |
| City | `city` | Trim |
| County (županija) | `county` | Trim |
| Phone | `phone` | Normalise: strip spaces, ensure +385 prefix |
| Fax | `fax` | Same as phone |
| Email | `email` | Lowercase |
| Website | `website` | Ensure https:// prefix where applicable |
| President (predsjednik) | `president` | Trim |
| — | `lat` / `lng` | Not in source; geocode post-import via OpenStreetMap Nominatim |
| — | `jurisdiction_area` JSONB | Not in source; populate from GADM Croatia polygons post-import |
| — | `slug` | Auto-generated from `name` (slugify) |

**Import order:** FIRST — all other collections reference `courts.id`.

**Risks:**
- Court type labels in Croatian may not match enum values exactly (e.g. "Općinski sud" → `municipal`). Mapping table required (§4.1).
- Geocoding requires an additional async pass after initial import.

---

### 3.2 Court Decisions / Case Law (`court_decisions`)

**Source:** `/sudska-praksa.aspx`, `/vts-praksa.aspx`, `/esud-praksa.aspx` — paginated
**Target:** `court_decisions` + `court_decisions_tags` + `court_decisions_rels`
**Estimated volume:** Thousands (site has been running since 2001)
**Scraper type:** `ScrapedDecision`

| Source field | Target column | Transform |
|---|---|---|
| Title | `title` | Trim |
| Court name | `court_id` FK | Resolve to `courts.id` by normalised name |
| Decision type | `decision_type` enum | Map source label → enum (§4.2) |
| Date | `date` timestamp | Parse Croatian date format (DD.MM.YYYY) → ISO-8601 |
| Case number | `case_number` | Trim, deduplicate check |
| Summary / excerpt | `summary` | Trim |
| Category | `category` | Store raw; also populate `legal_categories` via `court_decisions_rels` |
| Full text | `full_text` JSONB | Wrap in Lexical rich-text structure; fallback to plain text in `full_text_plain` |
| — | `search_vector` | Populated post-insert via `to_tsvector('croatian', ...)` trigger or batch update |
| — | `lang` | Default `hr`; detect English records by URL path (`?Lng=en`) |
| — | `slug` | Slugify from `case_number` + `date` |

**VTS source** (`/vts-praksa.aspx`) → `decision_type = 'commercial'`
**ECJ source** (`/esud-praksa.aspx`) → `decision_type = 'ecj'`

**Risks:**
- Volume is large; scraper must handle ASP.NET ViewState pagination (already implemented in `scraper.ts`).
- Full text may be absent for older records (summary-only).
- Date parsing: some older records may use non-standard formats.
- `search_vector` requires a batch `UPDATE court_decisions SET search_vector = to_tsvector('croatian', coalesce(full_text_plain,'') || ' ' || title)` after all records are inserted.

---

### 3.3 Expert Witnesses (`expert_witnesses`)

**Source:** `/sudski-vjestaci.aspx` — paginated, filterable by speciality
**Target:** `expert_witnesses` + `expert_witnesses_speciality_areas` + `expert_witnesses_languages` + `expert_witnesses_rels`
**Estimated volume:** Hundreds–thousands
**Scraper type:** `ScrapedExpert`

| Source field | Target column | Transform |
|---|---|---|
| Name | `name` | Trim |
| Speciality areas (comma list) | `expert_witnesses_speciality_areas.area` | Split on comma/semicolon; one row per area |
| Languages | `expert_witnesses_languages` | Detect from text; map to BCP-47 codes |
| County | `county` | Trim |
| City | `city` | Trim |
| Phone | `phone` | Normalise |
| Email | `email` | Lowercase |
| Court assignments | `expert_witnesses_rels.courts_id` | Resolve court names → `courts.id` |
| — | `verified` | Default `false`; admin confirms manually |

**Risks:**
- Speciality area names are in Croatian and may vary in spelling/capitalisation; normalise before insertion.
- Court name resolution may fail for courts not yet in the target DB — log unresolved names for manual review.

---

### 3.4 Interpreters (`interpreters`)

**Source:** `/tumaci.aspx` — paginated
**Target:** `interpreters` + `interpreters_language_pairs` + `interpreters_rels`
**Estimated volume:** Hundreds
**Scraper type:** `ScrapedInterpreter`

| Source field | Target column | Transform |
|---|---|---|
| Name | `name` | Trim |
| Language pairs (raw strings) | `interpreters_language_pairs.pair` | Normalise to `"xx-yy"` BCP-47 format |
| County / City / Phone / Email | direct columns | Standard normalisation |
| Court assignments | `interpreters_rels.courts_id` | Resolve by name → `courts.id` |

---

### 3.5 State Attorney Offices (`state_attorneys`)

**Source:** `/drzavna-odvjetnistva.aspx`
**Target:** `state_attorneys`
**Estimated volume:** ~30 records
**Scraper type:** `ScrapedStateAttorney`

| Source field | Target column | Transform |
|---|---|---|
| Name / Address / City / County / Phone / Fax / Email | direct columns | Standard normalisation |

**Notes:** Small table; should import cleanly with minimal transformation.

---

### 3.6 Bankruptcy Administrators (`bankruptcy_administrators`)

**Source:** `/stecajni-upravitelji.aspx`
**Target:** `bankruptcy_administrators`
**Estimated volume:** Hundreds
**Scraper type:** `ScrapedBankruptcyAdmin`

| Source field | Target column | Transform |
|---|---|---|
| Name | `name` | Trim |
| Licence number | `licence_number` | Trim |
| Phone / Email / Address / City / County | direct columns | Standard normalisation |

**Import order:** Before `bankruptcy_listings` (FK dependency).

---

### 3.7 Bankruptcy Listings (`bankruptcy_listings`)

**Source:** `/stecaj-ponude.aspx`, `/stecaj-prodaja.aspx`
**Target:** `bankruptcy_listings` + `bankruptcy_listings_rels`
**Estimated volume:** Active listings; archives going back years
**Scraper types:** `ScrapedBankruptcyListing`, `ScrapedBankruptcySale`

| Source field | Target column | Transform |
|---|---|---|
| Case number | `case_number` | Trim; dedup key |
| Debtor name | `debtor_name` | Trim |
| Court name | `court_id` FK | Resolve → `courts.id` |
| Administrator name | `administrator_id` FK | Resolve → `bankruptcy_administrators.id` |
| Assets (description) | `assets` JSONB | Wrap as `{description: "..."}` |
| Deadline | `deadline` timestamp | Parse DD.MM.YYYY |
| Status | `status` enum | Map: "Aktivan" → `active`, "Zaključen" → `completed`, "Povučen" → `withdrawn` |
| Published at | `published_at` | Parse date string |
| Contact email / phone | direct columns | Standard normalisation |

---

### 3.8 Laws (`laws`)

**Source:** `/stecajni-zakoni.aspx` + static pages — PDFs linked inline
**Target:** `laws` + `media` (for PDF files)
**Estimated volume:** Dozens

| Source field | Target column | Transform |
|---|---|---|
| Title | `title` | Trim |
| Law type | `type` enum | Map: "Zakon" → `zakon`, "Pravilnik" → `pravilnik`, etc. |
| Year | `year` | Parse from title or URL |
| Description | `description` | Trim |
| PDF URL | `file_id` FK → `media` | Download PDF → upload to Payload Media → link ID |
| Superseded by | `superseded_by_id` FK | Self-reference; resolve post-import by title matching |

---

### 3.9 Galleries (`galleries` + `galleries_items`)

**Source:** `/fotogalerije.aspx`, `/video-galerije.aspx`, `/audio-galerije.aspx`
**Target:** `galleries` + `galleries_items` + `media`
**Type enum:** photo / video / audio

**Notes:**
- Photo galleries: download images → upload to Payload Media → link `media_id`.
- Video galleries: store YouTube/Vimeo URLs in `media` caption or as external links — avoid re-hosting video.
- Audio galleries: download audio files if hosted on the site; external embeds otherwise.
- Flash-based video is fully broken; scraper should capture YouTube/external URLs only.

---

### 3.10 Legal Categories (`legal_categories`)

**Source:** Implicit from court decision categories in source data
**Target:** `legal_categories` (added in migration `20260322_legal_categories`)
**Notes:** Populated by `seedTaxonomy.ts` from a predefined Croatian legal taxonomy; not scraped from source.

---

## 4. Transformation Tables

### 4.1 Court Type Mapping

| Croatian source label | Target enum value |
|---|---|
| Općinski sud | `municipal` |
| Županijski sud | `county` |
| Trgovački sud | `commercial` |
| Prekršajni sud | `misdemeanour` |
| Visoki trgovački sud | `high_commercial` |
| Vrhovni sud | `supreme` |
| Upravni sud | `administrative` |
| Ustavni sud | `constitutional` |

### 4.2 Decision Type Mapping

| Croatian source label / URL | Target enum value |
|---|---|
| Građansko (civil) | `civil` |
| Kazneno (criminal) | `criminal` |
| Trgovačko / VTS source | `commercial` |
| Upravno (administrative) | `administrative` |
| Ustavno (constitutional) | `constitutional` |
| Europski sud pravde (ECJ) | `ecj` |
| ESLJP / ECtHR | `ecthr` |

### 4.3 Bankruptcy Status Mapping

| Croatian source label | Target enum value |
|---|---|
| Aktivan / U tijeku | `active` |
| Zaključen / Okončan | `completed` |
| Povučen / Obustavljen | `withdrawn` |

---

## 5. Import Dependency Order

The importer (`importer.ts`) already respects this ordering:

```
1. courts                    (no dependencies)
2. state_attorneys           (no dependencies)
3. bankruptcy_administrators (no dependencies)
4. legal_categories seed     (no dependencies — run seedTaxonomy.ts separately)
5. expert_witnesses          (→ courts)
6. interpreters              (→ courts)
7. bankruptcy_listings       (→ courts, → bankruptcy_administrators)
8. court_decisions           (→ courts, → legal_categories)
9. laws                      (self-referential: superseded_by resolved post-insert)
10. galleries                (→ media)
11. documents                (→ media)
```

---

## 6. Data Quality Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Court name mismatches in decisions/experts/interpreters | High | Fuzzy matching via `pg_trgm` similarity; unresolved names logged to `migration-errors.json` for manual review |
| ASP.NET ViewState pagination drops records | High | Scraper extracts `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` on every POST; validate record counts |
| Date parsing failures (non-standard Croatian formats) | Medium | Multi-format parser; fallback to `null` with warning |
| Full text absent for older decisions | Medium | Insert as summary-only; `full_text_plain` left empty; `search_vector` still populated from `title` |
| Duplicate records (same case number re-listed) | Medium | Dedup by normalised `case_number` before insert (implemented in importer) |
| Malicious ad script on source site (`new-adversting.com`) | Low | Scraper uses isolated `node-fetch`; no JS execution; ad script never runs |
| PDF download failures (broken links) | Medium | Log failed URLs; skip gracefully; report in migration summary |
| `search_vector` not populated at insert time | High | Run post-import batch update: `UPDATE court_decisions SET search_vector = to_tsvector('croatian', ...)` |
| Geocoding lag for courts (`lat`/`lng`) | Low | Async post-import step; site functions without coordinates initially |

---

## 7. Post-Migration Verification Checklist (M-09)

After each collection import, verify:

- [ ] Record count matches scraper output (zero records lost in transform)
- [ ] Random sample of 50 records — spot-check field accuracy
- [ ] All FK references resolve (no `NULL` court_id on mandatory FK fields)
- [ ] `search_vector` populated on all `court_decisions` rows
- [ ] Old `.aspx` URL redirect map covers all scraped decision/expert URLs
- [ ] Media uploads complete (no 404s on PDF/image links)
- [ ] Bilingual records: verify `lang` field is set correctly
- [ ] `pg_trgm` index active: `SELECT * FROM pg_indexes WHERE tablename = 'court_decisions'`

---

## 8. Migration Run Commands

```bash
# From /opt/ai-elevate/gigforge/projects/sudacka-mreza/cms/

# Step 1 — Scrape live site (writes JSON to src/migration/data/)
npm run migrate:scrape

# Step 2 — Dry run (preview without writing to DB)
IMPORT_DRY_RUN=true npm run migrate:import

# Step 3 — Full import
npm run migrate:import

# Step 4 — Seed legal categories taxonomy
npx tsx src/migration/seedTaxonomy.ts

# Step 5 — Post-import: rebuild search vectors
# (run directly against the PostgreSQL container)
docker compose exec db psql -U payload -d sudacka_mreza -c \
  "UPDATE court_decisions SET search_vector = to_tsvector('croatian', coalesce(full_text_plain,'') || ' ' || title);"
```

---

## 9. Blockers

| Blocker | Owner | Status |
|---|---|---|
| Client SQL Server dump OR written scrape consent | Dražen Komarica | Pending Phase 0 |
| Media files from client server (`user-folders/`, `gallery/`) | Dražen Komarica | Pending Phase 0 |
| Jurisdiction GeoJSON for courts | Dražen Komarica or GADM | Can use GADM fallback |

**Proceeding with web scrape (public data only) as authorised by Braun (2026-03-26).**

---

## 10. Next Steps

1. **Run scraper** → `npm run migrate:scrape` against the live site
2. **Validate JSON outputs** → review counts in `src/migration/data/*.json`
3. **Dry-run import** → confirm all transforms and FK resolutions
4. **Full import** → production database
5. **Run `seedTaxonomy.ts`** → populate legal category tree
6. **Rebuild search vectors** → batch `UPDATE` on `court_decisions`
7. **Geocode courts** → async Nominatim pass
8. **Spot-check 50 records** per collection (M-09)
9. **Build URL redirect map** (M-08) from scraped URLs → new clean URLs

---

*Document prepared by Chris Novak, Lead Engineer — GigForge*
