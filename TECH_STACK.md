# Tech Stack Decision
## Project: Sudačka Mreža — Website Rebuild (GF-GFWEB-002)
## Date: 2026-03-21
## Decision By: Chris Novak (CTO), GigForge Engineering

---

## Executive Summary

The owner has selected a **React 19 + Vite 6 + React Router 7 + Payload CMS 3 + PostgreSQL 16** stack. This document translates that decision into a complete, opinionated build specification: every file, every endpoint, every dependency, every port. The engineer who follows this document should be able to build without ambiguity.

This is a **two-service architecture**: a static React SPA served by Nginx, and a standalone Payload CMS 3 instance serving REST + GraphQL APIs. Caddy sits in front of both, handling TLS termination and routing. PostgreSQL 16 is the shared database (used exclusively by Payload CMS).

---

## Backend

### Language
**TypeScript 5.4** — both the CMS (`cms/`) and any migration/tooling scripts.

Rationale: The owner specified TypeScript. Payload CMS 3 is TypeScript-native. Type safety is essential for a long-lived civic platform that will be handed off and maintained by non-GigForge developers. The shared type system between frontend and backend via generated Payload types eliminates a whole class of integration bugs.

### Framework
**Payload CMS 3** (standalone mode, `@payloadcms/next` NOT used — pure standalone Express server).

Version: `payload@3.x` with `@payloadcms/db-postgres` adapter.

Rationale: Payload 3 in standalone mode runs as its own Node.js/Express process completely independent of the React frontend. It provides: REST API (auto-generated from collections), GraphQL API, Admin UI, JWT authentication, file uploads with local storage, Lexical rich text editor, access control, webhooks. This is exactly what this project needs — a content management backend with a good admin UI that a non-technical editor (Dražen) can use to manage court decisions, news, expert profiles, etc.

Payload runs on **port 3001** internally.

### Database
**PostgreSQL 16** with `pg_trgm` and `tsvector` for full-text search.

Connected via Payload's `@payloadcms/db-postgres` adapter (Drizzle ORM under the hood).

Key PostgreSQL extensions required:
- `pg_trgm` — trigram similarity search (fuzzy name matching for experts/interpreters)
- `tsvector` — full-text search for case law decisions
- `unaccent` — accent-insensitive Croatian search (č→c, š→s, ž→z)

Payload manages all schema migrations automatically via Drizzle. No manual `CREATE TABLE` SQL needed.

### Key Libraries (CMS service)

```
payload@3                    CMS framework
@payloadcms/db-postgres      PostgreSQL adapter (Drizzle)
@payloadcms/richtext-lexical Lexical editor for rich text fields
@payloadcms/storage-local    Local filesystem media storage (Phase 1)
express                      HTTP server (bundled by Payload standalone)
sharp                        Image optimisation (required by Payload)
resend                       Transactional email (contact form, notifications)
zod                          Request validation on custom endpoints
typescript@5.4               Language
tsx                          TypeScript execution (dev)
```

---

## Frontend

### Framework
**React 19** with **Vite 6** and **React Router 7** (client-side routing only, no SSR).

This is a pure SPA. Vite 6 builds static assets into `dist/`. Nginx serves the built assets. All data fetched at runtime from Payload CMS API.

**SEO note:** Case law detail pages and key directory pages need to be indexable. Strategy: `vite-plugin-ssg` (static site generation at build time for known routes) + React Helmet Async for `<head>` management. The sitemap is generated as a build step by calling the Payload API and writing `dist/sitemap.xml`.

### Styling
**Tailwind CSS 4** with CSS custom properties for the design token system.

Tailwind 4 uses a CSS-first configuration approach — design tokens defined in `src/styles/globals.css` using `@theme`. No `tailwind.config.js` file needed.

Typography plugin for legal document body text rendering.

### Build Tool
**Vite 6** with plugins:
- `@vitejs/plugin-react` — React 19 support with Fast Refresh
- `vite-plugin-ssg` — static HTML generation for SEO-critical routes
- `vite-tsconfig-paths` — TypeScript path aliases

### Key Libraries (Frontend)

```
react@19                      UI framework
react-dom@19                  DOM renderer
react-router@7                Client-side routing
react-i18next@15              Internationalisation
i18next@24                    i18n core
i18next-browser-languagedetector URL path language detection
leaflet@1.9                   Interactive maps (jurisdiction finder)
react-leaflet@4               React bindings for Leaflet
@tanstack/react-query@5       Server state, caching, pagination
axios@1                       HTTP client for Payload API calls
react-helmet-async            <head> management for SEO
@testing-library/react        Component testing
@testing-library/user-event   User interaction testing
vitest@2                      Test runner
@playwright/test              E2E tests
axe-core                      Accessibility testing
typescript@5.4                Language
tailwindcss@4                 Styling
@tailwindcss/typography       Prose styles for legal text
lucide-react                  Icon library
date-fns                      Date formatting (Croatian locale)
dompurify                     Sanitise Payload rich text HTML output
```

---

## Infrastructure

### Containerisation
**Docker Compose** — five core services (four in Phase 1; analytics added in Phase 2).

### Deployment Strategy

Multi-service Docker Compose on a **dedicated VPS** provisioned for Dražen's project (not the GigForge dev server). The target server has no pre-existing port conflicts; Caddy owns ports 80 and 443 directly.

