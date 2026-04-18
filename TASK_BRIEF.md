# Task Brief — Feature Pages: Bankruptcy, Calculator, Map, Auth, i18n
## Sprint 5–6 | GF-GFWEB-002 | 2026-03-21
## Assignee: Lead Engineer

---

## Context

Sprints 0–4 are complete:
- **Sprint 0:** Vite + React 19 scaffold, Docker, design tokens, AppShell, router
- **Sprint 1:** 11 UI components (Button, Card, Badge, Alert, Input, SearchBar, Modal, Pagination, Breadcrumb, Skeleton, DataTable), i18n setup (react-i18next, locales/hr & en), layout shell
- **Sprint 2:** All 13 Payload CMS collections with full-text search, PostgreSQL GIN indexes, bilingual locale support
- **Sprint 3–4:** `web/src/api/` client module, court-decisions, expert-witnesses, interpreters, courts, news, search API functions, utils/counties.ts, HomePage, DecisionsSearchPage, ExpertsPage, InterpretersPage, CourtsPage fully implemented

Every page listed below is currently a stub rendering "Ova stranica je u izradi."
The `web/src/api/` module exists — extend it with new collection functions.
No `AuthContext` or `ProtectedRoute` exists yet — create them from scratch.

---

## Scope

### Files to CREATE

```
# Auth infrastructure
web/src/api/auth.ts
web/src/contexts/AuthContext.tsx
web/src/components/auth/ProtectedRoute.tsx

# New API modules
web/src/api/bankruptcy.ts
web/src/api/galleries.ts
web/src/api/pages.ts
web/src/api/documents.ts
web/src/api/laws.ts

# New page
web/src/pages/DonationPage.tsx

# GeoJSON data (lazy-loaded)
web/public/data/croatia-jurisdictions.geojson

# Tests
web/src/api/__tests__/auth.test.ts
web/src/api/__tests__/bankruptcy.test.ts
web/src/api/__tests__/galleries.test.ts
web/src/api/__tests__/pages.test.ts
web/src/pages/__tests__/bankruptcy/BankruptcyPage.test.tsx
web/src/pages/__tests__/bankruptcy/BankruptcyListingsPage.test.tsx
web/src/pages/__tests__/bankruptcy/AdministratorsPage.test.tsx
web/src/pages/__tests__/bankruptcy/BankruptcyLawsPage.test.tsx
web/src/pages/__tests__/courts/JurisdictionFinderPage.test.tsx
web/src/pages/__tests__/CalculatorPage.test.tsx
web/src/pages/__tests__/LegalAidPage.test.tsx
web/src/pages/__tests__/NewsPage.test.tsx
web/src/pages/__tests__/GalleriesPage.test.tsx
web/src/pages/__tests__/GalleryDetailPage.test.tsx
web/src/pages/__tests__/AboutPage.test.tsx
web/src/pages/__tests__/ContactPage.test.tsx
web/src/pages/__tests__/DonationPage.test.tsx
web/src/pages/__tests__/LoginPage.test.tsx
web/src/pages/__tests__/MembersPage.test.tsx
web/src/contexts/__tests__/AuthContext.test.tsx
web/src/components/auth/__tests__/ProtectedRoute.test.tsx
```

### Files to REPLACE (stubs → full implementation)

```
web/src/pages/bankruptcy/BankruptcyPage.tsx          → landing, intro, quick links
web/src/pages/bankruptcy/BankruptcyListingsPage.tsx  → searchable listings
web/src/pages/bankruptcy/AdministratorsPage.tsx      → administrator directory
web/src/pages/bankruptcy/BankruptcyLawsPage.tsx      → laws archive with PDFs
web/src/pages/courts/JurisdictionFinderPage.tsx      → Leaflet choropleth map
web/src/pages/CalculatorPage.tsx                     → court fee calculator
web/src/pages/LegalAidPage.tsx                       → free legal aid (CMS content)
web/src/pages/NewsPage.tsx                           → paginated news listing
web/src/pages/GalleriesPage.tsx                      → gallery grid by type
web/src/pages/GalleryDetailPage.tsx                  → lightbox / video / audio
web/src/pages/AboutPage.tsx                          → CMS content + org info
web/src/pages/ContactPage.tsx                        → contact form + Resend
web/src/pages/LoginPage.tsx                          → Payload JWT auth
web/src/pages/MembersPage.tsx                        → protected member area
```

### Files to MODIFY

```
# Add DonationPage route and import
web/src/router.tsx

# Add all new translation keys
web/src/i18n/locales/hr/common.json
web/src/i18n/locales/en/common.json
```

---

## Spec Requirements

All tasks map to SPRINT_PLAN.md sprint tasks:

| Task ID | Deliverable |
|---------|-------------|
| E5-1 | Install `leaflet` + `react-leaflet`; configure OpenStreetMap tile provider |
| E5-2 | Source Croatian county GeoJSON; commit to `web/public/data/croatia-jurisdictions.geojson` |
| E5-3 | `JurisdictionFinderPage` — choropleth map; click county → popup with responsible court |
| E5-7 | `BankruptcyPage` — landing page (intro, quick links, latest 3 listings) |
| E5-8 | `BankruptcyListingsPage` — searchable listings; deadline highlight |
| E5-9 | `AdministratorsPage` — searchable administrator directory |
| E5-10 | `BankruptcyLawsPage` — laws list with PDF downloads, grouped by year |
| E6-1 | `CalculatorPage` — form-based calculator; Zod validation; bilingual |
| E6-2 | `LoginPage` — Payload JWT auth; success → redirect `/clanovi/`; error on bad creds |
| E6-4 | `MembersPage` — protected route; unauthenticated → redirect `/login` |
| E6-5 | Auth context (`useAuth` hook) — user state, login(), logout() |
| E6-6 | `GalleriesPage` — cards for photo, video, audio albums; type filter tabs |
| E6-7 | `GalleryDetailPage` — CSS lightbox (photo), iframe (video), `<audio>` (audio) |

