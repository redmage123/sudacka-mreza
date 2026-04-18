# Tech Stack Decision

## Project: Sudačka Mreža — Website Rebuild (GF-GFWEB-002)
## Date: 2026-03-21
## Decision By: Chris Novak (CTO)

---

### Backend

- **Language: TypeScript (Node.js 22 LTS)**
  TypeScript is mandated by Payload CMS 3, which is a TypeScript-first framework.
  It also gives us full type safety across the monorepo — shared types between the
  CMS collection definitions and the frontend API client, eliminating an entire class
  of runtime bugs. Node.js 22 LTS is the current long-term-support release with
  native fetch, stable ESM, and good performance for I/O-heavy CMS workloads.

- **Framework: Payload CMS 3 (standalone, headless)**
  Payload CMS 3 runs as a standalone Express-based Node.js service with its own
  admin UI, REST API, GraphQL API, file upload handling, JWT authentication, and
  Lexical rich text editor. It maps directly to this project's data model (13
  collections). Running it standalone (not embedded in Next.js) gives clean
  service separation — the frontend can be rebuilt without touching the CMS, and
  the CMS can be upgraded independently. No vendor lock-in: Payload is open-source
  and self-hosted.

- **Database: PostgreSQL 16**
  Client requirement. PostgreSQL 16 is the right choice regardless — it has
  native full-text search (tsvector + GIN indexes), pg_trgm for trigram similarity
  search, and JSONB for flexible fields (geolocation, asset metadata). The case law
  database will grow to thousands of records; PostgreSQL's query planner handles
  this well. Payload CMS has first-class PostgreSQL support via its
  `@payloadcms/db-postgres` adapter.

- **Key backend libraries:**
  - `payload@3` — CMS, admin UI, REST API, auth
  - `@payloadcms/db-postgres` — PostgreSQL adapter for Payload
  - `@payloadcms/richtext-lexical` — Lexical editor for legal documents
  - `express` (bundled with Payload) — HTTP server
  - `zod` — request validation for custom endpoints
  - `sharp` — image optimisation for expert photos and gallery uploads

---

### Frontend

- **Framework: React 19 + Vite 6 + React Router 7**
  Client requirement. React 19 brings concurrent features and improved Suspense
  for data loading. Vite 6 provides sub-second HMR and fast production builds.
  React Router 7 (formerly Remix Router in library mode) gives file-based routing
  with lazy-loading support, essential for a site with 20+ routes. The frontend is
  a pure SPA served as static files from Nginx — all data comes from Payload's REST
  API. This separation keeps concerns clean and makes the frontend independently
  deployable.

- **Styling: Tailwind CSS 4**
  Client requirement. Tailwind CSS 4 (Oxide engine) is a significant performance
  improvement over v3 — full builds in milliseconds, no JIT vs AOT distinction.
  The CSS variable–based design token system maps directly to the colour palette
  and typography scale in SPEC §5.2–5.3. Utility-first approach keeps component
  styles co-located and eliminates CSS naming conflicts.

- **Build tool: Vite 6**
  Bundled with the React 19 + Vite template. Rollup-based production builds,
  native ESM in dev, excellent TypeScript support out of the box.

- **Key frontend libraries:**
  - `react@19` + `react-dom@19`
  - `react-router@7` — routing, lazy loading, nested layouts
  - `tailwindcss@4` — styling
  - `react-i18next` + `i18next` — bilingual HR/EN, URL-path language detection
  - `leaflet@1.9` + `react-leaflet@4` — interactive Croatian jurisdiction map
  - `@fontsource/inter`, `@fontsource/source-serif-4`, `@fontsource/jetbrains-mono` — self-hosted fonts (GDPR clean, no Google CDN)
  - `zod` — API response validation
  - `dompurify` — sanitise Lexical rich text HTML before rendering
  - `vitest` + `@testing-library/react` + `@testing-library/user-event` — unit and component tests
  - `playwright` — E2E and visual regression tests
  - `@axe-core/playwright` — accessibility testing
  - `@vitejs/plugin-react` — React plugin for Vite

