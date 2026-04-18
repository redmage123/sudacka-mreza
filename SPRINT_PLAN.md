# Sudačka Mreža — Sprint Plan
**Project:** GF-GFWEB-002
**Client:** Dražen Komarica (drazen.komarica@gmail.com)
**PM:** gigforge-pm
**Engineer:** gigforge-engineer
**UX:** gigforge-dev-frontend (UX Designer role)
**Stack:** React 19 + Vite 6 + React Router 7 + Tailwind CSS 4 | Payload CMS 3 standalone | PostgreSQL 16 | Leaflet | Docker Compose
**Engagement:** Pro-bono
**Created:** 2026-03-21

---

## Milestones (existing in Postgres)

| # | Milestone | Sprints | Focus |
|---|-----------|---------|-------|
| 1 | Design | Sprint 0–1 | Design system, component library, wireframes |
| 2 | Backend | Sprint 2 | Payload CMS, data models, API, auth |
| 3 | Frontend | Sprint 3–6 | All public pages, i18n, Leaflet map |
| 4 | Testing | Sprint 7 | Vitest, Playwright, axe-core, coverage ≥ 80% |
| 5 | Deployment | Sprint 8 | Docker Compose, Caddy, CI/CD, SEO |

---

## Sprint 0 — Project Scaffold & Foundation
**Milestone:** Design
**Duration:** 3 days
**Goal:** Working skeleton with both services running; design tokens committed.

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E0-1 | Initialise `web/` — Vite 6 + React 19 + TypeScript + React Router 7 | `npm run dev` serves on port 5173; HMR working |
| E0-2 | Initialise `cms/` — Payload CMS 3 standalone + TypeScript | `npm run dev` serves admin on port 3001 |
| E0-3 | Wire PostgreSQL 16 connection in Payload config (`DATABASE_URL`) | Payload connects to DB; migrations run cleanly |
| E0-4 | Finalise Docker Compose: `caddy`, `web`, `cms`, `db` services (skeleton exists) | `docker compose up` brings all 4 services healthy |
| E0-5 | Add `web/.env.example` and `cms/.env.example` with all vars from SPEC §10.2 | All required vars documented; no secrets committed |
| E0-6 | GitHub Actions CI skeleton: lint + typecheck jobs on push | CI passes on empty repo |
| E0-7 | Configure `eslint`, `prettier`, `tsconfig` in both packages | `npm run lint` and `npm run typecheck` pass |

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U0-1 | Create `docs/design/tokens.md` — colour palette, typography scale, spacing scale | All values from SPEC §5.2–5.3 documented; dark mode variants included |
| U0-2 | Create `docs/design/wireframes/` directory; sketch homepage wireframe (lo-fi) | Header, hero, news strip, quick-access cards, footer visible |
| U0-3 | Define component inventory in `docs/design/components.md` — all 10 components from SPEC §5.4 | Each component has name, variants, and prop interface documented |

---

## Sprint 1 — Design System & Navigation Shell
**Milestone:** Design
**Duration:** 5 days
**Goal:** Full component library implemented; responsive shell with bilingual navigation working.

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U1-1 | Wireframe all primary page layouts: Home, Search results, Detail page, Directory listing, Contact | One wireframe per layout in `docs/design/wireframes/` |
| U1-2 | Wireframe mobile navigation (hamburger menu, language switch) | Mobile breakpoint (<768px) shows collapsed nav |
| U1-3 | Specify `Header` component: logo, main nav, language switcher, search icon, login button | Annotated spec in `docs/design/components.md` |
| U1-4 | Specify `Footer` component: links, social, copyright, language, accessibility links | Annotated spec |
| U1-5 | Accessibility review of colour palette — verify WCAG AA contrast ratios | All foreground/background combos ≥ 4.5:1; document results |

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E1-1 | Install and configure Tailwind CSS 4 in `web/`; add CSS variables for design tokens | `tailwind.config.ts` exports all colour/font tokens; dark mode class-based |
| E1-2 | Install Inter, Source Serif 4, JetBrains Mono via `@fontsource` | Fonts load from local bundle (no Google Fonts CDN); GDPR clean |
| E1-3 | Build `Button` component — primary / secondary / ghost / danger variants | Renders all variants; keyboard focus ring visible; tests pass |
| E1-4 | Build `Card` component — header, footer, badge props | Renders all variants; tests pass |
| E1-5 | Build `Badge/Tag` component — court type, category | Renders colour variants; tests pass |
| E1-6 | Build `Alert` component — info / warning / error / success | Dismissable variant; ARIA `role="alert"`; tests pass |
| E1-7 | Build `Modal` component — accessible dialog, trap focus, close on Escape | Focus trap works; axe-core clean; tests pass |
| E1-8 | Build `Breadcrumb` component | Renders `nav > ol > li`; `aria-label="breadcrumb"`; tests pass |
| E1-9 | Build `Pagination` component — numbered + prev/next | Keyboard navigable; `aria-current` on active page; tests pass |
| E1-10 | Build `Header` component with React Router 7 `NavLink`, mobile hamburger, language switcher stub | Responsive breakpoints; active route highlight; tests pass |
| E1-11 | Build `Footer` component | Renders all columns; links work; tests pass |
| E1-12 | Install `react-i18next` + `i18next`; create `web/src/i18n/` with `hr.json` and `en.json` stubs; language detection from URL path (`/hr/` vs `/en/`) | `useTranslation()` hook returns correct string per language; language persists in URL |
| E1-13 | Build `LanguageSwitch` component — HR / EN toggle | Switches language and updates URL path; current lang highlighted |
| E1-14 | Write Vitest component tests for all Sprint 1 components (≥ 80% coverage) | All tests pass; coverage ≥ 80% |