Features from SPEC.md §4.1 (Core): contact form, member accounts, news, free legal aid, about, galleries, media without Flash, court fee calculator, jurisdiction finder replacing Flash.

---

## ADR Decisions (Must Follow)

| ADR | Decision | Constraint |
|-----|----------|-----------|
| ADR-0001 | TypeScript strict | No `any`, no `@ts-ignore`, `strict: true` in tsconfig |
| ADR-0003 | React 19 + React Router 7 SPA | No SSR; no Next.js patterns; no `getServerSideProps`-style code |
| ADR-0005 | Payload CMS REST only | Never call `/api/graphql`; all data via REST endpoints |
| ADR-0006 | Payload JWT auth | Use `POST /api/users/login`, `POST /api/users/logout`, `GET /api/users/me`; `credentials: 'include'` on all fetch calls; cookie name is `payload-token` (HttpOnly — you cannot read it from JS; rely on `GET /api/users/me` to check auth state) |
| ADR-0007 | react-i18next | Every user-visible string via `t()`; no hardcoded literals in JSX |
| ADR-0008 | Leaflet.js 1.9 + react-leaflet 4 | OpenStreetMap tiles only (no Google Maps, no Mapbox); GeoJSON loaded lazily from `web/public/data/`; `JurisdictionFinderPage` MUST be dynamically imported or the map component wrapped in a dynamic import with `ssr: false` equivalent (Leaflet uses `window` directly — will crash if imported at module level without guard) |
| ADR-0010 | Tailwind CSS 4 CSS-first | All colours via `var(--color-*)` custom properties; no hardcoded hex or RGB values; no `tailwind.config.js` (CSS `@theme` only) |

---

## Page-by-Page Specification

---

### 1. BankruptcyPage (`web/src/pages/bankruptcy/BankruptcyPage.tsx`)

**Route:** `/:lang/stecaj`
**Sprint:** E5-7

**Sections:**
1. **Header** — `<h1>` with `t('bankruptcy.title')`, subtitle `t('bankruptcy.subtitle')`
2. **Quick-links grid** — 4 Cards in `grid-cols-1 sm:grid-cols-2 gap-4`:
   - Listings → `/${lang}/stecaj/oglasi`
   - Administrators → `/${lang}/stecaj/upravitelji`
   - Laws → `/${lang}/stecaj/zakoni`
   - Decisions → `/${lang}/stecaj/odluke`
3. **Latest 3 listings** — fetch `getBankruptcyListings({ limit: 3, locale })`;
   - While loading: 3 Skeleton rows
   - Each item: case number (monospace via `font-mono`), debtor name, court, deadline
   - Overdue deadline: `text-[color:var(--color-danger)]` if `deadline < today`
   - Footer: "View all" link → `/${lang}/stecaj/oglasi`

**Breadcrumb:** `[{ label: t('nav.home'), href: `/${lang}` }, { label: t('nav.bankruptcy') }]`

**Acceptance criteria:**
- [ ] Renders all 3 sections
- [ ] Latest listings are fetched from `/api/bankruptcy-listings?limit=3&sort=-deadline`
- [ ] Overdue items show in danger colour
- [ ] All strings via `t()`
- [ ] Test: renders with mocked API (loading state → 3 skeletons; success → listing items)

---

### 2. BankruptcyListingsPage (`web/src/pages/bankruptcy/BankruptcyListingsPage.tsx`)

**Route:** `/:lang/stecaj/oglasi`
**Sprint:** E5-8

**URL state params:** `?q=`, `?status=`, `?page=`

**Filter panel:**
| Control | URL param | Payload where clause |
|---------|-----------|---------------------|
| Keyword SearchBar (debounced 300ms) | `?q=` | `where[_search][like]` |
| Status select (Active/Completed/Cancelled/All) | `?status=` | `where[status][equals]` |

**Results:**
- 20 per page, `sort=-deadline` (most urgent first)
- Each row: case number (`font-mono`), debtor, court name, administrator name, deadline, status Badge
- Deadline: if `status === 'active'` AND deadline < today → `text-[color:var(--color-danger)] font-semibold`
- Empty state: `t('bankruptcy.noListings')`
- Pagination: `<Pagination>` updates `?page=` param; reset page to '1' on filter change

**Breadcrumb:** `[Home, Bankruptcy, t('nav.bankruptcyListings')]`

**Acceptance criteria:**
- [ ] Filter state survives page reload (URL params)
- [ ] Page resets to 1 when q or status changes
- [ ] Overdue active listings highlighted in danger colour
- [ ] Test: deep-link pre-fill, filter interaction, overdue highlighting, pagination

---

### 3. AdministratorsPage (`web/src/pages/bankruptcy/AdministratorsPage.tsx`)

**Route:** `/:lang/stecaj/upravitelji`
**Sprint:** E5-9

**URL state params:** `?q=`, `?page=`

**Filter:** SearchBar debounced 300ms → `where[_search][like]`

**Results:**
- 20 per page, `sort=name`
- Each card: administrator name, licence number, contact (email/phone only if user is logged in — check `user` from `useAuth()` — if null show `t('loginRequired')`)
- Link to assigned cases count if `assignedCases` populated

**Acceptance criteria:**
- [ ] Contact details hidden behind auth check
- [ ] `t('loginRequired')` shown for unauthenticated users instead of contact fields
- [ ] Test: renders card list; contact hidden when unauthenticated; visible when authenticated