---

### Infrastructure

- **Containerisation: Docker + Docker Compose**
  Client requirement. Every service runs in a container. The compose file defines
  four production services plus an optional analytics service.

- **Deployment strategy: Multi-service Docker Compose on a single VPS**
  Five services:
  1. `caddy` — HTTPS reverse proxy with auto Let's Encrypt cert renewal
  2. `web` — Nginx Alpine serving the Vite SPA build (static files)
  3. `cms` — Payload CMS 3 Node.js process
  4. `db` — PostgreSQL 16 with pg_trgm extension enabled on first boot
  5. `analytics` — Umami (self-hosted, cookieless, GDPR-compliant)

- **Port mapping:**

  | Service   | Internal | Exposed | Notes |
  |-----------|----------|---------|-------|
  | caddy     | 80, 443  | 80, 443 | Public-facing |
  | web       | 80       | —       | Internal only (Caddy proxy) |
  | cms       | 3001     | —       | Internal only (Caddy proxy) |
  | db        | 5432     | —       | Internal only (never exposed) |
  | analytics | 3000     | —       | Internal only (Caddy proxy at `/stats/`) |

- **Reverse proxy: Caddy 2**
  Caddyfile routing rules:
  ```
  sudacka-mreza.hr {
      reverse_proxy /api/*   cms:3001
      reverse_proxy /admin/* cms:3001
      reverse_proxy /stats/* analytics:3000
      reverse_proxy /*       web:80
  }
  ```
  Caddy handles TLS certificate provisioning and renewal automatically via
  ACME/Let's Encrypt. Rate limits applied at Caddy layer on `/api/users/login`
  and the contact form endpoint.

---

### File Structure

Every file that must be created, organised by directory:

