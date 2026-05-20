# Sudačka Mreža — Legacy Data Migration Readiness

**Date:** 2026-05-20
**Trigger:** Corrections-doc item 9 — client wants complete migration from the
legacy ASP.NET site so the new portal carries the full database and archive
the platform is known for.
**Status:** Partial. Several content types have already been migrated;
several are stuck or empty. The legacy site itself appears down on HTTPS;
HTTP returns 503. A legacy Postgres extract is already loaded into the
Toronto DB alongside Payload tables.

---

## 1. Current state of the scaffolding

### Scripts present

| Script | Purpose | Runnable? |
|---|---|---|
| `cms/src/migration/scraper.ts` | TypeScript scraper for ASP.NET WebForms (`/sudovi.aspx`, `/sudska-praksa.aspx`, etc.) | Yes — `npm run migrate:scrape` (cms) |
| `cms/src/migration/importer.ts` | Reads JSON from `cms/src/migration/data/` and POSTs to Payload REST API | Yes — `npm run migrate:import` (cms) |
| `cms/src/migration/migrate.ts` | CLI: `scrape`, `import`, `all` | Yes — `npm run migrate` |
| `scripts/legacy-inspect.mjs` | Probe legacy site structure | Yes — Node |
| `scripts/legacy-tumaci-scraper.mjs` | Targeted interpreter scrape (Playwright) | Yes — needs Playwright |
| `scripts/legacy-vjestaci-scraper.mjs` | Targeted expert-witness scrape (Playwright) | Yes — needs Playwright |
| `migrate_legacy.py` | Reads pre-dumped legacy tables in the Toronto DB and POSTs to Payload | Yes — but needs JWT at `/tmp/jwt_token.txt` |

### `scraper.ts` is the heaviest piece — it covers:
- Courts, Court Decisions (3 source endpoints incl. VTS & ECJ), Expert Witnesses,
  Interpreters, State Attorneys, Bankruptcy Administrators, Bankruptcy Listings,
  Laws (PDF links), Galleries (photo/video/audio).

---

## 2. Legacy site reachability

Probed from the Toronto host (`23.164.48.64`) and from the dev laptop:

| URL | Result |
|---|---|
| `https://www.sudacka-mreza.hr/sudovi.aspx` | TIMEOUT (HTTPS not responding) |
| `https://www.sudacka-mreza.hr/sudski-vjestaci.aspx` | TIMEOUT |
| `https://www.sudacka-mreza.hr/stecaj-ponude.aspx` | TIMEOUT |
| `http://www.sudacka-mreza.hr/sudovi.aspx` | HTTP 503 |

**Implication:** Live re-scraping of the legacy site is currently blocked.
The 503 suggests the legacy server is offline or behind a misconfigured
proxy. Until the legacy site is reachable again, the only sources of legacy
data are the pre-dumped legacy tables already in the Toronto Postgres
container.

---

## 3. Already-migrated content (Toronto DB row counts)

| Collection | Rows |
|---|---:|
| courts | 597 |
| court_decisions | 12 830 |
| expert_witnesses | 5 |
| interpreters | 5 |
| state_attorneys | 797 |
| bankruptcy_administrators | 462 |
| bankruptcy_listings | 11 |
| laws | 0 |
| judges | 4 832 |
| news_posts | 0 |
| galleries | 0 |

---

## 4. Legacy data already loaded into the Toronto DB

