# Sudačka mreža — Website Rebuild

[![CI](https://github.com/gigforge/sudacka-mreza/actions/workflows/ci.yml/badge.svg)](https://github.com/gigforge/sudacka-mreza/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Modern rebuild of [sudacka-mreza.hr](https://sudacka-mreza.hr) — Croatia's independent judicial information platform, serving lawyers, judges, and citizens since 2001.

Replaces a 2009 ASP.NET WebForms site (IE7, no HTTPS, broken Flash) with a fast, secure, bilingual (HR/EN) React + Payload CMS stack.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [API Reference](#api-reference)
- [Collections (Data Models)](#collections-data-models)
- [Authentication](#authentication)
- [Search](#search)
- [eSPIS Integration](#espis-integration)
- [Architecture Decision Records](#architecture-decision-records)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Browser / Client                    │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (Caddy / Let's Encrypt)
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼─────┐         ┌─────▼─────┐
    │  web:4093 │         │  cms:4094 │
    │  React 19 │         │ Payload 3 │
    │  Vite SPA │         │  REST API │
    │  (Nginx)  │         │  Admin UI │
    └─────┬─────┘         └─────┬─────┘
          │   REST/JSON         │
          └──────────┬──────────┘
                     │
              ┌──────▼──────┐
              │  db:5432    │
              │ PostgreSQL  │
              │    16       │
              │  + pg_trgm  │
              │  + tsvector │
              └─────────────┘
```

**Request flow:**
1. Caddy terminates HTTPS and reverse-proxies to `web` (port 4093) or `cms` (port 4094, `/api/*`, `/admin/*`)
2. The React SPA fetches all data from the Payload CMS REST API at `/api/*`
3. Payload CMS handles business logic, auth, and file uploads; persists to PostgreSQL
4. PostgreSQL full-text search (`tsvector` + `pg_trgm`) powers all search features

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework (concurrent features, Suspense) |
| Vite | 6 | Build tool and dev server |
| React Router | 7 | Client-side routing with data loaders |
| TypeScript | 5.4 | Static typing across the entire stack |
| Tailwind CSS | 4 | Utility-first styling (CSS-first `@theme`) |
| react-i18next | 15 | Bilingual HR/EN support |
| React Query | 5 | Server state management and caching |
| Leaflet.js | 1.9 | Interactive maps (replaces broken Flash) |
| react-leaflet | 4 | React bindings for Leaflet |
| DOMPurify | 3 | Sanitisation of server-provided rich text |
| react-helmet-async | — | Dynamic `<head>` / SEO meta tags |
| vite-plugin-ssg | — | Static HTML generation for SEO |

### Backend / CMS

| Technology | Version | Purpose |
|-----------|---------|---------|
| Payload CMS | 3 | Headless CMS with built-in REST + GraphQL + Admin UI |
| Express.js | 4.21 | HTTP server (used by Payload standalone mode) |
| TypeScript | 5.4 | Type-safe collections and hooks |
| Drizzle ORM | — | Database abstraction (via Payload) |
| @payloadcms/db-postgres | 3 | PostgreSQL adapter |
| @payloadcms/richtext-lexical | 3 | Block-based rich text editor |
| @payloadcms/storage-local | 3 | File upload handling |
| slugify | 1.6 | URL slug generation with Croatian character mapping |
| Resend | 4 | Transactional email (contact form, password reset) |

### Database

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 16 | Primary database |
| `pg_trgm` | Trigram fuzzy name search |
| `tsvector` | Full-text search (Croatian language config) |
| `unaccent` | Diacritic-insensitive search |
| GIN indexes | Search performance on text columns |
| `uuid-ossp` | UUID primary key generation |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker Compose | Local dev and production orchestration |
| Caddy | Reverse proxy with automatic Let's Encrypt HTTPS |
| Nginx | Serves the React SPA static build |
| Plausible CE | Self-hosted, cookieless, GDPR-compliant analytics |
| ClickHouse | Time-series database for Plausible analytics |
| GitHub Actions | CI/CD pipeline |

---

## Project Structure

```
sudacka-mreza/
├── cms/                          # Payload CMS backend (TypeScript)
│   ├── src/
│   │   ├── collections/          # Data models / Payload collections
│   │   │   ├── Users.ts          # User accounts (admin/editor/member roles)
│   │   │   ├── Courts.ts         # Court directory with coordinates
│   │   │   ├── CourtDecisions.ts # Case law database with full-text search
│   │   │   ├── ExpertWitnesses.ts# Expert witness directory
│   │   │   ├── Interpreters.ts   # Court interpreter directory
│   │   │   ├── StateAttorneys.ts # State attorney offices
│   │   │   └── BankruptcyListings.ts # Bankruptcy portal
│   │   ├── hooks/                # Payload lifecycle hooks
│   │   │   ├── generateSlug.ts   # Auto-slug from title/name
│   │   │   ├── generateSearchIndex.ts # Populate tsvector
│   │   │   └── sendContactEmail.ts    # Resend email integration
│   │   ├── globals/              # Payload global settings
│   │   ├── endpoints/            # Custom REST endpoints
│   │   └── payload.config.ts     # Payload configuration
│   ├── package.json
│   └── tsconfig.json
├── web/                          # React 19 frontend (Vite SPA)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/               # Button, Card, Badge, Modal, Alert, ...
│   │   │   ├── layout/           # Header, Footer, Nav, MobileMenu
│   │   │   └── features/         # DecisionCard, ExpertCard, CourtCard, ...
│   │   ├── pages/                # React Router 7 page components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── utils/                # Helpers, constants, formatters
│   │   ├── i18n/                 # Translation strings (hr.json, en.json)
│   │   ├── styles/               # globals.css with @theme tokens
│   │   ├── App.tsx               # Router setup
│   │   └── main.tsx              # Vite entry point
│   ├── public/
│   │   └── data/
│   │       └── croatia-jurisdictions.geojson  # Court jurisdiction polygons
│   ├── vite.config.ts
│   └── tsconfig.json
├── db/
│   └── init/
│       └── 01-extensions.sql     # pg_trgm + uuid-ossp extensions
├── backend/
│   └── tests/                    # Python integration test suite
│       ├── conftest.py           # Fixtures (test client, test DB)
│       ├── test_api.py           # API endpoint tests (all routes)
│       └── test_models.py        # Model validation tests
├── docs/
│   └── adr/                      # Architecture Decision Records (12 ADRs)
│       ├── 0001-backend-language.md
│       ├── 0002-database.md
│       ├── 0003-frontend-framework.md
│       ├── 0004-deployment-strategy.md
│       ├── 0005-cms-choice.md
│       ├── 0006-authentication.md
│       ├── 0007-i18n.md
│       ├── 0008-maps.md
│       ├── 0009-analytics.md
│       ├── 0010-styling.md
│       ├── 0011-seo-strategy.md
│       └── 0012-search-strategy.md
├── screenshots/                  # UI design references (current site)
├── docker-compose.yml
├── .env.example
├── SOFTWARE_SPEC.md              # Detailed software specification
├── TECH_STACK.md                 # Technology decisions and rationale
├── DESIGN.md                     # UI/UX design specification
├── SPRINT_PLAN.md                # Agile sprint breakdown
├── PROJECT_PLAN.md               # Timeline and phases
├── README.md                     # This file
├── RUNBOOK.md                    # Operational runbook
└── CHANGELOG.md                  # Version history
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before starting.

```bash
cp .env.example .env
```

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `POSTGRES_DB` | `sudacka_mreza` | Yes | PostgreSQL database name |
| `POSTGRES_USER` | `postgres` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | **Change in prod** | PostgreSQL password |
| `DATABASE_URI` | `postgresql://postgres:postgres@db:5432/sudacka_mreza` | Yes | Full PostgreSQL connection string |
| `PAYLOAD_SECRET` | `dev-secret-change-in-prod` | **Change in prod** | JWT signing secret (min 32 chars) |
| `PORT` | `4094` | Yes | Port Payload CMS listens on |
| `SERVER_URL` | `http://localhost:4094` | Yes | Public base URL of the CMS (used in emails) |
| `RESEND_API_KEY` | _(empty)_ | Prod only | Resend API key for transactional email |
| `CONTACT_EMAIL` | `info@sudacka-mreza.hr` | Yes | Destination for contact form emails |

**Production minimum changes:**
- `POSTGRES_PASSWORD` — use a strong random password (≥ 32 chars)
- `PAYLOAD_SECRET` — use `openssl rand -base64 48` to generate
- `RESEND_API_KEY` — required for contact form and password reset emails
- `SERVER_URL` — set to your public domain (e.g., `https://sudacka-mreza.hr`)

---

## Local Development

### Prerequisites

- Node.js 22+
- pnpm (or npm)
- Docker + Docker Compose
- Python 3.11+ (for integration tests)

### 1. Clone and configure

```bash
git clone https://github.com/gigforge/sudacka-mreza.git
cd sudacka-mreza
cp .env.example .env
```

### 2. Start the database

```bash
docker compose up db -d
```

Wait ~10 seconds for PostgreSQL to initialise, then verify:

```bash
docker compose logs db | tail -5
# Expected: "database system is ready to accept connections"
```

### 3. Start the CMS (Payload)

```bash
cd cms
npm install
npm run dev
```

Payload CMS will be available at:
- **API:** http://localhost:4094/api
- **Admin UI:** http://localhost:4094/admin
- **Health:** http://localhost:4094/api/health

On first start, navigate to http://localhost:4094/admin to create the first admin user.

### 4. Start the frontend

```bash
cd web
npm install
npm run dev
```

Frontend will be available at http://localhost:5173 (Vite dev server).

### 5. Run integration tests

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
```

---

## Docker Deployment

### Build and start all services

```bash
docker compose up --build -d
```

Services started:
- `db` — PostgreSQL 16 on internal port 5432 (single consolidated database — handles all CMS content and metadata)
- `cms` — Payload CMS on port **4094**
- `web` — React SPA (Nginx) on port **4093**

> **Architecture note (2026-03-27):** The project uses a single PostgreSQL instance (`db`). The legacy `postgres-sudacka` service (port 5439, Croatian-locale) was decommissioned after data import into the CMS database. All content and metadata are now stored in one PostgreSQL container.

### Verify health

```bash
# CMS health check
curl http://localhost:4094/api/health
# Expected: {"status":"ok"}

# Frontend (Nginx)
curl -I http://localhost:4093
# Expected: HTTP/1.1 200 OK

# Database
docker compose exec db pg_isready -U postgres
# Expected: localhost:5432 - accepting connections
```

### First-run admin setup

After containers start, create the first admin user:

```bash
curl -X POST http://localhost:4094/api/users/first-register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@example.com",
    "password": "changeme123!"
  }'
```

Or navigate to http://localhost:4094/admin and follow the on-screen wizard.

### Stop services

```bash
docker compose down           # Stop containers, keep volumes
docker compose down -v        # Stop and delete all data (destructive)
```

---

## API Reference

All endpoints are served by Payload CMS at base URL `http://localhost:4094`.

**Common headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (for protected routes)

**Pagination parameters** (all collection list endpoints):
- `limit` — items per page (default: 10, max: 100)
- `page` — page number (1-indexed, default: 1)
- `sort` — field name, prefix `-` for descending (e.g., `sort=-date`)
- `where` — JSON filter object (see examples below)

**Standard list response:**
```json
{
  "docs": [ ... ],
  "totalDocs": 150,
  "limit": 10,
  "page": 1,
  "totalPages": 15,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

---

### Authentication

#### Register

```
POST /api/users
```

```json
// Request body
{
  "name": "Marko Marković",
  "email": "marko@example.com",
  "password": "securepassword123!"
}

// Response 201
{
  "message": "User created successfully.",
  "doc": { "id": "abc123", "email": "marko@example.com", "role": "member" },
  "token": "<jwt>"
}
```

#### Login

```
POST /api/users/login
```

```json
// Request body
{ "email": "marko@example.com", "password": "securepassword123!" }

// Response 200
{
  "message": "Auth Passed",
  "user": { "id": "abc123", "email": "marko@example.com", "role": "member" },
  "token": "<jwt>"
}

// Response 401
{ "message": "The email or password provided is incorrect." }
```

#### Get current user

```
GET /api/users/me
Authorization: Bearer <token>
```

#### Logout

```
POST /api/users/logout
Authorization: Bearer <token>
```

#### Forgot password

```
POST /api/users/forgot-password
```

```json
{ "email": "marko@example.com" }
```

#### Reset password

```
POST /api/users/reset-password
```

```json
{ "token": "<reset-token>", "password": "newpassword123!" }
```

---

### Courts

#### List courts

```
GET /api/courts
```

Query parameters:
- `where[courtType][equals]=municipal` — filter by type
- `where[name_hr][contains]=zagreb` — name search
- `sort=name_hr`

```json
// Response 200
{
  "docs": [
    {
      "id": "court_1",
      "name_hr": "Općinski sud u Zagrebu",
      "name_en": "Municipal Court in Zagreb",
      "courtType": "municipal",
      "address": "Trg Nikole Šubića Zrinskog 5, 10000 Zagreb",
      "phone": "01/4801-000",
      "email": "predsjednistvo@os-zagreb.pravosudje.hr",
      "lat": 45.8131,
      "lng": 15.9774,
      "slug": "opcinski-sud-u-zagrebu"
    }
  ],
  "totalDocs": 100
}
```

#### Get court by ID

```
GET /api/courts/:id
GET /api/courts?where[slug][equals]=opcinski-sud-u-zagrebu
```

#### Court types

| Value | Description |
|-------|-------------|
| `municipal` | Općinski sud |
| `county` | Županijski sud |
| `commercial` | Trgovački sud |
| `misdemeanour` | Prekršajni sud |
| `supreme` | Vrhovni sud |
| `constitutional` | Ustavni sud |

---

### Court Decisions (Case Law)

#### Search court decisions

```
GET /api/court-decisions
```

Query parameters:
- `where[court][equals]=<court_id>` — filter by court
- `where[category][equals]=kazneno` — filter by legal category
- `where[decisionType][equals]=presuda` — filter by decision type
- `where[date][greater_than]=2020-01-01` — date range start
- `where[date][less_than]=2024-12-31` — date range end
- `where[caseNumber][contains]=Gž` — case number search
- `sort=-date` — newest first (default)

```json
// Response 200
{
  "docs": [
    {
      "id": "dec_1",
      "title_hr": "Presuda o naknadi štete",
      "title_en": "Damages Award Judgment",
      "court": { "id": "court_1", "name_hr": "Općinski sud u Zagrebu" },
      "decisionType": "presuda",
      "category": "gradjansko",
      "date": "2024-03-15",
      "caseNumber": "P-1234/2024",
      "tags": ["naknada-stete", "odgovornost"],
      "slug": "presuda-o-naknadi-stete-p-1234-2024"
    }
  ],
  "totalDocs": 4200
}
```

#### Get decision by ID / slug

```
GET /api/court-decisions/:id
GET /api/court-decisions?where[slug][equals]=presuda-o-naknadi-stete-p-1234-2024
```

Full response includes `fullText_hr`, `fullText_en` (Lexical rich text JSON), and `pdfFile`.

#### Decision types

| Value | Label |
|-------|-------|
| `presuda` | Presuda (Judgment) |
| `rješenje` | Rješenje (Ruling) |
| `odluka` | Odluka (Decision) |

#### Legal categories

| Value | Label |
|-------|-------|
| `kazneno` | Kazneno pravo (Criminal) |
| `gradjansko` | Građansko pravo (Civil) |
| `upravno` | Upravno pravo (Administrative) |
| `prekrsajno` | Prekršajno pravo (Misdemeanour) |
| `trgovacko` | Trgovačko pravo (Commercial) |

#### Create (admin/editor only)

```
POST /api/court-decisions
Authorization: Bearer <token>
```

```json
{
  "title_hr": "Naslov presude",
  "court": "court_id",
  "decisionType": "presuda",
  "category": "gradjansko",
  "date": "2024-06-01",
  "caseNumber": "P-5678/2024",
  "fullText_hr": { "root": { "children": [...] } }
}
```

#### Update (admin/editor only)

```
PATCH /api/court-decisions/:id
Authorization: Bearer <token>
```

#### Delete (admin only)

```
DELETE /api/court-decisions/:id
Authorization: Bearer <token>
```

---

### Expert Witnesses

#### Search expert witnesses

```
GET /api/expert-witnesses
```

Query parameters:
- `where[specialityAreas][contains]=psihijatrija` — filter by speciality
- `where[county][equals]=Grad Zagreb` — filter by county
- `where[isVerified][equals]=true` — verified only
- `where[name][contains]=ivić` — name search (triggers pg_trgm fuzzy)

```json
// Response 200
{
  "docs": [
    {
      "id": "exp_1",
      "name": "Dr. Ana Horvat",
      "specialityAreas": ["psihijatrija", "neurologija"],
      "languages": ["hr", "en", "de"],
      "county": "Grad Zagreb",
      "city": "Zagreb",
      "isVerified": true,
      "slug": "dr-ana-horvat"
      // email and phone omitted for unauthenticated requests
    }
  ]
}
```

**Note:** `email` and `phone` fields are only returned for authenticated users.

#### Get expert by ID / slug

```
GET /api/expert-witnesses/:id
Authorization: Bearer <token>   # required for contact details
```

---

### Interpreters

#### Search interpreters

```
GET /api/interpreters
```

Query parameters:
- `where[sourceLanguages][contains]=engleski` — filter by source language
- `where[targetLanguages][contains]=hrvatski` — filter by target language
- `where[county][equals]=Splitsko-dalmatinska` — filter by county
- `where[isVerified][equals]=true` — verified only

Response structure is identical to Expert Witnesses.

---

### State Attorneys

#### List state attorney offices

```
GET /api/state-attorneys
```

```json
// Response 200
{
  "docs": [
    {
      "id": "sa_1",
      "name": "Općinsko državno odvjetništvo u Zagrebu",
      "county": "Grad Zagreb",
      "address": "Gajeva 30a, 10000 Zagreb",
      "phone": "01/4591-805",
      "email": "odo-zagreb@dorh.hr",
      "jurisdiction": "Područje Općinskog suda u Zagrebu"
    }
  ]
}
```

---

### Bankruptcy Listings

#### Search bankruptcy listings

```
GET /api/bankruptcy-listings
```

Query parameters:
- `where[status][equals]=open` — active listings only
- `where[court][equals]=<court_id>` — filter by court
- `where[deadline][greater_than]=<iso_date>` — upcoming deadlines

```json
// Response 200
{
  "docs": [
    {
      "id": "bl_1",
      "caseNumber": "St-456/2024",
      "debtor": "ABC d.o.o.",
      "court": { "id": "court_1", "name_hr": "Trgovački sud u Zagrebu" },
      "assets": [
        {
          "type": "nekretnina",
          "description": "Poslovni prostor, 250 m², Zagreb",
          "value": 450000
        }
      ],
      "deadline": "2024-09-30",
      "status": "open",
      "contactEmail": "administrator@example.hr"
    }
  ]
}
```

#### Bankruptcy listing statuses

| Value | Description |
|-------|-------------|
| `open` | Listing is active, deadline not passed |
| `closed` | Listing closed or deadline passed |

---

### Media

#### Upload a file (admin/editor only)

```
POST /api/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@document.pdf
alt=Description of the file
```

#### Get file info

```
GET /api/media/:id
```

#### Serve file

Uploaded files are served at:
```
GET /media/<filename>
```

---

### Global Search (Custom Endpoint)

Searches across court decisions, expert witnesses, courts, and news in one request.

```
GET /api/search?q=<query>&limit=10
```

```json
// Response 200
{
  "results": [
    {
      "type": "court-decision",
      "id": "dec_1",
      "title": "Presuda o naknadi štete",
      "excerpt": "...naknada materijalne i nematerijalne štete...",
      "url": "/sudska-praksa/presuda-o-naknadi-stete-p-1234-2024",
      "score": 0.95
    },
    {
      "type": "expert-witness",
      "id": "exp_1",
      "title": "Dr. Ana Horvat",
      "excerpt": "Psihijatrija, neurologija — Grad Zagreb",
      "url": "/strucnjaci/dr-ana-horvat",
      "score": 0.72
    }
  ],
  "totalResults": 8
}
```

---

### Contact Form (Custom Endpoint)

```
POST /api/contact
```

```json
// Request body
{
  "name": "Marko Marković",
  "email": "marko@example.com",
  "subject": "Pitanje o presudi",
  "message": "Imate li presudu broj P-1234/2023?"
}

// Response 200
{ "message": "Poruka je uspješno poslana." }

// Response 400
{ "message": "Sva polja su obavezna." }

// Response 422
{
  "errors": [
    { "field": "email", "message": "Nevažeća email adresa." }
  ]
}
```

---

### Court Fee Calculator (Custom Endpoint)

```
GET /api/court-fee/calculate
```

Calculate Croatian court fees based on claim value and procedure type.

Query parameters:

| Param | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Claim value in EUR (numeric) |
| `procedureType` | Yes | `civil`, `commercial`, `administrative` |
| `stage` | No | `first_instance` (default), `appeal`, `cassation` |

```json
// Response 200
{
  "claimAmount": 50000,
  "procedureType": "civil",
  "stage": "first_instance",
  "fee": 1250,
  "currency": "EUR",
  "breakdown": [
    { "description": "Sudska pristojba", "amount": 1250 }
  ]
}
```

---

### Jurisdiction Finder (Custom Endpoint)

```
GET /api/jurisdiction
```

Point-in-polygon lookup: returns the court with jurisdiction over the given coordinates.

Query parameters:

| Param | Required | Description |
|-------|----------|-------------|
| `lat` | Yes | Latitude (decimal degrees) |
| `lng` | Yes | Longitude (decimal degrees) |

```json
// Response 200
{
  "court": {
    "id": "court_1",
    "name_hr": "Općinski sud u Zagrebu",
    "courtType": "municipal",
    "address": "Trg Nikole Šubića Zrinskog 5, 10000 Zagreb",
    "phone": "01/4801-000"
  }
}

// Response 404 — no jurisdiction found for coordinates
{ "message": "No court found for the given coordinates." }
```

---

### RSS Feeds (Custom Endpoints)

```
GET /api/rss/decisions    RSS 2.0 feed of latest court decisions
GET /api/rss/news         RSS 2.0 feed of latest news posts
```

Returns `Content-Type: application/rss+xml`. Suitable for feed readers and crawlers.

---

### Globals

```
GET    /api/globals/navigation   Site navigation structure
PATCH  /api/globals/navigation   Update navigation (admin only)

GET    /api/globals/settings     Site-wide settings (title, contact info)
PATCH  /api/globals/settings     Update settings (admin only)
```

---

### Health Check

```
GET /api/health
```

```json
// Response 200
{ "status": "ok" }
```

Used by Docker health checks and external monitoring. Returns `200 OK` when the CMS is fully initialised.

---

## Collections (Data Models)

### Users

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | Email | Yes | Unique, used as login |
| `name` | Text | Yes | Display name |
| `role` | Select | Yes | `admin` / `editor` / `member` |
| `password` | Password | Yes | Hashed by Payload |

**Access control:**
- `admin` — full CRUD on all collections
- `editor` — create/update court decisions, news, documents
- `member` — read-only access to member-only fields (expert contact details)

### Courts

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name_hr` | Text | Yes | Croatian name (used for slug) |
| `name_en` | Text | No | English name |
| `courtType` | Select | Yes | See court types |
| `address` | Text | Yes | Full postal address |
| `phone` | Text | No | |
| `email` | Email | No | |
| `website` | Text | No | |
| `lat` | Number | Yes | Latitude (decimal degrees) |
| `lng` | Number | Yes | Longitude (decimal degrees) |
| `slug` | Text | Auto | Generated from `name_hr` |

### Court Decisions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title_hr` | Text | Yes | Croatian title |
| `title_en` | Text | No | English title |
| `court` | Relationship | Yes | → Courts |
| `decisionType` | Select | Yes | See decision types |
| `category` | Select | Yes | Legal category |
| `date` | Date | Yes | Decision date |
| `caseNumber` | Text | Yes | e.g., `P-1234/2024` |
| `fullText_hr` | RichText | No | Lexical editor JSON |
| `fullText_en` | RichText | No | Lexical editor JSON |
| `pdfFile` | Relationship | No | → Media |
| `tags` | Array(Text) | No | Searchable keyword tags |
| `searchVector` | Text | Auto | PostgreSQL `tsvector`, GIN indexed |
| `slug` | Text | Auto | Generated from `title_hr` + `caseNumber` |

### Expert Witnesses

| Field | Type | Required | Access |
|-------|------|----------|--------|
| `name` | Text | Yes | Public |
| `specialityAreas` | Array(Text) | Yes | Public |
| `languages` | Array(Text) | No | Public |
| `county` | Text | Yes | Public |
| `city` | Text | No | Public |
| `email` | Email | No | **Members only** |
| `phone` | Text | No | **Members only** |
| `assignedCourts` | Relationship | No | → Courts, Public |
| `isVerified` | Checkbox | No | Public |
| `bio` | RichText | No | Public |
| `slug` | Text | Auto | Generated from `name` |

### Interpreters

Same fields as Expert Witnesses, with `sourceLanguages` and `targetLanguages` instead of `specialityAreas`.

### State Attorneys

| Field | Type | Required |
|-------|------|----------|
| `name` | Text | Yes |
| `county` | Text | Yes |
| `address` | Text | No |
| `phone` | Text | No |
| `email` | Email | No |
| `jurisdiction` | Text | No |

### Bankruptcy Listings

| Field | Type | Required |
|-------|------|----------|
| `caseNumber` | Text | Yes |
| `debtor` | Text | Yes |
| `court` | Relationship | Yes | → Courts |
| `administrator` | Relationship | No | → bankruptcy-administrators |
| `assets` | Array | No | `type`, `description`, `value` (EUR) |
| `deadline` | Date | No | Sale/submission deadline |
| `status` | Select | Yes | `open` / `closed` |
| `contactEmail` | Email | No | |
| `contactPhone` | Text | No | |

---

## Authentication

Payload CMS uses **JWT tokens** stored in HttpOnly cookies (and returned in response body for API clients).

**Token lifetime:** 2 hours (configurable in `payload.config.ts`)

**Roles and permissions:**

| Action | Unauthenticated | Member | Editor | Admin |
|--------|----------------|--------|--------|-------|
| Read public data | ✓ | ✓ | ✓ | ✓ |
| Read expert/interpreter contact | ✗ | ✓ | ✓ | ✓ |
| Create court decisions, news | ✗ | ✗ | ✓ | ✓ |
| Update court decisions, news | ✗ | ✗ | ✓ | ✓ |
| Manage courts, experts, interpreters | ✗ | ✗ | ✗ | ✓ |
| Manage users | ✗ | ✗ | ✗ | ✓ |
| Delete any record | ✗ | ✗ | ✗ | ✓ |

---

## Search

### Full-text search (case law)

Court decisions use PostgreSQL `tsvector` with Croatian language configuration:

```sql
-- searchVector is maintained via afterChange hook
to_tsvector('simple', coalesce(title_hr, '') || ' ' || coalesce(fulltext_plain_hr, ''))
```

Search query:
```
GET /api/court-decisions?where[searchVector][like]=naknada+štete
```

### Fuzzy name search (experts, interpreters, courts)

Uses `pg_trgm` trigram similarity for diacritic-insensitive fuzzy matching:

```
GET /api/expert-witnesses?where[name][like]=horvat
```

This matches "Horvat", "Horvatić", "Horvatinčić", etc.

---

## eSPIS Integration

[eSPIS](https://espis.pravosudje.hr) is Croatia's official electronic court information system, operated by the Ministry of Justice (Ministarstvo pravosuđa i uprave). When API access is granted it will allow Sudačka mreža to automatically import new published court decisions without manual data entry.

### Current status

**API access not yet obtained.** The integration layer is fully built and runs in **mock mode** — it logs every action it would take but makes no writes to the database.

### Architecture

```
cms/src/
├── integrations/
│   └── espis.ts        # EspisClient interface + MockEspisClient + RealEspisClient stub
└── jobs/
    └── espisSync.ts    # Cron job: polls eSPIS, deduplicates, imports into court-decisions
```

### Enabling live sync

Once API credentials are issued by MPA:

1. Set environment variables in `.env`:
   ```bash
   ESPIS_API_URL=https://api.espis.pravosudje.hr   # confirm exact URL with MPA
   ESPIS_API_KEY=<your-api-key>
   ESPIS_SYNC_ENABLED=true
   ESPIS_SYNC_WINDOW_HOURS=24
   ```

2. In `cms/src/integrations/espis.ts`, uncomment `RealEspisClient` and update the API path/field mappings to match the actual eSPIS API contract.

3. Swap the export at the bottom of `espis.ts`:
   ```ts
   // Before (mock)
   export const espisClient: EspisClient = new MockEspisClient()

   // After (live)
   export const espisClient: EspisClient = new RealEspisClient()
   ```

4. Wire up the cron job in `cms/src/server.ts`:
   ```ts
   import { runEspisSync } from './jobs/espisSync.js'

   // After payload.init() resolves:
   runEspisSync(payload)                                        // immediate run on startup
   setInterval(() => runEspisSync(payload), 6 * 60 * 60 * 1000) // then every 6 hours
   ```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ESPIS_API_URL` | _(empty)_ | Base URL of the eSPIS REST API |
| `ESPIS_API_KEY` | _(empty)_ | Bearer token issued by MPA |
| `ESPIS_SYNC_ENABLED` | `false` | Set to `true` to write to the DB (mock-only when `false`) |
| `ESPIS_SYNC_WINDOW_HOURS` | `24` | How many hours back to look for new decisions per run |

### Deduplication

The sync job checks `caseNumber` uniqueness before inserting. Safe to re-run at any frequency — existing documents are never duplicated or overwritten.

---

## Architecture Decision Records

All architectural decisions are documented in `docs/adr/`:

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](docs/adr/0001-backend-language.md) | TypeScript for entire stack | Accepted |
| [0002](docs/adr/0002-database.md) | PostgreSQL 16 with pg_trgm + tsvector | Accepted |
| [0003](docs/adr/0003-frontend-framework.md) | React 19 + Vite 6 + React Router 7 (SPA, not Next.js) | Accepted |
| [0004](docs/adr/0004-deployment-strategy.md) | Docker Compose + Caddy (auto-HTTPS) | Accepted |
| [0005](docs/adr/0005-cms-choice.md) | Payload CMS 3 (TypeScript-native, standalone) | Accepted |
| [0006](docs/adr/0006-authentication.md) | Payload built-in JWT (HttpOnly cookies) | Accepted |
| [0007](docs/adr/0007-i18n.md) | react-i18next with HR/EN language paths | Accepted |
| [0008](docs/adr/0008-maps.md) | Leaflet.js + OpenStreetMap (replaces Flash) | Accepted |
| [0009](docs/adr/0009-analytics.md) | Plausible CE (self-hosted, cookieless) | Accepted |
| [0010](docs/adr/0010-styling.md) | Tailwind CSS 4 (CSS-first @theme config) | Accepted |
| [0011](docs/adr/0011-seo-strategy.md) | vite-plugin-ssg for static HTML generation | Accepted |
| [0012](docs/adr/0012-search-strategy.md) | PostgreSQL full-text (no Meilisearch at MVP) | Accepted |