```
sudacka-mreza/
│
├── docker-compose.yml                        # Dev compose (with volume mounts)
├── docker-compose.prod.yml                   # Prod compose override (registry images, restart: unless-stopped)
├── .env.example                              # Root-level env var documentation
├── TECH_STACK.md                             # This file
├── SPEC.md                                   # Requirements specification
├── SPRINT_PLAN.md                            # Agile sprint plan
├── DEPLOYMENT.md                             # Deployment runbook (authored Sprint 8)
│
├── docker/
│   ├── Caddyfile                             # Caddy reverse proxy + HTTPS config
│   └── nginx.conf                            # Nginx config for SPA (try_files, gzip, cache headers)
│
├── scripts/
│   ├── deploy.sh                             # Pull latest images, docker compose up -d, run migrations
│   └── backup.sh                             # pg_dump to dated .sql.gz; keep last 7 days
│
├── .github/
│   └── workflows/
│       └── ci.yml                            # lint → typecheck → vitest → playwright → docker build → GHCR push
│
├── docs/
│   ├── adr/
│   │   ├── 0001-choice-of-backend-language.md
│   │   ├── 0002-choice-of-database.md
│   │   ├── 0003-choice-of-frontend-framework.md
│   │   ├── 0004-deployment-strategy.md
│   │   ├── 0005-cms-selection.md
│   │   ├── 0006-i18n-strategy.md
│   │   ├── 0007-map-solution.md
│   │   └── 0008-authentication.md
│   └── design/
│       ├── tokens.md                         # Colour palette, typography scale, spacing scale
│       ├── components.md                     # Component inventory with prop interfaces
│       ├── wireframes/                       # Lo-fi wireframes (Sprint 0)
│       │   ├── home.md
│       │   ├── search.md
│       │   ├── detail.md
│       │   ├── directory.md
│       │   └── contact.md
│       └── hifi/                             # Hi-fi mockups (Sprints 3–6)
│           ├── home.png
│           ├── news.png
│           ├── contact.png
│           ├── case-law.png
│           ├── experts.png
│           ├── jurisdiction.png
│           ├── stecaj.png
│           ├── calculator.png
│           ├── auth.png
│           └── gallery.png
│
├── web/                                      # React 19 SPA
│   ├── public/
│   │   ├── robots.txt                        # Disallow /admin/; allow all public routes
│   │   ├── favicon.ico
│   │   └── og-default.png                    # Default Open Graph share image
│   │
│   ├── src/
│   │   ├── main.tsx                          # Entry point — ReactDOM.createRoot + i18n init
│   │   ├── App.tsx                           # Root component — Router + AuthProvider + ThemeProvider
│   │   │
│   │   ├── router/
│   │   │   └── index.tsx                     # React Router 7 route tree; all 20+ routes lazy-loaded
│   │   │
│   │   ├── assets/
│   │   │   └── croatia-counties.geojson      # GADM Level 2 Croatian county polygons (21 counties)
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css                   # Tailwind @import + CSS custom properties for design tokens
│   │   │
│   │   ├── i18n/
│   │   │   ├── index.ts                      # i18next config: URL-path language detection, namespaces
│   │   │   ├── hr.json                       # Croatian translations (primary language)
│   │   │   └── en.json                       # English translations
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts                     # Base fetch: auth headers, locale param, error handling, Zod parse
│   │   │   ├── types.ts                      # Zod schemas + inferred TypeScript types for all 13 collections
│   │   │   ├── court-decisions.ts            # getCourtDecisions(), getCourtDecision(id), searchDecisions(params)
│   │   │   ├── expert-witnesses.ts           # getExpertWitnesses(filters), getExpertWitness(id)
│   │   │   ├── interpreters.ts               # getInterpreters(filters), getInterpreter(id)
│   │   │   ├── courts.ts                     # getCourts(type?), getCourt(id)
│   │   │   ├── state-attorneys.ts            # getStateAttorneys()
│   │   │   ├── bankruptcy.ts                 # getBankruptcyListings(), getAdministrators(), getLaws(), getPapers()
│   │   │   ├── news.ts                       # getNewsPosts(page, category), getNewsPost(slug)
│   │   │   ├── pages.ts                      # getPage(slug)
│   │   │   ├── galleries.ts                  # getGalleries(type?), getGallery(id)
│   │   │   ├── documents.ts                  # getDocuments(category?)
│   │   │   ├── search.ts                     # globalSearch(query, locale): returns grouped results
│   │   │   └── auth.ts                       # login(email, password), logout(), getMe(), register(data)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts                    # Consumes AuthContext: user, login(), logout(), isLoading
│   │   │   └── useBookmarks.ts               # localStorage CRUD for saved case law decisions
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.tsx               # JWT user state, persisted in sessionStorage
│   │   │   └── ThemeContext.tsx              # dark/light mode; prefers-color-scheme default + localStorage override
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx                # primary / secondary / ghost / danger; loading spinner; disabled state
│   │   │   │   ├── Card.tsx                  # header slot, body, footer slot, optional badge
│   │   │   │   ├── Badge.tsx                 # court-type and category colour variants
│   │   │   │   ├── Alert.tsx                 # info / warning / error / success; dismissable; role="alert"
│   │   │   │   ├── Modal.tsx                 # focus-trap, Escape-to-close, aria-modal, aria-labelledby
│   │   │   │   ├── Breadcrumb.tsx            # <nav aria-label="breadcrumb"> > ol > li
│   │   │   │   ├── Pagination.tsx            # numbered + prev/next; aria-current="page"
│   │   │   │   ├── DataTable.tsx             # sortable (aria-sort), paginated, mobile card fallback
│   │   │   │   └── SearchBar.tsx             # global typeahead; 300ms debounce; keyboard nav; Escape closes
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx                # logo, NavLink navigation, hamburger (mobile), LanguageSwitch, login button
│   │   │   │   ├── Footer.tsx                # link columns, social links, copyright, accessibility links
│   │   │   │   └── LanguageSwitch.tsx        # HR/EN toggle; switches URL path prefix /hr/ vs /en/
│   │   │   │
│   │   │   ├── BookmarkButton.tsx            # Save/unsave a court decision; filled/unfilled heart icon
│   │   │   └── LexicalRenderer.tsx           # Converts Payload Lexical JSON → safe HTML via DOMPurify
│   │   │
│   │   ├── pages/
│   │   │   ├── HomePage.tsx                  # /            Hero, quick-access grid (6 cards), news strip, stats bar
│   │   │   ├── GlobalSearchResultsPage.tsx   # /pretraga/   Unified results grouped by collection type
│   │   │   ├── NotFoundPage.tsx              # *            404 fallback
│   │   │   ├── ContactPage.tsx               # /kontakt/    Form (5 subjects) + Resend email via Payload
│   │   │   ├── AboutPage.tsx                 # /o-nama/     Lexical layout blocks from CMS pages collection
│   │   │   ├── FreeLegalAidPage.tsx          # /pravna-pomoc/   Lexical blocks
│   │   │   ├── DocumentLibraryPage.tsx       # /dokumenti/  Searchable PDFs by category
│   │   │   ├── CourtFeeCalculatorPage.tsx    # /pristojbe/  Stepped form + calculated result
│   │   │   │
│   │   │   ├── news/
│   │   │   │   ├── NewsListPage.tsx          # /vijesti/    Paginated, category filter
│   │   │   │   └── NewsDetailPage.tsx        # /vijesti/:slug   Full article, Lexical, OG meta
│   │   │   │
│   │   │   ├── case-law/
│   │   │   │   ├── CaseLawSearchPage.tsx     # /sudska-praksa/pretraga/   Keyword + court + date + type filters
│   │   │   │   ├── CaseLawDetailPage.tsx     # /sudska-praksa/:id         Full decision, PDF download, bookmark
│   │   │   │   ├── VTSPage.tsx               # /sudska-praksa/vts/        Filtered to court=VTS
│   │   │   │   └── ESLJPPage.tsx             # /sudska-praksa/esljp/      Filtered to decision_type=esljp
│   │   │   │
│   │   │   ├── experts/
│   │   │   │   ├── ExpertWitnessListPage.tsx     # /strucnjaci/vjestaci/       Search + speciality + location
│   │   │   │   ├── ExpertWitnessDetailPage.tsx   # /strucnjaci/vjestaci/:id    Profile, verified badge
│   │   │   │   ├── InterpreterListPage.tsx       # /strucnjaci/tumaci/         Language pair filter
│   │   │   │   └── InterpreterDetailPage.tsx     # /strucnjaci/tumaci/:id      Profile, language pairs
│   │   │   │
│   │   │   ├── courts/
│   │   │   │   ├── CourtsListPage.tsx            # /sudovi/           Type tabs (Municipal/County/Commercial/Misdemeanour)
│   │   │   │   ├── CourtDetailPage.tsx           # /sudovi/:id        Info card + single-marker Leaflet map
│   │   │   │   ├── StateAttorneyListPage.tsx     # /sudovi/dorh/      Directory table, sortable
│   │   │   │   └── JurisdictionMapPage.tsx       # /sudovi/nadleznost/ Choropleth; click county → popup
│   │   │   │
│   │   │   ├── bankruptcy/
│   │   │   │   ├── BankruptcyLandingPage.tsx         # /stecaj/           Intro + quick links
│   │   │   │   ├── BankruptcySalesPage.tsx           # /stecaj/ponude/    Searchable listings, deadline highlight
│   │   │   │   ├── BankruptcyAdministratorsPage.tsx  # /stecaj/upravitelji/ Searchable directory
│   │   │   │   ├── BankruptcyLawsPage.tsx            # /stecaj/zakoni/    Laws grouped by year + PDF downloads
│   │   │   │   ├── BankruptcyExpertPapersPage.tsx    # /stecaj/radovi/    Document list + category filter
│   │   │   │   └── BankruptcyCaseLawPage.tsx         # /stecaj/sudska-praksa/ Filtered case law
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx             # /prijava/    Payload JWT auth; sets HttpOnly cookie
│   │   │   │   ├── RegisterPage.tsx          # /registracija/ Create member account
│   │   │   │   └── MemberAreaPage.tsx        # /clanovi/    Protected route; saved decisions, profile
│   │   │   │
│   │   │   └── galleries/
│   │   │       ├── GalleriesListPage.tsx     # /galerije/   Photo/video/audio type tabs
│   │   │       └── GalleryDetailPage.tsx     # /galerije/:id Lightbox / YouTube iframe / HTML5 audio
│   │   │
│   │   └── utils/
│   │       ├── dates.ts                      # Locale-aware date formatting (HR: dd.MM.yyyy, EN: MM/dd/yyyy)
│   │       ├── feeCalculator.ts              # Court fee calculation logic (pure functions, fully tested)
│   │       └── richText.ts                   # Lexical JSON → plain text (used for meta description generation)
│   │
│   ├── tests/
│   │   ├── e2e/
│   │   │   ├── homepage.spec.ts
│   │   │   ├── language-switch.spec.ts
│   │   │   ├── case-law-search.spec.ts
│   │   │   ├── expert-filter.spec.ts
│   │   │   ├── contact-form.spec.ts
│   │   │   ├── auth.spec.ts
│   │   │   ├── fee-calculator.spec.ts
│   │   │   ├── jurisdiction-map.spec.ts
│   │   │   ├── bankruptcy-search.spec.ts
│   │   │   └── accessibility.spec.ts         # axe-core scan on every public page
│   │   └── screenshots/
│   │       └── baseline/                     # Visual regression baselines at 1440px and 375px
│   │
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── playwright.config.ts
│
└── cms/                                      # Payload CMS 3 standalone
    ├── src/
    │   ├── payload.config.ts                 # Root config: DB adapter, collections, i18n, CORS, upload, email
    │   │
    │   ├── collections/
    │   │   ├── CourtDecisions.ts             # title, court, date, decision_type, full_text (Lexical), attachments, category, tags; HR/EN locale
    │   │   ├── ExpertWitnesses.ts            # name, speciality_areas[], languages[], contact, court_assignments, verified; locale
    │   │   ├── Interpreters.ts               # name, language_pairs[], contact, court_assignments, verified; locale
    │   │   ├── Courts.ts                     # name, type enum, address, phone, president, website, county, geolocation (lat/lng JSONB); locale
    │   │   ├── StateAttorneys.ts             # name, jurisdiction, address, contact; locale
    │   │   ├── BankruptcyListings.ts         # case_no, debtor, court, administrator, assets[], deadline, status; locale
    │   │   ├── BankruptcyAdministrators.ts   # name, contact, assigned_cases
    │   │   ├── Laws.ts                       # title, type, year, text (Lexical), pdf_attachment, effective_date, superseded_by; locale
    │   │   ├── NewsPosts.ts                  # title, slug (auto from title), content (Lexical), published_at, category, featured_image; locale
    │   │   ├── Pages.ts                      # title, slug, content (blocks: text/image/CTA/divider); locale
    │   │   ├── Galleries.ts                  # title, type enum (photo/video/audio), items[] (media); locale
    │   │   ├── Documents.ts                  # title, category, file, published_at; MIME allowlist: pdf/doc/docx
    │   │   └── Users.ts                      # email, role enum (admin/editor/member), profile fields
    │   │
    │   ├── endpoints/
    │   │   ├── rss-news.ts                   # GET /api/rss/news.xml — RSS 2.0 (latest 20 news posts)
    │   │   ├── rss-court-decisions.ts        # GET /api/rss/court-decisions.xml — RSS 2.0 (latest 20 decisions)
    │   │   └── global-search.ts              # GET /api/search?q=&locale= — cross-collection FTS via pg_trgm
    │   │
    │   ├── migrations/
    │   │   └── 20260321_enable_pg_trgm.ts    # CREATE EXTENSION IF NOT EXISTS pg_trgm; GIN indexes on full_text/name/title
    │   │
    │   └── seed/
    │       └── index.ts                      # Demo data: 5 decisions, 5 experts, 5 courts, 2 news posts; idempotent
    │
    ├── .env.example
    ├── Dockerfile                            # Multi-stage: node:22-alpine builder → node:22-alpine runner (non-root)
    ├── package.json
    └── tsconfig.json
```