---

## Sprint 2 — Backend: Payload CMS Collections & API
**Milestone:** Backend
**Duration:** 5 days
**Goal:** All 13 Payload collections defined with full-text search; REST API queryable; auth working.

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E2-1 | Define `court-decisions` collection — title, court, date, decision_type, full_text (Lexical), attachments, category, tags, HR/EN locale fields | Collection visible in admin; REST `GET /api/court-decisions` returns paginated results |
| E2-2 | Define `expert-witnesses` collection — name, speciality_areas[], languages[], contact, court_assignments, verified, locale fields | Collection functional; bilingual fields working |
| E2-3 | Define `interpreters` collection — name, language_pairs[], contact, court_assignments, verified, locale fields | Collection functional |
| E2-4 | Define `courts` collection — name, type enum, address, phone, president, website, county, geolocation (lat/lng), locale fields | Collection functional; geolocation stored as JSONB |
| E2-5 | Define `state-attorneys` collection — name, jurisdiction, address, contact, locale fields | Collection functional |
| E2-6 | Define `bankruptcy-listings` collection — case_no, debtor, court, administrator, assets[], deadline, status, locale fields | Collection functional |
| E2-7 | Define `bankruptcy-administrators` collection — name, contact, assigned_cases | Collection functional |
| E2-8 | Define `laws` collection — title, type, year, text (Lexical), pdf_attachment, effective_date, superseded_by, locale fields | Collection functional; PDF upload working |
| E2-9 | Define `news-posts` collection — title, slug (auto), content (Lexical), published_at, category, author, featured_image, locale fields | Slug auto-generated from title; REST endpoint returns posts |
| E2-10 | Define `pages` collection — title, slug, content (flexible layout blocks), locale fields | Flexible layout blocks: text, image, CTA, divider |
| E2-11 | Define `galleries` collection — title, type enum (photo/video/audio), items[] (media array), locale fields | Media upload working; gallery API returns items |
| E2-12 | Define `documents` collection — title, category, file, published_at, locale fields | File upload; MIME allowlist: pdf, doc, docx |
| E2-13 | Define `users` collection — email, role enum (admin/editor/member), profile fields | Payload built-in auth; JWT login flow tested via curl |
| E2-14 | Enable PostgreSQL `pg_trgm` extension; add GIN indexes on `full_text`, `name`, `title` columns | `CREATE EXTENSION pg_trgm` in migration; indexes visible in `\d+` |
| E2-15 | Add `tsvector` search fields to `court-decisions`, `expert-witnesses`, `interpreters`; wire to Payload search hook | Full-text search query `?where[_search][like]=keyword` returns ranked results |
| E2-16 | Configure Payload i18n: `locales: ['hr', 'en']`, `defaultLocale: 'hr'` | `?locale=en` returns English content when translations exist |
| E2-17 | Configure CORS in Payload: allow `http://localhost:5173` (dev) and `https://sudacka-mreza.hr` (prod) | No CORS errors from frontend dev server |
| E2-18 | Configure file upload: max 50 MB; allowedMimeTypes; local storage in `cms/uploads/` | Upload via admin UI works; oversized file returns 413 |
| E2-19 | Write Vitest API tests for all 13 collections using Payload Local API (CRUD + search) | All tests pass; coverage ≥ 80% on collection config files |
| E2-20 | Write `cms/src/seed/` scripts for demo data (5 court decisions, 5 experts, 5 courts, 2 news posts) | `npm run seed` populates DB; idempotent (safe to run twice) |