```
caddy        TLS proxy + Let's Encrypt  host :80 + :443
web          React SPA (Nginx)          internal :80   (no host exposure — Caddy proxies)
cms          Payload CMS 3 (Node.js)    internal :3001 (no host exposure — Caddy proxies)
db           PostgreSQL 16              internal :5432  → host :127.0.0.1:5432 (dev only)
analytics    Plausible CE (Phase 2)     internal :8000 (no host exposure — Caddy proxies /stats)
```

See ADR-0004 for the full deployment strategy rationale.

### Port Mapping

| Service | Internal Port | Host Port | Notes |
|---------|--------------|-----------|-------|
| caddy | 80, 443 | 80, 443 | Public-facing TLS terminator |
| web | 80 | not exposed | Proxied by Caddy (`/` → web:80) |
| cms | 3001 | not exposed | Proxied by Caddy (`/api`, `/admin`, `/graphql` → cms:3001) |
| db | 5432 | 127.0.0.1:5432 (dev only) | Localhost-only in dev; never in prod |
| analytics | 8000 | not exposed | Proxied by Caddy (`/stats` → analytics:8000) |

### Reverse Proxy (Caddy)

`caddy/Caddyfile` — Caddy handles Let's Encrypt automatically, zero-config TLS:

```caddyfile
sudacka-mreza.hr, www.sudacka-mreza.hr {

    # Payload CMS: API, Admin UI, GraphQL
    handle /api/* {
        reverse_proxy cms:3001
    }
    handle /admin/* {
        reverse_proxy cms:3001
    }
    handle /graphql {
        reverse_proxy cms:3001
    }

    # Self-hosted analytics (Phase 2)
    handle /stats/* {
        reverse_proxy analytics:8000
    }

    # React SPA (catch-all — must be last)
    handle {
        reverse_proxy web:80
    }

    # Rate limiting on sensitive endpoints
    rate_limit {
        zone login {
            match path /api/users/login
            key {remote_host}
            events 10
            window 1m
        }
        zone contact {
            match path /api/contact
            key {remote_host}
            events 5
            window 10m
        }
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # URL redirect map (old ASP.NET → new SPA URLs)
    import redirects.conf
}
```

`caddy/Caddyfile.dev` — local development (HTTP only, no TLS):

```caddyfile
:80 {
    handle /api/* { reverse_proxy cms:3001 }
    handle /admin/* { reverse_proxy cms:3001 }
    handle /graphql { reverse_proxy cms:3001 }
    handle { reverse_proxy web:80 }
}
```

`caddy/redirects.conf` — 301 redirects from old ASP.NET URLs to new SPA URLs (generated by `scripts/migrate/generate-redirects.ts`).

---

## File Structure

Every file that needs to be created, organised by directory:

```
sudacka-mreza/
├── docker-compose.yml               # Dev environment (with port exposure)
├── docker-compose.prod.yml          # Production (no exposed db/cms ports)
├── .env.example                     # All required env vars documented
├── .gitignore
├── README.md
│
├── caddy/
│   ├── Caddyfile                    # Production (HTTPS + Let's Encrypt auto-renew)
│   ├── Caddyfile.dev                # Dev (HTTP only, no TLS)
│   └── redirects.conf               # 301 redirects: old ASP.NET URLs → new SPA URLs
│
├── web/                             # React SPA (Vite 6)
│   ├── Dockerfile
│   ├── nginx.conf                   # Serve dist/, SPA fallback to index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html                   # Vite entry point
│   ├── public/
│   │   ├── robots.txt
│   │   ├── favicon.ico
│   │   └── assets/                  # Static assets not processed by Vite
│   └── src/
│       ├── main.tsx                 # React entry point
│       ├── App.tsx                  # Root component with router + providers
│       ├── router.tsx               # All route definitions (React Router 7)
│       │
│       ├── styles/
│       │   ├── globals.css          # Tailwind 4 @theme tokens, base styles
│       │   └── print.css            # Print-friendly styles
│       │
│       ├── i18n/
│       │   ├── index.ts             # i18next init + language detection
│       │   └── locales/
│       │       ├── hr/
│       │       │   ├── common.json  # Shared: buttons, labels, errors
│       │       │   ├── nav.json     # Navigation labels
│       │       │   ├── home.json    # Homepage copy
│       │       │   ├── decisions.json
│       │       │   ├── experts.json
│       │       │   ├── courts.json
│       │       │   ├── bankruptcy.json
│       │       │   ├── calculator.json
│       │       │   ├── news.json
│       │       │   ├── contact.json
│       │       │   └── auth.json
│       │       └── en/
│       │           └── (same files)
│       │
│       ├── components/
│       │   ├── ui/                  # Reusable design system components
│       │   │   ├── Button.tsx
│       │   │   ├── Button.test.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Card.test.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Modal.test.tsx
│       │   │   ├── Alert.tsx
│       │   │   ├── Breadcrumb.tsx
│       │   │   ├── Pagination.tsx
│       │   │   ├── Pagination.test.tsx
│       │   │   ├── DataTable.tsx
│       │   │   ├── DataTable.test.tsx
│       │   │   ├── SearchBar.tsx
│       │   │   └── SearchBar.test.tsx
│       │   │
│       │   ├── layout/
│       │   │   ├── Header.tsx
│       │   │   ├── Header.test.tsx
│       │   │   ├── Footer.tsx
│       │   │   ├── MobileMenu.tsx
│       │   │   ├── LanguageSwitch.tsx
│       │   │   └── DarkModeToggle.tsx
│       │   │
│       │   └── features/
│       │       ├── JurisdictionMap.tsx      # Leaflet map, GADM polygons
│       │       ├── JurisdictionMap.test.tsx
│       │       ├── CourtFeeCalculator.tsx   # Pure client-side logic
│       │       ├── CourtFeeCalculator.test.tsx
│       │       ├── DecisionCard.tsx
│       │       ├── ExpertCard.tsx
│       │       ├── CourtCard.tsx
│       │       └── NewsCard.tsx
│       │
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── HomePage.test.tsx
│       │   ├── NotFoundPage.tsx
│       │   │
│       │   ├── decisions/
│       │   │   ├── DecisionsSearchPage.tsx  # /sudska-praksa/pretraga
│       │   │   ├── DecisionDetailPage.tsx   # /sudska-praksa/:id
│       │   │   ├── VTSDecisionsPage.tsx     # /sudska-praksa/vts
│       │   │   └── ESLJPDecisionsPage.tsx   # /sudska-praksa/esljp
│       │   │
│       │   ├── experts/
│       │   │   ├── ExpertsPage.tsx          # /strucnjaci/vjestaci
│       │   │   ├── ExpertDetailPage.tsx     # /strucnjaci/vjestaci/:id
│       │   │   ├── InterpretersPage.tsx     # /strucnjaci/tumaci
│       │   │   └── InterpreterDetailPage.tsx
│       │   │
│       │   ├── courts/
│       │   │   ├── CourtsPage.tsx           # /sudovi
│       │   │   ├── CourtDetailPage.tsx      # /sudovi/:id
│       │   │   ├── StateAttorneysPage.tsx   # /sudovi/dorh
│       │   │   └── JurisdictionFinderPage.tsx # /sudovi/nadleznost
│       │   │
│       │   ├── bankruptcy/
│       │   │   ├── BankruptcyPage.tsx       # /stecaj
│       │   │   ├── BankruptcyListingsPage.tsx
│       │   │   ├── BankruptcyListingDetailPage.tsx
│       │   │   ├── AdministratorsPage.tsx
│       │   │   ├── BankruptcyLawsPage.tsx
│       │   │   └── BankruptcyDecisionsPage.tsx
│       │   │
│       │   ├── CalculatorPage.tsx           # /pristojbe
│       │   ├── LegalAidPage.tsx             # /pravna-pomoc
│       │   ├── AboutPage.tsx                # /o-nama
│       │   ├── ContactPage.tsx              # /kontakt
│       │   ├── GalleriesPage.tsx            # /galerije
│       │   ├── GalleryDetailPage.tsx        # /galerije/:id
│       │   ├── NewsPage.tsx                 # /vijesti
│       │   ├── NewsDetailPage.tsx           # /vijesti/:slug
│       │   ├── MembersPage.tsx              # /clanovi (auth-gated)
│       │   ├── LoginPage.tsx                # /login
│       │   └── RegisterPage.tsx             # /register
│       │
│       ├── hooks/
│       │   ├── useSearch.ts                 # Debounced search + React Query
│       │   ├── useAuth.ts                   # Token storage, login/logout
│       │   ├── usePagination.ts
│       │   └── useDarkMode.ts               # System preference + manual override
│       │
│       ├── services/
│       │   ├── api.ts                       # Axios instance, base URL, auth headers
│       │   ├── decisions.service.ts         # API calls for court-decisions
│       │   ├── experts.service.ts
│       │   ├── interpreters.service.ts
│       │   ├── courts.service.ts
│       │   ├── bankruptcy.service.ts
│       │   ├── news.service.ts
│       │   ├── galleries.service.ts
│       │   ├── documents.service.ts
│       │   └── auth.service.ts
│       │
│       ├── types/
│       │   ├── payload-types.ts             # Auto-generated by `payload generate:types`
│       │   ├── api.ts                       # Payload list/detail response wrappers
│       │   └── search.ts
│       │
│       └── utils/
│           ├── feeCalculator.ts             # Court fee calculation logic (pure)
│           ├── feeCalculator.test.ts
│           ├── slugify.ts                   # Croatian slug generation (handles đ,č,š,ž,ć)
│           ├── slugify.test.ts
│           ├── seo.ts                       # Build sitemap, structured data helpers
│           └── richText.ts                  # DOMPurify wrapper for Payload Lexical HTML
│
├── cms/                                     # Payload CMS 3 standalone
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── payload.config.ts                    # Main Payload configuration
│   └── src/
│       ├── server.ts                        # Express server entry point
│       │
│       ├── collections/
│       │   ├── Users.ts                     # admin / editor / member roles
│       │   ├── CourtDecisions.ts            # Full-text indexed
│       │   ├── ExpertWitnesses.ts           # pg_trgm indexed
│       │   ├── Interpreters.ts              # pg_trgm indexed
│       │   ├── Courts.ts
│       │   ├── StateAttorneys.ts
│       │   ├── BankruptcyListings.ts
│       │   ├── BankruptcyAdministrators.ts
│       │   ├── Laws.ts
│       │   ├── NewsPosts.ts
│       │   ├── Pages.ts
│       │   ├── Galleries.ts
│       │   ├── Documents.ts
│       │   └── Media.ts                     # Payload media uploads
│       │
│       ├── globals/
│       │   ├── Settings.ts                  # Site name, contact email, social links
│       │   └── Navigation.ts                # Menu structure managed in admin
│       │
│       ├── endpoints/
│       │   ├── contact.ts                   # POST /api/contact → Resend
│       │   ├── search.ts                    # GET /api/search?q=... (global)
│       │   └── sitemap.ts                   # GET /api/sitemap.xml
│       │
│       ├── hooks/
│       │   ├── generateSlug.ts              # beforeChange: auto-generate slugs
│       │   ├── generateSearchIndex.ts       # afterChange: update tsvector column
│       │   └── sendContactEmail.ts          # afterChange: Resend integration
│       │
│       └── migrations/
│           └── (Drizzle auto-generated migration files)
│
├── scripts/
│   ├── migrate/
│   │   ├── README.md                        # Migration instructions
│   │   ├── parse-sql-dump.ts                # Parse SQL Server dump → JSON
│   │   ├── import-decisions.ts              # JSON → Payload Local API
│   │   ├── import-experts.ts
│   │   ├── import-interpreters.ts
│   │   ├── import-courts.ts
│   │   └── import-state-attorneys.ts
│   │
│   └── seed/
│       ├── seed.ts                          # Seed with Croatian dummy data for dev
│       └── data/
│           ├── courts.json
│           ├── experts.json
│           └── decisions.json
│
├── docs/
│   ├── adr/                                 # Architecture Decision Records
│   │   └── 0001-*.md ... 0012-*.md
│   └── api/
│       └── endpoints.md                     # Full API reference
│
└── .github/
    └── workflows/
        ├── ci.yml                           # Lint + test + build on PR
        └── deploy.yml                       # Build + push Docker images on main
```