---

### API Design

All REST endpoints are auto-generated by Payload CMS 3 except where marked **(custom)**.

#### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users/login` | Login — body: `{email, password}`; returns user + JWT; sets HttpOnly cookie |
| POST | `/api/users/logout` | Logout — clears auth cookie |
| GET | `/api/users/me` | Get current user (requires auth) |
| POST | `/api/users` | Register — body: `{email, password, name}`; role defaults to `member` |
| POST | `/api/users/forgot-password` | Send password reset link to email |
| POST | `/api/users/reset-password` | Complete reset — body: `{token, password}` |

#### Court Decisions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/court-decisions` | Paginated list; supports `?where[_search][like]=keyword&where[court][equals]=VTS&locale=hr&limit=20&page=1&sort=-date` |
| GET | `/api/court-decisions/:id` | Single decision including full Lexical content |
| POST | `/api/court-decisions` | Create (admin/editor only) |
| PATCH | `/api/court-decisions/:id` | Update (admin/editor only) |
| DELETE | `/api/court-decisions/:id` | Delete (admin only) |

#### Expert Witnesses

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/expert-witnesses` | List; `?where[_search][like]=name&where[speciality_areas][in]=medicina&locale=hr` |
| GET | `/api/expert-witnesses/:id` | Single profile |
| POST/PATCH/DELETE | `/api/expert-witnesses(/:id)` | Admin/editor only |

#### Interpreters

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/interpreters` | List; `?where[language_pairs][in]=engleski&locale=hr` |
| GET | `/api/interpreters/:id` | Single profile |
| POST/PATCH/DELETE | `/api/interpreters(/:id)` | Admin/editor only |