---

## Sprint 3 — Frontend: Shell, Home, News & Static Pages
**Milestone:** Frontend
**Duration:** 4 days
**Goal:** App shell rendering bilingual content from API; home page, news, about, contact live.

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U3-1 | High-fidelity design for Home page: hero, quick-access cards (6 sections), latest news strip, stats bar | Mockup in `docs/design/hifi/home.png` |
| U3-2 | High-fidelity design for News listing and News detail page | Mockup in `docs/design/hifi/news.png` |
| U3-3 | High-fidelity design for Contact page (form + map placeholder) | Mockup in `docs/design/hifi/contact.png` |

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E3-1 | Set up React Router 7 route tree: all routes from SPEC §3.1 defined as lazy-loaded components | All routes resolve; 404 fallback route in place |
| E3-2 | Create `web/src/api/` — typed fetch wrappers for Payload REST API (fetch + Zod validation) | `getCourtDecisions()`, `getNews()`, `getCourts()` return typed data |
| E3-3 | Build `HomePage` — hero, quick-access grid (6 cards), latest 5 news posts, bilingual | Page renders in HR and EN; data from API; Lighthouse perf ≥ 90 |
| E3-4 | Build `NewsListPage` — paginated list of news posts, category filter | 10 items per page; filter by category; loading state |
| E3-5 | Build `NewsDetailPage` — full article with Lexical rich text renderer, breadcrumb, share buttons | Rich text rendered as HTML; SEO meta tags populated |
| E3-6 | Build `AboutPage` — static content loaded from Payload `pages` collection | Bilingual content; renders Lexical blocks |
| E3-7 | Build `FreeLegalAidPage` — static content from `pages` collection | Bilingual; renders Lexical blocks |
| E3-8 | Build `ContactPage` — form with 5 subject options; Resend integration via Payload email | Form submits; success/error alert shown; server-side Zod validation |
| E3-9 | Build `SearchBar` component — global typeahead querying all collections | Debounced 300ms; keyboard navigable results dropdown; Escape closes |
| E3-10 | Build `GlobalSearchResultsPage` — unified results across decisions, experts, courts, news | Grouped by type; pagination per group |
| E3-11 | Add React Router meta tags to all Sprint 3 pages: title, description, Open Graph | Each page has unique title and description; og:image fallback |
| E3-12 | Write component tests for all Sprint 3 pages and components | Tests pass; ≥ 80% coverage |

---

## Sprint 4 — Frontend: Case Law & Experts/Interpreters
**Milestone:** Frontend
**Duration:** 5 days
**Goal:** Core legal database pages working — the primary mission of the site.

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U4-1 | High-fidelity design for Case Law search page: filter panel + results table + detail modal | Mockup in `docs/design/hifi/case-law.png` |
| U4-2 | High-fidelity design for Expert Witness and Interpreter directory pages | Mockup in `docs/design/hifi/experts.png` |
| U4-3 | Design `DataTable` component spec — sortable columns, row click, mobile card fallback | Annotated in `docs/design/components.md` |

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E4-1 | Build `DataTable` component — sortable, filterable, paginated, mobile card fallback | Keyboard navigable; `aria-sort`; tests pass |
| E4-2 | Build `CaseLawSearchPage` (`/sudska-praksa/pretraga/`) — keyword, court filter, date range, decision type | Results update on filter change; URL params persist filters; deep-linkable |
| E4-3 | Build `CaseLawDetailPage` — full decision text (Lexical), metadata panel, PDF download, breadcrumb | Lexical renderer handles all block types; PDF opens in new tab |
| E4-4 | Build `VTSPage` (`/sudska-praksa/vts/`) — High Commercial Court decisions filtered view | Filtered to `court: 'VTS'` |
| E4-5 | Build `ESLJPPage` (`/sudska-praksa/esljp/`) — ECtHR/ECJ decisions | Filtered to `decision_type: 'esljp'` |
| E4-6 | Build `ExpertWitnessListPage` (`/strucnjaci/vjestaci/`) — searchable, filterable by speciality + location | Search debounced; speciality multi-select; pagination |
| E4-7 | Build `ExpertWitnessDetailPage` — profile card, specialities, languages, contact | Bilingual; verified badge if `verified: true` |
| E4-8 | Build `InterpreterListPage` (`/strucnjaci/tumaci/`) — searchable by name and language pair | Language pair multi-select filter |
| E4-9 | Build `InterpreterDetailPage` — profile, language pairs, contact | Bilingual; verified badge |
| E4-10 | Add `BookmarkButton` component — save decision to localStorage | Saves decision ID; persists on reload; filled/unfilled toggle |
| E4-11 | Write component and integration tests for all Sprint 4 pages | Tests pass; ≥ 80% coverage |