---

### 4. BankruptcyLawsPage (`web/src/pages/bankruptcy/BankruptcyLawsPage.tsx`)

**Route:** `/:lang/stecaj/zakoni`
**Sprint:** E5-10

**Data:** fetch `getLaws({ locale })` — all laws sorted by `-year`

**Layout:**
- Group by year using `useMemo` (reduce into `Map<number, Law[]>`)
- Each year section: `<h2>` with year, then list of laws
- Each law item: title, type Badge, PDF download link (open in new tab), amendment link (if `supersededBy` populated → link to superseding law)
- If `supersededBy` is set → show Badge `t('laws.amended')` in muted style

**Acceptance criteria:**
- [ ] Laws grouped by year descending
- [ ] PDF links open in new tab with `rel="noopener noreferrer"`
- [ ] Amendment chain visible
- [ ] All strings via `t()`
- [ ] Test: groups by year; renders PDF links; shows amendment badge

---

### 5. JurisdictionFinderPage (`web/src/pages/courts/JurisdictionFinderPage.tsx`)

**Route:** `/:lang/sudovi/nadleznost`
**Sprint:** E5-3

**Critical setup — Leaflet SSR guard:**

```tsx
// ❌ WRONG — will crash: Leaflet reads window at import time
import { MapContainer } from 'react-leaflet'

// ✅ CORRECT — lazy dynamic import, renders only client-side
const JurisdictionMap = lazy(() => import('@/components/map/JurisdictionMap'))
```

Create `web/src/components/map/JurisdictionMap.tsx` as the actual Leaflet component.
The page wraps it in `<Suspense fallback={<Skeleton className="h-[600px]" />}>`.

**Packages to install (if not present):**
```bash
npm install leaflet react-leaflet @types/leaflet
```

**GeoJSON source:**
- Use GADM level-2 Croatia data (public domain, no client data available yet — see BLK-2 in SPRINT_PLAN.md)
- Download from `https://gadm.org/` and post-process, OR generate a minimal placeholder with 21 counties
- File: `web/public/data/croatia-jurisdictions.geojson`
- Each feature must have `properties.NAME_2` (county name in Croatian) and `properties.court_id` (nullable — assign to nearest commercial court by default)

**`JurisdictionMap.tsx` spec:**
```tsx
// Imports at top of file (NOT lazily — this file IS the lazy chunk)
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'

// Fix Leaflet default marker icon (missing in Vite builds)
// Must run once before any map renders:
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ ... })
```

**Map behaviour:**
- Default center: `[45.1, 15.2]` (centre of Croatia), zoom 7
- `TileLayer` URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Attribution: `© OpenStreetMap contributors`
- Each polygon: fill `var(--color-brand-navy)` at 20% opacity, stroke `var(--color-border)`
- On hover: fill opacity 40%, cursor pointer
- On click: highlight polygon (fill opacity 70%), show court info in sidebar panel
- Sidebar panel (right of map on desktop, below on mobile): court name, address, phone, `<Link>` to `/${lang}/sudovi/${court.id}`
- No court data yet → show `t('jurisdiction.noCourtData')` in panel
- Fetch court by county: `GET /api/courts?where[county][equals]=<county_name>&locale=<lang>`

**Keyboard accessibility:**
- Tab navigates to map container; arrow keys pan; +/- zoom (Leaflet built-in)
- Focusable polygon: set `tabIndex={0}` on each GeoJSON layer via `onEachFeature`

**Acceptance criteria:**
- [ ] `tsc --noEmit` passes (no `window is not defined` at build time)
- [ ] Map renders with OSM tiles
- [ ] Clicking a county polygon shows court name in sidebar (or no-data message)
- [ ] No hardcoded tile API keys
- [ ] Leaflet CSS imported within the lazy chunk file (not in `main.css`)
- [ ] Test: lazy import resolves; sidebar shows county name on polygon click event (mock GeoJSON click)

---

### 6. CalculatorPage (`web/src/pages/CalculatorPage.tsx`)

**Route:** `/:lang/pristojbe`
**Sprint:** E6-1

**Purpose:** Court fee calculator replicating the existing site's logic. The original ASP.NET calculator uses a simple formula based on claim value. Since the exact fee table from the client is pending (BLK-1), implement the publicly-known Croatian court fee schedule.

**Croatian court fee schedule (Zakon o sudskim pristojbama):**

| Claim value (HRK/EUR equivalent) | Fee rate |
|---|---|
| Up to 3,000 HRK (≈ €398) | 200 HRK flat |
| 3,001 – 6,000 HRK | 300 HRK flat |
| 6,001 – 12,000 HRK | 400 HRK flat |
| 12,001 – 24,000 HRK | 500 HRK flat |
| 24,001 – 60,000 HRK | 600 HRK flat |
| Over 60,000 HRK | 1% of claim value, max 5,000 HRK |

**Note:** Croatia adopted EUR as currency in 2023. Use EUR values at exchange rate 1 EUR = 7.5345 HRK for reference. Display in EUR.

**Form fields:**
1. `claimValue` — `<input type="number" min="0" step="0.01">` — value of claim in EUR
2. `procedureType` — `<select>` — options: Civil / Commercial / Administrative / Misdemeanour
3. `instanceType` — `<select>` — First instance / Appeal / Cassation (multiplier: 1x / 1.5x / 2x)

**Calculator logic:**
- Isolate in `web/src/utils/courtFees.ts` (pure function, no JSX — makes it unit-testable without DOM)
- Function signature: `calculateCourtFee(claimEUR: number, procedure: string, instance: string): number`
- The pure function is the primary unit test target

