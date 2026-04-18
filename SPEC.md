# Sudačka Mreža — Website Refactor Specification
**Project:** GF-GFWEB-002
**Client:** Dražen Komarica (drazen.komarica@gmail.com)
**Analyst:** GigForge Engineering
**Date:** 2026-03-20
**Engagement:** Pro-bono

---

## 1. Current Site Analysis

### 1.1 Organisation Overview

**Sudačka mreža** (Judges' Web / Judges' Network) is a Croatian non-profit founded circa 2001 that operates as the primary independent judicial information platform for Croatia. The organisation maintains the central Croatian court practice database (case law), a national directory of court experts (vještaci) and interpreters (tumači), a bankruptcy portal (WEB Stečaj®), a courts directory, a court fee calculator, and free legal aid information. Sister sites exist for Serbia (pravosudna-mreza.org.rs) and North Macedonia (pravosudna-mreza.org.mk).

The platform has received funding from: Dutch Ministry of Foreign Affairs, Norwegian Ministry of Foreign Affairs, OSCE, Canadian Department of Foreign Affairs, US Embassy Zagreb, American Bar Association (ABA), National Endowment for Democracy (NED), SPAN d.o.o., and IRZ (German Foundation for International Legal Cooperation).

### 1.2 Current Technical Stack

| Component | Current |
|-----------|---------|
| Framework | ASP.NET WebForms (.aspx) |
| Rendering | Server-side, full postback model |
| DOCTYPE | XHTML 1.0 Transitional |
| IE compat | `X-UA-Compatible: IE=7` |
| jQuery | 1.2.6 (released 2008 — 18 years old) |
| JavaScript | SWFObject (Flash), jQuery 1.2.6, custom carousel |
| CSS | 5 separate CSS files (master, menu, content, print, small/large) |
| Flash | SWFObject.js used for Jurisdiction Finder map — completely broken in all modern browsers |
| Language switch | Query parameter: `?Lng=hr` / `?Lng=en` |
| Database | Unknown (Microsoft SQL Server likely, given ASP.NET) |
| HTTP | HTTP only — HTTPS certificate appears broken/unreachable on port 443 |
| Hosting | IP: 69.61.26.116 (static); `wem.hr` built the original site |
| SEO | `<meta name="description" content="desc" />` — placeholder, not real content |
| Analytics | None detected |
| Copyright | 2009–2020 (stale) |

### 1.3 Current Navigation & Sitemap

```
Sudačka mreža (http://www.sudacka-mreza.hr)
├── [Top bar]
│   ├── Linkovi (Links to external legal resources)
│   ├── Donirajte (Donate)
│   ├── Galerije
│   │   └── Fotogalerije
│   ├── Mediji o nama (Media coverage)
│   │   ├── Audiogalerije
│   │   ├── Videogalerije
│   │   └── Novinski članci (Newspaper articles)
│   ├── O nama (About us)
│   ├── Besplatna pravna pomoć (Free legal aid)
│   ├── Kontakt
│   ├── Login / Registracija
│   └── HR / EN language switcher
│
└── [Main menu]
    ├── Sudska praksa (Case law)
    │   ├── Odluke (Decisions – general)
    │   ├── Odluke Visokog trgovačkog suda RH (Commercial Court decisions)
    │   └── Odluke Europskog suda pravde (ECJ decisions)
    ├── Sudski vještaci (Court expert witnesses)
    ├── Tumači (Court interpreters)
    ├── Sudovi (Courts directory)
    ├── Državna odvjetništva (State attorney offices)
    ├── Pretraživač nadležnosti (Jurisdiction finder — BROKEN: requires Flash)
    ├── WEB Stečaj® (Bankruptcy portal)
    │   ├── Osnovno o stečaju (Bankruptcy basics)
    │   ├── Pretraživanje prodaje (Bankruptcy sales search)
    │   ├── Stečajni upravitelji (Bankruptcy administrators)
    │   ├── Trgovački sudovi (Commercial courts)
    │   ├── O trgovačkom sudovanju (About commercial judiciary)
    │   ├── Stečajni zakoni (Bankruptcy laws)
    │   │   ├── Novela 2006, 2003, 2000, 1996
    │   │   └── Multiple amendment acts
    │   ├── Stručni radovi (Expert papers)
    │   ├── International Exchange
    │   └── Sudska praksa (stečaj-specific)
    └── Sudske pristojbe (Court fee calculator)
```