---

## Sprint 5 — Frontend: Courts, Jurisdiction Map & Bankruptcy
**Milestone:** Frontend
**Duration:** 5 days
**Goal:** Courts directory with Leaflet map replacing Flash; full bankruptcy portal.

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U5-1 | Wireframe Jurisdiction Finder map page: map fills viewport, click → popup with court info | Mockup in `docs/design/hifi/jurisdiction.png` |
| U5-2 | High-fidelity design for Bankruptcy portal landing page and listings table | Mockup in `docs/design/hifi/stecaj.png` |

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E5-1 | Install `leaflet` + `react-leaflet`; configure OpenStreetMap tile provider | Map renders; tiles load; no console errors |
| E5-2 | Source Croatian county GeoJSON (GADM level 2); commit to `web/src/assets/croatia-counties.geojson` | Valid GeoJSON; 21 counties present |
| E5-3 | Build `JurisdictionMapPage` (`/sudovi/nadleznost/`) — choropleth; click county → popup with responsible court | Map interactive; keyboard accessible (tab + Enter); bilingual popup |
| E5-4 | Build `CourtsListPage` (`/sudovi/`) — court type tabs (Municipal / County / Commercial / Misdemeanour) | Tab switching filters results; URL param `?type=opcinski` |
| E5-5 | Build `CourtDetailPage` — court info card, address, Leaflet single-marker map, contacts | Map renders single pin; bilingual |
| E5-6 | Build `StateAttorneyListPage` (`/sudovi/dorh/`) — directory table | Paginated; sortable by name/region |
| E5-7 | Build `BankruptcyLandingPage` (`/stecaj/`) — intro, quick links, latest listings | Bilingual |
| E5-8 | Build `BankruptcySalesPage` (`/stecaj/ponude/`) — searchable listings; deadline highlight | Overdue deadlines in red; search by debtor/case no |
| E5-9 | Build `BankruptcyAdministratorsPage` (`/stecaj/upravitelji/`) — searchable directory | Same pattern as expert witnesses |
| E5-10 | Build `BankruptcyLawsPage` (`/stecaj/zakoni/`) — laws list with PDF downloads | Grouped by year; amendment links |
| E5-11 | Build `BankruptcyExpertPapersPage` (`/stecaj/radovi/`) — PDF document list | Category filter; publication date sort |
| E5-12 | Build `BankruptcyCaseLawPage` (`/stecaj/sudska-praksa/`) — filtered case law view | Filtered to bankruptcy category |
| E5-13 | Write component and integration tests for all Sprint 5 pages | Tests pass; ≥ 80% coverage |

---

## Sprint 6 — Frontend: Fee Calculator, Galleries, Auth & SEO
**Milestone:** Frontend
**Duration:** 5 days
**Goal:** All remaining pages complete; user auth flow working; site feature-complete.

### UX Designer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| U6-1 | Design Court Fee Calculator page: stepped form, result display | Mockup in `docs/design/hifi/calculator.png` |
| U6-2 | Design Login, Register, Member Area pages | Mockup in `docs/design/hifi/auth.png` |
| U6-3 | Design Media Gallery page: photo grid, video embed, audio player | Mockup in `docs/design/hifi/gallery.png` |
| U6-4 | Final design review — all pages reviewed against WCAG AA checklist | Checklist completed; issues filed as tasks |