**Display:**
- While no input: show explanatory text `t('calculator.instructions')`
- On valid input: show result card with fee amount (`Intl.NumberFormat` for EUR)
- On invalid: Zod error inline below field

**Acceptance criteria:**
- [ ] `calculateCourtFee` is a pure function in `utils/courtFees.ts`
- [ ] Unit tests for `courtFees.ts` cover all fee brackets + all instance multipliers
- [ ] Form re-calculates on every input change (no submit button needed)
- [ ] Zod validates `claimValue >= 0`
- [ ] All labels via `t()`
- [ ] Test: known input → known output; zero input → no fee shown

---

### 7. LegalAidPage (`web/src/pages/LegalAidPage.tsx`)

**Route:** `/:lang/pravna-pomoc`
**Sprint:** E3-7

**Content source:** Payload `pages` collection, slug `besplatna-pravna-pomoc`

**Implementation:**
```ts
// web/src/api/pages.ts
getPage(slug: string, locale?: string): Promise<Page>
// GET /api/pages?where[slug][equals]={slug}&locale={locale}&limit=1
// Return: { id, title, content (Lexical JSON), metaTitle, metaDescription }
```

**Page rendering:**
- Fetch on mount; loading → Skeleton blocks
- Error → `<Alert variant="error">` with `t('error')`
- Success → `<h1>` from `page.title` + render Lexical content blocks
- Lexical renderer: build a minimal `LexicalRenderer` component that handles:
  - `paragraph` → `<p>`
  - `heading` → `<h2>` / `<h3>` (based on tag)
  - `list` / `listitem` → `<ul>/<ol>/<li>`
  - `link` → `<a href>` with `rel="noopener noreferrer"` for external
  - Anything unrecognised → `<div>` with its text children
- Store `LexicalRenderer` at `web/src/components/LexicalRenderer.tsx` — it will be reused by AboutPage, NewsDetailPage, CaseLawDetailPage

**Acceptance criteria:**
- [ ] Fetches from `pages` collection by slug
- [ ] Lexical heading blocks render as `<h2>`/`<h3>` (not `<h1>` — page already has `<h1>`)
- [ ] External links open in new tab
- [ ] Test: mocked page response renders title; paragraph block renders `<p>`

---

### 8. NewsPage (`web/src/pages/NewsPage.tsx`)

**Route:** `/:lang/vijesti`
**Sprint:** E3-4

**URL state params:** `?category=`, `?page=`

**Filter:**
- Category select (options fetched by collecting all categories from first-page response; deduplicated)
- Prepend "All categories" option

**Results:**
- 10 per page, `sort=-published_at`
- Each item: featured image thumbnail (if exists), title as link to `/${lang}/vijesti/${post.slug}`, publication date (locale-aware: `new Date(post.published_at).toLocaleDateString(lang === 'hr' ? 'hr-HR' : 'en-US')`), category Badge, excerpt (first 200 chars of plain text — Lexical `root.children[0].children[0].text` if available, else omit)
- Loading: 10 Skeleton rows
- Empty: `t('news.noResults')`

**Breadcrumb:** `[Home, t('nav.news')]`

**Acceptance criteria:**
- [ ] Pagination resets to 1 on category change
- [ ] Dates formatted per active locale
- [ ] Test: renders news list; category filter updates URL; pagination works

---

### 9. GalleriesPage (`web/src/pages/GalleriesPage.tsx`)

**Route:** `/:lang/galerije`
**Sprint:** E6-6

**URL state param:** `?type=` (photo / video / audio / all)

**Tab nav:**
| Tab | type value |
|-----|-----------|
| `t('galleries.tab.all')` | (omit param) |
| `t('galleries.tab.photo')` | photo |
| `t('galleries.tab.video')` | video |
| `t('galleries.tab.audio')` | audio |

**Tab markup:** `role="tablist"`, each button `role="tab"`, `aria-selected`

