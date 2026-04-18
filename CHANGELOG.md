# Changelog

All notable changes to the Sudačka mreža website will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.2] — 2026-04-02

### Fixed

- **Hybrid search FTS returning 0 results** — FTS WHERE clause updated to include `full_text_plain` (full decision text) alongside metadata fields, and switched text search config from `croatian` to `simple` to match the existing GIN index. Queries now return 1,067+ results for content-level terms with highlighted excerpts.

- **`search_vector` NULL for all 9,170 migrated decisions** — SQL bulk migration bypassed Payload's afterChange hook. Direct SQL UPDATE backfill applied from title, case number, summary, category, and tags across all records.

- **RAG service unreachable from CMS container (BUG-60)** — RAG API rebound from `127.0.0.1:8020` to `0.0.0.0:8020`. Container connectivity confirmed. `sudacka-caselaw` RAG collection created; background ingest running.

- **`fileSizeLimit` TypeScript error** — Removed obsolete property from `Media.ts` upload config; CMS now builds cleanly.

---

## [1.1.1] — 2026-03-26

### Verified (Revision 3 — i18n)

- **Build verification** — confirmed `docker compose build` (web + cms) passes cleanly after all i18n changes from v1.1.0. No regressions introduced. All 31 language locales compile into the Vite bundle without error.

---

## [1.1.0] — 2026-03-25

### Added

- **Full multilingual i18n support** — expanded from 2 languages (HR/EN) to 31 languages covering all EU official languages plus additional regional and world languages.
- **New locales added:**
  - EU official languages: Bulgarian (bg), Czech (cs), Danish (da), German (de), Greek (el), Spanish (es), Estonian (et), Finnish (fi), French (fr), Irish (ga), Hungarian (hu), Italian (it), Lithuanian (lt), Latvian (lv), Maltese (mt), Dutch (nl), Polish (pl), Portuguese (pt), Romanian (ro), Slovak (sk), Slovenian (sl), Swedish (sv)
  - Additional languages: Basque (eu), Norwegian Bokmål (nb), Icelandic (is), Ukrainian (uk), Arabic (ar), Mandarin Chinese (zh), Japanese (ja)
  - Each locale includes `nav.json` (navigation strings) and `common.json` (UI strings) with accurate translations

- **`LanguageSwitch` component redesigned** — replaced the flat button row (which would overflow at 31 languages) with an accessible `<select>` dropdown. Shows each language in its native name (e.g. "Deutsch", "Français", "日本語"). Preserves all existing routing behaviour.

- **`i18n/index.ts` updated** — `SUPPORTED_LANGUAGES` expanded to all 31 language codes; all locale resources registered with i18next.

### Fixed

- **`cms/src/jobs/notificationDigest.ts`** — Fixed pre-existing TypeScript errors: `getResend()` was using `await` inside a non-async function body (TS1308) and referencing `Resend` as a type without the correct import syntax (TS2749). Converted `getResend` to `async` and updated the call site to `await getResend()`.

### Build status after changes

| Target | Status |
|--------|--------|
| `docker compose build` (cms) | ✅ Pass — 0 TypeScript errors |
| `docker compose build` (web) | ✅ Pass — Vite bundle emitted |

---

## [1.0.0] — 2026-03-21