---

## API Design

### Base URL
- Development: `http://localhost:3001/api`
- Production: `https://sudacka-mreza.hr/api`

### Authentication
Payload CMS JWT. Login returns a token in an HttpOnly cookie AND the response body. Include `Cookie: payload-token=<jwt>` or `Authorization: Bearer <jwt>` on authenticated requests.

### Payload REST API (auto-generated)

All collection endpoints follow Payload's standard REST pattern. Query parameters: `where`, `limit` (default 20, max 100), `page`, `sort`, `depth` (relation depth).

#### Court Decisions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/court-decisions` | List/search decisions. Use `where[full_text_search][like]=keyword` for full-text |
| GET | `/api/court-decisions/:id` | Get single decision by ID |
| POST | `/api/court-decisions` | Create decision (admin/editor only) |
| PATCH | `/api/court-decisions/:id` | Update decision (admin/editor only) |
| DELETE | `/api/court-decisions/:id` | Delete decision (admin only) |

Key `where` filters: `court`, `decision_type`, `date[gte]`, `date[lte]`, `category`, `tags`

#### Expert Witnesses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/expert-witnesses` | List/search experts. `where[name][like]=`, `where[speciality_areas][in]=` |
| GET | `/api/expert-witnesses/:id` | Get single expert |
| POST | `/api/expert-witnesses` | Create (admin/editor) |
| PATCH | `/api/expert-witnesses/:id` | Update (admin/editor) |
| DELETE | `/api/expert-witnesses/:id` | Delete (admin) |

#### Interpreters
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/interpreters` | List/search. `where[language_pairs][in]=`, `where[name][like]=` |
| GET | `/api/interpreters/:id` | Get single interpreter |

#### Courts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/courts` | List all courts. Filter: `where[type][equals]=municipal` |
| GET | `/api/courts/:id` | Get single court with address + map coordinates |

Court types: `municipal`, `county`, `commercial`, `misdemeanour`, `high_commercial`, `supreme`, `administrative`

#### State Attorneys
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/state-attorneys` | List all offices |
| GET | `/api/state-attorneys/:id` | Get single office |

#### Bankruptcy Listings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bankruptcy-listings` | List listings. Filter: `status`, `court`, date range |
| GET | `/api/bankruptcy-listings/:id` | Get single listing |

#### Bankruptcy Administrators
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bankruptcy-administrators` | List administrators |
| GET | `/api/bankruptcy-administrators/:id` | Get single administrator |

#### Laws
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/laws` | List laws. Filter: `type`, `year` |
| GET | `/api/laws/:id` | Get single law (with PDF attachment) |

#### News Posts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/news-posts` | List published posts. Sort: `-published_at` |
| GET | `/api/news-posts/:id` | Get single post |

Slug-based lookup via `where[slug][equals]=my-slug`.

#### Galleries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/galleries` | List galleries. Filter: `where[type][equals]=photo` |
| GET | `/api/galleries/:id` | Get gallery with items |

#### Documents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List documents. Filter: `category` |
| GET | `/api/documents/:id` | Get document (with file URL) |

#### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users` | Register new member |
| POST | `/api/users/login` | Authenticate, receive JWT |
| POST | `/api/users/logout` | Invalidate token |
| GET | `/api/users/me` | Get current user profile |
| POST | `/api/users/forgot-password` | Send password reset email |
| POST | `/api/users/reset-password` | Complete password reset |