**Results:**
- Fetch `getGalleries({ type?, locale })` — `GET /api/galleries?where[type][equals]={type}&sort=-updatedAt&limit=20&locale={lang}`
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- Each Card: cover image (first item's media URL, or type-specific placeholder icon), gallery title, type Badge, item count
- Card is a `<Link>` to `/${lang}/galerije/${gallery.id}`
- Loading: 6 Skeleton cards
- Empty: `t('galleries.noResults')`

**Acceptance criteria:**
- [ ] Tab switching updates `?type=` URL param
- [ ] All galleries shown when no type filter
- [ ] Test: renders gallery cards; type filter updates URL param

---

### 10. GalleryDetailPage (`web/src/pages/GalleryDetailPage.tsx`)

**Route:** `/:lang/galerije/:id`
**Sprint:** E6-7

**Fetch:** `GET /api/galleries/:id?locale={lang}`

**Render by gallery type:**

**Photo:**
- CSS grid of thumbnails: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2`
- Click thumbnail → open lightbox (CSS-only, no library dependency):
  - Fixed overlay: `position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 50`
  - Centered `<img>` with `max-h-[90vh] max-w-[90vw]`
  - Close button (Escape key + click overlay): `t('close')`
  - Prev/Next arrows — keyboard navigable (ArrowLeft/ArrowRight)
  - State: `lightboxIndex: number | null` via `useState`

**Video:**
- Grid of video cards; each card: thumbnail or play icon placeholder, caption
- Click → open Modal containing `<iframe>` with YouTube/Vimeo embed URL
- If `item.videoUrl` is a YouTube URL, convert to embed format: `youtube.com/watch?v=ID` → `youtube.com/embed/ID`
- Use `allow="autoplay; encrypted-media"`, `allowFullScreen`

**Audio:**
- List of audio items; each: title/caption + HTML5 `<audio controls src={item.media.url}>` — no Flash, no third-party player

**Breadcrumb:** `[Home, Galleries, gallery.title]`

**Acceptance criteria:**
- [ ] Lightbox opens on photo click; closes on Escape
- [ ] Arrow keys navigate lightbox photos
- [ ] YouTube embed URL is transformed (no raw `watch?v=` in iframe src)
- [ ] `<audio>` element used for audio type (no Flash)
- [ ] Test: photo type renders grid; lightbox opens on first image click; ESC closes it

---

### 11. AboutPage (`web/src/pages/AboutPage.tsx`)

**Route:** `/:lang/o-nama`
**Sprint:** E3-6

Same pattern as LegalAidPage. Fetch Payload `pages` collection by slug `o-nama`.

Additional hardcoded section below CMS content:
- **Funders section** — static list of organisations that funded the platform (from SPEC §1.1): Dutch Ministry of Foreign Affairs, Norwegian Ministry of Foreign Affairs, OSCE, Canadian Department of Foreign Affairs, US Embassy Zagreb, ABA, NED, SPAN d.o.o., IRZ — render as simple `<ul>` under `<h2>t('about.fundersTitle')</h2>`
- **Sister sites** — links to `pravosudna-mreza.org.rs` (Serbia) and `pravosudna-mreza.org.mk` (North Macedonia) with `rel="noopener noreferrer"`

**Acceptance criteria:**
- [ ] CMS content rendered via `LexicalRenderer`
- [ ] Funders list visible
- [ ] External links open in new tab
- [ ] Test: renders title from mocked CMS page; funders section visible

---

### 12. ContactPage (`web/src/pages/ContactPage.tsx`)

**Route:** `/:lang/kontakt`
**Sprint:** E3-8

**Form fields:**
1. `name` — text input, required
2. `email` — email input, required, validated with Zod `.email()`
3. `subject` — `<select>` with 5 options (from SPEC §1.4):
   - `suggestion` → `t('contact.subject.suggestion')`
   - `criticism` → `t('contact.subject.criticism')`
   - `collaboration` → `t('contact.subject.collaboration')`
   - `media` → `t('contact.subject.media')`
   - `other` → `t('contact.subject.other')`
4. `message` — `<textarea>`, required, min 20 chars

**Zod schema (client-side):**
```ts
const ContactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.enum(['suggestion', 'criticism', 'collaboration', 'media', 'other']),
  message: z.string().min(20),
})
```

**Submission:** `POST /api/contact` — this is a **Payload custom endpoint** (not a collection). If it doesn't exist yet, the form should still handle the response gracefully:
- Success (2xx): show `<Alert variant="success">t('contact.success')</Alert>`, clear form
- Error (4xx/5xx or network): show `<Alert variant="error">t('contact.error')</Alert>`

**State management:** `useState` for form values; no URL state needed (not filterable).

**Acceptance criteria:**
- [ ] Client-side Zod validation shows inline errors before submission
- [ ] Submit button is disabled while submitting
- [ ] Success alert shown and form cleared after successful submission
- [ ] Error alert shown on API failure
- [ ] All labels via `t()`
- [ ] Test: renders form; validation errors on empty submit; success alert on mocked 200 response

---

### 13. DonationPage (`web/src/pages/DonationPage.tsx`) — NEW FILE

**Route:** `/:lang/doniraj` — **ADD THIS ROUTE TO `router.tsx`**

The original site has a Donirajte (Donate) link in its top bar. This page doesn't exist in the current router — add both the file and the route.

**Content:** Fetch Payload `pages` collection by slug `doniraj` (CMS page). If the page doesn't exist in Payload (404), render a static fallback:

```tsx
// Fallback when CMS page not found
<section>
  <h1>{t('donation.title')}</h1>
  <p>{t('donation.description')}</p>
  <p>{t('donation.contactPrompt')} <a href={`/${lang}/kontakt`}>{t('nav.contact')}</a></p>
</section>
```

**Router change in `router.tsx`:**
```tsx
// Add import at top with other static pages
const DonationPage = lazy(() => import('@/pages/DonationPage'))

// Add route inside /:lang children, near kontakt:
{ path: 'doniraj', element: S(DonationPage) },
```

**Acceptance criteria:**
- [ ] Route `/:lang/doniraj` resolves and renders
- [ ] If CMS page exists: renders Lexical content
- [ ] If CMS 404: renders static fallback (not a blank screen, not an error page)
- [ ] Test: renders title; CMS not-found → fallback visible

---

### 14. LoginPage (`web/src/pages/LoginPage.tsx`)

**Route:** `/:lang/login`
**Sprint:** E6-2

**Critical: Payload auth cookie is HttpOnly — JS cannot read `payload-token` directly. Use `GET /api/users/me` to determine auth state.**

**Auth API module (`web/src/api/auth.ts`):**
```ts
export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'editor' | 'member'
}

// POST /api/users/login
// Body: { email, password }
// On success: Payload sets HttpOnly cookie automatically; response body contains user object
export async function login(email: string, password: string): Promise<AuthUser>

// POST /api/users/logout
// Clears the HttpOnly cookie server-side
export async function logout(): Promise<void>