#### Courts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/courts` | List; `?where[type][equals]=opcinski` |
| GET | `/api/courts/:id` | Single court with geolocation `{lat, lng}` |
| POST/PATCH/DELETE | `/api/courts(/:id)` | Admin/editor only |

#### State Attorneys

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/state-attorneys` | Full list; sortable by name/jurisdiction |
| GET | `/api/state-attorneys/:id` | Single record |
| POST/PATCH/DELETE | `/api/state-attorneys(/:id)` | Admin/editor only |

#### Bankruptcy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bankruptcy-listings` | List; `?where[status][equals]=active&sort=-deadline` |
| GET | `/api/bankruptcy-listings/:id` | Single listing |
| GET | `/api/bankruptcy-administrators` | Full list; searchable by name |
| GET | `/api/bankruptcy-administrators/:id` | Single administrator |
| POST/PATCH/DELETE | (all) | Admin/editor only |

#### Laws and Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/laws` | List; `?where[type][equals]=stecajni&sort=-year` |
| GET | `/api/laws/:id` | Full law text (Lexical) + PDF attachment URL |
| GET | `/api/documents` | List; `?where[category][equals]=strucni-rad&sort=-published_at` |
| GET | `/api/documents/:id` | Single document + file download URL |
| POST/PATCH/DELETE | (all) | Admin/editor only |