The same database carries legacy tables (likely from a `pg_dump` taken of the
old SQL Server's Postgres mirror — names are Croatian).

| Legacy table | Rows | Corresponds to Payload |
|---|---:|---|
| `sudovi` | 1 695 | `courts` |
| `suci` | 16 155 | `judges` |
| `odvjetnici` | 1 350 | `state_attorneys` |
| `sudovi_nadleznosti` | 183 042 | `courts.jurisdiction_area` (m2m to jurisdiction units) |
| `sudovi_vrste_def` | small | court-type lookup |
| `odvjetnici_odvjetnistva` | (rows) | attorney↔office bridge |

**Coverage gaps the row counts immediately reveal:**
- `sudovi` 1695 → courts 597. ~1 100 missing. Plausibly because legacy has
  legacy/inactive court rows or per-language duplicates — needs verification,
  not a guess.
- `suci` 16 155 → judges 4 832. ~11 000 missing. Same caveat — could be
  duplicates by appointment epoch or per-language rows.
- `odvjetnici` 1 350 → state_attorneys 797. ~550 missing.
- `laws`, `news_posts`, `galleries` are 0 — not yet imported at all.
- `expert_witnesses` and `interpreters` are at 5 each — clearly stub data.

---

## 5. Per-content-type ticket breakdown

Each ticket is sized (S=under a day, M=1–3 days, L=a week+) and lists its
hard blocker if any.

### T-MIG-01 — Reconcile courts (size S)
- Diff `sudovi` (1695) against `courts` (597) — produce a manifest of
  legacy court IDs not present in the target.
- Decide: are missing rows actually defunct courts? Per-language doubles?
- Drive the import via `migrate_legacy.py` (already has `sudovi → courts`
  with skip-on-name dedup).
- **Blocker:** none — data is already in the Toronto DB.

### T-MIG-02 — Reconcile judges (size S–M)
- 11k judges absent. `migrate_legacy.py` currently SKIPS `suci` because
  Judges didn't exist when the script was written. Item 6 confirmed Judges
  now exists with `court` relationship.
- Extend `migrate_legacy.py` with a `suci → judges` step (resolve `sud_id` →
  Payload `court_id` via FK lookup).
- **Blocker:** none — purely an importer addition.

### T-MIG-03 — Reconcile state attorneys (size S)
- 550 missing. Existing `migrate_legacy.py` handles this already; needs
  another pass after T-MIG-01 because some records likely couldn't resolve
  their court reference.
- **Blocker:** none.

### T-MIG-04 — Expert witnesses + interpreters import (size M)
- Only 5 of each. The targeted Playwright scrapers
  (`scripts/legacy-vjestaci-scraper.mjs`, `legacy-tumaci-scraper.mjs`) were
  built to scrape the live legacy site.
- **Blocker:** live legacy site unreachable. Need either the legacy site
  back up, OR ask the client to provide a snapshot/dump of these tables.

### T-MIG-05 — Court decisions backfill (size L)
- 12 830 imported is meaningful, but the source claims thousands more in
  the archive going back to 2001. Heavy effort: `scraper.ts` is built for
  this but needs the legacy site, and ASP.NET viewstate pagination is
  slow. Coverage check requires sampling decision IDs the new DB doesn't
  carry.
- **Blocker:** live legacy site unreachable.

### T-MIG-06 — Laws (size S)
- 0 rows. `scraper.ts` handles `/stecajni-zakoni.aspx` + static law pages.
  Volume is dozens — small.
- **Blocker:** legacy site unreachable. Could be done quickly once it is.

### T-MIG-07 — Galleries + news posts (size S–M)
- 0 rows each. Photo / audio / video galleries plus press-clipping/news.
  `scraper.ts` covers galleries; news is implicit (`/sadrzaj.aspx` + press
  clipping URLs).
- **Blocker:** legacy site unreachable.

### T-MIG-08 — Bankruptcy listings (size M)
- Only 11 rows. The bankruptcy-ingest FastAPI service is already pulling
  data via email webhook, but legacy archive of historical sales hasn't
  been bulk-imported.
- **Blocker:** legacy site reachability + scoping (archive horizon — all
  history vs. last N years?).

### T-MIG-09 — Jurisdiction polygons (size S–M)
- 183 042 rows in `sudovi_nadleznosti`. The new schema stores per-court
  `jurisdiction_area` GeoJSON. The legacy m2m needs to be resolved to
  street→court mappings and reshaped into the new model.
- **Blocker:** none for the data; design question — keep raw mappings or
  pre-aggregate into GeoJSON polygons per court?

---

## 6. Risks

- **Live legacy site is down.** All scrape-based tickets are blocked until
  it returns. Either ping the client/host to restore it, or rely on the
  pre-dumped tables for content types where they exist.
- **Court name resolution** — `migrate_legacy.py` skips dupes by name, but
  legacy court names often have whitespace / dash variants. `pg_trgm`
  similarity matching (already in the DB) should be used during import.
- **Croatian collation** — the existing `croatian` text-search config is
  set up; verify imported text doesn't break it (especially with carriage-
  returns embedded in legacy text).
- **JWT for `migrate_legacy.py`** — script expects a token at
  `/tmp/jwt_token.txt`. Not committed; needs to be generated for each run
  via admin login.
- **Bankruptcy ingestion races** — the bankruptcy-ingest FastAPI service
  writes to `bankruptcy_listings` continuously. Any bulk import there must
  use dedup by case_number to avoid creating duplicates.

---

## 7. Recommendation — what to do first

In order of expected return-on-effort:

1. **T-MIG-02 (judges import).** ~11k records, source data already in
   Toronto DB, no external dependency. Should be a single afternoon
   extending `migrate_legacy.py`. Visible win — judges directory becomes
   real.
2. **T-MIG-01 (court reconciliation).** Inspect why ~1100 courts didn't
   import. Likely a fast filter — either intentional skip or a real gap.
   Either way, decide and document.
3. **T-MIG-09 (jurisdiction polygons).** 183k mappings already exist and
   can drive the jurisdiction finder feature without any external
   dependency. Worth scoping before scrape-dependent work.

Once the legacy site is reachable again, T-MIG-04 (vještaci/tumači) and
T-MIG-06 (laws) are the small fast wins to chase before tackling T-MIG-05
(decisions archive — the long pole).

---

## 8. Open questions for the client

- Is the live legacy site at `http://www.sudacka-mreza.hr/...` intentionally
  offline, or do we need to flag this to the hosting party?
- What's the archive horizon for bankruptcy listings — full history or last
  N years?
- Do they have a `pg_dump` of the legacy SQL Server they can hand off if
  scraping isn't viable?
- For expert witnesses / interpreters: the legacy site is the only known
  source. If it stays down, do we proceed with a fresh registry instead?