// GET /api/users/me
// Returns current user if cookie is valid; 401 if not authenticated
export async function getMe(): Promise<AuthUser | null>
```

**AuthContext (`web/src/contexts/AuthContext.tsx`):**
```tsx
interface AuthContextValue {
  user: AuthUser | null
  loading: boolean        // true while getMe() is in-flight on mount
  login(email: string, password: string): Promise<void>
  logout(): Promise<void>
}
```
- On mount: call `getMe()` to hydrate `user` from the existing cookie (persists across page reloads)
- `login()`: call `auth.login()`, set `user` in state; on failure re-throw so `LoginPage` can show error
- `logout()`: call `auth.logout()`, set `user = null`
- Wrap app in `<AuthProvider>` — update `web/src/App.tsx` or `web/src/main.tsx`

**LoginPage form:**
```
email (required) + password (required)
Submit → calls context.login()
On success → navigate(`/${lang}/clanovi`, { replace: true })
On error (401) → show <Alert variant="error">{t('auth.invalidCredentials')}</Alert>
```

**If already logged in (user !== null):** redirect to `/${lang}/clanovi` immediately (useEffect check on mount).

**Acceptance criteria:**
- [ ] Successful login calls `POST /api/users/login` with `credentials: 'include'`
- [ ] On success: navigates to `/${lang}/clanovi`
- [ ] On 401: shows invalid-credentials alert (not a full-page error)
- [ ] Already-authenticated user is redirected without seeing the form
- [ ] `getMe()` is called on `AuthContext` mount (not just on login action)
- [ ] Test: renders form; successful mock login → navigate called; 401 → error alert shown

---

### 15. MembersPage (`web/src/pages/MembersPage.tsx`)

**Route:** `/:lang/clanovi`
**Sprint:** E6-4

**ProtectedRoute component (`web/src/components/auth/ProtectedRoute.tsx`):**
```tsx
// Wraps any element; redirects to login if unauthenticated
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { lang } = useParams()
  if (loading) return <Skeleton className="h-64" />
  if (!user) return <Navigate to={`/${lang}/login`} replace />
  return <>{children}</>
}
```

**Router change:** Wrap MembersPage with ProtectedRoute in `router.tsx`:
```tsx
{ path: 'clanovi', element: <ProtectedRoute>{S(MembersPage)}</ProtectedRoute> }
```

**MembersPage content:**
- Welcome: `t('members.welcome', { name: user.email })`
- Section: Saved decisions (placeholder — localStorage bookmark list from Sprint 4 `BookmarkButton`)
- Section: Profile info (email, role Badge)
- Logout button → calls `context.logout()` → navigate to `/${lang}/login`

**Acceptance criteria:**
- [ ] Unauthenticated user visiting `/clanovi` is redirected to `/{lang}/login`
- [ ] Authenticated user sees welcome message with their email
- [ ] Logout button clears session and redirects to login
- [ ] `loading === true` shows Skeleton (not redirect — avoids redirect flicker while `getMe()` is in-flight)
- [ ] Test: unauthenticated → `<Navigate>` to login; authenticated → welcome text visible; logout button calls context.logout

---

## New API Modules

### `web/src/api/auth.ts`

See LoginPage spec above. All functions use `credentials: 'include'`. `getMe()` returns `null` (not throws) on 401.

### `web/src/api/bankruptcy.ts`

```ts
// Bankruptcy listings
getBankruptcyListings(params: {
  q?: string
  status?: 'active' | 'completed' | 'cancelled'
  page?: number
  limit?: number
  locale?: string
}): Promise<PayloadList<BankruptcyListing>>

// BankruptcyListing type:
// { id, case_no, debtor, court: { id, name }, administrator: { id, name },
//   deadline (ISO date string), status, createdAt }

// Administrators
getBankruptcyAdministrators(params: {
  q?: string
  page?: number
  locale?: string
}): Promise<PayloadList<BankruptcyAdministrator>>

// BankruptcyAdministrator type:
// { id, name, licenceNumber, email?, phone?, assignedCases: number }
```

Query mapping:
- `q` → `where[_search][like]`
- `status` → `where[status][equals]`
- Always `sort=-deadline` for listings, `sort=name` for administrators

### `web/src/api/laws.ts`

```ts
getLaws(params?: { locale?: string }): Promise<PayloadList<Law>>
// GET /api/laws?sort=-year&limit=100&locale={locale}

// Law type:
// { id, title, type, year, pdfUrl?: string, supersededBy?: { id, title } }
// pdfUrl: access via law.pdf?.url (Payload media field)
```

### `web/src/api/galleries.ts`

```ts
getGalleries(params?: {
  type?: 'photo' | 'video' | 'audio'
  page?: number
  locale?: string
}): Promise<PayloadList<GallerySummary>>

getGallery(id: string, locale?: string): Promise<Gallery>

// GallerySummary: { id, title, type, itemCount, coverUrl? }
// Gallery: { id, title, type, items: GalleryItem[] }
// GalleryItem: { id, caption?, media?: { url, alt }, videoUrl? }
```

Query: `type` → `where[type][equals]`; always `sort=-updatedAt`

### `web/src/api/pages.ts`

```ts
getPage(slug: string, locale?: string): Promise<CMSPage | null>
// GET /api/pages?where[slug][equals]={slug}&locale={locale}&limit=1
// Returns first result or null if docs array is empty or 404