#### Custom Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/contact` | Contact form submission → Resend email | Public |
| GET | `/api/search?q=&type=` | Global search across all collections. `type`: all/decisions/experts/courts/news | Public |
| GET | `/api/sitemap.xml` | Dynamic sitemap (all public content URLs) | Public |
| GET | `/api/feed/rss` | RSS feed (latest 50 news posts + decisions) | Public |

### Request/Response Formats

**Payload list response:**
```json
{
  "docs": [...],
  "totalDocs": 1847,
  "limit": 20,
  "totalPages": 93,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

**Contact form request (POST /api/contact):**
```json
{
  "subject": "suggestion" | "criticism" | "collaboration" | "media" | "other",
  "name": "string",
  "email": "string",
  "message": "string"
}
```

**Global search response (GET /api/search?q=keyword):**
```json
{
  "decisions": [{ "id": "...", "title": "...", "court": "...", "date": "..." }],
  "experts": [{ "id": "...", "name": "...", "speciality_areas": [...] }],
  "courts": [{ "id": "...", "name": "...", "type": "..." }],
  "news": [{ "id": "...", "title": "...", "slug": "...", "published_at": "..." }]
}
```

### GraphQL API
Available at `/graphql`. Auto-generated by Payload from collections. Used for any complex nested queries (e.g., bankruptcy listing with administrator profile and court details in one request).

---

## Quality Requirements

### Test Framework
**Vitest 2** — unit + component tests (fast, Vite-native, no Jest configuration overhead).
**@testing-library/react** — component tests (user-centric, ARIA queries).
**Playwright** — E2E tests and visual regression.
**axe-core** via `@axe-core/playwright` — accessibility checks on every page in E2E suite.

### Coverage Target
**80% minimum** — hard gate in CI. No merge if coverage drops below threshold.

Coverage scope: all utility functions, all UI components, all custom Payload endpoints.

### Test Structure

```
web/src/
  components/ui/Button.test.tsx          # All states: primary/secondary/disabled/loading
  components/ui/Pagination.test.tsx      # Page navigation, edge cases
  components/features/CourtFeeCalculator.test.tsx  # All fee calculation scenarios
  utils/feeCalculator.test.ts            # Pure logic, 100% coverage required
  utils/slugify.test.ts                  # Croatian character handling: č,š,ž,ć,đ

e2e/
  search.spec.ts                         # Full-text search, filters, pagination
  contact-form.spec.ts                   # Form validation, submission, success state
  auth.spec.ts                           # Register, login, member area access
  calculator.spec.ts                     # Court fee calculator scenarios
  jurisdiction-map.spec.ts               # Leaflet map loads, polygon click
  a11y.spec.ts                           # axe scan on all public pages
  visual.spec.ts                         # Screenshot regression: homepage, search, courts
```

### Linting / Formatting
- **ESLint** with `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`
- **Prettier** — consistent code style, enforced in CI
- **TypeScript strict mode** — `"strict": true` in both `web/tsconfig.json` and `cms/tsconfig.json`

### CI/CD (GitHub Actions)

**ci.yml** — runs on every PR:
1. `npm ci` (both `web/` and `cms/`)
2. `npm run lint` (both)
3. `npm run type-check` (both)
4. `npm run test:coverage` (web — must be ≥80%)
5. `npm run build` (web — must compile clean)
6. `docker compose build` — verify all containers build successfully

**deploy.yml** — runs on push to `main`:
1. Run full CI suite
2. Build Docker images
3. Push to registry
4. SSH to production server, pull new images, `docker compose up -d`
5. Health check: `curl https://sudacka-mreza.hr/api/health`

---

## Environment Variables

```bash
# docker-compose.yml / .env

# Database
DATABASE_URL=postgresql://sudacka:changeme@db:5432/sudacka_mreza

# Payload CMS
PAYLOAD_SECRET=<32-char random string — NEVER commit>
PAYLOAD_PUBLIC_SERVER_URL=https://sudacka-mreza.hr

# CORS
CORS_ORIGIN=https://sudacka-mreza.hr

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM=info@sudacka-mreza.hr

# Analytics (Plausible)
PLAUSIBLE_DOMAIN=sudacka-mreza.hr

# Frontend (build-time Vite env)
VITE_API_BASE_URL=https://sudacka-mreza.hr/api
VITE_PLAUSIBLE_DOMAIN=sudacka-mreza.hr
```

---

## Design System Tokens (Tailwind 4 CSS-first)

Defined in `web/src/styles/globals.css` using `@theme`:

```css
@theme {
  --color-primary: #1B3A6B;
  --color-secondary: #2E6DA4;
  --color-accent: #C9A227;
  --color-background: #F8F9FB;
  --color-surface: #FFFFFF;
  --color-text: #1A1A2E;
  --color-muted: #6B7280;
  --color-danger: #DC2626;
  --color-border: #E5E7EB;

  --font-sans: 'Inter', ui-sans-serif;
  --font-serif: 'Source Serif 4', ui-serif;
  --font-mono: 'JetBrains Mono', ui-monospace;
}
```

Dark mode overrides via `.dark` class (toggled by `useDarkMode` hook):
```css
.dark {
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-text: #F1F5F9;
}
```