#### News

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/news-posts` | Paginated; `?where[category][equals]=vijesti&locale=hr&limit=10&sort=-published_at` |
| GET | `/api/news-posts/:id` | Single post (also supports `?where[slug][equals]=slug-value`) |
| POST/PATCH/DELETE | `/api/news-posts(/:id)` | Admin/editor only |

#### Pages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pages` | All pages |
| GET | `/api/pages/:id` | Page with layout blocks; `?where[slug][equals]=o-nama&locale=hr` |
| POST/PATCH/DELETE | `/api/pages(/:id)` | Admin only |

#### Galleries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/galleries` | List; `?where[type][equals]=photo` |
| GET | `/api/galleries/:id` | Gallery with full media items array |
| POST/PATCH/DELETE | `/api/galleries(/:id)` | Admin/editor only |

#### Custom Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q={query}&locale={hr\|en}&limit=5` | **(custom)** Cross-collection full-text search via pg_trgm; response: `{decisions: [], experts: [], courts: [], news: []}` |
| GET | `/api/rss/news.xml` | **(custom)** RSS 2.0 feed for news posts (latest 20); Content-Type: application/rss+xml |
| GET | `/api/rss/court-decisions.xml` | **(custom)** RSS 2.0 feed for court decisions (latest 20) |

#### Payload GraphQL