### 1.4 Content Types Inventoried

| Content Type | Volume Estimate | Notes |
|---|---|---|
| Court decisions (case law) | Thousands | Core mission since 2001; searchable database |
| Expert witness profiles | Hundreds–thousands | Name, speciality, contact, bilingual |
| Interpreter profiles | Hundreds | Name, language pairs, contact |
| Court entries | ~100 | Municipal, county, commercial, misdemeanour courts |
| State attorney offices | ~30 | Directory entries |
| Bankruptcy listings (sales) | Active listings | Time-sensitive, changes frequently |
| Bankruptcy administrator profiles | Hundreds | With ZAP Zagreb integration |
| Laws / legislation documents | Dozens | PDFs and HTML text |
| Expert papers | Dozens | PDFs |
| Photo galleries | Multiple | Events, signings, legal conferences |
| Video galleries | Multiple | HRT, RTL, Z1, OTV, KAPITAL NETWORK clips |
| Audio galleries | Some | Media appearances |
| Newspaper articles | Many | Media coverage archive |
| News/announcements | Unknown | Homepage content |
| Static pages | ~10 | About, Donate, Free Legal Aid, Links |
| Contact form | 1 | 5 subjects: Suggestion, Criticism, Collaboration, Media, Other |

### 1.5 Existing Features

| Feature | Status |
|---|---|
| Court decision search | Working (basic text search) |
| Expert witness directory | Working |
| Interpreter directory | Working |
| Courts directory | Working |
| Jurisdiction finder | BROKEN — requires Adobe Flash (EOL 2020) |
| Bankruptcy sales search | Working |
| Court fee calculator | Working |
| User login / registration | Working |
| Bilingual (HR/EN) | Working via URL parameter |
| Galleries (photo/video/audio) | Working but Flash-dependent for video |
| Contact form | Working |
| Print-friendly view | Working (CSS) |
| Font size switcher (A-/A/A+) | Working via alternate stylesheets |
| Sitemap page | Working |

### 1.6 Critical Issues Identified

| # | Issue | Severity |
|---|---|---|
| 1 | **Flash dependency** — Jurisdiction Finder completely non-functional on all modern browsers since 2020 | Critical |
| 2 | **No HTTPS** — port 443 times out; all traffic over HTTP. PII (login credentials) sent in cleartext | Critical |
| 3 | **Malicious ad injection** — third-party script (`new-adversting.com`) injected into `<head>` was redirecting the browser mid-session during crawl | Critical |
| 4 | **IE=7 compatibility shim** — forces all modern browsers to render in IE7 emulation mode | High |
| 5 | **jQuery 1.2.6** — 18-year-old library; numerous known CVEs; unsupported | High |
| 6 | **Placeholder SEO** — `<meta description="desc">` and `<meta keywords="key">` are literal placeholders | High |
| 7 | **No analytics** — no visibility into traffic, most-visited pages, search queries | High |
| 8 | **ViewState bloat** — 43 hidden ViewState fields (25 chunked inputs) on homepage; significant page weight | Medium |
| 9 | **Copyright 2009–2020** — stale, undermines credibility | Medium |
| 10 | **Not mobile responsive** — fixed-width layout, table-based; unusable on phones | High |
| 11 | **No SSL/HTTPS redirect** — browsers show "Not Secure" warning | Critical |
| 12 | **Flash video carousel** — video thumbnails non-functional | Medium |
| 13 | **No robots.txt/sitemap.xml** observed | Medium |
| 14 | **Outdated copyright** — "2009–2020" still displayed | Low |

---

## 2. Proposed Technical Stack