---

## Data Models (Payload Collections)

### Users
```typescript
{
  email: string (unique)
  password: string (hashed bcrypt-12)
  role: 'admin' | 'editor' | 'member'
  firstName: string
  lastName: string
  createdAt: Date
}
```

### CourtDecisions
```typescript
{
  title: string
  court: relationship → Courts
  decisionType: 'civil' | 'criminal' | 'commercial' | 'administrative' | 'constitutional' | 'ecj' | 'ecthr'
  date: Date
  caseNumber: string
  fullText: richText (Lexical)
  summary: textarea
  attachments: array of Media
  category: string
  tags: array of strings
  searchVector: text (tsvector, populated by afterChange hook)
  lang: 'hr' | 'en'
  slug: string (auto-generated)
}
```

### ExpertWitnesses
```typescript
{
  name: string
  specialityAreas: array of strings
  languages: array of strings
  county: string
  city: string
  phone: string
  email: string
  verified: boolean
  courtAssignments: array of relationship → Courts
  notes: richText
  lang: 'hr' | 'en'
  slug: string
}
```

### Interpreters
```typescript
{
  name: string
  languagePairs: array of strings  // e.g. ['hr-en', 'hr-de']
  county: string
  city: string
  phone: string
  email: string
  verified: boolean
  courtAssignments: array of relationship → Courts
  slug: string
}
```

### Courts
```typescript
{
  name: string
  type: 'municipal' | 'county' | 'commercial' | 'misdemeanour' | 'high_commercial' | 'supreme' | 'administrative' | 'constitutional'
  address: string
  city: string
  county: string
  phone: string
  fax: string
  email: string
  website: string
  president: string
  lat: number
  lng: number
  jurisdictionArea: string  // GeoJSON polygon (for Leaflet)
  slug: string
}
```

### BankruptcyListings
```typescript
{
  caseNumber: string
  debtorName: string
  court: relationship → Courts
  administrator: relationship → BankruptcyAdministrators
  assets: richText
  deadline: Date
  status: 'active' | 'completed' | 'withdrawn'
  publishedAt: Date
  attachments: array of Media
}
```

### NewsPosts
```typescript
{
  title: string
  slug: string (auto-generated)
  content: richText (Lexical)
  excerpt: textarea
  featuredImage: relationship → Media
  category: string
  publishedAt: Date
  author: relationship → Users
  lang: 'hr' | 'en'
}
```

---

## Croatian Full-Text Search Implementation

PostgreSQL full-text search using Croatian language support:

```sql
-- Enable extensions (run once at setup)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create custom Croatian text search configuration
CREATE TEXT SEARCH CONFIGURATION hr (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION hr
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, simple;

-- court_decisions table (managed by Payload/Drizzle)
-- The search_vector column is populated by an afterChange hook:
ALTER TABLE court_decisions ADD COLUMN search_vector tsvector;
CREATE INDEX court_decisions_search_idx ON court_decisions USING GIN(search_vector);

-- Trigram index for name-based expert/interpreter search
CREATE INDEX expert_witnesses_name_trgm_idx ON expert_witnesses USING GIN(name gin_trgm_ops);
CREATE INDEX interpreters_name_trgm_idx ON interpreters USING GIN(name gin_trgm_ops);
```

The `generateSearchIndex` hook in `cms/src/hooks/` updates the `search_vector` column after every court decision save by calling:
```sql
UPDATE court_decisions
SET search_vector = to_tsvector('hr', coalesce(title,'') || ' ' || coalesce(full_text_plain,''))
WHERE id = $1;
```

---

## SEO Strategy

The React SPA has a specific SEO challenge: search engines crawl the initial HTML, which for a pure SPA is nearly empty. Strategy:

1. **`vite-plugin-ssg`** — at build time, crawl all known routes and generate static HTML snapshots. This covers: homepage, all court pages, all news post pages, all expert profiles, all court decisions (critical for search engine indexing of case law).

2. **`react-helmet-async`** — dynamic `<title>`, `<meta>`, `<link rel="canonical">` management per page.

3. **Structured data** — JSON-LD schemas injected per page type:
   - Homepage: `LegalOrganization`
   - Court decision: `LegalCase`
   - Expert profile: `Person` + `OccupationalExpert`
   - Court: `Courthouse`
   - News post: `NewsArticle`

4. **sitemap.xml** — generated as a build step by the `scripts/generate-sitemap.ts` script, which calls the Payload API and writes `web/public/sitemap.xml`.

5. **robots.txt** — static file in `web/public/robots.txt`. Disallows `/admin/`, `/api/`.

---

## Internationalisation (i18n)

React Router 7 handles language routing via path prefix: `/hr/...` and `/en/...`. Default is Croatian (`/hr/`). The root `/` redirects to `/hr/`.

`i18next-browser-languagedetector` is configured to detect from URL path (highest priority), then `localStorage`, then browser `Accept-Language`.

Translation files are loaded lazily by namespace — `common.json` is loaded on every page, namespace-specific files are loaded only when that page renders.

Croatian is the primary language. English translations start incomplete and are filled in over time. Missing English translations fall back to Croatian.

---

## Migration Scripts

Located in `scripts/migrate/`. Run with Node.js (tsx):