| Path | Description |
|------|-------------|
| `/api/graphql` | Full GraphQL API (auto-generated by Payload 3) |
| `/api/graphql-playground` | GraphQL Playground — **disabled in production** |

#### Standard Response Envelope

```typescript
// Collection list response (Payload standard)
interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

// Error response
interface PayloadError {
  errors: Array<{ message: string; field?: string }>;
}
```

Query parameters:
- `locale=hr|en` — language for localised fields (defaults to `hr`)
- `limit=20` — page size (max 100, enforced by Payload)
- `page=1` — page number (1-indexed)
- `sort=-createdAt` — sort field; `-` prefix = descending
- `where[field][operator]=value` — operators: `equals`, `not_equals`, `like`, `in`, `exists`, `greater_than`, `less_than`
- `depth=1` — relationship population depth (0 = IDs, 1 = one level populated)

---

### Quality Requirements

- **Test framework: Vitest 2** (unit + component) + **Playwright 1.44** (E2E + visual regression)
- **Coverage target: ≥ 80% line coverage** across `web/src/` and `cms/src/collections/`
- **Coverage gate: Hard CI failure** when coverage drops below threshold

**Test types:**

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest | Fee calculator, i18n helpers, date formatters, Zod schemas, utility functions |
| Component | Vitest + @testing-library/react | All 10 UI components + layout components |
| API | Vitest + Payload Local API | All 13 collections: CRUD, validation, search, file upload |
| E2E | Playwright | 10 critical journeys (Sprint 7: T7-3 through T7-10) |
| Accessibility | axe-core via @axe-core/playwright | All 20+ pages; zero critical/serious violations |
| Visual regression | Playwright screenshots | Key pages at 1440px and 375px |
| Cross-browser | Playwright | Chromium, Firefox, WebKit |
| Performance | @lhci/cli | Perf ≥ 90, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 90 |

**Linting and formatting:**

| Tool | Config file | Scope |
|------|-------------|-------|
| ESLint 9 (flat config) | `eslint.config.ts` | Both `web/` and `cms/` |
| Prettier 3 | `.prettierrc` | TypeScript, JSON, CSS |
| TypeScript | `tsconfig.json` (`"strict": true`) | Both packages |

ESLint plugins: `@typescript-eslint/recommended`, `react-hooks`, `jsx-a11y`, `import`

**CI/CD (GitHub Actions — `ci.yml`):**

```
On every push:
  job: lint        → eslint + prettier --check (web + cms in parallel)
  job: typecheck   → tsc --noEmit (web + cms in parallel)
  job: test:unit   → vitest run --coverage (web + cms; fails if < 80%)
  job: test:e2e    → docker compose up + playwright test
  job: docker:build → docker build web + docker build cms (verify builds)

On push to main only (after all above pass):
  job: docker:push → tag with git SHA + push to GHCR
```

---

*Authored by Chris Novak (CTO) · GF-GFWEB-002 · 2026-03-21*
*This document is the single source of truth for the build. The engineer follows it exactly.*