### 2.1 Stack Decision

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **React 19 + Vite 6 + React Router 7** | Pure React SPA — simpler architecture, clean frontend/backend separation, easier to maintain |
| Language | **TypeScript** (frontend + backend) | Type safety, maintainability for a long-lived civic platform |
| Styling | **Tailwind CSS 4** | Rapid development, consistent design system, excellent responsive utilities |
| Backend/CMS | **Payload CMS 3** (standalone) | TypeScript-native, self-hosted, REST + GraphQL API; runs as a separate service, no vendor lock-in; strong document/collection model fits this data perfectly |
| Database | **PostgreSQL 16** | Full-text search (pg_trgm, tsvector), JSONB for flexible fields, battle-tested |
| Search | **PostgreSQL full-text** (pg_trgm + tsvector) + optional **Meilisearch** | Built-in for MVP; Meilisearch if volume justifies it |
| Authentication | **Payload built-in auth** | JWT-based, supports credentials + future OAuth; no separate auth library needed |
| i18n | **react-i18next** + **i18next** | Industry standard React i18n; JSON translation files; language detection from URL path |
| Rich text | **Lexical editor** (bundled with Payload) | Rich text editing for legal documents in CMS admin |
| Map (replaces Flash) | **Leaflet.js** + **OpenStreetMap** | Free, no API key required, Croatian jurisdiction polygons from GADM data |
| Email | **Resend** | Simple HTTP API, good deliverability, free tier adequate |
| File storage | **Local filesystem** (initial) → **Cloudflare R2** (production) | PDFs, court decisions, expert photos |
| Deployment | **Docker Compose** | Consistent with GigForge standards |
| CI/CD | **GitHub Actions** | Automated tests + build checks |
| Analytics | **Plausible** (self-hosted) or **Umami** | Privacy-preserving, GDPR-compliant, no cookie consent needed |
| SSL | **Let's Encrypt** via **Caddy** reverse proxy | Auto-renewal, zero-config HTTPS |