```bash
cd scripts && npx tsx migrate/parse-sql-dump.ts data/dump.sql > data/decisions.json
npx tsx migrate/import-decisions.ts data/decisions.json
npx tsx migrate/import-experts.ts data/experts.json
```

Each script uses Payload's Local API (direct DB access, no HTTP overhead) for bulk imports. Expects a running PostgreSQL instance.

URL redirect map is generated by `scripts/migrate/generate-redirects.ts` and output as a Caddy rewrite config file (`caddy/redirects.conf`) that is included in the Caddyfile.

---

## DevOps Review

**Reviewer:** gigforge-devops
**Date:** 2026-03-21
**Verdict:** CONDITIONAL — stack is sound but 4 hard blockers must be resolved before dev environment spins up

---

### 1. Containerisation — FEASIBLE ✓

All four services (caddy, web, cms, db) containerise cleanly:

- `web` — Vite 6 builds to static `dist/`, served by Nginx in a multi-stage Docker image. Standard pattern; no issues.
- `cms` — Payload CMS 3 standalone is a Node.js/Express process. Standard multi-stage build (`node:20-alpine` or `node:22-alpine`). `sharp` requires native bindings — use `--platform linux/amd64` if building on ARM Mac, and pin `sharp@^0.33` which ships prebuilt binaries for Alpine.
- `db` — `pgvector/pgvector:pg16` image supports all required extensions (`pg_trgm`, `unaccent`, `tsvector`). Extension init SQL should be in `db/init/01-extensions.sql` mounted as an initdb script, not run manually.
- `analytics` — Plausible CE is available as `ghcr.io/plausible/community-edition`. Requires a `plausible-conf.env` secrets file; document this in `.env.example`.

Multi-stage Dockerfiles are **mandatory** for both `web` and `cms` to keep image sizes manageable (Payload with all deps is ~600 MB dev → ~120 MB production image after tree-shaking).

---

### 2. Port Conflicts — BLOCKERS ⚠️

**Critical finding: the host already has processes bound to ports 80, 443, 3000, 3001, and 8000.**

| Planned Port | Status | Conflict |
|---|---|---|
| 80 (Caddy) | **BLOCKED** | Host Nginx (pid 15853 + workers) owns port 80 |
| 443 (Caddy) | **BLOCKED** | Host Nginx owns port 443 |
| 3001 (CMS dev) | **BLOCKED** | `course-creator-frontend-1` → `0.0.0.0:3001→80` |
| 3000 (web dev) | **BLOCKED** | `course-creator-frontend-1` → `0.0.0.0:3000→3000` |
| 8000 (Plausible) | **BLOCKED** | `course-creator-user-management-1` → `0.0.0.0:8000→8000` |
| 5432 (db dev) | Clear | Not exposed on host |

**Required fix — Caddy is not viable as the public-facing container on this host.**

The host Nginx is the TLS terminator for all services. Every other project on this host follows the same pattern: containers run on high internal ports (4090, 4091, 4095, 4096, 4098 range) and Nginx proxies domain traffic to them.

**Resolution — drop the Caddy container; integrate with host Nginx instead:**

1. Remove the `caddy` service from `docker-compose.yml`.
2. Assign fixed host ports from the available `409x` range:

| Service | Internal | Host Port |
|---|---|---|
| web (Nginx) | 80 | **4093** |
| cms (Payload) | 3001 | **4094** |
| analytics (Plausible) | 8000 | **4097** (if used) |
| db (PostgreSQL) | 5432 | not exposed in prod |

3. Add a Nginx vhost on the host (to be created by DevOps at deploy time):

```nginx
server {
    listen 80;
    server_name sudacka-mreza.hr www.sudacka-mreza.hr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sudacka-mreza.hr www.sudacka-mreza.hr;

    # TLS — managed by certbot on the host
    ssl_certificate     /etc/letsencrypt/live/sudacka-mreza.hr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sudacka-mreza.hr/privkey.pem;

    # React SPA
    location / {
        proxy_pass http://127.0.0.1:4093;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Payload CMS API + Admin
    location ~ ^/(api|admin|graphql) {
        proxy_pass http://127.0.0.1:4094;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;  # for file uploads
    }
}
```

4. **TLS:** Use `certbot --nginx -d sudacka-mreza.hr` on the host. Caddy's automatic TLS is not available since we're removing it.
5. **Redirect map:** The `caddy/redirects.conf` approach needs to become an Nginx `rewrite` map instead. The `scripts/migrate/generate-redirects.ts` script should output an Nginx `map` block or a set of `rewrite` rules to an `nginx/redirects.conf` include file.

---

### 3. Resource Assessment — CLEAR ✓

| Resource | Available | Estimated Usage | Status |
|---|---|---|---|
| RAM | 16 GB free (32 GB total) | ~800 MB–1.2 GB peak | ✓ Comfortable |
| CPU | 32 GB host, not constrained | Moderate (SSG build, Payload indexing) | ✓ Fine |
| Disk | 364 GB free (601 GB total) | ~5 GB initial + media growth | ✓ Fine |
| Swap | **0 MB** | N/A | ⚠️ See below |

**Swap concern:** The host has no swap. Payload CMS 3 can spike to ~400–600 MB at startup (Drizzle migration + TypeScript compilation in dev). Combined with PostgreSQL shared_buffers, a cold start during a low-memory moment could OOM-kill the container. Add memory limits to `docker-compose.yml` to bound the blast radius:

```yaml
cms:
  mem_limit: 768m
  memswap_limit: 768m  # no swap available anyway
db:
  mem_limit: 512m
  environment:
    - POSTGRES_SHARED_BUFFERS=128MB  # keep conservative
```

**Media/upload growth:** Payload uses `@payloadcms/storage-local` (Phase 1). Court decision PDFs, expert profile photos, gallery images, and law documents will accumulate on disk. Set a reminder to evaluate S3/R2 migration before the 10 GB mark. No action needed now, but plan for it.

---

### 4. Database — DEPLOYABLE ✓ (with initdb fix)

PostgreSQL 16 is already proven on this host (crm-postgres, cms-postgres, video-creator-db all running). Using a dedicated container with an isolated Docker volume is correct — do not share a PostgreSQL instance with other projects.

**Required:** The Croatian FTS extensions (`pg_trgm`, `unaccent`) and the custom `hr` text search configuration must be initialised before Payload runs its Drizzle migrations. Create `db/init/01-extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TEXT SEARCH CONFIGURATION hr (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION hr
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, simple;
```

Mount this in `docker-compose.yml`:
```yaml
db:
  volumes:
    - ./db/init:/docker-entrypoint-initdb.d:ro
    - sudacka_db_data:/var/lib/postgresql/data
```

PostgreSQL 16 on Alpine (`pgvector/pgvector:pg16`) ships both extensions. **Do not use `postgres:16-alpine`** (missing `pg_trgm` build — use `pgvector/pgvector:pg16` as specified, which includes it, or `postgis/postgis:16-3.4` if GeoJSON polygon queries are ever moved server-side).

**Dev port:** The spec exposes `5432:5432`. Since the host port 5432 is currently clear, this works now — but to be consistent with every other project on this host (which all use 5435, 5436, 5437), use `127.0.0.1:5438:5432` to avoid a future conflict and restrict to loopback.

---

### 5. Security Concerns — ACTION REQUIRED ⚠️

| # | Severity | Finding | Required Action |
|---|---|---|---|
| S-1 | **HIGH** | `DATABASE_URL` password is `changeme` in `.env.example` | Generate 24+ char random password at deploy time; document in `.env.example` that this MUST be changed |
| S-2 | **HIGH** | GraphQL endpoint `/graphql` exposes full schema introspection | Disable introspection in production: set `graphQL.disable: true` in `payload.config.ts` for prod, or add Nginx `deny all` to `location /graphql` and only allow trusted IPs |
| S-3 | **MEDIUM** | Payload Admin UI at `/admin` is publicly reachable | Restrict to trusted IPs at the Nginx level (team IPs + VPN). Add to host Nginx vhost: `location /admin { allow 203.0.113.0/24; deny all; proxy_pass ... }` |
| S-4 | **MEDIUM** | No rate limiting on `POST /api/contact` | Add `express-rate-limit` middleware scoped to `/api/contact` — 5 requests per 15 minutes per IP |
| S-5 | **MEDIUM** | Local file uploads — no size or MIME limits specified | Configure `upload.limits` in each Payload collection: `{ mimeTypes: ['image/jpeg', 'image/png', 'application/pdf'], fileSize: 10_000_000 }` (10 MB). Nginx `client_max_body_size 50M` is already noted above. |
| S-6 | **LOW** | `PAYLOAD_SECRET` placeholder in `.env.example` | Good that it's documented — add a validator in `server.ts` that throws on startup if `PAYLOAD_SECRET.length < 32` |
| S-7 | **LOW** | JWT returned in response body (in addition to HttpOnly cookie) | Confirm the frontend uses the HttpOnly cookie for all authenticated requests (not localStorage). `api.ts` Axios instance should send `withCredentials: true` and not manually attach the token from localStorage. |
| S-8 | **LOW** | `robots.txt` disallows `/api/` and `/admin/` | Confirmed in spec ✓ — good. Verify these are `Disallow: /api/` and `Disallow: /admin/` on the deployed `robots.txt`. |

---

### Summary of Required Changes Before Dev Spinup

1. **Remove Caddy container** from `docker-compose.yml` and `docker-compose.prod.yml`; assign host ports 4093 (web) and 4094 (cms)
2. **Create `db/init/01-extensions.sql`** with extension + FTS config init
3. **Change dev PostgreSQL host port** to `127.0.0.1:5438:5432`
4. **Add memory limits** to `cms` and `db` services in `docker-compose.yml`
5. **Add `express-rate-limit`** to `POST /api/contact` in `cms/src/endpoints/contact.ts`
6. **Disable GraphQL introspection** in production Payload config
7. **Nginx vhost config** needs to be provisioned on the host at deploy time (DevOps will handle this step)
8. **`scripts/migrate/generate-redirects.ts`** should target Nginx rewrite syntax, not Caddy

**Non-blocking recommendations (Phase 2):**
- Plan S3/Cloudflare R2 migration for media storage before 10 GB disk usage
- Add Plausible CE (`analytics` service) only after core site is live — it is optional in Phase 1
- Consider a read replica for PostgreSQL once court decisions corpus grows past ~50k rows and full-text search latency becomes noticeable