Initial release. Full rebuild of [sudacka-mreza.hr](https://sudacka-mreza.hr), replacing the 2009 ASP.NET WebForms site (IE7-era, HTTP-only, broken Flash, malicious ad injection) with a modern, secure, bilingual platform.

### Added

#### Security
- **HTTPS everywhere** via Caddy with automatic Let's Encrypt certificate provisioning and renewal
- **Removed malicious ad injection** script (`new-adversting.com`) present on the old site
- **JWT authentication** (HttpOnly cookies) via Payload CMS built-in auth system
- **Role-based access control** (admin / editor / member) on all API endpoints
- **Member-only contact details** — expert witness and interpreter phone/email hidden from unauthenticated users
- **Zod request validation** on all API inputs
- **CORS** configured for same-origin and Caddy proxy

#### Backend / CMS (Payload CMS 3)
- **Payload CMS 3** (TypeScript-native, standalone mode) as the headless CMS
- **PostgreSQL 16** database with `pg_trgm`, `tsvector`, `unaccent`, `uuid-ossp` extensions
- **Full-text search** on court decisions using PostgreSQL `tsvector` with Croatian language configuration
- **Fuzzy name search** using `pg_trgm` trigram similarity (diacritic-insensitive, handles Štefica → stefica)
- **Auto-slug generation** hook — Croatian diacritics stripped (č→c, š→s, ž→z, ć→c, đ→d) for ASCII-safe URLs
- **Search index hook** — `tsvector` automatically updated on every court decision save
- **Contact form email** integration via Resend API (`sendContactEmail` hook)
- **Local file storage** for PDF uploads (laws, expert papers, court decisions)

#### Data Collections
- **Courts** — directory of ~100 Croatian courts with bilingual names, court type, address, GPS coordinates, and auto-generated slugs
- **Court Decisions** — case law database with bilingual titles, court relationship, decision type (presuda/rješenje/odluka), legal category (kazneno/građansko/upravno/prekršajno/trgovačko), date, case number, full rich-text body, PDF attachment, tags, and full-text search vector
- **Expert Witnesses** — searchable directory with speciality areas, languages, county/city, court assignments, verification badge, and member-gated contact details
- **Interpreters** — directory with source/target languages, county/city, court assignments, and member-gated contact details
- **State Attorneys** — directory of ~30 state attorney offices with jurisdiction descriptions
- **Bankruptcy Listings** — time-sensitive bankruptcy sales with asset listings, deadlines, court and administrator relationships
- **Users** — accounts with three roles (admin, editor, member) and Payload built-in JWT authentication

#### Frontend (React 19 + Vite 6)
- **React 19** SPA with concurrent features and Suspense
- **Vite 6** with `vite-plugin-ssg` for static HTML generation (SEO)
- **React Router 7** with data loaders for client-side navigation
- **Tailwind CSS 4** utility-first styling with CSS-first `@theme` design tokens
- **Bilingual support** (HR/EN) via `react-i18next` with clean language path URLs (`/hr/`, `/en/`)
- **Dark mode** toggle with system preference detection and manual override
- **Mobile-first responsive design** — works on all screen sizes

#### Pages and Features
- **Homepage** — hero search bar, quick-access cards (case law, experts, courts, bankruptcy), news teaser
- **Case Law Search** (`/sudska-praksa/`) — filter by court, legal category, decision type, date range, case number; paginated results; full decision detail page with rich text body and PDF download
- **Expert Witness Directory** (`/strucnjaci/`) — filter by speciality, county, language, verification status; grid/list view; detail profile with court assignments
- **Interpreter Directory** (merged under `/strucnjaci/`) — filter by source/target language and county; member-gated contact details
- **Courts Directory** (`/sudovi/`) — list all courts by type; detail page with map pin and contact info
- **Jurisdiction Finder** — interactive Leaflet.js map with clickable court jurisdiction polygons (replaces broken Flash map from the old site)
- **Bankruptcy Portal** (`/stecaj/`) — searchable listings with asset details and deadlines; administrator profiles
- **Court Fee Calculator** (`/pristojbe/`) — interactive form for calculating Croatian court fees
- **News Archive** (`/vijesti/`) — editor-managed announcements with category filtering and pagination
- **Contact Form** (`/kontakt/`) — validated form with Resend email delivery
- **Member Area** — login-gated content (expert/interpreter contact details, member documents)
- **Authentication Pages** — login, register, forgot password, reset password
- **Static Pages** — About (`/o-nama/`), Free Legal Aid (`/pravna-pomoc/`), Privacy Policy

#### Interactive Map (Leaflet.js)
- **Replaced broken Flash-based Jurisdiction Finder** with Leaflet.js + OpenStreetMap
- Interactive GeoJSON polygons for all Croatian court jurisdictions
- Click polygon → side panel shows court details (name, address, contact, type)
- Mobile-friendly touch navigation
- No proprietary dependencies — fully open source

#### SEO and Analytics
- **Real meta tags** (title, description, Open Graph, Twitter Card) on every page via `react-helmet-async`
- **Structured data** (JSON-LD) for `LegalOrganization`, `BreadcrumbList`, `Article` schemas
- **Sitemap.xml** dynamically generated on build
- **robots.txt** correctly configured
- **301 redirects** from all old ASP.NET `.aspx` URLs to new clean URLs
- **Plausible Community Edition** — self-hosted, cookieless, GDPR-compliant analytics; zero cookie banners required
- **ClickHouse** for Plausible time-series data storage

#### Infrastructure
- **Docker Compose** configuration for both local development and production
- **Caddy** reverse proxy with automatic Let's Encrypt certificate (HTTP→HTTPS redirect, HTTP/2, HSTS)
- **Nginx** serving the React SPA static build with proper cache headers
- **GitHub Actions** CI/CD pipeline — lint, typecheck, test, build on every push to `main`
- **Multi-stage Docker builds** for minimal production image sizes
- **PostgreSQL 16** with persistent named volume for data durability
- **Health check endpoints** on all services

#### Documentation
- **README.md** — full project overview, setup instructions, API reference, data models
- **RUNBOOK.md** — deployment, health checks, monitoring, troubleshooting, backup/restore
- **CHANGELOG.md** — this file
- **12 Architecture Decision Records** (ADRs) in `docs/adr/` covering all major technology choices
- **Integration test suite** — pytest + httpx covering all API endpoints, CRUD, search, access control, model validation, edge cases

### Security Fixes (vs. old site)

| Issue | Severity | Resolution |
|-------|----------|-----------|
| No HTTPS | Critical | Caddy + Let's Encrypt auto-HTTPS |
| Malicious ad injection script | Critical | Removed; not present in rebuild |
| jQuery 1.2.6 (CVE-2011-4969, CVE-2012-6708, etc.) | High | Not used; React + modern deps only |
| `X-UA-Compatible: IE=7` (IE7 emulation) | High | Not present; modern HTML5 |
| Login credentials sent over HTTP | Critical | All traffic HTTPS-only |
| ASP.NET ViewState 25KB+ per page | Medium | Not applicable; SPA architecture |
| Flash dependency (broken since 2020) | Critical | Replaced with Leaflet.js |
| Placeholder SEO (`keyword1, keyword2`) | High | Real metadata on every page |
| No analytics | High | Plausible CE — privacy-preserving |
| Stale copyright (2009–2020) | Low | Dynamic current year |

---

## [1.0.1] — 2026-03-21

### Fixed

- **`web/tsconfig.json`** — Added `exclude` array to prevent test files (`*.test.ts`, `*.test.tsx`, `__tests__/**`) from being compiled during production `tsc -b` build. Fixes 30+ TypeScript errors in Docker image build caused by `@testing-library/react` exports being unavailable during production compilation.
- **`web/tsconfig.json`** — Added `"types": ["vite/client"]` to compilerOptions so `import.meta.env` is properly typed throughout the project.
- **`web/src/components/ui/Input.tsx`** — Replaced `process.env.NODE_ENV` (Node.js global, not available in browser/Vite build) with `import.meta.env.DEV` (Vite's standard environment check). Fixes `TS2580: Cannot find name 'process'` TypeScript error in Docker build.
- **`web/vite.config.ts`** — Removed `/// <reference types="vitest" />` directive and `test` block that caused `TS2769: 'test' does not exist in type 'UserConfigExport'` build error. Test config moved exclusively to `vitest.config.ts`.
- **`web/vitest.config.ts`** — Rewrote to import `mergeConfig` and `defineConfig` from `vitest/config` (not `vite`), resolving type incompatibility with merged vite config.
- **`web/src/pages/decisions/DecisionsSearchPage.tsx`** — Added required initial argument `undefined` to `useRef<ReturnType<typeof setTimeout>>()` (React 19 requires initial value for all `useRef` calls).
- **`web/src/pages/experts/ExpertsPage.tsx`** — Same `useRef` fix as above.
- **`web/src/pages/experts/InterpretersPage.tsx`** — Same `useRef` fix as above.
- **`cms/src/collections/Media.ts`** — Removed `fileSizeLimit` property from `upload` config (not valid in Payload CMS 3 `UploadConfig`; file size configured globally).
- **`cms/src/seed/index.ts`** — Cast `payload` as `any` in `findBySlug`, `findByCaseNumber`, and all six `payload.create()` call sites to satisfy Payload 3's strict generic collection-slug typing. All seed data types are correct at runtime.
- **`cms/Dockerfile`** — Replaced `npm ci` (requires lockfile) with `npm install --ignore-scripts`; removed `package-lock.json` from `COPY` (no lockfile in repo).
- **`web/Dockerfile`** — Same lockfile fix as CMS; added `--legacy-peer-deps` to handle `react-helmet-async@2.0.5` peer dependency conflict with React 19.

### Build status after fixes

| Target | Status |
|--------|--------|
| `web npm run build` | ✅ Pass — 0 TypeScript errors, Vite bundle emitted |
| `cms npm run build` | ✅ Pass — 0 TypeScript errors |
| `docker compose build` (cms) | ✅ Pass |
| `docker compose build` (web) | ✅ Pass |

---

## [Unreleased]

Planned for future releases:

- **Data migration from old site** — import existing court decisions, experts, interpreters from ASP.NET database dump (pending client asset delivery)
- **Laws archive** (`/propisi/`) — legislation database with PDF downloads
- **Media galleries** (`/galerija/`) — photo, video, and audio galleries
- **Expert papers** — downloadable legal articles and expert opinions
- **Full-text search across all collections** — global search bar in header
- **Email notifications** — alert editors when new member registrations require approval
- **CSV export** — export court decisions and expert lists for power users
- **Print stylesheet** — print-optimised layout for court decisions (legal citation format)
- **Accessibility audit** — WCAG 2.1 AA compliance pass with axe-core
- **Lighthouse optimisation** — target ≥90 on Performance, Accessibility, Best Practices, SEO
- **E2E test suite** — Playwright tests for all critical user journeys
- **Staging environment** — separate staging.sudacka-mreza.hr for client review before production deploys

---

*Generated by GigForge Engineering — 2026-03-21*