// CMSPage: { id, title, content (Lexical JSON root), metaTitle?, metaDescription? }
```

---

## i18n — Complete `hr/common.json` and `en/common.json`

Add ALL keys below to both `web/src/i18n/locales/hr/common.json` and `web/src/i18n/locales/en/common.json`.

Do NOT modify the legacy flat files `web/src/i18n/locales/hr.json` / `en.json`. Use the `locales/*/common.json` files (see Gotcha G-11).

### Keys to add to `hr/common.json`:

```json
{
  "bankruptcy": {
    "title": "WEB Stečaj®",
    "subtitle": "Pretraživanje stečajnih postupaka, upravitelja i propisa",
    "noListings": "Nema stečajnih oglasa",
    "noAdministrators": "Nema stečajnih upravitelja",
    "noLaws": "Nema zakona",
    "latestListings": "Najnoviji oglasi",
    "viewAll": "Prikaži sve",
    "caseNo": "Broj predmeta",
    "debtor": "Dužnik",
    "administrator": "Upravitelj",
    "deadline": "Rok",
    "overdue": "Prošao rok",
    "status": {
      "active": "Aktivno",
      "completed": "Završeno",
      "cancelled": "Otkazano",
      "all": "Svi statusi"
    },
    "licenceNo": "Broj licence"
  },
  "laws": {
    "amended": "Izmijenjeno",
    "pdfDownload": "Preuzmi PDF",
    "noLaws": "Nema zakona"
  },
  "jurisdiction": {
    "title": "Pretraživač nadležnosti",
    "subtitle": "Kliknite na područje na karti kako biste pronašli nadležni sud",
    "noCourtData": "Za ovo područje nema podataka o nadležnom sudu",
    "responsibleCourt": "Nadležni sud",
    "viewCourt": "Prikaži sud"
  },
  "calculator": {
    "title": "Kalkulator sudskih pristojbi",
    "subtitle": "Izračunajte visinu sudske pristojbe za vaš predmet",
    "claimValue": "Vrijednost spora (EUR)",
    "procedureType": "Vrsta postupka",
    "instanceType": "Stupanj suda",
    "procedure": {
      "civil": "Parnični",
      "commercial": "Trgovački",
      "administrative": "Upravni",
      "misdemeanour": "Prekršajni"
    },
    "instance": {
      "first": "Prvostupanjski",
      "appeal": "Žalbeni",
      "cassation": "Kasacijski"
    },
    "result": "Iznos pristojbe",
    "instructions": "Unesite vrijednost spora i odaberite vrstu postupka za izračun pristojbe.",
    "disclaimer": "Napomena: Ovo je informativni izračun. Za točan iznos obratite se nadležnom sudu."
  },
  "legalAid": {
    "title": "Besplatna pravna pomoć",
    "loading": "Učitavanje sadržaja..."
  },
  "news": {
    "title": "Vijesti",
    "noResults": "Nema vijesti",
    "allCategories": "Sve kategorije",
    "readMore": "Čitaj više",
    "publishedOn": "Objavljeno"
  },
  "galleries": {
    "title": "Galerije",
    "noResults": "Nema galerija",
    "tab": {
      "all": "Sve",
      "photo": "Foto",
      "video": "Video",
      "audio": "Audio"
    },
    "items": "materijala"
  },
  "about": {
    "title": "O nama",
    "fundersTitle": "Donatori i suradnici"
  },
  "contact": {
    "title": "Kontakt",
    "name": "Ime i prezime",
    "email": "E-mail adresa",
    "subject": "Predmet",
    "message": "Poruka",
    "send": "Pošalji poruku",
    "success": "Vaša poruka je poslana. Hvala!",
    "error": "Greška pri slanju poruke. Pokušajte ponovo.",
    "subject": {
      "suggestion": "Prijedlog",
      "criticism": "Kritika",
      "collaboration": "Suradnja",
      "media": "Mediji",
      "other": "Ostalo"
    }
  },
  "donation": {
    "title": "Donirajte",
    "description": "Sudačka Mreža je neprofitna organizacija. Vaša donacija pomaže nam u razvoju i održavanju ove platforme.",
    "contactPrompt": "Za informacije o doniranju obratite nam se putem"
  },
  "auth": {
    "loginTitle": "Prijava",
    "email": "E-mail",
    "password": "Lozinka",
    "loginButton": "Prijavi se",
    "invalidCredentials": "Pogrešan e-mail ili lozinka.",
    "loginError": "Greška pri prijavi. Pokušajte ponovo.",
    "noAccount": "Nemate račun?",
    "registerLink": "Registrirajte se"
  },
  "members": {
    "title": "Članski prostor",
    "welcome": "Dobrodošli, {{name}}",
    "savedDecisions": "Spremljene odluke",
    "noSavedDecisions": "Nemate spremljenih odluka.",
    "profile": "Profil",
    "role": "Uloga",
    "logout": "Odjava"
  }
}
```

### Keys to add to `en/common.json`:

Provide exact English equivalents. Key structural rules:
- `bankruptcy.status.active` → "Active"
- `calculator.procedure.civil` → "Civil"
- `calculator.instance.first` → "First instance"
- `auth.invalidCredentials` → "Invalid email or password."
- `members.welcome` → "Welcome, {{name}}" (same interpolation syntax)
- All other keys follow direct translation

---

## Test Requirements

**Coverage target:** ≥ 80% line coverage for all new/modified files.

**Framework:** Vitest + @testing-library/react. No `msw`. Mock fetch with `vi.stubGlobal('fetch', vi.fn())`.

**Page test pattern:**
```tsx
// Every page test must:
// 1. Wrap in MemoryRouter with the /:lang route
// 2. Wrap in AuthProvider (or mock useAuth)
// 3. Mock API modules with vi.mock('@/api/bankruptcy', () => ({ getBankruptcyListings: vi.fn() }))
// 4. Test: initial render (Skeleton/loading state), success render, error render, URL param pre-fill

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

function renderWithRouter(ui: React.ReactElement, { initialEntries = ['/hr/stecaj'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/:lang/stecaj" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}
```

**AuthContext tests:**
- `getMe` called on mount
- `login()` calls `auth.login()` and updates `user` state
- `logout()` calls `auth.logout()` and sets `user = null`
- Mock `auth.getMe` to return `null` → `user` is null; mock to return user object → `user` is populated

**ProtectedRoute tests:**
- `user = null, loading = false` → renders `<Navigate>`
- `user = {...}, loading = false` → renders children
- `loading = true` → renders Skeleton (no redirect)

**CalculatorPage / courtFees.ts tests:**
- `calculateCourtFee(200, 'civil', 'first')` → 200 (flat, below 3000 HRK threshold ≈ €398)
- `calculateCourtFee(1000, 'civil', 'appeal')` → first-instance-fee × 1.5
- `calculateCourtFee(100000, 'civil', 'first')` → 5000 (capped at max)

---

## Gotchas & Constraints

| # | Rule |
|---|------|
| G-01 | **Leaflet SSR crash** — Never top-level import `react-leaflet` or `leaflet` in a file that gets included in the main bundle. `JurisdictionFinderPage.tsx` must `lazy()` import a child component that does the actual Leaflet imports. The child file imports `'leaflet/dist/leaflet.css'` at its top — this is fine because the child is lazy. |
| G-02 | **Leaflet default marker icon** — Vite breaks Leaflet's default marker icon paths. Add the `L.Icon.Default.mergeOptions(...)` fix at the top of the Leaflet component file. Without this, markers will be invisible (broken image). |
| G-03 | **HttpOnly cookie** — You cannot read `payload-token` from `document.cookie` in JS. Don't try. The only way to know if a user is logged in is to call `GET /api/users/me` with `credentials: 'include'`. |
| G-04 | **Auth loading flicker** — `AuthContext` calls `getMe()` on mount. Until that resolves, `loading = true`. `ProtectedRoute` must show a Skeleton (not redirect) while loading — otherwise an authenticated user will briefly be redirected to login and back, causing a flash. |
| G-05 | **`getMe()` returns null on 401** — Do NOT throw on a 401 from `/api/users/me`. Return `null`. A 401 simply means "not logged in" — it's expected for unauthenticated users. |
| G-06 | **Payload bracket notation** — Payload REST query params use literal bracket strings: `where[_search][like]`, `where[status][equals]`. Use `URLSearchParams` with string keys: `params.set('where[status][equals]', 'active')`. |
| G-07 | **GeoJSON lazy load** — The `croatia-jurisdictions.geojson` file belongs in `web/public/data/` (served as a static asset), NOT imported via `import`. Fetch it at runtime inside `JurisdictionMap.tsx` via `fetch('/data/croatia-jurisdictions.geojson')`. This keeps it out of the JS bundle. |
| G-08 | **Laws page: supersededBy is a relationship** — Payload may return `supersededBy` as a full object `{ id, title }` or just an ID string depending on `depth` param. Fetch with `?depth=1` to ensure you get the object. |
| G-09 | **Contact form: custom endpoint** — `POST /api/contact` is a Payload custom endpoint that may not be implemented yet. Handle gracefully: if the endpoint returns 404, show the error alert. Don't throw. |
| G-10 | **DonationPage requires a router.tsx change** — The page file alone won't work. You MUST add the import and route to `router.tsx`. Verify the route exists by checking the router before running tests. |
| G-11 | **i18n namespacing** — The new keys use nested objects (`bankruptcy.title`, not a flat `bankruptcyTitle`). Verify `useTranslation()` is called with the `'common'` namespace and `t` uses dot notation: `t('bankruptcy.title')`. If your i18n config uses flat keys, choose one style and be consistent — flat is fine, just document it. |
| G-12 | **No `any` types** — `tsc --noEmit` must pass with zero errors. For Leaflet's `onEachFeature` callback typing, use `import type { Layer, PathOptions } from 'leaflet'` to get proper types. |
| G-13 | **Mock Response in tests** — No `msw` installed. Mock fetch like this: `(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response(JSON.stringify(data), { status: 200 }))`. Set `Content-Type` if your `apiFetch` reads it. |
| G-14 | **YouTube embed transform** — `https://youtube.com/watch?v=XYZ` → `https://youtube.com/embed/XYZ`. Use `URL` API, not string replace, to handle all URL variants robustly. |
| G-15 | **Calculator formula isolation** — The calculator logic MUST live in `utils/courtFees.ts` as a pure function. Do not embed business logic in the React component — it becomes untestable and violates the test coverage requirement. |

---

## Definition of Done

- [ ] All files listed in "Files to CREATE" exist and are non-empty
- [ ] All stub pages in "Files to REPLACE" are fully implemented
- [ ] `router.tsx` includes the `doniraj` route and `ProtectedRoute` wrapper on `clanovi`
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `eslint` passes with zero errors
- [ ] `vitest run` passes — zero test failures
- [ ] `vitest run --coverage` reports ≥ 80% line coverage across all new/modified files
- [ ] `utils/courtFees.ts` has ≥ 90% branch coverage (every fee bracket tested)
- [ ] Playwright screenshots taken at 1440px and 375px for: BankruptcyPage, BankruptcyListingsPage, JurisdictionFinderPage (map visible), CalculatorPage (result visible), LoginPage, MembersPage
- [ ] No hardcoded hex or RGB colour values anywhere in new components
- [ ] No bare string literals in JSX — every user-visible string uses `t()`
- [ ] All new translation keys present in both `hr/common.json` AND `en/common.json`
- [ ] `AuthContext` wraps the application in `App.tsx` or `main.tsx`
- [ ] Sprint handoff written to `memory/handoffs/2026-03-21-sprint5-6-feature-pages.md`

---

*Brief authored by gigforge-engineer · GF-GFWEB-002 · 2026-03-21*
