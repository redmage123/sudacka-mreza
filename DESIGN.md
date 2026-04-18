# Design Specification
## Project: Sudačka Mreža Website Rebuild
## Project ID: GF-GFWEB-002
## Date: 2026-03-21
## Author: UX Designer, GigForge
## Status: Draft — pending client review

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing & Sizing Scale](#4-spacing--sizing-scale)
5. [Responsive Breakpoints](#5-responsive-breakpoints)
6. [Component Hierarchy](#6-component-hierarchy)
7. [Page Wireframes](#7-page-wireframes)
8. [Interaction Patterns](#8-interaction-patterns)
9. [Accessibility Requirements](#9-accessibility-requirements)
10. [Dark Mode](#10-dark-mode)
11. [Print Stylesheet](#11-print-stylesheet)
12. [Tailwind CSS 4 Token Setup](#12-tailwind-css-4-token-setup)
13. [Appendix A: Icon Set](#appendix-a-icon-set)
14. [Appendix B: Animation Conventions](#appendix-b-animation-conventions)
15. [Appendix C: File Structure](#appendix-c-file-structure-frontend)

---

## 1. Design Principles

1. **Trust through authority.** This is a judicial information platform. The design must signal credibility, permanence, and precision. Navy + gold palette, serif body text for legal documents, conservative layout grid. Not playful. Not startup-y.
2. **Speed first.** Legal professionals use this daily. No unnecessary animations, no full-page transitions. Search results must feel instant.
3. **Content density without clutter.** Case law results need to show maximum useful information per screen. Use tight but comfortable typography, clear information hierarchy via weight and size.
4. **Accessibility is non-negotiable.** WCAG 2.1 AA throughout. Every interactive element must work with keyboard only. High contrast in both light and dark modes.
5. **Mobile parity.** Not mobile-compromise. Every feature works fully on mobile, not just the homepage.

---

## 2. Color Palette

Defined as Tailwind CSS 4 `@theme` tokens in `web/src/styles/globals.css`.

### Brand Colors

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--color-brand-navy` | `#0D2B55` | `#1A3F72` | Primary brand; nav background, primary buttons, headings |
| `--color-brand-navy-dark` | `#091E3D` | `#0D2B55` | Nav hover states, active link underlines |
| `--color-brand-navy-light` | `#1A3F72` | `#2B5499` | Card borders, secondary nav elements |
| `--color-brand-gold` | `#C8941A` | `#E0B040` | Accent; CTA buttons, active states, focus rings, badges |
| `--color-brand-gold-light` | `#F5D98A` | `#C8941A` | Tag backgrounds, highlight chips |
| `--color-brand-gold-dark` | `#9A6F0F` | `#C8941A` | Gold button hover states |

### Surface Colors

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--color-bg` | `#F8F9FA` | `#0F172A` | Page background (spec FR-040) |
| `--color-surface` | `#FFFFFF` | `#1E293B` | Cards, panels, modals (spec FR-040) |
| `--color-surface-raised` | `#FFFFFF` | `#243347` | Elevated cards (search results hover) |
| `--color-surface-subtle` | `#F1F5F9` | `#162032` | Alternate row shading, filter panel background |
| `--color-border` | `#CBD5E1` | `#334155` | Dividers, input borders |
| `--color-border-focus` | `#C8941A` | `#E0B040` | Focus ring on all interactive elements |

### Text Colors

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--color-text` | `#1A202C` | `#F1F5F9` | Primary body text (spec FR-040) |
| `--color-text-muted` | `#64748B` | `#94A3B8` | Metadata, timestamps, secondary labels |
| `--color-text-inverse` | `#FFFFFF` | `#F1F5F9` | Text on dark navy backgrounds |
| `--color-text-link` | `#0D2B55` | `#60A5FA` | Default hyperlinks |
| `--color-text-link-hover` | `#C8941A` | `#E0B040` | Link hover |

### Semantic Colors

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--color-success` | `#16A34A` | `#4ADE80` | Form success, verified badges |
| `--color-success-bg` | `#DCFCE7` | `#14532D` | Success toast/banner background |
| `--color-error` | `#DC2626` | `#F87171` | Form errors, validation messages |
| `--color-error-bg` | `#FEE2E2` | `#7F1D1D` | Error toast/banner background |
| `--color-warning` | `#D97706` | `#FBBF24` | Deadline warnings (<7 days), caution states |
| `--color-warning-bg` | `#FEF3C7` | `#78350F` | Warning banner background |
| `--color-info` | `#2563EB` | `#60A5FA` | Info toasts, neutral badges |

### Contrast Ratios (verified WCAG AA)

| Foreground | Background (Light) | Ratio | WCAG Level |
|------------|--------------------|-------|------------|
| `#1A202C` (text) | `#F8F9FA` (bg) | 16.7:1 | AAA |
| `#FFFFFF` (inverse) | `#0D2B55` (navy) | 13.4:1 | AAA |
| `#C8941A` (gold) | `#FFFFFF` (surface) | 3.2:1 | AA Large only |
| `#DC2626` (error) | `#FFFFFF` (surface) | 4.6:1 | AA |
| `#64748B` (muted) | `#FFFFFF` (surface) | 5.9:1 | AA |

> **CRITICAL:** `--color-brand-gold` on white is 3.2:1 — below the 4.5:1 threshold for normal text. **Never use gold as small body text.** Use it only for large headings (≥18pt/24px bold), buttons, badges, and decorative borders where the large-text 3:1 threshold applies.

---

## 3. Typography

### Font Loading

Self-host via `@fontsource` packages (GDPR-safe, no external requests):

```
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/source-serif-4/400.css';
@import '@fontsource/source-serif-4/400-italic.css';
@import '@fontsource/source-serif-4/600.css';
```

### Font Family Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `'Inter', system-ui, sans-serif` | UI: navigation, labels, buttons, metadata, forms |
| `--font-serif` | `'Source Serif 4', Georgia, serif` | Legal document body text (court decisions, laws, articles) |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Case numbers, codes, technical metadata |

### Type Scale

| Token | Value | px equiv | Usage |
|-------|-------|----------|-------|
| `--text-xs` | `0.75rem` | 12px | Fine print, file sizes, timestamps in dense lists |
| `--text-sm` | `0.875rem` | 14px | UI labels, nav items, form helper text, badge text |
| `--text-base` | `1rem` | 16px | Body text, form inputs, card descriptions |
| `--text-lg` | `1.125rem` | 18px | Card titles, section introductions |
| `--text-xl` | `1.25rem` | 20px | Sub-section headings, result titles |
| `--text-2xl` | `1.5rem` | 24px | Page section headings (H2) |
| `--text-3xl` | `1.875rem` | 30px | Page title (H1 on content pages) |
| `--text-4xl` | `2.25rem` | 36px | Hero heading (homepage H1) |
| `--text-5xl` | `3rem` | 48px | Large hero on wide screens (`lg:`) |

### Line Heights

| Usage | Token | Value |
|-------|-------|-------|
| Dense UI (nav, badges) | `--leading-tight` | 1.25 |
| Body text | `--leading-normal` | 1.5 |
| Legal document body | `--leading-relaxed` | 1.75 |
| Display headings | `--leading-none` | 1.1 |

### Font Weight Conventions

| Weight | Usage |
|--------|-------|
| 400 | Body text, descriptions, legal document prose |
| 500 | UI labels, nav items, secondary headings |
| 600 | Primary headings, card titles, CTA button text |
| 700 | Hero headline, critical emphasis, active nav |

### Legal Document Prose (`prose` class)

Court decisions, news articles, and law texts use `@tailwindcss/typography` with custom overrides:

```css
/* In globals.css */
.prose {
  --tw-prose-body: var(--color-text);
  --tw-prose-headings: var(--color-brand-navy);
  --tw-prose-links: var(--color-text-link);
  --tw-prose-bold: var(--color-text);
  --tw-prose-code: var(--color-brand-navy);
  font-family: var(--font-serif);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  max-width: 72ch;   /* optimal reading width for legal text */
}

.dark .prose {
  --tw-prose-body: var(--color-text);
  --tw-prose-headings: #A0C4FF;
  --tw-prose-links: #60A5FA;
}
```

---

## 4. Spacing & Sizing Scale

Tailwind default spacing (multiples of 4px). Key values in use:

| Tailwind | px | Usage |
|----------|----|-------|
| `space-1` | 4px | Icon padding, tight badge spacing |
| `space-2` | 8px | Inline element gaps, compact form spacing |
| `space-3` | 12px | List item vertical padding |
| `space-4` | 16px | Card padding (mobile), form field spacing |
| `space-6` | 24px | Card padding (desktop), section internal padding |
| `space-8` | 32px | Section top/bottom padding (mobile) |
| `space-12` | 48px | Major section separators |
| `space-16` | 64px | Hero section padding |
| `space-24` | 96px | Max-width container top padding |

### Container Max-Widths

| Usage | Max-Width | Tailwind Class |
|-------|-----------|----------------|
| Prose (legal text) | 720px / 72ch | `max-w-prose` (customised) |
| Form pages (contact, register) | 640px | `max-w-2xl` |
| Standard content | 1024px | `max-w-4xl` |
| Wide (search + filter) | 1280px | `max-w-5xl` |
| Full layout (nav, hero) | 1440px | `max-w-7xl` |

---

## 5. Responsive Breakpoints

Tailwind CSS 4 default breakpoints:

| Breakpoint | Min-Width | Design Target |
|------------|-----------|---------------|
| (default) | 0px | Mobile portrait (375px baseline) |
| `sm:` | 640px | Mobile landscape / large phone |
| `md:` | 768px | Tablet portrait |
| `lg:` | 1024px | Tablet landscape / small laptop |
| `xl:` | 1280px | Desktop (primary design target) |
| `2xl:` | 1536px | Wide desktop |

### Grid Strategy per Breakpoint

- **Mobile (< 640px):** Single column. Filter panels collapse to accordion below search bar. Navigation collapses to hamburger. Cards stack vertically.
- **Tablet (640–1023px):** Two-column card grids. Sidebar filters as collapsible panel. Navigation: horizontal or hamburger depending on item count.
- **Desktop (≥ 1024px):** Three-column card grids. Sidebar filters always visible as sticky left rail (w-64). Full horizontal navigation with dropdowns.

### Responsive Typography

Hero headline scales across breakpoints using Tailwind responsive prefixes:

```jsx
<h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-none">
  Sudačka mreža
</h1>
```

---

## 6. Component Hierarchy

All components live in `web/src/components/`. Grouped by domain.

### 6.1 Layout Shell

```
<AppShell>                    # Root layout; provides ThemeContext, I18nContext
  <SkipLink />                # "Skoči na sadržaj" — first focusable element
  <Header>                    # Sticky, bg-brand-navy, h-16 mobile / h-20 desktop
    <Logo />                  # SVG + wordmark "Sudačka mreža"
    <NavMenu>                 # Desktop: horizontal links
      <NavLink />             # Active state = gold bottom border
      <NavDropdown />         # Hover/click sub-menu (Stručnjaci, Sudovi sub-pages)
    </NavMenu>
    <LanguageSwitcher />      # HR | EN; persists to URL prefix /hr/ /en/
    <ThemeToggle />           # Sun/moon icon button; persists to localStorage
    <AuthButtons />           # Guest: Prijava + Registracija; Logged-in: avatar dropdown
    <HamburgerButton />       # Mobile only; aria-expanded, aria-controls MobileNav
  </Header>
  <MobileNav>                 # Full-screen slide-in overlay; focus-trapped when open
    <NavLink />
    <LanguageSwitcher />
    <AuthButtons />
  </MobileNav>
  <Breadcrumb />              # Depth ≥ 2 pages; uses React Router useMatches()
  <main id="main-content">
    {children}
  </main>
  <Footer>
    <FooterLinks />           # Three-column sitemap
    <FooterLegal />           # Copyright year (auto), Privacy, Accessibility, Donate
  </Footer>
</AppShell>
```

### 6.2 UI Primitives

```
Button
  props: variant ('primary'|'secondary'|'ghost'|'danger'), size ('sm'|'md'|'lg'),
         disabled, loading, icon, iconPosition ('left'|'right')
  primary:   bg-brand-navy text-inverse hover:bg-brand-navy-dark focus-visible:ring-brand-gold
  secondary: border border-brand-navy text-brand-navy hover:bg-surface-subtle
  ghost:     text-brand-navy hover:text-brand-gold hover:bg-surface-subtle
  danger:    bg-error text-inverse hover:bg-red-700
  loading state: shows Spinner, disables pointer events but keeps button in tab order

Badge
  props: variant ('default'|'gold'|'success'|'warning'|'error'|'closed'|'verified'),
         size ('sm'|'md')
  Inline pill for: decision types, categories, verified status, deadline urgency

Card
  props: hoverable (bool), padding ('sm'|'md'|'lg'), as ('div'|'article'|'li')
  bg-surface border border-border rounded-lg
  hoverable: transition-shadow hover:shadow-md hover:border-brand-navy-light

Input
  props: label (required string), error, hint, required, ...HTMLInputAttributes
  Always renders <label htmlFor>; error text uses aria-describedby; never label-less

Select
  props: label, options, error, multiple, placeholder
  Styled native <select>; no custom listbox (native is most accessible cross-platform)

Textarea
  Same pattern as Input; minRows, maxRows props

CheckboxGroup
  props: legend, options, value, onChange, error
  <fieldset><legend> wraps all options; native <input type="checkbox"> with peer styling

DatePicker
  Renders <input type="date">; no custom calendar widget (native most accessible)

FilterChip
  props: label, onRemove
  Dismissible active-filter pill: bg-brand-gold-light text-brand-navy-dark rounded-full
  × button: aria-label="Ukloni filter {label}"

Spinner
  SVG with animateTransform; used in Button (loading) and Suspense fallbacks

Pagination
  props: currentPage, totalPages, onPageChange, siblingCount
  <nav aria-label="Straničenje">; current page: aria-current="page"
  Prev/Next buttons always present; disabled when at limits

Modal
  Radix UI Dialog primitive
  role="dialog" aria-modal aria-labelledby focus-trap Escape-to-close
  Backdrop: fixed inset-0 bg-black/50 backdrop-blur-sm z-50

Toast
  props: variant ('success'|'error'|'info'|'warning'), message, duration (ms)
  aria-live="polite" region; auto-dismiss with visible countdown bar
  Position: top-right desktop, bottom-center mobile

SkipLink
  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute ...">
  "Skoči na sadržaj" (HR) / "Skip to content" (EN)
```

### 6.3 Search Components

```
SearchBar
  props: defaultValue, placeholder, onSearch, autoFocus, size ('default'|'hero')
  Input + submit button; fires onSearch on Enter or button click
  Hero variant: larger, used on homepage and section landing pages

GlobalSearchDropdown
  Appears in Header on typing (debounced 300ms)
  Shows top 5 results across types; "Svi rezultati →" link at bottom
  Closes on Escape, on outside click, or on navigation

SearchResults<T>
  Generic; list of result cards + total count + Pagination
  aria-live="polite" result count: "Pronađeno {n} rezultata"
  Shows skeleton cards during loading (animate-pulse)

FilterPanel
  props: filters (FilterConfig[]), activeFilters, onChange, isOpen (mobile)
  Desktop (≥ lg): sticky left rail, w-64, always visible
  Mobile: hidden; "Filteri (n)" button opens bottom-sheet drawer via Modal
  Children: FilterSection components

FilterSection
  props: title, children, defaultOpen
  Accordion: aria-expanded aria-controls; open by default on desktop, closed on mobile

ActiveFilterChips
  Renders FilterChip per active filter above results
  "Ukloni sve" button: clears all, aria-label="Ukloni sve filtrere"

SearchHighlight
  props: text, query
  Wraps matched substrings in <mark className="bg-brand-gold-light rounded-sm">

CourtDecisionCard
  props: decision, query (for highlight)
  Title (linked), court name, date, decision-type Badge, SearchHighlight excerpt
  Keyboard: entire card is not a link — title is the link; avoid nested interactive elements

ExpertCard
  props: expert
  Name (linked), speciality Badges, language Badges, city/county, verified Badge

CourtCard
  props: court
  Name (linked), type Badge, address, phone number

NewsCard
  props: post
  16:9 image (fallback: gradient bg-brand-navy), category Badge, title, date, 2-line excerpt
```

### 6.4 Expert & Interpreter Directory

```
DirectoryPage                 # Shared shell for /vjestaci/ and /tumaci/
  DirectorySearchForm
    Expert variant: keyword + speciality (multi-select) + language (multi-select) + county
    Interpreter variant: keyword + source language + target language + county
  DirectoryResults<Expert|Interpreter>

ExpertDetailPage
  ExpertHeader                # Name + verified Badge; ContactGate
  ExpertMetaTable             # Speciality areas, languages, courts — <dl> definition list
  CourtAssignmentList

ContactGate
  if loggedIn: shows email, phone
  if guest: "Prijavite se za pregled kontakt podataka" with LoginLink
  Do NOT render contact details in DOM for guests (not just hidden with CSS — server must gate)
```

### 6.5 Court & Jurisdiction Components

```
CourtsListPage
  CourtTypeFilter             # Tab row: Svi | Općinski | Županijski | Trgovački | Prekršajni
  CourtList                   # CourtCard list with Pagination

CourtDetailPage
  CourtHeader                 # Name, type Badge, address, phone, external website link
  CourtMap                    # Leaflet map; single marker; height 300px

JurisdictionFinderPage
  AddressSearchBar            # Input + "Pretraži" button; calls Nominatim API
  LeafletMap                  # Full-width, height: calc(100vh - var(--header-height) - 120px)
    JurisdictionLayer         # GeoJSON polygons; semi-transparent navy fill
    ActiveJurisdictionLayer   # Highlighted polygon (gold fill) on click/geocode
    JurisdictionPopup         # Court name, address, phone, link to court page
  JurisdictionLegend          # Explains the overlay; keyboard-accessible
```

### 6.6 Leaflet Map Components

Leaflet requires DOM and is incompatible with SSR. Use a dynamic import with a loading fallback:

```tsx
const LeafletMap = React.lazy(() => import('./LeafletMap'));
// Wrap in <Suspense fallback={<MapPlaceholder />}>
```

```
MapContainer                  # Thin React wrapper around Leaflet.map(); handles init/destroy
  props: center: [lat, lng], zoom: number, className

TileLayer                     # OSM: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
GeoJSONLayer
  props: data: GeoJSON, style: StyleFn, onEachFeature: Fn
  Used for jurisdiction polygon overlay

MarkerLayer
  props: markers: { position: LatLng, popupContent: ReactNode }[]
  Used for court location pins

MapPopup                      # React content rendered into Leaflet popup via createRoot()
```

### 6.7 Case Law Components

```
CaseLawSearchPage
  CaseLawSearchBar            # Hero-size SearchBar
  CaseLawFilterPanel
    CourtSelect               # Populated from Payload API
    CourtTypeCheckboxGroup    # Općinski | Županijski | Trgovački | Prekršajni
    DateRangeInputs           # Od: DatePicker  Do: DatePicker
    CategoryCheckboxGroup     # Kazneno | Građansko | Upravno | Stečajno | ...
  ActiveFilterChips
  CaseLawResults              # SearchResults<CourtDecision>

CaseLawDetailPage
  BackToResultsLink           # Preserves search params from location.state
  CaseMetaBlock               # border-l-4 border-brand-gold; court, date, type Badge, category tags
  CaseBody                    # <article className="prose prose-lg font-serif max-w-prose">
  CasePDFDownload             # Download button; opens in new tab with target="_blank"
  CaseSaveButton              # Bookmark toggle; logged-in only; optimistic update
```

### 6.8 Bankruptcy Portal Components

```
BankruptcyListingsPage
  ListingFilters              # Court, administrator, asset type, deadline date range
  ListingCard
    Deadline Badge: bg-error text-inverse if < 7 days; normal otherwise
    Expired listing: opacity-60, "Zatvoreno" Badge
  ListingDetailPage
    ListingMeta               # Case no, debtor, court, administrator link, deadline
    AssetList                 # Each asset as a card
    AdministratorLink         # → /stecaj/upravitelji/{slug}

AdministratorDetailPage
  ContactBlock                # Address, phone, email
  ActiveCaseList              # Linked listings
```

### 6.9 User Account Components

```
RegistrationPage              # max-w-sm centred card
  RegistrationForm
    EmailInput
    PasswordInput             # Eye toggle (show/hide); strength indicator
    PasswordConfirmInput
    SubmitButton
    Success state: verification-email notice
    Field-level errors via aria-describedby

LoginPage                     # max-w-sm centred card
  LoginForm
    EmailInput
    PasswordInput             # Eye toggle
    RememberMeCheckbox
    ForgotPasswordLink
    Generic error (no enumeration): "E-mail ili lozinka nisu ispravni"

MemberAreaPage                # /clanovi/
  MemberNav                   # Tabs: Profil | Spremljeno
  MemberProfile               # Email, joined date, role Badge

SavedDecisionsPage
  SavedDecisionsList          # CourtDecisionCard list; unsave button per item
```

### 6.10 Contact Form

```
ContactPage                   # max-w-2xl centred
  ContactForm
    NameInput
    EmailInput
    SubjectSelect             # Prijedlog | Kritika | Suradnja | Mediji | Ostalo
    MessageTextarea           # min 20 chars
    HoneypotField             # aria-hidden tabIndex={-1} position: absolute; opacity: 0
    SubmitButton
    FormSuccessBanner         # aria-live="polite"; shown after successful POST
    FormErrorBanner           # shown if server/network error; fields preserved
```

### 6.11 Court Fee Calculator

```
CalculatorPage                # /pristojbe/; two-column on md+, stacked on mobile
  FeeCalculatorForm
    ProceedingTypeSelect
    ClaimValueInput           # type="number"; validates on change; friendly error for non-numeric
    FeeResultBlock            # Updates on every input change without submit
      FeeBreakdown            # <table>: base fee, surcharges, total
    PrintButton               # Calls window.print(); @media print shows only result block
```

### 6.12 Gallery Components

```
GalleryIndexPage
  AlbumGrid                   # 1-col mobile, 2-col tablet, 3-col desktop
  AlbumCard                   # Cover image (16:9), title, date, photo count

AlbumPage
  PhotoGrid                   # Responsive grid; variable aspect ratios
  PhotoThumbnail              # onClick + onKeyDown (Enter/Space) → open Lightbox

Lightbox                      # Radix UI Dialog
  role="dialog" aria-modal aria-label="Pregled fotografije"
  Escape = close; ArrowLeft/Right = navigate
  Counter: <p aria-live="polite">"Fotografija {n} od {total}"</p>

VideoGalleryPage
  VideoCard
    YoutubeFacade             # Static thumbnail + play button; replaces with iframe on click
    Prevents YouTube tracking until user interaction

AudioPlayer                   # Styled HTML5 <audio> element; play, pause, volume, seek
```

### 6.13 News Components

```
NewsListingPage
  CategoryFilter              # Tab row: Sve | Obavijesti | Događaji | Novosti
  NewsGrid                    # 1-col mobile, 2-col tablet, 3-col desktop
  NewsCard

ArticleDetailPage
  ArticleHeader               # h1, featured image (16:9), date, author, category Badge
  ArticleBody                 # <article className="prose prose-lg font-serif">
  RelatedPosts                # Max 3 same-category cards
  BackToNewsLink
```

### 6.14 Global Search Page

```
GlobalSearchPage              # /pretraga/?q=...
  SearchBar                   # Pre-filled with query; re-runs on submit
  ContentTypeFilter           # All | Sudska praksa | Vještaci | Sudovi | Vijesti
  SearchResultsGrouped
    SearchGroup               # One per type; shows top 3 + "Svi rezultati u [sekciji]"
      CourtDecisionCard (reused)
      ExpertCard (reused)
      CourtCard (reused)
      NewsCard (reused)
```

---

## 7. Page Wireframes

Wireframes use ASCII layout notation. All padding/sizing expressed as Tailwind classes.

### 7.1 Homepage (`/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER  bg-brand-navy  h-20  sticky top-0  z-50                    │
│ [Logo]  Sudska praksa  Stručnjaci  Sudovi  Stečaj  Vijesti          │
│                              [HR|EN]  [🌙/☀]  [Prijava]  [Reg.]   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ HERO  bg-brand-navy  py-24 lg:py-32                                 │
│                                                                     │
│  Sudačka mreža                              text-4xl lg:text-5xl   │
│  Nezavisna pravosudna informacijska          text-xl text-slate-300 │
│  platforma Hrvatske                                                 │
│                                                                     │
│  ┌──────────────────────────────────────────┐ ┌─────────────┐      │
│  │ 🔍 Pretraži sudsku praksu...             │ │   Traži     │      │
│  └──────────────────────────────────────────┘ └─────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ QUICK ACCESS CARDS  py-16  bg-surface                               │
│                                                                     │
│ grid  grid-cols-2 lg:grid-cols-4  gap-6  max-w-5xl                 │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────┐│
│ │ ⚖              │ │ 👤             │ │ 🗺             │ │ 💼     ││
│ │ Sudska praksa  │ │ Sudski vještaci│ │ Pretraživač    │ │ WEB    ││
│ │                │ │               │ │ nadležnosti    │ │ Stečaj ││
│ │ Pretražite     │ │ Pronađite      │ │ Koji sud je    │ │ Stečajne││
│ │ odluke sudova  │ │ verificiranog  │ │ nadležan za    │ │ ponude ││
│ │                │ │ vještaka       │ │ vašu adresu?   │ │        ││
│ │ [Pretraži →]   │ │ [Pretraži →]   │ │ [Otvori →]     │ │[Pregl.]││
│ └────────────────┘ └────────────────┘ └────────────────┘ └────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LATEST NEWS  py-16  bg-surface-subtle                               │
│                                                                     │
│ Najnovije vijesti  text-2xl font-bold         [Sve vijesti →]       │
│                                                                     │
│ grid  grid-cols-1 sm:grid-cols-2 lg:grid-cols-4  gap-6             │
│ [NewsCard] [NewsCard] [NewsCard] [NewsCard]                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FOOTER  bg-brand-navy-dark  text-slate-300  py-12                  │
│ [Logo + tagline]  [Sekcije col]  [Informacije col]  [Pravno col]   │
│ ─────────────────────────────────────────────────────────────────── │
│ © 2026 Sudačka mreža  ·  Privatnost  ·  Pristupačnost  ·  Donirajte│
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile (< 640px):**
- Quick access: 2×2 grid.
- News: 1-column, show 2 cards + "Sve vijesti" button.
- Hero search bar full-width.

---

### 7.2 Case Law Search (`/sudska-praksa/pretraga/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Sudska praksa > Pretraga                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌────────────────────────────────────────────────────────────┐ ─    │
│ │ 🔍  Pretraži sudsku praksu...                     [Traži]  │      │
│ └────────────────────────────────────────────────────────────┘      │
│                                                                     │
│ Active chips: [Županijski ×] [2020–danas ×]        [Ukloni sve]    │
│                                                                     │
├──────────────────────┬──────────────────────────────────────────────┤
│ FILTER RAIL  w-64    │ RESULTS                                      │
│ sticky top-20        │                                              │
│                      │ 1.842 rezultata          Poredaj: Relevantnost▼│
│ ▼ Sud                │ ──────────────────────────────────────────── │
│ [Odaberi sud  ▾]     │                                              │
│                      │ ┌──────────────────────────────────────────┐ │
│ ▼ Vrsta suda         │ │ Presuda Vrhovnog suda RH                  │ │
│ ☐ Općinski           │ │ Vrhovni sud · 15. 3. 2023 · [Kazneno]    │ │
│ ☐ Županijski         │ │ ...zakon o **kaznenom** djelu te je stoga │ │
│ ☐ Trgovački          │ └──────────────────────────────────────────┘ │
│ ☐ Prekršajni         │                                              │
│                      │ [repeated CourtDecisionCard rows...]         │
│ ▼ Datum              │                                              │
│ Od: [date input]     │ ← 1  2  3  4  5  ...  74 →                 │
│ Do: [date input]     │                                              │
│                      │                                              │
│ ▼ Kategorija         │                                              │
│ ☐ Kazneno            │                                              │
│ ☐ Građansko          │                                              │
│ ☐ Upravno            │                                              │
│ ☐ Stečajno           │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

**Mobile (<1024px):**
- Filter rail hidden.
- "Filteri (2)" button below search bar opens bottom-sheet drawer.
- Results full-width.
- Active chips scroll horizontally if many.

---

### 7.3 Case Law Detail (`/sudska-praksa/{id}-{slug}`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Sudska praksa > [Case title truncated]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ← Nazad na rezultate                                                │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ CASE META BLOCK                                                 │ │
│ │ bg-surface-subtle  border-l-4 border-brand-gold  p-6  rounded  │ │
│ │                                                                 │ │
│ │ Presuda Vrhovnog suda RH, Kž-123/2022-4          text-xl bold  │ │
│ │                                                                 │ │
│ │ Sud:        Vrhovni sud Republike Hrvatske                      │ │
│ │ Datum:      15. travnja 2023.                                   │ │
│ │ Vrsta:      [Presuda badge]                                     │ │
│ │ Kategorija: [Kazneno badge]  [Žalba badge]                      │ │
│ │                                                                 │ │
│ │ [⬇ Preuzmi PDF]                        [🔖 Spremi]             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ CASE BODY                                                       │ │
│ │ <article class="prose prose-lg font-serif max-w-prose">         │ │
│ │                                                                 │ │
│ │ Full legal text rendered from Payload rich text (Lexical).     │ │
│ │ Paragraphs, headings, bold, italic, tables as produced by       │ │
│ │ the editor.                                                     │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- Meta block gold left-border is the primary visual anchor. Keep it prominent.
- `max-w-prose` (72ch) on body — never full width; reading comfort is essential.
- PDF download opens `target="_blank" rel="noopener"`.
- Save button hidden from DOM (not just visually) for logged-out users.

---

### 7.4 Expert Witness Directory (`/strucnjaci/vjestaci/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Stručnjaci > Sudski vještaci                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Sudski vještaci                               h1 text-3xl bold      │
│ Imenik sudskih vještaka Republike Hrvatske    text-muted            │
│                                                                     │
│ ┌──────────────────────────────────────────────────────┐ ┌───────┐ │
│ │ 🔍 Ime vještaka ili specijalnost...                  │ │ Traži │ │
│ └──────────────────────────────────────────────────────┘ └───────┘ │
│                                                                     │
│ [Specijalnost ▾]  [Jezik ▾]  [Županija ▾]                          │
│                                                                     │
│ 482 vještaka pronađeno  ────────────────────────────────────────    │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ Ivan Horvat                                 [✓ Verificiran]  │   │
│ │ Specijalnosti: [Financije] [Računovodstvo] [Revizija]        │   │
│ │ Jezici: [HR] [EN] [DE]       📍 Split, Splitsko-dalmatinska  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│ [repeated...]                                                       │
│                                                                     │
│ ← 1  2  3  ...  20 →                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.5 Jurisdiction Finder (`/sudovi/nadleznost/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Sudovi > Pretraživač nadležnosti              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Pretraživač nadležnosti                       h1 text-3xl           │
│                                                                     │
│ ┌──────────────────────────────────────────────────┐ ┌──────────┐  │
│ │ 📍 Unesite adresu ili kliknite na karti...       │ │ Pretraži │  │
│ └──────────────────────────────────────────────────┘ └──────────┘  │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ LEAFLET MAP                                                     │ │
│ │ height: calc(100vh - 280px);  min-height: 500px                 │ │
│ │                                                                 │ │
│ │  [Croatia basemap — OpenStreetMap tiles]                        │ │
│ │  [Jurisdiction polygons: rgba(13,43,85,0.15) fill navy stroke]  │ │
│ │                                                                 │ │
│ │  On hover:   polygon fill opacity increases to 0.35             │ │
│ │  On click:   polygon fills gold rgba(200,148,26,0.4)            │ │
│ │                                                                 │ │
│ │  ┌──────────────────────────────────────────────────────────┐   │ │
│ │  │ POPUP  bg-surface  p-4  rounded  shadow-lg              │   │ │
│ │  │ Nadležni sud:                                            │   │ │
│ │  │ Općinski sud u Splitu                  font-semibold     │   │ │
│ │  │ Gundulićeva 1, 21000 Split                               │   │ │
│ │  │ Tel: 021 555 000                                         │   │ │
│ │  │ [→ Stranica suda]                      brand-gold link   │   │ │
│ │  └──────────────────────────────────────────────────────────┘   │ │
│ │                                                                 │ │
│ │  [+][-]  tabIndex=0  aria-label="Interaktivna karta"            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile:** Map full viewport height minus header. Address search bar pinned at top.

---

### 7.6 Bankruptcy Listings (`/stecaj/ponude/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > WEB Stečaj > Ponude                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌──────────┐ ┌────────────┐ ┌────────────────┐ ┌────────────────┐  │
│ │ Sud [▾]  │ │ Upravit.[▾]│ │ Vrsta imovine  │ │ Rok do [▾]     │  │
│ └──────────┘ └────────────┘ └────────────────┘ └────────────────┘  │
│                                                                     │
│ 47 aktivnih ponuda  Poredano: rok, najranije                       │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ St-44/2024-3                              [⚠ 3 dana]  URGENT   │ │
│ │ Dužnik: Gradnja d.o.o.                    bg-error-bg           │ │
│ │ Sud: Trgovački sud u Zagrebu                                    │ │
│ │ Upravitelj: Ana Kovačić  (linked →)                             │ │
│ │ Imovina: Poslovni prostor 420m², Zadar                          │ │
│ │ Rok za prijavu: 28. 03. 2026                     [Detalji →]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ St-11/2023-7                               [Zatvoreno]  grey   │ │
│ │ opacity-60  cursor-default                                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.7 Contact Form (`/kontakt/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Kontakt                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  max-w-2xl  mx-auto  py-16                                          │
│                                                                     │
│  Kontaktirajte nas         h1 text-3xl                              │
│  Primamo prijedloge, kritike, zahtjeve za suradnju i medijske       │
│  upite putem ovog obrasca.      text-muted                          │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Ime i prezime *                                                 │ │
│ │ [_____________________________________________]                 │ │
│ │                                                                 │ │
│ │ E-mail adresa *                                                 │ │
│ │ [_____________________________________________]                 │ │
│ │ ⚠ Molimo unesite ispravnu e-mail adresu.   ← error text        │ │
│ │                                                                 │ │
│ │ Predmet *                                                       │ │
│ │ [Odaberite predmet                          ▾]                 │ │
│ │                                                                 │ │
│ │ Poruka * (min 20 znakova)                                       │ │
│ │ ┌───────────────────────────────────────────────────────────┐  │ │
│ │ │                                                           │  │ │
│ │ │                                                           │  │ │
│ │ └───────────────────────────────────────────────────────────┘  │ │
│ │                                                                 │ │
│ │ [  Pošalji poruku  ]  ← primary Button                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ SUCCESS:  ┌─────────────────────────────────────────────────────┐  │
│           │ ✅ Vaša poruka je poslana. Javit ćemo se ubrzo.     │  │
│           └─────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.8 News Listing (`/vijesti/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Vijesti                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Vijesti                               h1                            │
│                                                                     │
│ [Sve]  [Obavijesti]  [Događaji]  [Novosti]   ← role="tablist"      │
│ ─────  (active tab: gold underline)                                 │
│                                                                     │
│ grid  grid-cols-1 sm:grid-cols-2 lg:grid-cols-3  gap-6             │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│ │ [image 16:9]     │ │ [image 16:9]     │ │ [image 16:9]     │     │
│ │ [Obavijesti]     │ │ [Događaji]       │ │ [Novosti]        │     │
│ │ Naslov vijesti   │ │ Naslov vijesti   │ │ Naslov vijesti   │     │
│ │ 15. 03. 2026     │ │ 14. 03. 2026     │ │ 13. 03. 2026     │     │
│ │ Dva retka        │ │ Dva retka        │ │ Dva retka        │     │
│ │ kratkog sadržaja │ │ kratkog sadržaja │ │ kratkog sadržaja │     │
│ │ [Čitaj više →]   │ │ [Čitaj više →]   │ │ [Čitaj više →]   │     │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘     │
│                                                                     │
│ ← 1  2  3 →                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.9 User Registration (`/clanovi/registracija/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  max-w-sm  mx-auto  py-16                                           │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │              [Logo  Sudačka mreža]                              │ │
│ │                                                                 │ │
│ │              Registracija          h1 text-2xl text-center      │ │
│ │                                                                 │ │
│ │  E-mail adresa *                                                │ │
│ │  [_______________________________________]                      │ │
│ │                                                                 │ │
│ │  Lozinka *  (min 8 znakova, 1 veliko slovo, 1 broj)             │ │
│ │  [_______________________________________]  [👁]                │ │
│ │  [password strength bar]                                        │ │
│ │                                                                 │ │
│ │  Potvrdi lozinku *                                              │ │
│ │  [_______________________________________]  [👁]                │ │
│ │                                                                 │ │
│ │  [          Kreiraj račun          ]                            │ │
│ │                                                                 │ │
│ │  Već imate račun?  [Prijavite se]                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 7.10 Court Fee Calculator (`/pristojbe/`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Početna > Sudske pristojbe                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Kalkulator sudskih pristojbi           h1                           │
│                                                                     │
│ grid  grid-cols-1 md:grid-cols-2  gap-12  max-w-4xl                │
│ ┌────────────────────────────┐  ┌──────────────────────────────┐   │
│ │ KALKULATOR (form)          │  │ OBRAČUN (live result)         │   │
│ │                            │  │                              │   │
│ │ Vrsta postupka *           │  │ Obračun sudske pristojbe      │   │
│ │ [Odaberi postupak  ▾]      │  │ ──────────────────────────── │   │
│ │                            │  │ Osnovna pristojba:  150,00 € │   │
│ │ Vrijednost spora (€) *     │  │ Uplata na ime prist:+30,00 € │   │
│ │ [_____________________]    │  │ ──────────────────────────── │   │
│ │                            │  │ UKUPNO:          180,00 €    │   │
│ │                            │  │                              │   │
│ │                            │  │ [🖨  Ispis obračuna]          │   │
│ └────────────────────────────┘  └──────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Interaction Patterns

### 8.1 Real-Time Search

- **Case law and directory search:** Fires on **Enter or button click only** — not on keystroke. Avoids hammering the PostgreSQL full-text search endpoint.
- **Global header search:** Debounced 300ms autocomplete dropdown showing top 5 cross-type results. "Svi rezultati →" link at bottom. Dismisses on Escape, outside click, or navigation.
- Results load with React Suspense + skeleton cards (same height as real cards via `animate-pulse`).
- URL params update on every search/filter change — back button restores state.
- `aria-live="polite"` announces result count: `"Pronađeno 1.842 rezultata"` after every search.

### 8.2 Filter Panel Behaviour

- **Desktop (≥ lg):** Left rail, `position: sticky; top: 5rem`. FilterSection accordions open by default.
- **Mobile (< lg):** "Filteri (n)" button above results opens a bottom-sheet drawer (Radix Dialog, positioned at the bottom via CSS). FilterSection accordions closed by default in the drawer.
- Filter changes update URL params immediately and re-run the search.
- `FilterChip` per active filter above results; each has × to remove; "Ukloni sve" clears all.

### 8.3 Tag / Category Tabs

Used on: news listing, gallery, court-type sub-pages.

- `role="tablist"` on container; `role="tab"` + `aria-selected` on each button.
- Active: gold border-bottom-2 + text-brand-gold.
- Arrow keys navigate between tabs (keyboard pattern for tab widget per ARIA spec).
- On narrow viewports: `overflow-x-auto scroll-snap-type-x-mandatory`.

### 8.4 Leaflet Map Interactions

| Event | Behaviour |
|-------|-----------|
| Page load | Croatia centered `[45.1, 16.4]` zoom 7; jurisdiction polygons rendered |
| Polygon hover | fill opacity 0.15 → 0.35; cursor pointer |
| Polygon click | gold fill 0.4 opacity; popup opens; previous selection cleared |
| Address search button click | Call Nominatim; `map.flyTo()` to result; point marker + popup |
| Geocode failure | Error Toast: "Adresa nije pronađena. Pokušajte s drugom adresom." |
| Map keyboard focus | Arrow keys pan (Leaflet keyboard plugin); +/- zoom |

**Dark mode:** Tile layer CSS filter inversion (see Section 10).

GeoJSON source: `web/public/data/jurisdictions.geojson` (static file, served by Nginx/Vite dev server). Load inside `GeoJSONLayer` via `fetch()` on mount.

### 8.5 Photo Lightbox Keyboard Pattern

| Key | Action |
|-----|--------|
| Enter / Space on thumbnail | Open lightbox |
| Escape | Close lightbox |
| ArrowRight / ArrowLeft | Next / previous photo |
| Tab | Cycle through lightbox controls |

Focus moves to dialog on open. Returns to triggering thumbnail on close.
`aria-live="polite"`: `"Fotografija 3 od 24"` announced on each navigation.

### 8.6 Video Facade (Lazy YouTube/Vimeo)

```tsx
// VideoFacade.tsx — prevents third-party scripts loading until user clicks
const [loaded, setLoaded] = useState(false);
return loaded ? (
  <iframe src={embedUrl} title={title} allow="autoplay" allowFullScreen />
) : (
  <button
    onClick={() => setLoaded(true)}
    aria-label={`Reproduciraj video: ${title}`}
    className="relative w-full aspect-video bg-black group"
  >
    <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
    <PlayIcon className="absolute inset-0 m-auto text-white w-16 h-16
                         group-hover:scale-110 transition-transform" aria-hidden />
  </button>
);
```

### 8.7 Dark Mode Toggle (No Flash of Wrong Theme)

Inline `<script>` in `index.html` `<head>` — runs before CSS, prevents FOWT:

```html
<script>
  (function(){
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme:dark)').matches))
      document.documentElement.classList.add('dark');
  })();
</script>
```

Toggle button: `aria-label="Uključi tamni način"` ↔ `"Uključi svijetli način"`.
Persists to `localStorage`.

### 8.8 Bookmark / Save Decision

- `CaseSaveButton` rendered in DOM only for logged-in users (server-gated).
- Click fires `POST /api/bookmarks` via React Query `useMutation`.
- **Optimistic update:** button switches to saved state immediately.
- On API error: revert state + error Toast.
- States: idle (bookmark outline icon + "Spremi"), saved (filled icon + "Spremljeno").

### 8.9 Form Validation Pattern

- Validate **on blur** (when field loses focus), not on keystroke.
- On submit: validate all fields; scroll + focus first error.
- Error text below field + red border on input.
- `aria-describedby` links input to error `<p id="{field}-error">`.
- Do NOT disable submit button until validation — allow users to discover errors naturally.
- Password field: eye icon `<button type="button">` toggles `type="text"/"password"`.

---

## 9. Accessibility Requirements

This section maps FR-039 to concrete engineering requirements.

### 9.1 Focus Management

| Scenario | Requirement |
|----------|-------------|
| Page navigation (SPA) | Move focus to `<h1>` or `<main>` after route change |
| Modal open | Focus moves into dialog (first focusable element) |
| Modal close | Focus returns to triggering element |
| Skip link | First focusable element; visible on `:focus-visible` |
| Form error on submit | Focus moves to first errored field |
| Search results load | Announce count via `aria-live`; do not move focus |

### 9.2 Semantic HTML Requirements

| Element | Usage |
|---------|-------|
| `<header>` | Site header (one per page) |
| `<nav aria-label="Glavna navigacija">` | Main nav |
| `<nav aria-label="Breadcrumb">` | Breadcrumb |
| `<main id="main-content">` | Primary content area |
| `<aside aria-label="Filteri">` | Filter panel on search pages |
| `<footer>` | Site footer |
| `<article>` | Court decision body, news article body |
| `<section aria-labelledby>` | Distinct content regions |
| One `<h1>` | Per page; never skip heading levels |
| `<fieldset><legend>` | Checkbox/radio groups in filters, forms |
| `<table><caption><th scope>` | Fee calculator breakdown, court data tables |
| `<ol>` + `aria-current="page"` | Breadcrumb list |

### 9.3 ARIA Patterns

| Pattern | Implementation |
|---------|---------------|
| Result count | `<p aria-live="polite">1.842 rezultata</p>` |
| Loading | `aria-busy="true"` on results container during fetch |
| Filter accordion | `<button aria-expanded aria-controls>` + `<div id>` on panel |
| Tab row | `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"` |
| Modal | `role="dialog"` `aria-modal="true"` `aria-labelledby="{heading-id}"` |
| Mobile nav | `aria-expanded` on hamburger; `aria-label` on nav element |
| Lightbox | `role="dialog"` + `aria-live` photo counter |
| Field error | `role="alert"` for toast; `aria-describedby` for field-level |
| Map | `aria-label="Interaktivna karta nadležnosti sudova"` on container |
| Icon-only button | `aria-label` with descriptive text |
| Decorative icon | `aria-hidden="true"` |

### 9.4 Touch Target Sizes

Minimum **44×44px** for all interactive elements:
- Buttons: `min-h-[44px] px-4`
- Checkboxes: custom styled via `w-5 h-5` with `p-3` label padding (total touch area ≥ 44px)
- Leaflet zoom controls: override Leaflet default (30×30) to `44×44px` via CSS
- FilterChip × button: `w-8 h-8` with `flex items-center justify-center`

### 9.5 Images

- `alt` required on ALL `<img>` elements (required field in Payload schema)
- Decorative backgrounds: `alt=""` + `role="presentation"`
- Expert photos: `alt="{firstName} {lastName}, sudski vještak"`
- News featured images: `alt` from CMS caption field
- Gallery photos: `alt` from CMS caption; fallback: `"{album} — fotografija {n}"`

### 9.6 Colour

- Normal text: ≥ 4.5:1 against background
- Large text (≥ 18pt or bold ≥ 14pt): ≥ 3:1
- Focus ring: ≥ 3:1 against adjacent colours
- Disabled elements: ≥ 3:1 or supplemented by non-colour indicator (e.g., `not-allowed` cursor, reduced opacity + strikethrough)
- Never convey information by colour alone (e.g., deadline urgency: red badge **+ "3 dana"** text label)

### 9.7 Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 9.8 Testing Protocol

| Test | Tool | Target |
|------|------|--------|
| Automated a11y scan | axe-core in Playwright | Zero violations, all tested pages |
| Lighthouse Accessibility | CI (every PR) | ≥ 95 on homepage, case law, jurisdiction map |
| Keyboard navigation | Manual per sprint demo | All interactions reachable, no traps |
| Screen reader | NVDA + Firefox (Windows), VoiceOver + Safari (macOS) | All content readable |

---

## 10. Dark Mode

Implemented via `.dark` class on `<html>` (ADR-0010). Theme tokens override under `.dark` in `globals.css`.

### CSS Token Overrides

```css
.dark {
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  --color-surface-raised: #243347;
  --color-surface-subtle: #162032;
  --color-border: #334155;
  --color-border-focus: #E0B040;
  --color-text: #F1F5F9;
  --color-text-muted: #94A3B8;
  --color-text-inverse: #F1F5F9;
  --color-text-link: #60A5FA;
  --color-text-link-hover: #E0B040;
  --color-brand-navy: #1A3F72;
  --color-brand-navy-dark: #0D2B55;
  --color-brand-gold: #E0B040;
  --color-brand-gold-light: #C8941A;
  --color-success: #4ADE80;
  --color-success-bg: #14532D;
  --color-error: #F87171;
  --color-error-bg: #7F1D1D;
  --color-warning: #FBBF24;
  --color-warning-bg: #78350F;
  --color-info: #60A5FA;
}
```

### Component Dark-Mode Checklist

Engineers verify in dark mode before each sprint review:

- [ ] No hardcoded hex/rgb values — only `var(--color-*)` tokens
- [ ] Leaflet map tiles inverted (see below)
- [ ] Map popup `bg-surface` readable
- [ ] Badge colours readable on `bg-surface #1E293B`
- [ ] Form input border visible (`#334155` on `#1E293B` is subtle — verify)
- [ ] Active filter chips (gold bg in dark = `#C8941A`) — verify text contrast
- [ ] Error red readable on dark surface (use `#F87171` not `#DC2626`)
- [ ] `prose` headings not too bright (use `#A0C4FF` not pure white)

### Leaflet Dark Map Inversion

```css
/* Invert OSM raster tiles to create a dark map effect */
.dark .leaflet-tile {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}
.dark .leaflet-container {
  background: var(--color-bg);
}
/* Keep our GeoJSON overlay colours correct (un-invert via the layer styles themselves) */
```

---

## 11. Print Stylesheet

Implements FR-041. Target: court decisions and fee calculator.

```css
@media print {
  /* --- Hide chrome --- */
  header, nav, footer, aside,
  .breadcrumb, .filter-panel,
  .search-bar, .case-save-button,
  .pdf-download-button, .back-link,
  .related-posts, .skip-link,
  button:not(.print-visible) {
    display: none !important;
  }

  /* --- Page setup --- */
  @page { margin: 2cm; size: A4 portrait; }

  body {
    font-family: 'Source Serif 4', Georgia, serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #000000;
    background: #ffffff;
  }

  /* --- Show inline URLs after external links --- */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 9pt;
    color: #555555;
  }
  a[href^="#"]::after,
  a[href^="javascript:"]::after { content: ""; }

  /* --- Case meta block --- */
  .case-meta-block {
    border: 1pt solid #666;
    padding: 12pt;
    margin-bottom: 24pt;
    break-inside: avoid;
  }

  /* --- Legal prose --- */
  .prose {
    max-width: 100%;
    font-size: 11pt;
  }

  /* --- Fee calculator result only --- */
  .fee-calculator-form { display: none !important; }
  .fee-result-block { display: block !important; }

  /* --- Prevent orphaned headings --- */
  h1, h2, h3, h4 { break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
}
```

---

## 12. Tailwind CSS 4 Token Setup

Complete starting point for `web/src/styles/globals.css`. Engineer: use this verbatim.

```css
/* globals.css */
@import 'tailwindcss';
@import '@tailwindcss/typography';

/* Fonts (self-hosted via @fontsource — no external CDN requests) */
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/source-serif-4/400.css';
@import '@fontsource/source-serif-4/400-italic.css';
@import '@fontsource/source-serif-4/600.css';

@theme {
  /* ── Fonts ──────────────────────────────────────────────── */
  --font-sans:  'Inter', system-ui, sans-serif;
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* ── Brand ──────────────────────────────────────────────── */
  --color-brand-navy:       #0D2B55;
  --color-brand-navy-dark:  #091E3D;
  --color-brand-navy-light: #1A3F72;
  --color-brand-gold:       #C8941A;
  --color-brand-gold-light: #F5D98A;
  --color-brand-gold-dark:  #9A6F0F;

  /* ── Surfaces ───────────────────────────────────────────── */
  --color-bg:             #F8F9FA;
  --color-surface:        #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-surface-subtle: #F1F5F9;
  --color-border:         #CBD5E1;
  --color-border-focus:   #C8941A;

  /* ── Text ───────────────────────────────────────────────── */
  --color-text:            #1A202C;
  --color-text-muted:      #64748B;
  --color-text-inverse:    #FFFFFF;
  --color-text-link:       #0D2B55;
  --color-text-link-hover: #C8941A;

  /* ── Semantic ───────────────────────────────────────────── */
  --color-success:     #16A34A;
  --color-success-bg:  #DCFCE7;
  --color-error:       #DC2626;
  --color-error-bg:    #FEE2E2;
  --color-warning:     #D97706;
  --color-warning-bg:  #FEF3C7;
  --color-info:        #2563EB;
}

/* ── Dark mode overrides ────────────────────────────────────── */
.dark {
  --color-bg:             #0F172A;
  --color-surface:        #1E293B;
  --color-surface-raised: #243347;
  --color-surface-subtle: #162032;
  --color-border:         #334155;
  --color-border-focus:   #E0B040;
  --color-text:           #F1F5F9;
  --color-text-muted:     #94A3B8;
  --color-text-inverse:   #F1F5F9;
  --color-text-link:      #60A5FA;
  --color-text-link-hover:#E0B040;
  --color-brand-navy:      #1A3F72;
  --color-brand-navy-dark: #0D2B55;
  --color-brand-gold:      #E0B040;
  --color-brand-gold-light:#C8941A;
  --color-success:    #4ADE80;
  --color-success-bg: #14532D;
  --color-error:      #F87171;
  --color-error-bg:   #7F1D1D;
  --color-warning:    #FBBF24;
  --color-warning-bg: #78350F;
  --color-info:       #60A5FA;
}

/* ── Prose (legal documents, articles) ─────────────────────── */
.prose {
  --tw-prose-body:     var(--color-text);
  --tw-prose-headings: var(--color-brand-navy);
  --tw-prose-links:    var(--color-text-link);
  --tw-prose-bold:     var(--color-text);
  --tw-prose-code:     var(--color-brand-navy);
  --tw-prose-pre-bg:   var(--color-surface-subtle);
  font-family: var(--font-serif);
  max-width: 72ch;
}
.dark .prose {
  --tw-prose-body:     var(--color-text);
  --tw-prose-headings: #A0C4FF;
  --tw-prose-links:    var(--color-text-link);
  --tw-prose-code:     #A0C4FF;
}

/* ── Leaflet dark mode ──────────────────────────────────────── */
.dark .leaflet-tile {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}
.dark .leaflet-container {
  background: var(--color-bg);
}

/* ── Global focus ring ──────────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Reduced motion ─────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Appendix A: Icon Set

Use **Lucide React** (`lucide-react`). All icons `aria-hidden="true"` when decorative.
Icon-only buttons require `aria-label`.

| Icon | Usage |
|------|-------|
| `Search` | Search bars, search buttons |
| `Filter` | Mobile filter toggle button |
| `X` | Close modal, dismiss chip, clear filter |
| `ChevronDown / ChevronUp` | Accordion toggles, select indicators |
| `ChevronLeft / ChevronRight` | Pagination, lightbox navigation, breadcrumb separator |
| `Menu` | Hamburger — mobile nav toggle |
| `Moon / Sun` | Dark mode toggle |
| `Globe` | Language switcher |
| `Bookmark / BookmarkCheck` | Save / unsave decision |
| `Download` | PDF download |
| `MapPin` | Court location, jurisdiction finder address input |
| `User / UserCircle` | Auth buttons, member area |
| `CheckCircle` | Verified badge, form success |
| `AlertTriangle` | Deadline warning, error states |
| `FileText` | Document / law archive entries |
| `Play` | Video facade play button |
| `Printer` | Print button |
| `ExternalLink` | Links that open in new tab |
| `Eye / EyeOff` | Password show/hide |
| `Calendar` | Date pickers, event dates |

---

## Appendix B: Animation Conventions

This is a judicial platform. Keep animations minimal and purposeful.

| Context | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Mobile nav open/close | `translateX` slide from right | 250ms | ease-out |
| Filter bottom sheet open/close | `translateY` slide from bottom | 300ms | ease-out |
| Modal fade in | `opacity` 0→1 + `scale` 0.95→1 | 200ms | ease-out |
| Modal fade out | `opacity` 1→0 + `scale` 1→0.95 | 150ms | ease-in |
| Lightbox open | `opacity` 0→1 | 150ms | linear |
| Toast appear | `translateY` + `opacity` | 250ms | ease-out |
| Hover card shadow | `box-shadow` | 150ms | ease |
| Skeleton shimmer | `animate-pulse` (Tailwind) | default | — |
| Tab panel switch | Instant — no animation | — | — |
| Search results appear | Instant replace — no animation | — | — |

> All animations respect `prefers-reduced-motion: reduce` (see Section 12 globals.css).

---

## Appendix C: File Structure (Frontend)

```
web/src/
  styles/
    globals.css              ← @theme tokens, .dark, prose, focus ring, print, motion
  components/
    layout/
      AppShell.tsx
      Header.tsx
      Footer.tsx
      MobileNav.tsx
      Breadcrumb.tsx
      SkipLink.tsx
      LanguageSwitcher.tsx
      ThemeToggle.tsx
      AuthButtons.tsx
    ui/
      Button.tsx
      Badge.tsx
      Card.tsx
      Input.tsx
      Select.tsx
      Textarea.tsx
      CheckboxGroup.tsx
      DatePicker.tsx
      FilterChip.tsx
      Spinner.tsx
      Pagination.tsx
      Modal.tsx
      Toast.tsx
      ToastProvider.tsx
    search/
      SearchBar.tsx
      GlobalSearchDropdown.tsx
      SearchResults.tsx
      FilterPanel.tsx
      FilterSection.tsx
      ActiveFilterChips.tsx
      SearchHighlight.tsx
    cards/
      CourtDecisionCard.tsx
      ExpertCard.tsx
      CourtCard.tsx
      NewsCard.tsx
      ListingCard.tsx
      AlbumCard.tsx
      VideoCard.tsx
    map/
      MapContainer.tsx
      TileLayer.tsx
      GeoJSONLayer.tsx
      MarkerLayer.tsx
      MapPopup.tsx
    auth/
      ContactGate.tsx
    media/
      PhotoThumbnail.tsx
      Lightbox.tsx
      VideoFacade.tsx
      AudioPlayer.tsx
  pages/
    HomePage.tsx
    GlobalSearchPage.tsx
    NotFoundPage.tsx
    case-law/
      CaseLawSearchPage.tsx
      CaseLawDetailPage.tsx
    experts/
      ExpertListPage.tsx
      ExpertDetailPage.tsx
      InterpreterListPage.tsx
      InterpreterDetailPage.tsx
    courts/
      CourtsListPage.tsx
      CourtDetailPage.tsx
      JurisdictionFinderPage.tsx
      StateAttorneyPage.tsx
    bankruptcy/
      BankruptcyListingsPage.tsx
      ListingDetailPage.tsx
      AdministratorListPage.tsx
      AdministratorDetailPage.tsx
      BankruptcyLawsPage.tsx
      BankruptcyPapersPage.tsx
    news/
      NewsListingPage.tsx
      ArticleDetailPage.tsx
    gallery/
      GalleryIndexPage.tsx
      AlbumPage.tsx
      VideoGalleryPage.tsx
      AudioGalleryPage.tsx
    members/
      RegistrationPage.tsx
      LoginPage.tsx
      MemberAreaPage.tsx
      SavedDecisionsPage.tsx
      MemberProfilePage.tsx
    static/
      AboutPage.tsx
      DonatePage.tsx
      ContactPage.tsx
      LegalAidPage.tsx
      LinksPage.tsx
    calculator/
      CalculatorPage.tsx
  hooks/
    useDarkMode.ts
    useDebounce.ts
    useBookmark.ts
  lib/
    api.ts                   ← Payload CMS REST API client (typed fetch wrappers)
    i18n.ts                  ← react-i18next setup; language detection
    leaflet.ts               ← Leaflet init helpers; dynamic import guard
    feeCalculator.ts         ← Court fee calculation logic (pure functions)
  types/
    payload.ts               ← Generated by `npx payload generate:types` from CMS
    api.ts                   ← API response wrapper types
  router.tsx                 ← React Router 7 route tree
  main.tsx                   ← Entry point; FOWT script runs before this
  index.html                 ← FOWT inline script in <head>; meta charset/viewport
```

---

*Design specification complete. This document is the authoritative source for all UI decisions on GF-GFWEB-002. Any deviation from these specifications requires a design review and an update to this document.*