### Engineer Tasks
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| E6-1 | Build `CourtFeeCalculatorPage` (`/pristojbe/`) — form-based calculator; Zod validation | Correct result for known test cases; bilingual labels |
| E6-2 | Build `LoginPage` — Payload JWT auth via `/api/users/login`; token in HttpOnly cookie | Successful login redirects to `/clanovi/`; error on bad credentials |
| E6-3 | Build `RegisterPage` — create account via `/api/users` | Validation: email format, password ≥ 8 chars; success message |
| E6-4 | Build `MemberAreaPage` (`/clanovi/`) — protected route; saved decisions, profile | Redirects to `/prijava/` if unauthenticated |
| E6-5 | Implement auth context (`useAuth` hook) — user state, login(), logout() | Context available app-wide; token refresh handled; tests pass |
| E6-6 | Build `GalleriesListPage` (`/galerije/`) — cards for photo, video, audio albums | Type filter tabs; responsive grid |
| E6-7 | Build `GalleryDetailPage` — CSS lightbox for photos, YouTube/Vimeo iframe for video, HTML5 `<audio>` | No Flash; lightbox keyboard navigable |
| E6-8 | Build `DocumentLibraryPage` — searchable PDFs by category | Search by title; category filter; download link |
| E6-9 | Add print-friendly CSS — `@media print` hides nav/footer; preserves content | `window.print()` produces clean output |
| E6-10 | Add dark/light mode toggle — `prefers-color-scheme` default; manual toggle in localStorage | Persists on reload; no flash of wrong theme |
| E6-11 | Add `robots.txt` and `sitemap.xml` generation script (reads Payload API at build time) | `robots.txt` disallows `/admin/`; `sitemap.xml` includes all news slugs and static routes |
| E6-12 | Add `LegalOrganization` JSON-LD schema on homepage | Valid schema; no errors in Google Rich Results Test |
| E6-13 | Add Plausible/Umami analytics script (cookieless) | Script loads; no GDPR cookie consent banner required |
| E6-14 | Add RSS feed endpoints — `/api/rss/news.xml` and `/api/rss/court-decisions.xml` via Payload custom endpoint | Valid RSS 2.0; validates at w3c feed validator |
| E6-15 | Write component and integration tests for all Sprint 6 pages and hooks | Tests pass; ≥ 80% coverage |

---

## Sprint 7 — Testing
**Milestone:** Testing
**Duration:** 5 days
**Goal:** Full test suite ≥ 80% coverage; E2E critical paths pass; accessibility clean.

### QA Tasks (Engineer in QA role)
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| T7-1 | Audit Vitest coverage; write missing unit tests (fee calculator logic, i18n helpers, date formatters) | Coverage ≥ 80% lines across `web/src/` |
| T7-2 | Audit Payload collection test coverage; add missing CRUD + validation tests | Coverage ≥ 80% on `cms/src/collections/` |
| T7-3 | Playwright E2E: Homepage loads; HR/EN language switch works | Test passes headless |
| T7-4 | Playwright E2E: Case law search → results → click detail → full text visible | Test passes |
| T7-5 | Playwright E2E: Expert witness filter by speciality → results filter → profile page opens | Test passes |
| T7-6 | Playwright E2E: Contact form — fill all fields → submit → success message shown | Test passes |
| T7-7 | Playwright E2E: Register → login → member area accessible → logout → member area redirects | Test passes |
| T7-8 | Playwright E2E: Court fee calculator — enter values → result correct | Test passes against known fee table values |
| T7-9 | Playwright E2E: Jurisdiction map loads → click county → popup shows court info | Test passes |
| T7-10 | Playwright E2E: Bankruptcy sales search — search by debtor → filtered results | Test passes |
| T7-11 | Run `axe-core` on all 20+ pages via Playwright; fix all critical and serious violations | Zero critical/serious axe violations on any page |
| T7-12 | Playwright visual regression baseline — screenshots at 1440px and 375px for all key pages | Baseline committed to `tests/screenshots/baseline/` |
| T7-13 | Lighthouse CI on all pages; fix any score below target | Perf ≥ 90, Accessibility ≥ 95, SEO ≥ 95, Best Practices ≥ 90 |
| T7-14 | Cross-browser smoke test (Chromium, Firefox, WebKit) via Playwright | All E2E tests pass on all 3 engines |
| T7-15 | Add coverage enforcement to CI: fail build if coverage < 80% | CI job fails with coverage diff report when threshold not met |

---

## Sprint 8 — Deployment & DevOps
**Milestone:** Deployment
**Duration:** 4 days
**Goal:** Production-ready Docker Compose stack; CI/CD pipeline; HTTPS; monitoring.