### 2.2 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                Caddy (reverse proxy)                │
│              HTTPS / Let's Encrypt                  │
│                                                     │
│  /          → React SPA (static files via Nginx)    │
│  /api/*     → Payload CMS API (port 3001)           │
│  /admin/*   → Payload CMS Admin UI (port 3001)      │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌────────────────────┐   ┌───────────────────┐
│  React SPA         │   │  Payload CMS 3    │
│  (Nginx, port 80)  │   │  (port 3001)      │
│                    │   │                   │
│  - React 19        │   │  - REST API       │
│  - React Router 7  │   │  - GraphQL API    │
│  - Vite build      │   │  - Admin UI       │
│  - Tailwind CSS 4  │   │  - Auth (JWT)     │
│  - react-i18next   │   │  - File uploads   │
│  - Leaflet maps    │   │  - Lexical editor  │
└────────────────────┘   └────────┬──────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │ PostgreSQL 16  │
                          │ (pg_trgm +     │
                          │  tsvector)     │
                          └───────────────┘
```

**Key difference from Next.js approach:** The React frontend is a static SPA served
by Nginx. All data comes from Payload CMS via REST/GraphQL API calls. This gives
clean separation — the frontend can be rebuilt without touching the backend, and
vice versa. Payload handles authentication, file uploads, rich text editing, and
the admin UI independently.

**SEO strategy:** For case law pages that need search engine indexing, we use
`vite-plugin-prerender` to generate static HTML at build time for critical routes.
The sitemap.xml is generated from the Payload API during the build step.

### 2.3 Data Models

**Collections (Payload CMS):**
- `court-decisions` — title, court, date, decision_type, full_text, attachments, category, tags
- `expert-witnesses` — name, speciality_areas[], languages[], contact, court_assignments, verified
- `interpreters` — name, language_pairs[], contact, court_assignments, verified
- `courts` — name, type (municipal/county/commercial/misdemeanour), address, phone, president, website, county
- `state-attorneys` — name, jurisdiction, address, contact
- `bankruptcy-listings` — case_no, debtor, court, administrator, assets[], deadline, status
- `bankruptcy-administrators` — name, contact, assigned_cases
- `laws` — title, type, year, text, pdf_attachment, effective_date, superseded_by
- `news-posts` — title, slug, content, published_at, category, author, featured_image
- `pages` — title, slug, content (flexible layout)
- `galleries` — title, type (photo/video/audio), items[]
- `documents` — title, category, file, published_at
- `users` — email, role (admin/editor/member), profile

---

## 3. Proposed Information Architecture

### 3.1 Revised Navigation

```
sudacka-mreza.hr
├── / (Naslovnica / Home)
├── /sudska-praksa/ (Case Law)
│   ├── /sudska-praksa/pretraga/ (Search decisions)
│   ├── /sudska-praksa/vts/ (High Commercial Court)
│   └── /sudska-praksa/esljp/ (ECtHR / ECJ)
├── /strucnjaci/ (Experts — merged)
│   ├── /strucnjaci/vjestaci/ (Expert Witnesses)
│   └── /strucnjaci/tumaci/ (Interpreters)
├── /sudovi/ (Courts & Institutions)
│   ├── /sudovi/opcinski/ (Municipal courts)
│   ├── /sudovi/zupanijski/ (County courts)
│   ├── /sudovi/trgovacki/ (Commercial courts)
│   ├── /sudovi/dorh/ (State Attorney Offices)
│   └── /sudovi/nadleznost/ (Jurisdiction finder — Leaflet map)
├── /stecaj/ (Bankruptcy Portal)
│   ├── /stecaj/ponude/ (Sales listings)
│   ├── /stecaj/upravitelji/ (Administrators)
│   ├── /stecaj/zakoni/ (Laws & amendments)
│   ├── /stecaj/radovi/ (Expert papers)
│   └── /stecaj/sudska-praksa/ (Bankruptcy case law)
├── /pristojbe/ (Court Fee Calculator)
├── /pravna-pomoc/ (Free Legal Aid)
├── /vijesti/ (News)
├── /galerije/ (Media Gallery)
├── /o-nama/ (About)
├── /kontakt/ (Contact)
├── /clanovi/ (Member area — login required)
└── /admin/ (Payload CMS admin)
```

---

## 4. Proposed Features

### 4.1 Core Features (Must-Have)

| Feature | Description |
|---|---|
| **Modern responsive design** | Mobile-first, works on all screen sizes; current site unusable on phones |
| **HTTPS** | Caddy + Let's Encrypt; auto-renewed |
| **Full-text search** | Search across case law, experts, courts, news — single unified search bar |
| **Case law database** | Searchable decisions with filters: court, date range, decision type, keyword |
| **Expert witness directory** | Search by name, speciality, location; bilingual |
| **Interpreter directory** | Search by name, language pair, location |
| **Courts directory** | All Croatian courts with address, phone, map pin |
| **Jurisdiction finder** | Interactive Leaflet map replacing the broken Flash widget; click region → responsible court |
| **Bankruptcy portal** | Listings with search/filter; administrator profiles; laws archive |
| **Court fee calculator** | Form-based calculator (replicate existing logic) |
| **Bilingual (HR/EN)** | next-intl; all public content in both languages where translations exist |
| **User accounts** | Registration, login, member-only content area |
| **Contact form** | Server-side validated; Resend delivery |
| **Privacy-respecting analytics** | Plausible or Umami; no cookie consent banner needed |
| **News/announcements** | Editor-managed via Payload; RSS feed |
| **Media galleries** | Photo, video (YouTube/Vimeo embed, no Flash), audio |
| **Document library** | PDFs categorised and searchable |
| **SEO** | Real meta tags, Open Graph, structured data (LegalOrganization schema), sitemap.xml, robots.txt |

### 4.2 Enhanced Features (Should-Have)

| Feature | Description |
|---|---|
| **Events calendar** | Conferences, webinars, continuing education for judges |
| **Newsletter** | Email subscription (Resend); opt-in only |
| **RSS feeds** | For news, case law updates |
| **Print-friendly CSS** | Preserve existing print capability |
| **Accessibility (WCAG 2.1 AA)** | Keyboard navigation, screen reader support, sufficient contrast |
| **Dark/light mode** | System preference detection |
| **Advanced search filters** | Date range, court type, category for case law |
| **Bookmark / save decisions** | Logged-in users can save case law for later |

### 4.3 Future Features (Could-Have)

| Feature | Description |
|---|---|
| **Expert verification system** | Judges can flag inaccurate expert profiles |
| **Case law AI summary** | Brief plain-language summary of each decision |
| **Push notifications** | New decisions in subscribed areas |
| **API** | Public REST API for partner institutions |

---

## 5. Design System

### 5.1 Design Principles

The current site has a dated, government-portal aesthetic. The redesign should feel **professional, trustworthy, and modern** without being corporate or flashy. Judicial platforms must inspire confidence.

Reference designs: Croatia's Supreme Court (vsrh.hr), EUR-Lex, German Federal Constitutional Court (bundesverfassungsgericht.de).

### 5.2 Colour Palette (Proposed)

```
Primary:     #1B3A6B   (deep navy — authority, trust)
Secondary:   #2E6DA4   (medium blue — links, CTAs)
Accent:      #C9A227   (judicial gold — badges, highlights)
Background:  #F8F9FB   (off-white — clean, not clinical)
Surface:     #FFFFFF   (cards, panels)
Text:        #1A1A2E   (near-black — readability)
Muted text:  #6B7280   (secondary labels)
Danger:      #DC2626   (errors)
Border:      #E5E7EB   (subtle separators)
```

Dark mode shifts: background → #0F172A, surface → #1E293B, text → #F1F5F9

### 5.3 Typography

```
Headings:  Inter (400, 600, 700)       — clean, modern, legible
Body:      Source Serif 4 (400, 600)   — warm, authoritative feel for legal text
Mono:      JetBrains Mono              — code blocks, case numbers
```

Font sizes follow a fluid type scale (clamp-based, no breakpoint jumps).

### 5.4 Component Library

Built on **Tailwind CSS 4** utility classes with a small set of custom components:
- `Button` — primary / secondary / ghost / danger
- `Card` — with optional header, footer, badge
- `DataTable` — sortable, filterable, paginated
- `SearchBar` — global, with type-ahead
- `Tag/Badge` — court type, category labels
- `Modal` — accessible dialog
- `Alert` — info / warning / error / success
- `Breadcrumb` — for deep navigation pages
- `LanguageSwitch` — HR / EN toggle in header
- `Pagination` — numbered + prev/next

---

## 6. Content Migration Plan

### 6.1 Migration Priority

| Priority | Content | Volume | Method |
|---|---|---|---|
| P0 | Case law decisions database | Thousands | DB migration script (ASP.NET DB → PostgreSQL) or HTML scrape + structured import |
| P0 | Expert witnesses | Hundreds–thousands | DB migration or crawl + structured import |
| P0 | Interpreters | Hundreds | Same as above |
| P1 | Courts directory | ~100 entries | Manual or scripted from public sources |
| P1 | State attorney offices | ~30 entries | Manual |
| P1 | Bankruptcy laws (PDFs) | Dozens | Upload existing PDFs into Payload Media |
| P2 | Expert papers (PDFs) | Dozens | Upload |
| P2 | Photo galleries | Multiple albums | Download + re-upload |
| P2 | News articles | Unknown | Crawl → import |
| P3 | Video galleries | Multiple | Re-link to YouTube/Vimeo |
| P3 | Audio galleries | Some | Re-host or link |
| P3 | Newspaper clippings | Many | Best-effort; link to originals where possible |

### 6.2 Migration Approach

**Phase 1 — Data export:**
Request database export from current host (SQL Server dump) OR build a Python scraper that crawls the existing ASP.NET site via HTTP and extracts structured data into CSV/JSON for import.

**Phase 2 — Schema mapping:**
Map current DB columns to Payload CMS collections. Write a Node.js migration script that reads the export and calls Payload's Local API to create records.

**Phase 3 — Verification:**
Spot-check 50 random records across all collections. Verify counts match source. Expert witnesses and interpreters must be validated against the current searchable database.

**Phase 4 — SEO redirect map:**
All old URLs (e.g., `/vjestaci.aspx?id=123`) must redirect 301 to new URLs (e.g., `/strucnjaci/vjestaci/123-ime-vjetak`). Build a redirect map from the crawl before go-live.

### 6.3 Client Dependencies

To complete migration, GigForge needs from Dražen:

1. **Database access** — SQL Server dump or read-only DB credentials; OR written confirmation that scraping the public site is acceptable
2. **All static asset files** — images, PDFs, Word documents from the current server (`user-folders/` directory and `gallery/`)
3. **Login credentials** for the admin panel to access any member-only content
4. **Translations** — Croatian↔English translation status: which content is available in English?
5. **Jurisdiction boundary data** — GeoJSON or shapefiles for the Jurisdiction Finder map; or confirmation to use publicly available GADM data
6. **Hosting preferences** — continue on current host? Move to new VPS? (GigForge can recommend Railway or DigitalOcean for ~€10–20/mo)
7. **Domain/DNS control** — access to DNS to add Let's Encrypt verification TXT records

---

## 7. Performance & Accessibility Targets

| Metric | Target |
|---|---|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse SEO | ≥ 95 |
| Lighthouse Best Practices | ≥ 90 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| Core Web Vitals INP | < 200ms |
| WCAG Compliance | 2.1 AA |
| Mobile Responsive | Yes — all breakpoints |
| Languages | Croatian (primary), English |

---

## 8. Security & Privacy

| Control | Implementation |
|---|---|
| HTTPS | Caddy + Let's Encrypt (auto-renew) |
| User passwords | bcrypt (cost factor 12) via Payload |
| Session tokens | HttpOnly, Secure, SameSite=Strict cookies |
| CSRF protection | Next.js built-in + Payload built-in |
| Input sanitisation | Zod (API) + DOMPurify (rich text display) |
| File upload validation | MIME type + extension allowlist; size limit |
| Rate limiting | Nginx/Caddy rate limits on contact form and login |
| GDPR | No tracking cookies; Plausible is cookieless; data export on request |
| Dependency scanning | Dependabot or `npm audit` in CI |

---

## 9. Testing Strategy

| Type | Tool | Target |
|---|---|---|
| Unit tests | Vitest | Utility functions, form validation, calculators |
| Component tests | @testing-library/react + Vitest | All UI components |
| API route tests | Payload Local API + Vitest | All CMS collections and endpoints |
| E2E tests | Playwright | Critical user journeys: search, contact form, login, court fee calculator |
| Accessibility | axe-core (in Playwright) | All pages |
| Visual regression | Playwright screenshots | Key pages |
| Coverage threshold | 80% minimum | Hard gate in CI |

---

## 10. Deployment

### 10.1 Docker Compose Topology

```yaml
services:
  caddy:           # HTTPS proxy + Let's Encrypt (routes / → web, /api → cms, /admin → cms)
  web:             # React SPA (Nginx serving Vite build output, port 80)
  cms:             # Payload CMS 3 standalone (REST + GraphQL + Admin UI, port 3001)
  db:              # PostgreSQL 16 (full-text search, pgvector)
  analytics:       # Plausible (optional, self-hosted)
```

### 10.2 Environment Variables Required

```
DATABASE_URL=postgresql://...
PAYLOAD_SECRET=
PAYLOAD_URL=https://sudacka-mreza.hr
CORS_ORIGIN=https://sudacka-mreza.hr
SMTP_FROM=info@sudacka-mreza.hr
RESEND_API_KEY=
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=sudacka-mreza.hr
```

### 10.3 Estimated Resource Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB | 50 GB (for PDF/media archive) |
| Monthly cost | €6–10 | €12–20 |

---

*Screenshots of current site: see `/screenshots/` directory alongside this document.*
*Crawl date: 2026-03-20. Site accessed via `http://www.sudacka-mreza.hr` (HTTP only — HTTPS unreachable).*