### DevOps Tasks (Engineer in DevOps role)
| # | Task | Acceptance Criteria |
|---|------|---------------------|
| D8-1 | Finalise `docker-compose.yml` — `caddy`, `web` (Nginx + Vite build), `cms` (Payload), `db` (PostgreSQL 16) | `docker compose up` brings all services healthy |
| D8-2 | Write `Caddyfile` — HTTPS auto via Let's Encrypt; route `/` → web, `/api/*` → cms:3001, `/admin/*` → cms:3001; rate limit on login + contact | HTTPS works; routing verified; rate limit tested with curl |
| D8-3 | Write multi-stage `Dockerfile` for `web` (Node builder → Nginx alpine) | Final image < 50 MB; serves static files on port 80 |
| D8-4 | Write multi-stage `Dockerfile` for `cms` (Node builder → Node alpine, non-root) | Final image < 200 MB; runs as non-root user |
| D8-5 | PostgreSQL volume, healthcheck, `pg_trgm` init SQL in compose | DB persists across restarts; healthcheck passes; extension enabled on first run |
| D8-6 | Write `docker-compose.prod.yml` override — registry images, `restart: unless-stopped`, no dev mounts | Prod override working |
| D8-7 | GitHub Actions CI/CD: lint → typecheck → Vitest → Playwright → Docker build → push to GHCR | Full pipeline passes on `main`; images pushed with SHA tag |
| D8-8 | Write `scripts/deploy.sh` — pull latest images, `docker compose up -d`, run migrations | Script idempotent |
| D8-9 | Write `scripts/backup.sh` — `pg_dump` to dated `.sql.gz`; keep last 7 days | Script runs; file created; old files pruned |
| D8-10 | Add `analytics` service (Umami) to compose; configure in frontend | Umami admin accessible; pageviews tracked |
| D8-11 | Document deployment in `DEPLOYMENT.md` — prerequisites, env vars, first-run, backup restore | New developer can follow it cold |
| D8-12 | Final smoke test on production-equivalent Docker stack (local prod compose) | All Playwright E2E tests pass against Docker stack |

---

## Backlog — Should-Have (post-launch)

| # | Feature | Milestone |
|---|---------|-----------|
| B1 | Events calendar — conferences, webinars | Frontend |
| B2 | Newsletter subscription (Resend opt-in) | Backend + Frontend |
| B3 | Advanced case law filters — date range calendar picker | Frontend |
| B4 | Bookmark sync to user account (persist in DB) | Backend + Frontend |
| B5 | Meilisearch integration if FTS performance insufficient at scale | Backend |
| B6 | Cloudflare R2 for file storage (replace local filesystem) | DevOps |
| B7 | Dependabot + `npm audit` in CI | DevOps |

---

## Blocked — Pending Client (Dražen)

The following cannot proceed without input from the client:

| # | Blocker | Sprint Impacted |
|---|---------|----------------|
| BLK-1 | **Database access** — SQL Server dump or scraping authorisation for content migration | Post-launch migration |
| BLK-2 | **GeoJSON jurisdiction boundaries** — county-to-court mapping data (fallback: GADM open data unblocks E5-2) | Sprint 5 |
| BLK-3 | **DNS/domain control** — needed for Let's Encrypt in Caddy | Sprint 8 |
| BLK-4 | **Translation status** — which content sections exist in English? | Sprint 2–3 |
| BLK-5 | **Hosting preference** — stay on current host or move to new VPS? | Sprint 8 |

Sprint 5 (E5-2) uses GADM open data as fallback — unblocked by default.

---

## Definition of Done

**Task DONE when:**
1. Code written and committed
2. Tests written and passing (unit or E2E as appropriate)
3. Coverage threshold maintained (≥ 80%)
4. Linting and typecheck pass

**Sprint DONE when:**
1. All tasks DONE
2. `npm run test` passes in both `web/` and `cms/`
3. `docker compose up` starts clean
4. PM has reviewed deliverables
5. Handoff written for next sprint

---

## Velocity Estimate

| Sprint | Days | Deliverable |
|--------|------|-------------|
| Sprint 0 | 3 | Scaffold, Docker skeleton, design tokens |
| Sprint 1 | 5 | Component library, nav shell, i18n |
| Sprint 2 | 5 | All 13 Payload collections, FTS, API |
| Sprint 3 | 4 | Home, News, About, Contact, Global search |
| Sprint 4 | 5 | Case law, Expert witnesses, Interpreters |
| Sprint 5 | 5 | Courts, Jurisdiction map, Bankruptcy portal |
| Sprint 6 | 5 | Calculator, Auth, Galleries, Docs, SEO |
| Sprint 7 | 5 | Full test suite, E2E, Accessibility, Lighthouse |
| Sprint 8 | 4 | Docker prod, CI/CD, Deployment |
| **Total** | **41** | **Production-ready build** |

---

*Sprint plan authored by gigforge-pm · GF-GFWEB-002 · 2026-03-21*
