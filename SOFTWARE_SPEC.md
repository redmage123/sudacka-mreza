# Software Specification
## Project: Sudačka Mreža Website Rebuild
## Customer: drazen.komarica@gmail.com
## Date: 2026-03-21
## Project ID: GF-GFWEB-002
## Engagement: Pro-bono
## Status: Draft — Awaiting Client Review

---

## 1. Executive Summary

**Sudačka Mreža** (Judges' Network) is Croatia's primary independent judicial information platform, operating since 2001. It serves legal professionals — judges, attorneys, court experts, interpreters, and members of the public — who need access to case law, expert witness directories, court information, bankruptcy listings, and procedural tools. The organisation has received funding from the Dutch Ministry of Foreign Affairs, the Norwegian Ministry of Foreign Affairs, OSCE, the US Embassy Zagreb, the American Bar Association, and other international bodies, underscoring its importance to the Croatian justice system.

The current site runs on a 2001-era ASP.NET WebForms stack with Internet Explorer 7 compatibility headers, an 18-year-old jQuery library, broken Flash dependencies, no HTTPS, and evidence of third-party script injection. The Jurisdiction Finder has been completely non-functional on every modern browser since Adobe Flash reached end-of-life in December 2020. The site is not mobile-responsive, carries no real SEO metadata, and user credentials are transmitted in cleartext over HTTP.

This specification defines a complete rebuild: a modern, accessible, bilingual (Croatian/English) web application that preserves every feature of the current platform, fixes all critical deficiencies, and adds meaningful enhancements. The new site uses a React 19 SPA frontend served as static files, a Payload CMS 3 standalone backend for content management and REST API, PostgreSQL 16 for data storage and full-text search, and a Docker Compose deployment stack with automatic HTTPS via Caddy.

**Primary goal:** Restore the platform to a state that reflects the credibility and importance of the organisation it represents, and keep it maintainable for the next decade without vendor lock-in.

---

## 2. User Personas

### P1 — Legal Professional (Primary)
**Who:** Croatian judge, attorney, state attorney, or law clerk.
**Goals:** Find case law decisions quickly by keyword, court, or date. Look up an expert witness by speciality. Check court contact details and jurisdiction. Download laws and amendments.
**Behaviour:** Visits frequently — often 3–5 times per week. Uses desktop or work laptop. May bookmark decisions for later review. Expects fast, accurate search results. Uses the site primarily in Croatian; switches to English occasionally for international case law.
**Pain points with current site:** Broken Flash map, browser "Not Secure" warning from missing HTTPS, site completely unusable on mobile, slow full-page postbacks on every search interaction.

### P2 — Court Expert Witness or Interpreter
**Who:** Licensed court expert or certified interpreter listed in the national registry.
**Goals:** Verify that their own profile is accurate and up-to-date. Look up colleagues. See which courts they are assigned to.
**Behaviour:** Occasional visitor — checks the site when they need to verify information or research colleagues. May use mobile.
**Pain points:** Profile information can be out-of-date with no mechanism to request corrections. Site difficult to use on a phone.

### P3 — Citizen / Member of the Public
**Who:** Person involved in a legal matter, student, or journalist.
**Goals:** Understand court procedures. Find free legal aid information. Look up a court address and phone number. Search for bankruptcy listings relevant to a business dispute.
**Behaviour:** Infrequent visitor; mobile-first; may prefer English if a foreign national. Low tolerance for complexity.
**Pain points:** Current site layout is confusing on desktop, completely unusable on mobile, no meaningful English content available.

### P4 — Bankruptcy Professional
**Who:** Insolvency administrator, commercial lawyer, or creditor's representative.
**Goals:** Track active bankruptcy sales listings with deadlines. Look up administrator profiles. Find the relevant bankruptcy laws and amendments. Access bankruptcy-specific case law.
**Behaviour:** Regular visitor during active cases. Deadline sensitivity is high — overdue listings must be immediately visually distinct.
**Pain points:** Basic keyword search only; no filtering by status or deadline; site is slow and unreliable.

### P5 — CMS Editor / Content Administrator
**Who:** Dražen Komarica or a designated editor at Sudačka Mreža.
**Goals:** Publish news posts. Add new court decisions. Update expert profiles. Upload PDFs. Manage gallery items.
**Behaviour:** Uses the Payload CMS admin UI. Needs a structured, user-friendly editorial interface. Non-technical for editorial tasks.
**Pain points (current):** No structured CMS — all content requires bespoke .NET admin access or direct database manipulation.

---

## 3. Functional Requirements

### 3.1 Global Navigation & Shell

#### FR-001: Bilingual Navigation
- **Description:** Every page is available in both Croatian (HR) and English (EN). The active language is reflected in the URL path prefix (`/hr/` or `/en/`). The Header contains an HR/EN toggle visible on all pages.
- **User story:** As a legal professional, I want to switch between Croatian and English at any point on the site, so that I can access the platform in my preferred language.
- **Acceptance criteria:**
  - Language toggle is visible in the Header on every page at all screen sizes.
  - Switching language updates the URL path prefix and re-renders all translated strings without a full page reload.
  - The selected language persists across navigation within the same browser session.
  - The default language is Croatian (`hr`).
  - All navigation labels, page titles, form labels, button text, and inline error messages are translated in both languages.
  - Content that has no English translation falls back to Croatian with a visible "Translation not available" indicator shown in EN mode.
- **Priority:** Must-have

#### FR-002: Responsive Header
- **Description:** A persistent header on every page containing the Sudačka Mreža logo, main navigation links, a global search icon, a language switcher, and a login/logout button. On screens narrower than 768 px the main navigation collapses into a hamburger menu.
- **User story:** As a mobile user, I want a clean, accessible navigation menu, so that I can reach any section of the site from my phone without zooming or horizontal scrolling.
- **Acceptance criteria:**
  - Header renders correctly at 375 px, 768 px, and 1440 px viewport widths.
  - Hamburger icon appears at < 768 px; clicking it opens a full-width slide-down navigation panel.
  - Active route is visually highlighted in the navigation.
  - Tab order is logical: logo → nav links → search icon → language switch → login button.
  - Hamburger menu can be closed with the Escape key.
  - All interactive header elements have visible focus rings meeting WCAG AA contrast requirements.
- **Priority:** Must-have

#### FR-003: Persistent Footer
- **Description:** A footer on all pages containing quick-link columns, social media links, a copyright notice with the current calendar year, accessibility links, and a language switcher.
- **User story:** As a user at the bottom of a long page, I want easy access to key links and organisational information so that I don't have to scroll back to the top.
- **Acceptance criteria:**
  - Footer renders on every public page.
  - Copyright year is dynamic — it always reflects the current calendar year.
  - All footer links are keyboard-navigable.
  - Social media links open in a new tab with `rel="noopener noreferrer"`.
- **Priority:** Must-have

#### FR-004: Global Search Bar
- **Description:** A typeahead search bar accessible from the Header on every page. Queries court decisions, expert witnesses, interpreters, courts, and news simultaneously and shows grouped results in a dropdown.
- **User story:** As a legal professional, I want to type a name or keyword into a single search bar anywhere on the site, so that I can find relevant content without knowing which section it lives in.
- **Acceptance criteria:**
  - Search input is reachable via keyboard from anywhere in the header (e.g., keyboard shortcut or Tab to the search icon then Enter).
  - Queries are debounced 300 ms before firing to avoid excessive API calls.
  - Results dropdown groups hits by type: Decisions / Experts / Courts / News with a count per group.
  - A maximum of 3 items per group are shown in the dropdown; a "View all results" link at the bottom navigates to the full search results page.
  - Pressing Escape closes the dropdown.
  - Pressing Enter or clicking a result navigates to the relevant detail page.
  - The dropdown is keyboard-navigable with the Up/Down arrow keys.
  - A "No results found" message is shown (not a blank dropdown) when the query matches nothing.
  - Search passes `?locale=hr|en` to the API so results respect the active language.
- **Priority:** Must-have

#### FR-005: Dark / Light Mode
- **Description:** The site respects the user's OS-level `prefers-color-scheme` setting by default, with a manual override toggle that persists in `localStorage`.
- **User story:** As a user who prefers dark mode, I want the site to use a dark colour scheme so that I can read it comfortably in low-light environments.
- **Acceptance criteria:**
  - Dark mode uses the specified dark palette: background `#0F172A`, surface `#1E293B`, text `#F1F5F9`.
  - Manual toggle in the header overrides the OS setting.
  - Preference persists in `localStorage` and is applied on the next visit without a flash of the wrong theme.
  - All components pass WCAG AA contrast requirements in both light and dark modes.
- **Priority:** Must-have

#### FR-006: 404 Not Found Page
- **Description:** A custom 404 page is shown for any URL that does not match a defined route.
- **User story:** As a user who follows a broken or outdated link, I want a helpful error page so that I can navigate back to useful content.
- **Acceptance criteria:**
  - Custom 404 page renders for any unmatched URL.
  - Page includes a link to the homepage and a search bar.
  - Page `<title>` is "Page Not Found | Sudačka Mreža" in HR; "Page Not Found | Sudačka Mreža" in EN.
- **Priority:** Must-have

---

### 3.2 Homepage

#### FR-007: Homepage — Hero Section
- **Description:** A prominent hero section at the top of the homepage with a headline, sub-headline, and a primary call-to-action button linking to Case Law Search.
- **User story:** As a first-time visitor, I want to immediately understand the purpose of the platform and find the main feature, so that I don't have to explore to find it.
- **Acceptance criteria:**
  - Hero section is visible above the fold at 1440 px and 768 px.
  - Headline and sub-headline are translated in HR/EN.
  - CTA button links to `/sudska-praksa/pretraga/`.
  - Lighthouse Performance score ≥ 90 with hero section fully rendered.
- **Priority:** Must-have

#### FR-008: Homepage — Quick-Access Grid
- **Description:** Six card-based quick-access links to the six main sections: Case Law, Expert Witnesses, Interpreters, Courts & Jurisdiction, Bankruptcy Portal, Court Fee Calculator.
- **User story:** As a returning legal professional, I want to reach the section I need from the homepage in a single click.
- **Acceptance criteria:**
  - Six cards in a responsive grid: 3 columns at ≥ 1024 px, 2 columns at 768 px, 1 column at 375 px.
  - Each card has a descriptive icon, a translated title, and a translated brief description.
  - Each card is a clickable link to the relevant section.
  - Cards are keyboard-focusable with visible focus rings.
- **Priority:** Must-have

#### FR-009: Homepage — Latest News Strip
- **Description:** A strip showing the 5 most recently published news posts with titles, publication dates, and links.
- **User story:** As a legal professional, I want to see recent news on the homepage so that I stay informed about developments relevant to the judiciary.
- **Acceptance criteria:**
  - Displays exactly the 5 most recent published news posts.
  - Each item shows: title, publication date (locale-aware formatting: `dd.MM.yyyy` in HR, `MM/dd/yyyy` in EN), and a "Read more" link.
  - Content is fetched from the CMS API at page load.
  - A "View all news" link at the bottom navigates to `/vijesti/`.
  - Strip renders in HR and EN with translated titles.
- **Priority:** Must-have

#### FR-010: Homepage — Statistics Bar
- **Description:** A summary statistics bar showing approximate counts of database records: court decisions, expert witnesses, interpreters, and courts.
- **User story:** As a first-time visitor, I want to see the scale of the database so that I understand the value of the platform.
- **Acceptance criteria:**
  - Statistics bar shows at least four figures: number of decisions, experts, interpreters, courts.
  - Numbers are fetched from the API and formatted with locale-appropriate thousands separators (`.` in HR, `,` in EN).
  - Labels are translated HR/EN.
- **Priority:** Must-have

---

### 3.3 Case Law (Sudska Praksa)

#### FR-011: Case Law Search
- **Description:** A full-featured search page for court decisions with keyword search, court filter, date range filter, and decision type filter. Results are paginated and deep-linkable via URL query parameters.
- **User story:** As a legal professional, I want to search for court decisions by keyword and narrow results by court, date, and decision type, so that I can find the most relevant precedents for my case efficiently.
- **Acceptance criteria:**
  - Keyword search queries `full_text` and `title` fields via pg_trgm full-text search.
  - Court filter: a dropdown listing all courts in the database; supports single selection.
  - Date range: two date inputs (from / to) filtering by the `date` field; inputs accept `dd.MM.yyyy` (HR) and `MM/dd/yyyy` (EN) format.
  - Decision type filter: dropdown with options: All Types / General Decisions / High Commercial Court (VTS) / ECtHR and ECJ (ESLJP).
  - All active filter values are reflected in the URL query string (e.g., `?q=nekretnina&court=VTS&from=2020-01-01&to=2024-12-31&type=vts`).
  - Deep-linking: loading a URL with query params pre-fills all filter inputs and executes the search automatically.
  - Results list shows per item: decision title, court name, date, decision type badge, truncated excerpt (≤ 200 chars).
  - Pagination: 20 results per page with numbered pagination and prev/next controls.
  - Total result count shown (e.g., "Prikazujem 1–20 od 347 rezultata" / "Showing 1–20 of 347 results").
  - Empty state message shown when no results match the query.
  - Loading spinner shown while the API request is in flight.
- **Priority:** Must-have

#### FR-012: Case Law Detail Page
- **Description:** A full detail page for a single court decision showing all metadata, the full decision text rendered from Payload Lexical rich text, a PDF attachment download link, and a bookmark button.
- **User story:** As a legal professional, I want to read the full text of a court decision with its metadata, so that I can evaluate its relevance and cite it accurately.
- **Acceptance criteria:**
  - Renders the following metadata: title, court name, date, decision type badge, category, tags.
  - Full decision text rendered from Payload Lexical JSON using DOMPurify-sanitised HTML output.
  - Lexical renderer supports: H2–H4 headings, paragraphs, bold, italic, underline, numbered lists, bulleted lists, blockquotes, horizontal rules, hyperlinks.
  - If a PDF attachment exists, a "Download PDF" button opens it in a new tab.
  - Breadcrumb navigation: Home → Case Law → [Decision Title].
  - Share button: copies the page URL to the clipboard.
  - Bookmark button (see FR-027): shows a filled heart icon if the decision is already bookmarked; unfilled if not. Clicking toggles the saved state.
  - SEO: unique `<title>`, `<meta name="description">` (first 160 chars of plain text from the decision), and Open Graph tags populated from decision title and truncated text.
  - Bilingual: content renders in the active language if a translation exists; falls back to Croatian if not.
- **Priority:** Must-have

#### FR-013: High Commercial Court (VTS) Filtered View
- **Description:** A pre-filtered case law view showing only decisions from the High Commercial Court of the Republic of Croatia (Visoki Trgovački Sud RH).
- **User story:** As a commercial lawyer, I want a dedicated page for VTS decisions so that I can quickly access the court most relevant to my practice without manually setting filters every visit.
- **Acceptance criteria:**
  - Page at `/sudska-praksa/vts/` renders the Case Law Search UI pre-filtered to `court = VTS`.
  - The VTS court filter is visible in the filter panel so users can see it is applied; it cannot be cleared to show all courts on this page.
  - All other filters (keyword, date range, decision type) remain available.
  - Page title and breadcrumb reflect "High Commercial Court Decisions" / "Odluke Visokog Trgovačkog Suda".
- **Priority:** Must-have

#### FR-014: ECtHR / ECJ Decisions Filtered View
- **Description:** A pre-filtered case law view showing only decisions from the European Court of Human Rights (ESLJP) and European Court of Justice (ECJ).
- **User story:** As a judge or attorney dealing with EU or human rights law, I want a dedicated page for European court decisions so that I can focus on European jurisprudence.
- **Acceptance criteria:**
  - Page at `/sudska-praksa/esljp/` renders the Case Law Search UI pre-filtered to `decision_type = esljp`.
  - The ESLJP type filter is visible and fixed; all other filters remain available.
  - Page title and breadcrumb reflect "ECtHR / ECJ Decisions" / "Odluke ESLJP-a".
- **Priority:** Must-have

---

### 3.4 Expert Witnesses (Sudski Vještaci)

#### FR-015: Expert Witness Directory
- **Description:** A searchable, filterable directory of court-certified expert witnesses. Filters include keyword (name), speciality area (multi-select), and county/location.
- **User story:** As a judge or attorney, I want to find a qualified expert witness in a specific medical speciality in Zagreb County, so that I can request them for an upcoming case.
- **Acceptance criteria:**
  - Keyword search queries the `name` field.
  - Speciality filter: a multi-select dropdown populated from all speciality values in the database (e.g., Medicine, Engineering, Accounting, IT, Traffic). Multiple selected specialities are `AND`-joined.
  - County/location filter: a single-select dropdown of the 21 Croatian counties.
  - Filters update results on change without a full page reload.
  - Results list shows per item: full name, primary speciality badge, languages, verified badge (only if `verified: true`), link to profile page.
  - Pagination: 20 results per page.
  - Active filter values reflected in URL params for deep-linking.
  - Empty state message shown when no results match.
  - All labels and UI text translated HR/EN.
- **Priority:** Must-have

#### FR-016: Expert Witness Detail Page
- **Description:** A full profile page for an individual expert witness.
- **User story:** As an attorney, I want to see the full profile of an expert witness — including their specialities, languages, and contact information — so that I can decide whether to engage them.
- **Acceptance criteria:**
  - Renders: full name, all speciality areas (as badges), all languages spoken, verified status badge (if `verified: true`), contact information (email and phone shown only if present in the record), court assignments.
  - Breadcrumb: Home → Expert Witnesses → [Name].
  - Bilingual: all profile fields render in the active language.
  - SEO: unique `<title>` and `<meta description>` populated from the profile name and speciality.
- **Priority:** Must-have

---

### 3.5 Interpreters (Tumači)

#### FR-017: Interpreter Directory
- **Description:** A searchable directory of certified court interpreters, filterable by name and language pair.
- **User story:** As a court official, I want to find an interpreter for German–Croatian proceedings in Split, so that I can schedule them for an upcoming hearing.
- **Acceptance criteria:**
  - Keyword search queries the `name` field.
  - Language pair filter: a multi-select list of all language pairs in the database (e.g., English-Croatian, German-Croatian, French-Croatian).
  - Results list shows: name, all language pairs as badges, verified status.
  - Pagination: 20 results per page.
  - Active filter values reflected in URL params.
  - All labels translated HR/EN.
- **Priority:** Must-have

#### FR-018: Interpreter Detail Page
- **Description:** A full profile page for an individual interpreter.
- **User story:** As an attorney, I want to see an interpreter's full language pairs, contact details, and court assignments before requesting them.
- **Acceptance criteria:**
  - Renders: full name, all language pairs as badges, verified badge, contact details, court assignments.
  - Breadcrumb: Home → Interpreters → [Name].
  - Bilingual.
- **Priority:** Must-have

---

### 3.6 Courts & Institutions (Sudovi)

#### FR-019: Courts Directory
- **Description:** A full listing of Croatian courts organised by type (Municipal, County, Commercial, Misdemeanour) accessible via tab navigation.
- **User story:** As a citizen, I want to find the address and phone number of my local municipal court so that I can contact them about my case.
- **Acceptance criteria:**
  - Four tabs: Municipal (Općinski) / County (Županijski) / Commercial (Trgovački) / Misdemeanour (Prekršajni).
  - The active tab state is reflected in the URL: `?type=opcinski`.
  - Each court entry shows: name, address, phone, president name (if available in the record).
  - Clicking a court entry navigates to its detail page.
  - Pagination: 20 courts per tab if the collection size warrants it.
  - All labels translated HR/EN.
- **Priority:** Must-have

#### FR-020: Court Detail Page
- **Description:** A page for a single court showing full contact information, a single-pin Leaflet map at the court's coordinates, and a link to the Jurisdiction Finder.
- **User story:** As a citizen, I want to see my court on a map with its full address so that I can navigate there.
- **Acceptance criteria:**
  - Renders: full court name, court type badge, address, phone number, president name, website link (if present), county.
  - Leaflet map renders a single pin at the court's `{lat, lng}` coordinates using OpenStreetMap tiles.
  - Map has an `aria-label` attribute; it is keyboard-accessible (Tab to focus, Enter/Space to interact with the pin).
  - Breadcrumb: Home → Courts → [Court Type] → [Court Name].
  - Bilingual.
- **Priority:** Must-have

#### FR-021: Jurisdiction Finder (Interactive Leaflet Map)
- **Description:** An interactive Leaflet.js choropleth map of Croatia showing all 21 counties. Clicking a county reveals the court(s) responsible for that county's jurisdiction in a popup. This completely replaces the Flash-based widget that has been non-functional since December 2020.
- **User story:** As a citizen, I want to click on my county on the map to find out which court has jurisdiction over my area, so that I can file documents at the correct court without guessing.
- **Acceptance criteria:**
  - Map fills the page viewport at all screen sizes (no horizontal scrolling).
  - All 21 Croatian counties are represented as polygon regions sourced from GADM GeoJSON data (or client-supplied data if provided — BLK-2).
  - Hovering a county highlights it with a distinct fill colour and shows a tooltip with the county name.
  - Clicking a county opens a popup showing: county name, responsible court name, court address, and a "View Court Details" link to the CourtDetailPage.
  - Map is keyboard-accessible: Tab moves focus between counties; Enter/Space opens the popup for the focused county.
  - All popup content is translated HR/EN.
  - OpenStreetMap attribution ("© OpenStreetMap contributors") is displayed as required by the ODbL licence.
  - No Flash, no browser plugin, no third-party paid map service required.
- **Priority:** Must-have

#### FR-022: State Attorney Offices Directory
- **Description:** A sortable table listing all Croatian state attorney offices (Državna odvjetništva).
- **User story:** As a legal professional, I want to find the address and contact details of a state attorney office by jurisdiction so that I can correspond with the correct office.
- **Acceptance criteria:**
  - Table columns: Name, Jurisdiction, Address, Contact.
  - Sortable by Name (ascending/descending) and by Jurisdiction (ascending/descending).
  - Pagination: 20 entries per page.
  - All labels translated HR/EN.
- **Priority:** Must-have

---

### 3.7 Bankruptcy Portal (WEB Stečaj®)

#### FR-023: Bankruptcy Landing Page
- **Description:** A hub page for the WEB Stečaj® portal with an introduction, quick-link cards to sub-sections, and the 5 most recently updated active bankruptcy sales listings.
- **User story:** As a bankruptcy professional, I want a single entry point for all bankruptcy-related content so that I can navigate quickly to what I need.
- **Acceptance criteria:**
  - Quick-link cards present for: Sales Listings, Administrators, Laws, Expert Papers, Bankruptcy Case Law.
  - Latest 5 active listings displayed: debtor name, case number, and deadline.
  - Bilingual.
- **Priority:** Must-have

#### FR-024: Bankruptcy Sales Listings
- **Description:** A searchable, filterable table of bankruptcy sales with deadline-based visual urgency indicators. Overdue deadlines are highlighted in red.
- **User story:** As a creditor's representative, I want to search bankruptcy sales by debtor name or case number and immediately see which listings are overdue or urgent, so that I can act on time-sensitive opportunities.
- **Acceptance criteria:**
  - Keyword search by debtor name and case number.
  - Status filter: Active / Closed / All (default: Active).
  - Sort by deadline ascending by default (most urgent first).
  - Table columns: Case No., Debtor, Court, Administrator, Deadline, Status badge.
  - Deadlines that have passed: row displays in red with an "Overdue" badge.
  - Deadlines within 7 days: row displays in amber with an "Urgent — N days remaining" badge.
  - Pagination: 20 rows per page.
  - Active filter values reflected in URL params for deep-linking.
- **Priority:** Must-have

#### FR-025: Bankruptcy Administrators Directory
- **Description:** A searchable directory of licensed bankruptcy administrators.
- **User story:** As a judge, I want to find a qualified bankruptcy administrator so that I can appoint them to a new case.
- **Acceptance criteria:**
  - Keyword search by name.
  - Results show: name, contact details, number of assigned cases.
  - Pagination: 20 per page.
  - Bilingual.
- **Priority:** Must-have

#### FR-026: Bankruptcy Laws Archive
- **Description:** A page listing bankruptcy-related laws and amendments grouped by year, with links to view full text (Lexical) or download the PDF attachment.
- **User story:** As a lawyer, I want to find the 2003 amendment to the Bankruptcy Act so that I can reference the correct version of the law in my submission.
- **Acceptance criteria:**
  - Laws grouped by year; most recent year shown first.
  - Each entry shows: title, law type badge, effective date, and an amendment link (shown if `superseded_by` is populated).
  - "View full text" link opens the Lexical-rendered law on a dedicated detail page.
  - "Download PDF" button shown only if a `pdf_attachment` exists; opens in a new browser tab.
  - Bilingual.
- **Priority:** Must-have

#### FR-027-B: Bankruptcy Expert Papers
- **Description:** A document list of expert papers on bankruptcy topics, filterable by category and sortable by publication date.
- **User story:** As an insolvency researcher, I want to browse expert papers by category so that I can find literature on specific aspects of bankruptcy law.
- **Acceptance criteria:**
  - Category filter dropdown populated from document categories in the CMS.
  - Sorted by publication date, newest first by default.
  - Each item shows: title, category badge, publication date, and a download link.
  - Download link opens the PDF in a new tab.
  - Bilingual.
- **Priority:** Must-have

#### FR-027-C: Bankruptcy Case Law
- **Description:** A pre-filtered view of the case law database showing only decisions tagged with the bankruptcy category.
- **User story:** As a bankruptcy professional, I want to see case law specific to insolvency without manually applying a category filter every time I visit.
- **Acceptance criteria:**
  - Page at `/stecaj/sudska-praksa/` uses the Case Law Search UI pre-filtered to `category = bankruptcy`.
  - The bankruptcy category filter is visible and fixed; keyword, date range, and court type filters remain available.
  - Breadcrumb: Home → Bankruptcy Portal → Case Law.
- **Priority:** Must-have

---

### 3.8 Court Fee Calculator (Sudske Pristojbe)

#### FR-028: Court Fee Calculator
- **Description:** A form-based calculator that computes the court fee owed for a given legal proceeding based on current Croatian court fee schedules. The user selects the proceeding type and enters the claim value; the system returns the applicable fee.
- **User story:** As a citizen preparing to file a court claim, I want to calculate the court fee in advance so that I know exactly how much to budget before I go to the courthouse.
- **Acceptance criteria:**
  - Form fields: proceeding type selector (dropdown, all types translated HR/EN), claim value input (numeric; accepts decimal values; EUR).
  - On submit, the fee is calculated using the correct fee schedule formula for the selected proceeding type. (Fee schedule logic to be verified against the current live site's calculator during Sprint 6 implementation — any discrepancies escalated to the client.)
  - Result display: calculated fee amount, currency (HRK / EUR as applicable), and a brief plain-language explanation of how the fee was calculated.
  - Invalid input (non-numeric, negative, zero, or empty claim value) triggers a Zod validation error message shown inline below the relevant field before submission.
  - At least 5 known fee calculation test cases are verified against the current site's output during QA (Sprint 7 — T7-8).
  - All form labels, dropdown options, error messages, and result text translated HR/EN.
- **Priority:** Must-have

---

### 3.9 Bookmarks

#### FR-027: Bookmark Court Decisions
- **Description:** Any visitor (logged in or not) can save individual court decisions to a local bookmark list persisted in `localStorage`. Saved decisions are visible in the Member Area for authenticated users.
- **User story:** As a legal professional researching a case, I want to save court decisions I find interesting so that I can return to them later without re-running the search.
- **Acceptance criteria:**
  - A bookmark button (heart icon) appears on every court decision detail page.
  - Clicking the button saves the decision ID to `localStorage`; the icon changes to a filled/active state.
  - Clicking again removes the bookmark; the icon returns to an unfilled/inactive state.
  - Bookmark state survives browser page refresh (persisted in `localStorage`).
  - The bookmarked decisions list is accessible on the Member Area page (FR-040).
  - The feature is fully functional without a user account (guest bookmarks in `localStorage`).
- **Priority:** Must-have

---

### 3.10 News (Vijesti)

#### FR-029: News Listing Page
- **Description:** A paginated list of news posts with category filtering.
- **User story:** As a legal professional, I want to browse recent news and filter by category so that I can stay informed about relevant judicial announcements.
- **Acceptance criteria:**
  - 10 posts per page with numbered pagination and prev/next controls.
  - Category filter: dropdown populated from categories in the CMS.
  - Each list item shows: featured image thumbnail (or a placeholder if no image), title, publication date, category badge, article excerpt (≤ 160 chars).
  - Clicking an item navigates to the news detail page.
  - All items rendered in the active language.
- **Priority:** Must-have

#### FR-030: News Detail Page
- **Description:** A full article page for a single news post rendered from Payload Lexical rich text.
- **User story:** As a user, I want to read the full text of a news article so that I can understand an announcement in full.
- **Acceptance criteria:**
  - Renders: featured image (full width), title, publication date, category badge, full content via LexicalRenderer.
  - Breadcrumb: Home → News → [Article Title].
  - Share button copies the page URL to the clipboard.
  - SEO: unique `<title>`, `<meta name="description">` (first 160 chars of plain text), and Open Graph tags including the featured image URL.
  - Bilingual: renders in active language.
- **Priority:** Must-have

---

### 3.11 Media Galleries

#### FR-031: Galleries Listing Page
- **Description:** A page listing all media galleries organised by type (Photo / Video / Audio) via tabs. No Flash required.
- **User story:** As a user, I want to browse available photo, video, and audio galleries so that I can find media from events I'm interested in.
- **Acceptance criteria:**
  - Three tabs: Photos / Videos / Audio.
  - Each gallery shown as a responsive card: cover thumbnail, title, item count.
  - Clicking a gallery navigates to its detail page.
  - Bilingual gallery titles.
- **Priority:** Must-have

#### FR-032: Gallery Detail Page
- **Description:** A detail page for a single gallery. Photos open in a keyboard-navigable lightbox. Videos embed as YouTube/Vimeo iframes. Audio renders as HTML5 `<audio>` players. No Flash or browser plugin required for any media type.
- **User story:** As a user, I want to view photos from a conference, watch video clips, or listen to audio recordings without needing any browser plugin.
- **Acceptance criteria:**
  - **Photo gallery:** Images displayed in a responsive CSS grid. Clicking any image opens a CSS lightbox overlay showing the full-size image with a caption. Lightbox supports: left/right arrow navigation, keyboard Left/Right arrow keys, Escape key to close. Lightbox is an ARIA dialog with `aria-label` and `aria-modal="true"`.
  - **Video gallery:** Videos rendered as `<iframe>` embeds pointing to the YouTube or Vimeo URL. No Flash. Each video shows a thumbnail, title, and an external link as a fallback.
  - **Audio gallery:** Each audio item rendered as an HTML5 `<audio>` element with native browser controls. Title/filename displayed beneath each player.
  - Breadcrumb: Home → Galleries → [Gallery Title].
  - Bilingual gallery title and description.
- **Priority:** Must-have

---

### 3.12 Document Library

#### FR-033: Document Library
- **Description:** A searchable library of downloadable documents (PDFs, Word files) organised by category.
- **User story:** As a legal professional, I want to find and download reference documents by category or title so that I can access materials quickly.
- **Acceptance criteria:**
  - Keyword search by document title.
  - Category filter dropdown populated from document categories in the CMS.
  - Sorted by publication date, newest first by default.
  - Each item shows: title, category badge, publication date, file type indicator (PDF / DOCX), and a download button.
  - Download button opens the file in a new browser tab.
  - Bilingual.
- **Priority:** Must-have

---

### 3.13 Static Information Pages

#### FR-034: About Page (`/o-nama/`)
- **Description:** An editable "About Us" page managed via Payload CMS flexible layout blocks.
- **Acceptance criteria:**
  - Content sourced from the CMS `pages` collection (slug: `o-nama`).
  - Supports flexible layout blocks: rich text paragraphs, image with caption, CTA button, divider.
  - Bilingual: HR and EN content can be entered per-field in the CMS.
- **Priority:** Must-have

#### FR-034-B: Free Legal Aid Page (`/pravna-pomoc/`)
- **Description:** An editable page explaining free legal aid entitlements in Croatia, managed via Payload CMS.
- **Acceptance criteria:**
  - Content sourced from the CMS `pages` collection (slug: `pravna-pomoc`).
  - Supports same flexible layout blocks as FR-034.
  - Bilingual.
- **Priority:** Must-have

---

### 3.14 Contact Form

#### FR-036: Contact Page
- **Description:** A contact form allowing visitors to send a message to Sudačka Mreža. Submitted messages are delivered via the Resend API to the organisation's email address.
- **User story:** As a user, I want to send a message to Sudačka Mreža to report an error, propose collaboration, or ask a question — and receive confirmation that it was sent.
- **Acceptance criteria:**
  - Form fields: Name (required), Email (required, validated format), Subject (required, dropdown with 5 options: Suggestion / Criticism / Collaboration / Media inquiry / Other), Message (required, minimum 20 characters).
  - Client-side Zod validation: all required fields checked and error messages shown inline below each field before the form submits.
  - Server-side Zod validation via Payload custom endpoint: same schema re-applied; returns structured errors on invalid input.
  - On success: form is cleared and a success Alert component is displayed above the form.
  - On server error: an error Alert is shown; form remains populated so the user does not lose their message.
  - Submitted data is sent via the Resend API to the designated organisation address.
  - Rate limit: a maximum of 5 submissions per IP address per hour is enforced at the Caddy layer.
  - Bilingual: all labels, placeholder text, dropdown options, error messages, and success/error alerts translated HR/EN.
- **Priority:** Must-have

---

### 3.15 User Accounts & Member Area

#### FR-037: User Registration
- **Description:** A registration page that creates a new member account via the Payload CMS users API.
- **User story:** As a legal professional, I want to create an account so that I can save court decisions and access member-only content.
- **Acceptance criteria:**
  - Form fields: Full Name (required), Email (required, valid format), Password (required, minimum 8 characters, must contain at least one digit), Confirm Password (must match Password).
  - Client-side and server-side Zod validation with inline error messages.
  - On success: the form clears and a success message directs the user to log in; the user is redirected to `/prijava/`.
  - Duplicate email: a clear error message is shown without revealing which accounts exist.
  - Password fields have a reveal/hide toggle; the password is never shown unless toggled.
  - New accounts are created with role `member` by default; `admin` and `editor` roles require direct CMS admin assignment.
  - Bilingual.
- **Priority:** Must-have

#### FR-038: User Login
- **Description:** A login page authenticating users via the Payload CMS JWT flow, with the token stored in an HttpOnly cookie.
- **User story:** As a registered user, I want to log in so that I can access my saved decisions and member content.
- **Acceptance criteria:**
  - Form fields: Email, Password.
  - On success: a JWT is set in an HttpOnly, Secure, SameSite=Strict cookie. User is redirected to `/clanovi/` (or the original destination if a `redirect` query param is present).
  - On failure (wrong credentials): a clear, generic error message is shown without revealing whether the email or password was the incorrect element.
  - Rate limit: Caddy enforces a maximum of 10 failed login attempts per IP per 15 minutes. After the limit is reached, a "Too many attempts — try again in 15 minutes" message is shown.
  - "Forgot password?" link present and navigates to the password reset request page.
  - Bilingual.
- **Priority:** Must-have

#### FR-039: Forgot Password / Reset Flow
- **Description:** A two-step flow allowing users to request a password reset email and then set a new password via a time-limited token link.
- **User story:** As a user who has forgotten my password, I want to receive a secure reset link by email so that I can regain access to my account.
- **Acceptance criteria:**
  - Forgot password form: email input + submit.
  - The response message is identical whether or not the email address is registered (prevents email enumeration attacks).
  - On submit, if the email exists, Payload sends a password reset email to that address.
  - Reset link in the email navigates to a reset form where the user enters a new password (with the same validation rules as registration).
  - On successful password reset: user is redirected to `/prijava/` with a success confirmation message.
- **Priority:** Must-have

#### FR-040: Member Area (Protected Route)
- **Description:** A members-only page accessible only to authenticated users, showing their saved bookmarks and basic account information.
- **User story:** As a logged-in legal professional, I want to see all the court decisions I have bookmarked in one place so that I can review my research list efficiently.
- **Acceptance criteria:**
  - Any unauthenticated request to `/clanovi/` redirects immediately to `/prijava/?redirect=/clanovi/` so the user is returned after logging in.
  - Displays: user's full name, email address, member since date.
  - Bookmarks list: full list of bookmarked court decisions (read from `localStorage`). Each item shows: decision title, court name, decision date, a "View decision" link, and a remove-bookmark button.
  - Removing a bookmark from this list also removes it from `localStorage`.
  - Logout button: calls `/api/users/logout`, clears the auth cookie, and redirects to the homepage with a "Logged out" confirmation message.
  - Bilingual.
- **Priority:** Must-have

---

### 3.16 SEO & Syndication

#### FR-041: Structured Data (JSON-LD)
- **Description:** A `LegalOrganization` JSON-LD schema block is injected on the homepage to enable rich search results.
- **Acceptance criteria:**
  - A `<script type="application/ld+json">` block with a valid `LegalOrganization` schema is present in the `<head>` of the homepage.
  - The schema passes Google Rich Results Test without errors or warnings.
- **Priority:** Must-have

#### FR-042: Sitemap & Robots
- **Description:** An auto-generated `sitemap.xml` and a `robots.txt` file are published at the site root.
- **Acceptance criteria:**
  - `sitemap.xml` is accessible at `https://sudacka-mreza.hr/sitemap.xml`.
  - Sitemap includes all public static routes and all published news post slugs.
  - `robots.txt` disallows indexing of `/admin/` and allows all public routes.
  - Both files are generated from the Payload API at build time.
- **Priority:** Must-have

#### FR-043: RSS Feeds
- **Description:** RSS 2.0 feeds for news posts and court decisions exposed as custom Payload endpoints.
- **Acceptance criteria:**
  - `/api/rss/news.xml`: latest 20 published news posts; valid RSS 2.0 with title, link, description, and pubDate per item.
  - `/api/rss/court-decisions.xml`: latest 20 court decisions; valid RSS 2.0.
  - Both feeds validate at the W3C Feed Validator without errors.
  - Both feeds are served with `Content-Type: application/rss+xml`.
- **Priority:** Must-have

#### FR-044: Print-Friendly Output
- **Description:** Printing any page via the browser print dialog produces clean, readable output.
- **Acceptance criteria:**
  - `@media print` CSS hides: Header, Footer, navigation menus, filter panels, sidebar elements, social share buttons.
  - Main content (decision text, directory entries, article body) is fully visible and readable in print output.
  - Body font renders at a minimum equivalent of 11pt in print mode.
  - Page titles are printed.
- **Priority:** Must-have

---

### 3.17 Analytics

#### FR-045: Privacy-Preserving Analytics
- **Description:** Umami is deployed as a self-hosted Docker service and its tracking script is included on all public pages.
- **Acceptance criteria:**
  - Umami admin UI is accessible at `https://sudacka-mreza.hr/stats/` (Caddy proxy).
  - Page views are tracked across all public pages.
  - No cookies are set by the analytics system.
  - No cookie consent banner is required (confirmed by Umami's cookieless tracking mechanism).
  - No PII is transmitted to analytics.
- **Priority:** Must-have

---

### 3.18 CMS Administration

#### FR-046: Payload CMS Admin UI
- **Description:** All 13 content collections are manageable via the Payload CMS admin UI at `/admin/`. Editors can create, edit, and manage content and upload files without touching code or the database.
- **User story:** As a content editor at Sudačka Mreža, I want to add a court decision, update an expert witness profile, and publish a news post from a web interface so that I can manage the site's content independently.
- **Acceptance criteria:**
  - Admin UI accessible at `https://sudacka-mreza.hr/admin/`.
  - All 13 collections are visible and editable in the admin: CourtDecisions, ExpertWitnesses, Interpreters, Courts, StateAttorneys, BankruptcyListings, BankruptcyAdministrators, Laws, NewsPosts, Pages, Galleries, Documents, Users.
  - Lexical rich text editor is available for `court-decisions`, `laws`, `news-posts`, and `pages` collections.
  - File upload (PDF, DOCX, images) works via the admin UI. Files larger than 50 MB are rejected with a clear error message.
  - Role-based access is enforced: `admin` can access all collections and delete records; `editor` can create and update but not delete; `member` role has no admin UI access.
  - Bilingual fields: for every locale-enabled field, editors can enter separate Croatian and English translations.
  - Admin UI is not indexed by search engines (`robots.txt` disallows `/admin/`).
- **Priority:** Must-have

---

## 4. User Flows

### UF-001: Legal Professional Finds a Court Decision via Global Search

1. User arrives on the homepage (`/`).
2. User clicks the search icon in the Header and types "nekretnina" into the search input.
3. After a 300 ms debounce, the API is queried. A grouped dropdown appears showing up to 3 matching decisions, 2 experts, 1 court, and 2 news articles.
4. User clicks "View all results" → navigates to `/pretraga/?q=nekretnina`.
5. GlobalSearchResultsPage shows results grouped by type. The "Decisions (47)" section is visible.
6. User clicks the link "Open in Case Law Search" → navigates to `/sudska-praksa/pretraga/?q=nekretnina`.
7. User applies additional filters: Court = "Visoki Trgovački Sud RH", Date from = "2020-01-01".
8. URL updates to `/sudska-praksa/pretraga/?q=nekretnina&court=VTS&from=2020-01-01`. Page re-renders showing 12 matching decisions.
9. User clicks a decision title → navigates to CaseLawDetailPage.
10. Full decision text and metadata are visible. User clicks the bookmark heart icon.
11. The heart icon becomes filled. Decision ID is saved to `localStorage`.
12. User navigates to `/clanovi/` → the bookmarked decision appears in the saved decisions list.

### UF-002: Citizen Finds Their Local Court via the Jurisdiction Map

1. User navigates to `/sudovi/nadleznost/` via the Courts menu.
2. JurisdictionMapPage loads with a choropleth map of Croatia's 21 counties.
3. User moves the mouse over their county; the county highlights and a tooltip shows the county name.
4. User clicks the county; a Leaflet popup appears showing: county name, responsible court name, court address, and a "View Court Details" link.
5. User clicks "View Court Details" → navigates to the CourtDetailPage.
6. Court address, phone number, and a single-pin map are visible.

### UF-003: Bankruptcy Professional Searches Active Listings

1. User navigates to `/stecaj/ponude/`.
2. BankruptcySalesPage loads; results are sorted by deadline ascending.
3. Two rows are highlighted in red with "Overdue" badges; three rows are in amber with "Urgent — 3 days remaining" badges.
4. User types a debtor company name into the keyword search input. Results filter live — no page reload.
5. User clicks a listing row → full details shown: assets, administrator, case number, court.

### UF-004: Editor Publishes a News Post

1. Editor navigates to `https://sudacka-mreza.hr/admin/` and logs in with admin credentials.
2. Editor opens the "News Posts" collection and clicks "Create New".
3. Editor fills in: Title (HR), Title (EN), Content (Lexical editor, HR), Content (EN), Category, sets `published_at` to today, and uploads a featured image.
4. Editor clicks "Save". The post is published.
5. Editor navigates to the public site. The homepage news strip now shows the new post at the top.

### UF-005: New User Registers and Saves a Decision

1. User navigates to `/registracija/` via the Header login button.
2. User fills in: name, email, password (≥ 8 chars, ≥ 1 digit), confirm password.
3. Zod validation passes. On submit, account is created. User is redirected to `/prijava/` with a success message.
4. User logs in. The JWT cookie is set. User is redirected to `/clanovi/`.
5. User browses to a court decision and clicks the bookmark button.
6. User returns to `/clanovi/` → the bookmarked decision appears in their saved decisions list.

### UF-006: Citizen Calculates a Court Fee

1. User navigates to `/pristojbe/` via the main navigation.
2. User selects a proceeding type from the dropdown: "Civil claim — property dispute" / "Građanski tužbeni zahtjev — imovinska stvar".
3. User enters a claim value: "50000" (EUR).
4. User clicks "Calculate" / "Izračunaj".
5. The result appears below the form: "Court fee: 1,750 HRK (approx. 232 EUR)" with a breakdown statement.
6. User presses `Ctrl+P` → browser print dialog opens; the Header and Footer are hidden in print preview; the result is clearly visible.

### UF-007: User Switches Language Mid-Session

1. User is reading an expert witness profile at `/strucnjaci/vjestaci/123` in Croatian.
2. User clicks the "EN" toggle in the Header.
3. URL updates to `/en/strucnjaci/vjestaci/123`. All translated UI labels (breadcrumb, field names, navigation) switch to English. The expert's name and bilingual profile fields render in English.
4. User clicks "HR" → URL returns to `/hr/strucnjaci/vjestaci/123`; content re-renders in Croatian.

---

## 5. Scope & Constraints

### 5.1 In Scope

The following are committed deliverables in this engagement:

| # | Feature Area | Notes |
|---|---|---|
| 1 | Bilingual website (HR + EN) | Full translation of all UI; content translated where client provides EN source |
| 2 | HTTPS via Caddy + Let's Encrypt | Automatic certificate provisioning and renewal |
| 3 | Mobile-responsive design (mobile-first) | Tested at 375 px, 768 px, 1440 px |
| 4 | All 13 Payload CMS collections | As defined in TECH_STACK.md §Data Models |
| 5 | Case law search & detail pages (FR-011–FR-014) | Full-text search via pg_trgm + tsvector |
| 6 | Expert witness directory & profiles (FR-015–FR-016) | |
| 7 | Interpreter directory & profiles (FR-017–FR-018) | |
| 8 | Courts directory, detail pages, State Attorneys (FR-019–FR-020, FR-022) | |
| 9 | Jurisdiction finder — Leaflet map replacing Flash widget (FR-021) | GADM open data used as fallback if client does not supply custom GeoJSON |
| 10 | Full Bankruptcy portal — 5 sub-sections (FR-023–FR-027C) | |
| 11 | Court fee calculator (FR-028) | Logic replicated from current site; to be verified with client |
| 12 | Decision bookmarks (FR-027) | localStorage-based; DB sync deferred to post-launch backlog |
| 13 | News listing & detail pages (FR-029–FR-030) | |
| 14 | Media galleries — photo, video, audio — no Flash (FR-031–FR-032) | |
| 15 | Document library (FR-033) | |
| 16 | About and Free Legal Aid static pages (FR-034–FR-034B) | |
| 17 | Contact form with Resend email delivery (FR-036) | |
| 18 | User registration, login, password reset, member area (FR-037–FR-040) | |
| 19 | SEO — sitemap, robots.txt, Open Graph, JSON-LD, per-page meta (FR-041–FR-043) | |
| 20 | Print-friendly CSS (FR-044) | |
| 21 | Umami analytics — self-hosted, cookieless (FR-045) | |
| 22 | Payload CMS admin UI with role-based access (FR-046) | All 13 collections |
| 23 | RSS feeds — news and court decisions (FR-043) | |
| 24 | Dark / light mode (FR-005) | |
| 25 | Docker Compose production stack | caddy + web + cms + db + analytics services |
| 26 | GitHub Actions CI/CD pipeline | lint → typecheck → Vitest → Playwright → Docker build → GHCR push |
| 27 | Automated tests at ≥ 80% line coverage | Vitest (unit + component + API) + Playwright (E2E + accessibility) |
| 28 | Seed data for demo / staging environment | 5 decisions, 5 experts, 5 courts, 2 news posts |
| 29 | Deployment runbook (`DEPLOYMENT.md`) | Step-by-step for a cold-start VPS setup |

### 5.2 Out of Scope (This Delivery)

The following are explicitly excluded from this engagement:

| # | Feature | Rationale |
|---|---|---|
| 1 | **Content migration from the current SQL Server database** | Blocked on client providing database access or authorising a public-site scrape (BLK-1). Migration scripts will be authored as a separate post-delivery phase once data access is granted. |
| 2 | **Events calendar** | Post-launch backlog item B1. Deferred. |
| 3 | **Newsletter subscription (Resend opt-in)** | Post-launch backlog item B2. Requires audience setup and double-opt-in flow. |
| 4 | **Bookmark sync to user account in the database** | Post-launch backlog item B4. MVP uses `localStorage` only. |
| 5 | **Meilisearch integration** | Post-launch backlog item B5. PostgreSQL full-text search is sufficient for MVP volumes. Review at scale. |
| 6 | **Cloudflare R2 file storage** | Post-launch backlog item B6. Local filesystem storage in production initially. |
| 7 | **Expert profile correction / verification request system** | Future feature (SPEC §4.3). |
| 8 | **AI-generated case law summaries** | Future feature (SPEC §4.3). |
| 9 | **Public REST API for partner institutions** | Future feature (SPEC §4.3). |
| 10 | **Font size switcher (A− / A / A+)** | Replaced by OS-level accessibility controls and browser zoom. Not rebuilt. |
| 11 | **Sister sites** (Serbia, North Macedonia) | Separate organisations; entirely out of scope. |
| 12 | **Donation / payment processing** | The "Donate" link can be maintained as an external link; no payment gateway in scope. |
| 13 | **Advanced case law date range calendar picker** | Post-launch backlog item B3. Plain text date inputs are sufficient for MVP. |

### 5.3 Budget & Timeline Constraints

- **Engagement:** Pro-bono. GigForge provides all engineering services at no cost to the client.
- **Timeline:** 41 working days across 9 sprints (Sprint 0 through Sprint 8). See `SPRINT_PLAN.md` for day-by-day breakdown.
- **Client blockers:** The following items require input from Dražen Komarica before the indicated sprints can complete:

| Blocker ID | Requirement | Sprint Impacted | Fallback |
|---|---|---|---|
| BLK-1 | SQL Server dump or written scraping authorisation for content migration | Post-launch | Migration deferred; site ships with seed data |
| BLK-2 | County-to-court GeoJSON or confirmation to use GADM open data | Sprint 5 | GADM data used as fallback — Sprint 5 unblocked by default |
| BLK-3 | DNS / domain control for Let's Encrypt certificate provisioning | Sprint 8 | Local dev uses self-signed cert; prod deployment blocked until DNS access confirmed |
| BLK-4 | English translation status — which content sections exist in EN? | Sprint 2–3 | Site ships with Croatian content only in untranslated sections |
| BLK-5 | Hosting preference — stay on current host or move to new VPS? | Sprint 8 | GigForge can provide VPS recommendation (DigitalOcean €12–20/mo) |

---

## 6. Acceptance Criteria (Project Level)

The project is considered **done** when all of the following conditions are verified:

### 6.1 Functional Completeness
- [ ] All 29 in-scope features listed in §5.1 are implemented and functional on the production Docker Compose stack.
- [ ] Every FR-001 through FR-046 acceptance criterion has been verified (QA Engineer sign-off and Client Advocate sign-off required — see `workflows/approval-gate.md`).
- [ ] Every URL in the navigation tree (SPEC §3.1) resolves with HTTP 200 when accessed by an unauthenticated user.
- [ ] The 404 page is returned for non-existent routes. Admin routes (`/admin/*`, `/api/*` write endpoints) return HTTP 401 or 403 for unauthenticated requests.

### 6.2 Critical Issues Resolved
- [ ] **Flash dependency eliminated:** The Jurisdiction Finder at `/sudovi/nadleznost/` works in all modern browsers using Leaflet.js. No Flash, Silverlight, or any browser plugin is required anywhere on the site.
- [ ] **HTTPS enforced:** The site is served exclusively over HTTPS with a valid Let's Encrypt TLS certificate. All HTTP requests are redirected to HTTPS (HTTP 301). The browser address bar shows no security warnings.
- [ ] **Mobile-responsive:** The site is fully usable on a 375 px viewport. No horizontal scrolling occurs on any page. No text is too small to read without zooming. All interactive elements are tappable.
- [ ] **Real SEO metadata:** Every page has a unique, meaningful `<title>` tag and `<meta name="description">` tag. No placeholder values ("desc", "key", empty strings) appear on any page.

### 6.3 Bilingual
- [ ] Every page is accessible in both Croatian and English via URL path prefix.
- [ ] The language toggle functions correctly on every page.
- [ ] All UI strings (labels, buttons, placeholder text, error messages, success messages) are translated in both HR and EN.

### 6.4 Performance
- [ ] Lighthouse Performance score ≥ 90 on the homepage and on at least 3 key secondary pages: Case Law Search, Expert Witness List, Court Detail.
- [ ] Core Web Vitals on the homepage: LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

### 6.5 Accessibility
- [ ] Lighthouse Accessibility score ≥ 95 on every public page.
- [ ] Zero critical or serious axe-core violations on any page (verified by the Playwright axe-core scan across all 20+ pages — Sprint 7 task T7-11).
- [ ] All interactive elements are keyboard-focusable with a clearly visible focus ring.
- [ ] All images have descriptive `alt` attributes. Decorative images use `alt=""`.
- [ ] All form inputs have associated `<label>` elements.
- [ ] WCAG 2.1 AA colour contrast requirements are met in both light mode and dark mode for all foreground/background combinations.

### 6.6 Test Coverage
- [ ] Vitest line coverage ≥ 80% across `web/src/` and `cms/src/collections/`.
- [ ] All 10 Playwright E2E critical journey tests (Sprint 7: T7-3 through T7-10) pass headlessly on Chromium, Firefox, and WebKit.
- [ ] The CI pipeline passes on the `main` branch without manual intervention: lint → typecheck → Vitest → Playwright → Docker build.

### 6.7 Security
- [ ] User passwords are stored as bcrypt hashes with a minimum cost factor of 12 via Payload. No plain-text passwords in any database column, log, or file.
- [ ] JWT authentication tokens are stored in HttpOnly, Secure, SameSite=Strict cookies. Tokens are never exposed in JavaScript's `document.cookie`.
- [ ] All user-supplied rich text output passes through DOMPurify before insertion into the DOM. No raw `innerHTML` injection.
- [ ] All file uploads are validated by MIME type and file extension. Files exceeding 50 MB are rejected with HTTP 413.
- [ ] Rate limits are active on `/api/users/login` and the contact form endpoint (Caddy layer).
- [ ] `robots.txt` disallows `/admin/` from search engine indexing.

### 6.8 SEO
- [ ] `sitemap.xml` is accessible at the production URL and includes all defined public routes and all published news post slugs.
- [ ] `LegalOrganization` JSON-LD schema on the homepage validates in Google Rich Results Test with no errors.
- [ ] Open Graph meta tags (`og:title`, `og:description`, `og:image`) are populated on all key pages: homepage, all news articles, all case law detail pages, expert witness profiles.
- [ ] Lighthouse SEO score ≥ 95 on all public pages.

### 6.9 Deployment
- [ ] `docker compose up` on a clean VPS with `.env` configured brings all 5 services (caddy, web, cms, db, analytics) to a healthy state within 2 minutes.
- [ ] `scripts/deploy.sh` runs idempotently: pulling the latest images, running migrations, and restarting containers without data loss.
- [ ] `scripts/backup.sh` creates a dated `pg_dump .sql.gz` archive and prunes archives older than 7 days.
- [ ] `DEPLOYMENT.md` is complete and sufficient for a developer unfamiliar with the project to perform a first-time deployment from scratch.

### 6.10 Client Sign-Off
- [ ] **QA Engineer** (Acceptance Tester) has executed the full test plan, verified every FR acceptance criterion against the running application, and filed a written APPROVED verdict.
- [ ] **Client Advocate** has independently reviewed the application as a paying client, scored quality across all 5 dimensions, and filed a written APPROVED verdict.
- [ ] **Dražen Komarica** has reviewed the staging deployment, confirmed that all features meet his expectations, and sent written acceptance confirmation to `pm@gigforge.ai-elevate.ai` (or equivalent).

---

*Authored by gigforge-pm · GF-GFWEB-002 · 2026-03-21*
*Source documents: SPEC.md (requirements analysis and current-site audit), SPRINT_PLAN.md (sprint breakdown), TECH_STACK.md (engineering decisions)*
*This document is the functional contract between GigForge and the client. Any changes to scope, features, or acceptance criteria must be agreed in writing before implementation begins.*

---

## 7. System Architecture

### 7.1 High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              PUBLIC INTERNET                               │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ HTTPS :443 / HTTP :80
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          CADDY 2 (edge proxy)                             │
│  • Auto Let's Encrypt TLS termination                                     │
│  • Route: /api/* /admin/*  → cms:3001                                     │
│  • Route: /stats/*          → analytics:3000                             │
│  • Route: /*                → web:80                                      │
│  • Rate limit: /api/users/login  5 req/min/IP                             │
│  • Rate limit: /api/contact      3 req/min/IP                             │
└─────────────┬────────────────────────┬──────────────────────┬─────────────┘
              │                        │                      │
              ▼                        ▼                      ▼
┌─────────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐
│  web (Nginx Alpine) │  │  cms (Payload CMS 3)    │  │  analytics       │
│  port 80 (internal) │  │  port 3001 (internal)   │  │  (Umami)         │
│                     │  │                         │  │  port 3000       │
│  Serves:            │  │  • REST API (auto)      │  │  (internal)      │
│  • Vite SPA bundle  │  │  • GraphQL API (auto)   │  │                  │
│  • /index.html      │  │  • Admin UI /admin/     │  │  Cookieless      │
│    for all routes   │  │  • File uploads         │  │  page-view       │
│  • gzip + cache     │  │  • Custom endpoints:    │  │  analytics       │
│    headers          │  │    /api/search          │  └──────────────────┘
│  • @fontsource      │  │    /api/rss/news.xml    │
│    font files       │  │    /api/rss/court-      │
│  • og-default.png   │  │    decisions.xml        │
└─────────────────────┘  │  • Contact form email   │
                         │    via Resend API        │
                         └────────────┬────────────┘
                                      │ TCP :5432 (internal only)
                                      ▼
                         ┌───────────────────────────┐
                         │  db (PostgreSQL 16)        │
                         │  port 5432 (internal only) │
                         │                            │
                         │  Extensions:               │
                         │  • pg_trgm (GIN indexes)  │
                         │                            │
                         │  13 Payload collections    │
                         │  + media upload registry   │
                         └───────────────────────────┘
```

### 7.2 Component Breakdown

| Layer | Service | Technology | Responsibility |
|-------|---------|-----------|----------------|
| Edge proxy | Caddy | Caddy 2 | TLS, routing, rate limiting |
| Frontend | web | Nginx Alpine + Vite SPA | Static file serving, SPA shell |
| CMS / API | cms | Payload CMS 3 (Node.js 22) | REST API, GraphQL, admin UI, file uploads, JWT auth |
| Database | db | PostgreSQL 16 | Persistent data, FTS indexes |
| Analytics | analytics | Umami | Cookieless page-view tracking |
| Build pipeline | — | GitHub Actions | lint → typecheck → test → Docker build → GHCR push |

### 7.3 Communication Patterns

| Pattern | Used Between | Protocol | Notes |
|---------|-------------|----------|-------|
| REST (JSON) | SPA → Payload CMS | HTTPS/HTTP (internal) | Primary data channel. Payload auto-generates REST for all 13 collections |
| GraphQL | SPA → Payload CMS (optional) | HTTPS/HTTP (internal) | Auto-generated; disabled in prod for Playground; available for future tooling |
| RSS (XML) | RSS readers → Payload custom endpoint | HTTPS | `/api/rss/news.xml`, `/api/rss/court-decisions.xml` |
| Webhook/SMTP | Payload CMS → Resend API | HTTPS outbound | Contact form email delivery |
| Docker network | All services → PostgreSQL | TCP (internal bridge) | Payload connects to `db:5432`; never exposed to host network |
| Analytics pixel | Browser → Umami | HTTPS (via Caddy /stats/) | Script tag in `index.html`; no cookies |

---

## 8. Data Models

### 8.1 Entity-Relationship Overview

```
Users ─────────── (created by) ──────────► CourtDecisions
Courts ───────────────────────────────────► CourtDecisions (court FK)
Courts ───────────────────────────────────► BankruptcyListings (court FK)
Courts ───────────────────────────────────► ExpertWitnesses (court_assignments[])
Courts ───────────────────────────────────► Interpreters (court_assignments[])
BankruptcyAdministrators ─────────────────► BankruptcyListings (administrator FK)
Laws ─────────────────────────────────────► Laws (superseded_by self-ref, nullable)
Media ────────────────────────────────────► CourtDecisions (attachments[])
Media ────────────────────────────────────► NewsPosts (featured_image FK)
Media ────────────────────────────────────► Laws (pdf_attachment FK)
Media ────────────────────────────────────► Documents (file FK)
Media ────────────────────────────────────► Galleries.items[].media
Media ────────────────────────────────────► ExpertWitnesses (photo FK)
Media ────────────────────────────────────► Interpreters (photo FK)
```

### 8.2 CourtDecisions

**Table:** `court_decisions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | Payload document ID |
| title_hr | TEXT | NOT NULL | Decision title (Croatian) |
| title_en | TEXT | | Decision title (English) |
| court_id | UUID | FK → courts.id, ON DELETE SET NULL | Issuing court |
| date | TIMESTAMPTZ | NOT NULL | Date the decision was issued |
| decision_type | VARCHAR(30) | NOT NULL, CHECK IN ('general','vts','esljp','criminal','civil','commercial','administrative','constitutional') | Classification |
| full_text_hr | JSONB | NOT NULL | Lexical rich text JSON (Croatian) |
| full_text_en | JSONB | | Lexical rich text JSON (English) |
| case_number | VARCHAR(100) | UNIQUE | Case reference number |
| summary_hr | TEXT | | Short summary for search snippets (Croatian) |
| summary_en | TEXT | | Short summary for search snippets (English) |
| category_hr | VARCHAR(200) | | Content category (Croatian) |
| category_en | VARCHAR(200) | | Content category (English) |
| tags_hr | TEXT[] | DEFAULT '{}' | Tag array (Croatian) |
| tags_en | TEXT[] | DEFAULT '{}' | Tag array (English) |
| search_vector_hr | TSVECTOR | | Auto-updated via Payload beforeChange hook |
| search_vector_en | TSVECTOR | | Auto-updated via Payload beforeChange hook |
| _status | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','published') | Payload draft mode |
| published_at | TIMESTAMPTZ | | When first published |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_court_decisions_court_id      ON court_decisions(court_id);
CREATE INDEX idx_court_decisions_date          ON court_decisions(date DESC);
CREATE INDEX idx_court_decisions_type          ON court_decisions(decision_type);
CREATE INDEX idx_court_decisions_status        ON court_decisions(_status);
CREATE INDEX idx_court_decisions_fts_hr        ON court_decisions USING GIN(search_vector_hr);
CREATE INDEX idx_court_decisions_fts_en        ON court_decisions USING GIN(search_vector_en);
CREATE INDEX idx_court_decisions_trgm_title_hr ON court_decisions USING GIN(title_hr gin_trgm_ops);
```

**Attachments junction table:** `court_decisions_attachments`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| court_decision_id | UUID | FK → court_decisions.id ON DELETE CASCADE |
| media_id | UUID | FK → media.id ON DELETE SET NULL |
| order | INTEGER | DEFAULT 0 |

---

### 8.3 ExpertWitnesses

**Table:** `expert_witnesses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| name | VARCHAR(200) | NOT NULL | Full name |
| speciality_areas_hr | TEXT[] | NOT NULL, DEFAULT '{}' | Speciality areas (Croatian) |
| speciality_areas_en | TEXT[] | DEFAULT '{}' | Speciality areas (English) |
| languages | TEXT[] | NOT NULL, DEFAULT '{}' | Languages spoken |
| contact_email | VARCHAR(255) | | Public contact email |
| contact_phone | VARCHAR(50) | | Public contact phone |
| verified | BOOLEAN | NOT NULL, DEFAULT FALSE | Officially verified status |
| verified_at | TIMESTAMPTZ | | When verified |
| notes_hr | TEXT | | Additional notes (Croatian) |
| notes_en | TEXT | | Additional notes (English) |
| photo_id | UUID | FK → media.id ON DELETE SET NULL | Profile photo |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_expert_witnesses_verified    ON expert_witnesses(verified);
CREATE INDEX idx_expert_witnesses_trgm_name   ON expert_witnesses USING GIN(name gin_trgm_ops);
CREATE INDEX idx_expert_witnesses_specialities ON expert_witnesses USING GIN(speciality_areas_hr);
```

**Court assignments junction table:** `expert_witnesses_courts`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| expert_witness_id | UUID | FK → expert_witnesses.id ON DELETE CASCADE |
| court_id | UUID | FK → courts.id ON DELETE CASCADE |

---

### 8.4 Interpreters

**Table:** `interpreters`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| name | VARCHAR(200) | NOT NULL | Full name |
| contact_email | VARCHAR(255) | | |
| contact_phone | VARCHAR(50) | | |
| verified | BOOLEAN | NOT NULL, DEFAULT FALSE | |
| verified_at | TIMESTAMPTZ | | |
| photo_id | UUID | FK → media.id ON DELETE SET NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Language pairs table:** `interpreter_language_pairs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| interpreter_id | UUID | FK → interpreters.id ON DELETE CASCADE | |
| source_language | VARCHAR(100) | NOT NULL | e.g. "Hrvatski" |
| target_language | VARCHAR(100) | NOT NULL | e.g. "Engleski" |
| order | INTEGER | DEFAULT 0 | Display order |

**Indexes:**
```sql
CREATE INDEX idx_interpreters_verified   ON interpreters(verified);
CREATE INDEX idx_interpreters_trgm_name  ON interpreters USING GIN(name gin_trgm_ops);
CREATE INDEX idx_lang_pairs_interpreter  ON interpreter_language_pairs(interpreter_id);
CREATE INDEX idx_lang_pairs_target       ON interpreter_language_pairs(target_language);
```

**Court assignments junction table:** `interpreters_courts` (same structure as `expert_witnesses_courts`)

---

### 8.5 Courts

**Table:** `courts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| name_hr | VARCHAR(255) | NOT NULL | Court name (Croatian) |
| name_en | VARCHAR(255) | | Court name (English) |
| type | VARCHAR(30) | NOT NULL, CHECK IN ('opcinski','zupanijski','trgovacki','prekrsajni','upravni','vrhovni','ustavni','vts','dorh') | |
| address_hr | TEXT | | Full address (Croatian) |
| address_en | TEXT | | Full address (English) |
| phone | VARCHAR(50) | | |
| fax | VARCHAR(50) | | |
| email | VARCHAR(255) | | |
| website | VARCHAR(500) | | |
| president_hr | VARCHAR(200) | | Court president name (Croatian) |
| president_en | VARCHAR(200) | | |
| county_hr | VARCHAR(100) | | County/region (Croatian) |
| county_en | VARCHAR(100) | | |
| geolocation | JSONB | | `{"lat": 45.8150, "lng": 15.9819}` |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_courts_type            ON courts(type);
CREATE INDEX idx_courts_county_hr       ON courts(county_hr);
CREATE INDEX idx_courts_trgm_name_hr    ON courts USING GIN(name_hr gin_trgm_ops);
```

---

### 8.6 StateAttorneys

**Table:** `state_attorneys`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| name_hr | VARCHAR(255) | NOT NULL | Office name (Croatian) |
| name_en | VARCHAR(255) | | |
| jurisdiction_hr | VARCHAR(255) | | Jurisdiction area (Croatian) |
| jurisdiction_en | VARCHAR(255) | | |
| address_hr | TEXT | | |
| address_en | TEXT | | |
| phone | VARCHAR(50) | | |
| fax | VARCHAR(50) | | |
| email | VARCHAR(255) | | |
| website | VARCHAR(500) | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_state_attorneys_trgm_name ON state_attorneys USING GIN(name_hr gin_trgm_ops);
```

---

### 8.7 BankruptcyListings

**Table:** `bankruptcy_listings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| case_no | VARCHAR(100) | NOT NULL, UNIQUE | e.g. "St-5/2024" |
| debtor_hr | VARCHAR(255) | NOT NULL | Debtor entity name (Croatian) |
| debtor_en | VARCHAR(255) | | |
| court_id | UUID | FK → courts.id ON DELETE SET NULL | Court handling the case |
| administrator_id | UUID | FK → bankruptcy_administrators.id ON DELETE SET NULL | |
| deadline | TIMESTAMPTZ | | Offer/submission deadline |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active','closed','withdrawn') | |
| notes_hr | TEXT | | Additional details (Croatian) |
| notes_en | TEXT | | |
| published_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Assets table:** `bankruptcy_listing_assets`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| listing_id | UUID | FK → bankruptcy_listings.id ON DELETE CASCADE | |
| description_hr | TEXT | NOT NULL | Asset description (Croatian) |
| description_en | TEXT | | |
| order | INTEGER | DEFAULT 0 | |

**Indexes:**
```sql
CREATE INDEX idx_bankruptcy_listings_status    ON bankruptcy_listings(status);
CREATE INDEX idx_bankruptcy_listings_deadline  ON bankruptcy_listings(deadline DESC);
CREATE INDEX idx_bankruptcy_listings_court_id  ON bankruptcy_listings(court_id);
CREATE INDEX idx_bankruptcy_listings_trgm      ON bankruptcy_listings USING GIN(debtor_hr gin_trgm_ops);
```

---

### 8.8 BankruptcyAdministrators

**Table:** `bankruptcy_administrators`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| name | VARCHAR(200) | NOT NULL | Full name |
| contact_email | VARCHAR(255) | | |
| contact_phone | VARCHAR(50) | | |
| address | TEXT | | Office address |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_bankruptcy_admins_trgm_name ON bankruptcy_administrators USING GIN(name gin_trgm_ops);
```

---

### 8.9 Laws

**Table:** `laws`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| title_hr | VARCHAR(500) | NOT NULL | Law title (Croatian) |
| title_en | VARCHAR(500) | | |
| type | VARCHAR(30) | NOT NULL, CHECK IN ('stecajni','gradanski','kazneni','upravni','ustavni','europski','ostali') | |
| year | SMALLINT | NOT NULL | Year of enactment |
| text_hr | JSONB | | Lexical rich text JSON (Croatian) |
| text_en | JSONB | | |
| pdf_attachment_id | UUID | FK → media.id ON DELETE SET NULL | PDF download |
| effective_date | DATE | | Date the law came into force |
| superseded_by_id | UUID | FK → laws.id ON DELETE SET NULL | Links to replacing law |
| published_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_laws_type                ON laws(type);
CREATE INDEX idx_laws_year                ON laws(year DESC);
CREATE INDEX idx_laws_trgm_title_hr       ON laws USING GIN(title_hr gin_trgm_ops);
```

---

### 8.10 NewsPosts

**Table:** `news_posts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| title_hr | VARCHAR(500) | NOT NULL | |
| title_en | VARCHAR(500) | | |
| slug | VARCHAR(500) | NOT NULL, UNIQUE | Auto-generated from `title_hr` on create; URL-safe |
| content_hr | JSONB | NOT NULL | Lexical rich text JSON (Croatian) |
| content_en | JSONB | | |
| published_at | TIMESTAMPTZ | | |
| category | VARCHAR(30) | NOT NULL, DEFAULT 'vijesti', CHECK IN ('vijesti','obavijesti','natjecaji','ostalo') | |
| featured_image_id | UUID | FK → media.id ON DELETE SET NULL | |
| meta_description_hr | TEXT | | ≤ 160 chars |
| meta_description_en | TEXT | | |
| _status | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','published') | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_news_posts_slug        ON news_posts(slug);
CREATE INDEX idx_news_posts_published_at       ON news_posts(published_at DESC);
CREATE INDEX idx_news_posts_category           ON news_posts(category);
CREATE INDEX idx_news_posts_status             ON news_posts(_status);
CREATE INDEX idx_news_posts_trgm_title_hr      ON news_posts USING GIN(title_hr gin_trgm_ops);
```

---

### 8.11 Pages

**Table:** `pages`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| title_hr | VARCHAR(500) | NOT NULL | |
| title_en | VARCHAR(500) | | |
| slug | VARCHAR(500) | NOT NULL, UNIQUE | e.g. 'o-nama', 'pravna-pomoc' |
| content_hr | JSONB | NOT NULL | Lexical layout blocks array (Croatian) |
| content_en | JSONB | | |
| meta_description_hr | TEXT | | |
| meta_description_en | TEXT | | |
| _status | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','published') | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_pages_slug ON pages(slug);
```

**Layout block structure (JSONB schema):**
```typescript
type LayoutBlock =
  | { type: 'text';    content_hr: LexicalJSON; content_en: LexicalJSON }
  | { type: 'image';   media_id: string; caption_hr: string; caption_en: string; alt: string }
  | { type: 'cta';     label_hr: string; label_en: string; url: string; style: 'primary' | 'secondary' }
  | { type: 'divider' }
```

---

### 8.12 Galleries

**Table:** `galleries`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| title_hr | VARCHAR(255) | NOT NULL | |
| title_en | VARCHAR(255) | | |
| type | VARCHAR(10) | NOT NULL, CHECK IN ('photo','video','audio') | |
| thumbnail_id | UUID | FK → media.id ON DELETE SET NULL | Cover image |
| published_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Gallery items table:** `gallery_items`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| gallery_id | UUID | FK → galleries.id ON DELETE CASCADE | |
| media_id | UUID | FK → media.id ON DELETE SET NULL | For photo/audio |
| video_url | VARCHAR(500) | | YouTube/Vimeo URL (video type) |
| caption_hr | TEXT | | |
| caption_en | TEXT | | |
| order | INTEGER | NOT NULL, DEFAULT 0 | Display order |

**Indexes:**
```sql
CREATE INDEX idx_galleries_type         ON galleries(type);
CREATE INDEX idx_galleries_published_at ON galleries(published_at DESC);
CREATE INDEX idx_gallery_items_gallery  ON gallery_items(gallery_id, "order");
```

---

### 8.13 Documents

**Table:** `documents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| title_hr | VARCHAR(500) | NOT NULL | |
| title_en | VARCHAR(500) | | |
| category_hr | VARCHAR(200) | | e.g. "Stečajni zakoni", "Stručni radovi" |
| category_en | VARCHAR(200) | | |
| file_id | UUID | FK → media.id ON DELETE RESTRICT | MIME: pdf/doc/docx only |
| published_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE INDEX idx_documents_category     ON documents(category_hr);
CREATE INDEX idx_documents_published_at ON documents(published_at DESC);
CREATE INDEX idx_documents_trgm_title   ON documents USING GIN(title_hr gin_trgm_ops);
```

---

### 8.14 Users

**Table:** `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| email | VARCHAR(255) | NOT NULL, UNIQUE | |
| password | VARCHAR(255) | NOT NULL | bcrypt hash, cost factor 12 |
| name | VARCHAR(200) | | Display name |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'member', CHECK IN ('admin','editor','member') | |
| reset_token | VARCHAR(255) | | Password reset token (one-time use) |
| reset_token_expiry | TIMESTAMPTZ | | |
| login_attempts | SMALLINT | NOT NULL, DEFAULT 0 | Failed login counter (Payload managed) |
| lock_until | TIMESTAMPTZ | | Account lock expiry |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role         ON users(role);
```

---

### 8.15 Media (Payload Upload Collection)

**Table:** `media`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, NOT NULL, DEFAULT gen_random_uuid() | |
| filename | VARCHAR(500) | NOT NULL | Stored filename on disk |
| mime_type | VARCHAR(100) | NOT NULL | e.g. "image/jpeg", "application/pdf" |
| filesize | INTEGER | NOT NULL | Bytes |
| width | SMALLINT | | Pixels (images only) |
| height | SMALLINT | | Pixels (images only) |
| url | VARCHAR(1000) | NOT NULL | Public URL path via Payload upload handler |
| alt | TEXT | | Alt text (images); populated via admin UI |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Accepted MIME types (enforced by Payload upload config):**
`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `audio/mpeg`, `video/mp4`

**Max upload size:** 50 MB (enforced in Payload config and Caddy request body limit)

---

### 8.16 Database Initialisation SQL

```sql
-- Run on first boot (Payload migration: 20260321_enable_pg_trgm.ts)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- tsvector auto-update triggers (court_decisions example)
CREATE OR REPLACE FUNCTION update_court_decisions_search_vector_hr()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector_hr := to_tsvector('simple',
    coalesce(NEW.title_hr, '') || ' ' ||
    coalesce(NEW.summary_hr, '') || ' ' ||
    coalesce(NEW.case_number, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_court_decisions_tsvector_hr
  BEFORE INSERT OR UPDATE ON court_decisions
  FOR EACH ROW EXECUTE FUNCTION update_court_decisions_search_vector_hr();
```

---

## 9. API Contract

All collection endpoints follow the Payload CMS 3 REST API standard.  
Base URL: `https://sudacka-mreza.hr` (production) / `http://localhost:4094` (dev CMS port).

**Standard query parameters (all GET collection endpoints):**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | `'hr' \| 'en'` | `'hr'` | Response language for localised fields |
| `limit` | integer | 10 | Results per page (max 100) |
| `page` | integer | 1 | Page number (1-indexed) |
| `sort` | string | `-createdAt` | Field name; prefix `-` for descending |
| `where[field][op]` | string | — | Filter operators: `equals`, `not_equals`, `like`, `in`, `exists`, `greater_than`, `less_than` |
| `depth` | integer | 1 | Relationship population depth (0=IDs only, 1=one level) |

---

### 9.1 Authentication Endpoints

#### POST /api/users/login

**Description:** Authenticate a user. Sets an HttpOnly JWT cookie.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secretpassword"
}
```

**Response 200 OK:**
```json
{
  "message": "Auth Passed",
  "user": {
    "id": "3f2d1a-...",
    "email": "user@example.com",
    "name": "Ana Horvat",
    "role": "member",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-20T14:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```
Sets `Set-Cookie: payload-token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/`

**Response 401 Unauthorized:**
```json
{
  "errors": [{ "message": "The email or password provided is incorrect." }]
}
```

**Status codes:** `200` success · `400` validation error · `401` invalid credentials · `429` rate limited

---

#### POST /api/users/logout

**Description:** Invalidates the current session. Clears the JWT cookie.

**Request:** No body. Auth cookie required.

**Response 200 OK:**
```json
{ "message": "You have been logged out successfully." }
```

**Status codes:** `200` success · `401` not authenticated

---

#### GET /api/users/me

**Description:** Returns the currently authenticated user.

**Request:** No body. Auth cookie or `Authorization: JWT <token>` header required.

**Response 200 OK:**
```json
{
  "user": {
    "id": "3f2d1a-...",
    "email": "user@example.com",
    "name": "Ana Horvat",
    "role": "member",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-20T14:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Status codes:** `200` success · `401` not authenticated

---

#### POST /api/users (Register)

**Description:** Create a new member account.

**Request:**
```json
{
  "email": "new@example.com",
  "password": "SecurePass123",
  "name": "Marko Perić"
}
```

**Response 201 Created:**
```json
{
  "message": "User successfully created.",
  "doc": {
    "id": "a1b2c3-...",
    "email": "new@example.com",
    "name": "Marko Perić",
    "role": "member",
    "createdAt": "2026-03-21T12:00:00.000Z",
    "updatedAt": "2026-03-21T12:00:00.000Z"
  }
}
```

**Response 400 Bad Request (duplicate email):**
```json
{
  "errors": [{ "message": "The following field is already taken: email", "field": "email" }]
}
```

**Validation rules (Zod, applied server-side in Payload collection beforeValidate hook):**
- `email`: valid email format, max 255 chars
- `password`: min 8 chars, must contain at least one letter and one number
- `name`: optional, max 200 chars

**Status codes:** `201` created · `400` validation error · `409` email conflict

---

#### POST /api/users/forgot-password

**Request:** `{ "email": "user@example.com" }`

**Response 200 OK (always — does not reveal whether email exists):**
```json
{ "message": "Success" }
```

---

#### POST /api/users/reset-password

**Request:** `{ "token": "abc123resettoken", "password": "NewSecurePass456" }`

**Response 200 OK:**
```json
{ "message": "Password reset successfully." }
```

**Status codes:** `200` success · `400` invalid/expired token

---

### 9.2 Court Decisions Endpoints

#### GET /api/court-decisions

**Description:** Paginated, filterable list of court decisions.

**Example request:**
```
GET /api/court-decisions?locale=hr&limit=20&page=1&sort=-date
  &where[_status][equals]=published
  &where[decision_type][equals]=civil
  &where[_search][like]=ugovor+o+najmu
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "d1a2b3-...",
      "title": "Ugovor o najmu stana — raskid ugovora",
      "court": {
        "id": "c1a2b3-...",
        "name": "Općinski sud u Zagrebu",
        "type": "opcinski"
      },
      "date": "2025-06-15T00:00:00.000Z",
      "decisionType": "civil",
      "caseNumber": "Pn-1234/25",
      "summary": "Sud je odlučio da najmodavac ima pravo raskinuti ugovor...",
      "category": "Građansko pravo",
      "tags": ["najam", "raskid", "stanovanje"],
      "_status": "published",
      "publishedAt": "2025-06-20T10:00:00.000Z",
      "createdAt": "2025-06-20T10:00:00.000Z",
      "updatedAt": "2025-06-20T10:00:00.000Z"
    }
  ],
  "totalDocs": 247,
  "limit": 20,
  "totalPages": 13,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

**Status codes:** `200` success · `400` invalid query params

---

#### GET /api/court-decisions/:id

**Description:** Single court decision with full Lexical content.

**Example request:** `GET /api/court-decisions/d1a2b3-...?locale=hr&depth=1`

**Response 200 OK:**
```json
{
  "id": "d1a2b3-...",
  "title": "Ugovor o najmu stana — raskid ugovora",
  "court": {
    "id": "c1a2b3-...",
    "name": "Općinski sud u Zagrebu",
    "type": "opcinski",
    "address": "Ulica grada Vukovara 84, 10000 Zagreb",
    "county": "Grad Zagreb"
  },
  "date": "2025-06-15T00:00:00.000Z",
  "decisionType": "civil",
  "caseNumber": "Pn-1234/25",
  "fullText": { "root": { "type": "root", "children": [...] } },
  "summary": "Sud je odlučio da najmodavac ima pravo raskinuti ugovor...",
  "category": "Građansko pravo",
  "tags": ["najam", "raskid", "stanovanje"],
  "attachments": [
    {
      "id": "m1a2b3-...",
      "filename": "odluka-pn-1234-25.pdf",
      "mimeType": "application/pdf",
      "filesize": 245760,
      "url": "/api/media/file/odluka-pn-1234-25.pdf"
    }
  ],
  "_status": "published",
  "publishedAt": "2025-06-20T10:00:00.000Z",
  "createdAt": "2025-06-20T10:00:00.000Z",
  "updatedAt": "2025-06-20T10:00:00.000Z"
}
```

**Status codes:** `200` success · `404` not found

---

#### POST /api/court-decisions

**Auth required:** `admin` or `editor` role.

**Request body (all localised fields accept `_hr`/`_en` suffixed keys via Payload `locale` parameter):**
```json
{
  "title": "Decision title in Croatian",
  "court": "c1a2b3-...",
  "date": "2026-03-01T00:00:00.000Z",
  "decisionType": "civil",
  "caseNumber": "Pn-100/26",
  "summary": "Short summary...",
  "fullText": { "root": { ... } },
  "category": "Građansko pravo",
  "tags": ["ugovor", "najam"],
  "_status": "published"
}
```

**Response 201 Created:** Full document (same shape as GET /:id)

**Status codes:** `201` created · `400` validation error · `401` unauthenticated · `403` forbidden

---

#### PATCH /api/court-decisions/:id

**Auth required:** `admin` or `editor` role.

**Request body:** Partial — any field from POST body.

**Response 200 OK:** Updated document.

**Status codes:** `200` success · `400` validation error · `401` · `403` · `404` not found

---

#### DELETE /api/court-decisions/:id

**Auth required:** `admin` role only.

**Response 200 OK:** `{ "message": "Court Decision with id d1a2b3-... successfully deleted." }`

**Status codes:** `200` success · `401` · `403` · `404`

---

### 9.3 Expert Witnesses Endpoints

#### GET /api/expert-witnesses

**Example request:**
```
GET /api/expert-witnesses?locale=hr&limit=20&page=1
  &where[verified][equals]=true
  &where[speciality_areas][in]=medicina
  &where[_search][like]=horvat
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "ew1a2b-...",
      "name": "Dr. Ivan Horvat",
      "specialityAreas": ["Medicina — opća", "Traumatologija"],
      "languages": ["Hrvatski", "Engleski", "Njemački"],
      "contactEmail": "ivan.horvat@example.com",
      "contactPhone": "+385 1 234 5678",
      "verified": true,
      "verifiedAt": "2025-01-10T00:00:00.000Z",
      "photo": {
        "id": "m2a3b4-...",
        "url": "/api/media/file/ivan-horvat.jpg",
        "alt": "Dr. Ivan Horvat"
      },
      "courtAssignments": [
        { "id": "c1a2b3-...", "name": "Općinski sud u Zagrebu" }
      ],
      "createdAt": "2025-01-10T00:00:00.000Z",
      "updatedAt": "2025-03-01T00:00:00.000Z"
    }
  ],
  "totalDocs": 143,
  "limit": 20,
  "totalPages": 8,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

#### GET /api/expert-witnesses/:id

**Response 200 OK:** Full profile (same structure as list item but with `notes` field included).

**POST / PATCH / DELETE /api/expert-witnesses(/:id):** Same auth pattern as court decisions.

---

### 9.4 Interpreters Endpoints

#### GET /api/interpreters

**Example request:**
```
GET /api/interpreters?locale=hr&limit=20
  &where[language_pairs.target_language][like]=engleski
  &where[verified][equals]=true
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "int1a2b-...",
      "name": "Petra Kovačević",
      "languagePairs": [
        { "sourceLanguage": "Hrvatski", "targetLanguage": "Engleski" },
        { "sourceLanguage": "Engleski", "targetLanguage": "Hrvatski" }
      ],
      "contactEmail": "petra.kovacevic@example.com",
      "contactPhone": "+385 91 234 5678",
      "verified": true,
      "verifiedAt": "2024-11-05T00:00:00.000Z",
      "courtAssignments": [
        { "id": "c1a2b3-...", "name": "Županijski sud u Zagrebu" }
      ],
      "createdAt": "2024-11-05T00:00:00.000Z",
      "updatedAt": "2025-02-10T00:00:00.000Z"
    }
  ],
  "totalDocs": 89,
  "limit": 20,
  "totalPages": 5,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

---

### 9.5 Courts Endpoints

#### GET /api/courts

**Example request:**
```
GET /api/courts?locale=hr&limit=100&where[type][equals]=opcinski&sort=name_hr
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "c1a2b3-...",
      "name": "Općinski sud u Zagrebu",
      "type": "opcinski",
      "address": "Ulica grada Vukovara 84, 10000 Zagreb",
      "phone": "+385 1 480 0111",
      "fax": "+385 1 480 0112",
      "email": "os-zagreb@pravosudje.hr",
      "website": "https://sudovi.pravosudje.hr/oszu/",
      "president": "Neven Arend",
      "county": "Grad Zagreb",
      "geolocation": { "lat": 45.8003, "lng": 15.9824 },
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-02-15T00:00:00.000Z"
    }
  ],
  "totalDocs": 24,
  "limit": 100,
  "totalPages": 1,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": false,
  "prevPage": null,
  "nextPage": null
}
```

**Valid `type` values:** `opcinski` · `zupanijski` · `trgovacki` · `prekrsajni` · `upravni` · `vrhovni` · `ustavni` · `vts` · `dorh`

---

### 9.6 News Posts Endpoints

#### GET /api/news-posts

**Example request:**
```
GET /api/news-posts?locale=hr&limit=10&page=1&sort=-published_at
  &where[_status][equals]=published
  &where[category][equals]=vijesti
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "np1a2b-...",
      "title": "Novi Zakon o stečaju stupio na snagu",
      "slug": "novi-zakon-o-stecaju-stupio-na-snagu",
      "category": "vijesti",
      "publishedAt": "2026-03-15T09:00:00.000Z",
      "metaDescription": "Novi Zakon o stečaju stupio je na snagu 15. ožujka 2026...",
      "featuredImage": {
        "id": "m3a4b5-...",
        "url": "/api/media/file/vijest-stecaj.jpg",
        "alt": "Sudnica",
        "width": 1200,
        "height": 630
      },
      "_status": "published",
      "createdAt": "2026-03-14T16:00:00.000Z",
      "updatedAt": "2026-03-15T09:00:00.000Z"
    }
  ],
  "totalDocs": 58,
  "limit": 10,
  "totalPages": 6,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

#### GET /api/news-posts?where[slug][equals]=:slug&locale=hr

**Response 200 OK:** Same as list but with `content` (full Lexical JSON) field included.

---

### 9.7 Bankruptcy Endpoints

#### GET /api/bankruptcy-listings

**Example request:**
```
GET /api/bankruptcy-listings?locale=hr&limit=20&sort=-deadline
  &where[status][equals]=active
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "bl1a2b-...",
      "caseNo": "St-5/2024",
      "debtor": "Atlantik d.o.o.",
      "court": { "id": "c1a2b3-...", "name": "Trgovački sud u Zagrebu" },
      "administrator": { "id": "ba1a2b-...", "name": "Stjepan Blažević" },
      "assets": [
        "Poslovni prostor, Savska 41, Zagreb — 320 m²",
        "Osobni automobil Volkswagen Passat, reg. ZG-1234-AB"
      ],
      "deadline": "2026-04-30T23:59:59.000Z",
      "status": "active",
      "publishedAt": "2026-03-01T00:00:00.000Z",
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "totalDocs": 12,
  "limit": 20,
  "totalPages": 1,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": false,
  "prevPage": null,
  "nextPage": null
}
```

#### GET /api/bankruptcy-administrators

**Example request:** `GET /api/bankruptcy-administrators?where[_search][like]=blaz&sort=name`

**Response 200 OK:** Standard paginated list with fields: `id`, `name`, `contactEmail`, `contactPhone`, `address`.

---

### 9.8 Laws and Documents Endpoints

#### GET /api/laws

**Example request:**
```
GET /api/laws?locale=hr&sort=-year&where[type][equals]=stecajni
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "law1a2b-...",
      "title": "Stečajni zakon",
      "type": "stecajni",
      "year": 2015,
      "effectiveDate": "2015-09-01",
      "supersededBy": null,
      "pdfAttachment": {
        "id": "m4a5b6-...",
        "url": "/api/media/file/stecajni-zakon-2015.pdf",
        "filename": "stecajni-zakon-2015.pdf",
        "filesize": 1048576
      },
      "publishedAt": "2026-01-01T00:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "totalDocs": 28,
  "limit": 20,
  "totalPages": 2,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

#### GET /api/documents

**Example request:**
```
GET /api/documents?locale=hr&sort=-published_at
  &where[category_hr][like]=strucni
```

**Response 200 OK:**
```json
{
  "docs": [
    {
      "id": "doc1a2b-...",
      "title": "Analiza primjene Stečajnog zakona u praksi",
      "category": "Stručni radovi",
      "publishedAt": "2025-11-10T00:00:00.000Z",
      "file": {
        "id": "m5a6b7-...",
        "url": "/api/media/file/analiza-stecaj.pdf",
        "filename": "analiza-stecaj.pdf",
        "filesize": 524288,
        "mimeType": "application/pdf"
      },
      "createdAt": "2025-11-10T00:00:00.000Z",
      "updatedAt": "2025-11-10T00:00:00.000Z"
    }
  ],
  "totalDocs": 34,
  "limit": 20,
  "totalPages": 2,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

---

### 9.9 Custom Endpoint: Global Search

#### GET /api/search

**Description:** Cross-collection full-text search using pg_trgm. Returns grouped results (max 5 per group by default).

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |
| `locale` | `'hr' \| 'en'` | No | Default: `'hr'` |
| `limit` | integer | No | Max results per group (default 5, max 10) |

**Example request:** `GET /api/search?q=ugovor+o+najmu&locale=hr&limit=5`

**Response 200 OK:**
```json
{
  "query": "ugovor o najmu",
  "locale": "hr",
  "results": {
    "decisions": {
      "docs": [
        {
          "id": "d1a2b3-...",
          "title": "Ugovor o najmu stana — raskid ugovora",
          "date": "2025-06-15T00:00:00.000Z",
          "decisionType": "civil",
          "summary": "...najmodavac ima pravo raskinuti ugovor..."
        }
      ],
      "totalDocs": 14
    },
    "experts": {
      "docs": [],
      "totalDocs": 0
    },
    "courts": {
      "docs": [],
      "totalDocs": 0
    },
    "news": {
      "docs": [
        {
          "id": "np1a2b-...",
          "title": "Izmjene zakona o najmu stanova",
          "slug": "izmjene-zakona-o-najmu-stanova",
          "publishedAt": "2026-02-10T00:00:00.000Z"
        }
      ],
      "totalDocs": 1
    }
  }
}
```

**Response 400 Bad Request (query too short):**
```json
{
  "errors": [{ "message": "Search query must be at least 2 characters.", "field": "q" }]
}
```

**Status codes:** `200` success · `400` invalid params · `500` database error

---

### 9.10 Custom Endpoint: Contact Form

#### POST /api/contact

**Description:** Submits the contact form. Validates server-side with Zod. Sends email via Resend API. Rate limited at Caddy to 3 req/min/IP.

**Request body:**
```json
{
  "name": "Ana Knežević",
  "email": "ana@example.com",
  "subject": "suradnja",
  "message": "Zanima me suradnja na projektu digitalizacije sudske prakse."
}
```

**Validation rules:**

| Field | Rule |
|-------|------|
| `name` | Required, string, min 2 chars, max 200 chars |
| `email` | Required, valid email format, max 255 chars |
| `subject` | Required, enum: `prijedlog` · `kritika` · `suradnja` · `mediji` · `ostalo` |
| `message` | Required, string, min 20 chars, max 5000 chars |

**Response 200 OK:**
```json
{ "message": "Vaša poruka je uspješno poslana." }
```

**Response 400 Bad Request:**
```json
{
  "errors": [
    { "field": "email", "message": "Unesite valjanu e-mail adresu." },
    { "field": "message", "message": "Poruka mora imati najmanje 20 znakova." }
  ]
}
```

**Response 429 Too Many Requests:**
```json
{ "errors": [{ "message": "Previše zahtjeva. Pokušajte ponovo za 60 sekundi." }] }
```

**Status codes:** `200` success · `400` validation error · `429` rate limited · `500` email service error

---

### 9.11 RSS Feed Endpoints

#### GET /api/rss/news.xml

**Description:** RSS 2.0 feed of the latest 20 published news posts.

**Query parameters:** `locale=hr|en` (default: `hr`)

**Response 200 OK:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sudačka mreža — Vijesti</title>
    <link>https://sudacka-mreza.hr/vijesti/</link>
    <description>Najnovije vijesti s portala Sudačka mreža</description>
    <language>hr</language>
    <lastBuildDate>Fri, 21 Mar 2026 12:00:00 +0000</lastBuildDate>
    <atom:link href="https://sudacka-mreza.hr/api/rss/news.xml"
               rel="self" type="application/rss+xml"/>
    <item>
      <title>Novi Zakon o stečaju stupio na snagu</title>
      <link>https://sudacka-mreza.hr/vijesti/novi-zakon-o-stecaju-stupio-na-snagu</link>
      <description>Novi Zakon o stečaju stupio je na snagu 15. ožujka 2026...</description>
      <pubDate>Sun, 15 Mar 2026 09:00:00 +0000</pubDate>
      <guid>https://sudacka-mreza.hr/vijesti/novi-zakon-o-stecaju-stupio-na-snagu</guid>
    </item>
  </channel>
</rss>
```

**Content-Type:** `application/rss+xml; charset=UTF-8`

**Status codes:** `200` success · `500` server error

---

#### GET /api/rss/court-decisions.xml

Same structure as news RSS. `<title>` field contains the case number + decision title. `<link>` points to `/sudska-praksa/:id`.

---

## 10. Frontend Components

### 10.1 Route Tree

```
/                                →  App.tsx
  /:locale/                      →  LocaleLayout (sets i18next language from URL)
    /                            →  HomePage
    /pretraga/                   →  GlobalSearchResultsPage
    /vijesti/                    →  NewsListPage
    /vijesti/:slug               →  NewsDetailPage
    /sudska-praksa/pretraga/     →  CaseLawSearchPage
    /sudska-praksa/:id           →  CaseLawDetailPage
    /sudska-praksa/vts/          →  VTSPage
    /sudska-praksa/esljp/        →  ESLJPPage
    /strucnjaci/vjestaci/        →  ExpertWitnessListPage
    /strucnjaci/vjestaci/:id     →  ExpertWitnessDetailPage
    /strucnjaci/tumaci/          →  InterpreterListPage
    /strucnjaci/tumaci/:id       →  InterpreterDetailPage
    /sudovi/                     →  CourtsListPage
    /sudovi/:id                  →  CourtDetailPage
    /sudovi/dorh/                →  StateAttorneyListPage
    /sudovi/nadleznost/          →  JurisdictionMapPage
    /stecaj/                     →  BankruptcyLandingPage
    /stecaj/ponude/              →  BankruptcySalesPage
    /stecaj/upravitelji/         →  BankruptcyAdministratorsPage
    /stecaj/zakoni/              →  BankruptcyLawsPage
    /stecaj/radovi/              →  BankruptcyExpertPapersPage
    /stecaj/sudska-praksa/       →  BankruptcyCaseLawPage
    /pristojbe/                  →  CourtFeeCalculatorPage
    /dokumenti/                  →  DocumentLibraryPage
    /galerije/                   →  GalleriesListPage
    /galerije/:id                →  GalleryDetailPage
    /o-nama/                     →  AboutPage
    /pravna-pomoc/               →  FreeLegalAidPage
    /kontakt/                    →  ContactPage
    /prijava/                    →  LoginPage
    /registracija/               →  RegisterPage
    /clanovi/                    →  MemberAreaPage  [protected]
    *                            →  NotFoundPage
```

Language routing strategy: `i18next` URL-path detection maps `/hr/*` and `/en/*`. Default language `hr` is served at `/` (no prefix) with a redirect from `/hr/` for canonicality. `LanguageSwitch` swaps the path prefix in-place.

---

### 10.2 Component Tree

```
App.tsx
├── AuthProvider (context/AuthContext.tsx)
│   └── ThemeProvider (context/ThemeContext.tsx)
│       └── RouterProvider (router/index.tsx)
│           ├── RootLayout
│           │   ├── Header
│           │   │   ├── Logo (link to /)
│           │   │   ├── NavLink × N (react-router Link with active styling)
│           │   │   ├── SearchBar (global typeahead)
│           │   │   ├── LanguageSwitch
│           │   │   ├── ThemeToggle (dark/light)
│           │   │   └── AuthButton (login / user menu / logout)
│           │   ├── <Outlet /> (page content)
│           │   └── Footer
│           │       ├── FooterLinkColumn × 4
│           │       ├── SocialLinks
│           │       └── CopyrightBar
│           └── [page components — see §10.3]
```

---

### 10.3 UI Component Specifications

#### Button

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';          // default: 'md'
  isLoading?: boolean;                  // shows spinner, disables interaction
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset'; // default: 'button'
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;                   // required when children is icon-only
}
```

State: none (pure presentational). Uses `disabled` HTML attribute when `isLoading` or `disabled` is true.

---

#### Card

```typescript
interface CardProps {
  header?: React.ReactNode;             // optional slot — title, badge row
  children: React.ReactNode;            // body content
  footer?: React.ReactNode;             // optional slot — actions, metadata
  badge?: { label: string; color: 'blue' | 'green' | 'red' | 'gray' | 'yellow' };
  onClick?: () => void;                 // makes card keyboard-focusable (role="button")
  className?: string;
  as?: 'article' | 'div' | 'li';       // default: 'div'
}
```

---

#### Badge

```typescript
interface BadgeProps {
  label: string;
  variant: 'opcinski' | 'zupanijski' | 'trgovacki' | 'prekrsajni' | 'upravni'
         | 'vrhovni' | 'ustavni' | 'vts' | 'dorh'
         | 'vijesti' | 'obavijesti' | 'natjecaji' | 'ostalo'
         | 'verified' | 'draft' | 'published' | 'active' | 'closed'
         | 'default';
  size?: 'sm' | 'md';                  // default: 'sm'
}
```

Each variant maps to a specific Tailwind colour class pair (background + text). Colours defined in `tailwind.config.ts` as semantic tokens.

---

#### Alert

```typescript
interface AlertProps {
  type: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
  dismissable?: boolean;               // shows × button; default: false
  onDismiss?: () => void;
}
```

State: `isDismissed: boolean` (internal). Renders `role="alert"` for screen readers. Auto-announces via live region.

---

#### Modal

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full'; // default: 'md'
  footer?: React.ReactNode;
}
```

State: tracks focus sentinel refs for focus trap. Attaches `keydown` listener for Escape. Renders portal via `createPortal` into `document.body`. Uses `aria-modal="true"`, `aria-labelledby` pointing to title element.

---

#### Pagination

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;               // pages shown either side of current; default: 1
}
```

State: none (controlled). Renders `<nav aria-label="Navigacija stranicama">`, uses `aria-current="page"` on active page button.

---

#### DataTable

```typescript
interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;                      // e.g. '200px', 'auto'
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
}
```

State: none in component (sort state lifted to parent via `onSort`). Uses `aria-sort` attribute on column headers. Falls back to card layout at `< 640px` breakpoint.

---

#### SearchBar (global typeahead)

```typescript
interface SearchBarProps {
  placeholder?: string;                // defaults to i18n key 'search.placeholder'
  onSearch?: (query: string) => void;  // called on Enter or explicit search button
  className?: string;
}
```

State:
- `query: string` — current input value
- `results: SearchResultsGrouped | null` — typeahead dropdown data
- `isOpen: boolean` — dropdown visibility
- `isLoading: boolean` — fetch in flight

Behaviour:
- 300ms debounce before firing `GET /api/search?q={query}&limit=3`
- Escape closes dropdown; Tab moves focus out and closes dropdown
- `aria-expanded`, `aria-controls`, `role="combobox"` on input
- Dropdown items: `role="option"`, navigable with arrow keys

---

#### LexicalRenderer

```typescript
interface LexicalRendererProps {
  content: LexicalRootNode;            // Payload Lexical JSON
  className?: string;
}
```

Converts Payload Lexical AST to HTML string, sanitises with DOMPurify (allowed tags: `p`, `h1`–`h6`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `u`, `s`, `blockquote`, `code`, `pre`, `br`, `hr`, `img`), then sets via `dangerouslySetInnerHTML`.

---

#### BookmarkButton

```typescript
interface BookmarkButtonProps {
  decisionId: string;
  decisionTitle: string;
  decisionDate: string;
  decisionCourt: string;
}
```

State: reads/writes `useBookmarks()` hook (localStorage). `aria-label` switches between "Save bookmark" / "Remove bookmark". Renders filled/unfilled heart icon.

---

#### Header

```typescript
interface HeaderProps {}  // no props — reads from AuthContext, ThemeContext, i18n
```

State:
- `isMobileMenuOpen: boolean` — hamburger menu toggle
- `isUserMenuOpen: boolean` — user avatar dropdown

Navigation items defined in `router/navItems.ts` as a typed array with `{ label: string; path: string; icon?: LucideIcon; children?: NavItem[] }`.

---

#### LanguageSwitch

```typescript
interface LanguageSwitchProps {}  // reads current locale from URL via useParams
```

State: none. Reads current `/:locale/` path segment, swaps between `hr` and `en`, preserves remaining path. Uses React Router `useNavigate`.

---

### 10.4 Page Component Specifications

#### HomePage (`/`)

**Props:** none

**State:**
- `recentDecisions: CourtDecision[]` — latest 3 published decisions
- `recentNews: NewsPost[]` — latest 3 news posts
- `isLoading: boolean`

**Data fetched on mount:**
- `GET /api/court-decisions?limit=3&sort=-published_at&where[_status][equals]=published&locale={locale}`
- `GET /api/news-posts?limit=3&sort=-published_at&where[_status][equals]=published&locale={locale}`

**Sections (in order):**
1. Hero — full-width banner, site tagline, SearchBar
2. Quick-access grid — 6 cards: Court Decisions, Expert Witnesses, Interpreters, Courts Directory, Bankruptcy Portal, Legal Aid
3. Recent decisions strip — 3 Card components, "View all" link
4. Recent news strip — 3 Card components, "View all" link
5. Stats bar — "Since 2001 · X decisions · Y experts" (static/CMS-driven)

---

#### CaseLawSearchPage (`/sudska-praksa/pretraga/`)

**Props:** none

**State:**
- `query: string` — sync'd to URL `?q=`
- `court: string` — sync'd to URL `?court=`
- `decisionType: string` — sync'd to URL `?type=`
- `dateFrom: string` — sync'd to URL `?from=`
- `dateTo: string` — sync'd to URL `?to=`
- `page: number` — sync'd to URL `?page=`
- `results: PayloadListResponse<CourtDecision> | null`
- `courts: Court[]` — for court dropdown (loaded once on mount)
- `isLoading: boolean`

URL is the source of truth for all filter state. On filter change: update URL → effect triggers re-fetch.

---

#### JurisdictionMapPage (`/sudovi/nadleznost/`)

**Props:** none

**State:**
- `courts: Court[]` — all courts with `geolocation`
- `selectedCounty: string | null`
- `selectedCourt: Court | null`
- `isLoading: boolean`

**Leaflet map setup:**
- Tiles: OpenStreetMap (no API key required)
- GeoJSON layer: `assets/croatia-counties.geojson` (GADM Level 2, 21 counties)
- Each county polygon `onClick` → `setSelectedCounty(feature.properties.NAME_2)` → popup with matching court data
- Map bounds constrained to Croatia: `[[42.0, 13.5], [46.8, 19.5]]`
- All Leaflet CSS imported lazily to avoid SSR issues

---

#### CourtFeeCalculatorPage (`/pristojbe/`)

**Props:** none

**State:**
- `step: 1 | 2 | 3` — wizard step
- `feeType: string` — dropdown selection (e.g. "civil_complaint", "criminal", "administrative")
- `claimValue: number` — numeric input (EUR, ≥ 0)
- `result: { fee: number; breakdown: FeeBreakdownLine[] } | null`
- `errors: Record<string, string>`

**Fee calculation:** Pure functions in `utils/feeCalculator.ts`. No API call needed — all logic runs client-side. Fee schedule hard-coded per Croatian court fee regulations (Zakon o sudskim pristojbama).

**Fee types and logic:**

| Type | Formula |
|------|---------|
| `civil_complaint` | Tiered: ≤ €133: €6.64; ≤ €666: 5% of value; ≤ €1,999: €33.18 + 2.5% above €666; ≤ €6,638: €66.36 + 1.5% above €1,999; ≤ €13,272: €136.12 + 1% above €6,638; > €13,272: €202.48 + 0.5% above €13,272; max €1,327.20 |
| `commercial` | Same tiers as civil, capped at €2,654.40 |
| `administrative_court` | Flat €26.54 |
| `constitutional_appeal` | Flat €26.54 |
| `enforcement` | 50% of civil complaint fee for the claimed amount |

---

#### LoginPage (`/prijava/`)

**Props:** none

**State:**
- `email: string`
- `password: string`
- `isLoading: boolean`
- `error: string | null`

**On submit:**
1. Client-side Zod validation
2. `POST /api/users/login`
3. On 200: store user in `AuthContext`; navigate to `redirectTo` param or `/clanovi/`
4. On 401: set `error` state with generic message

---

#### MemberAreaPage (`/clanovi/`) — Protected

**Route guard:** `PrivateRoute` wrapper checks `AuthContext.user`. If null: redirect to `/prijava/?redirect=/clanovi/`.

**State:**
- `bookmarks: BookmarkEntry[]` — loaded from `useBookmarks()` hook (localStorage)

**Renders:**
- User profile card (email, role badge)
- Bookmarked decisions list (each as Card with remove action)
- Empty state if no bookmarks

---

## 11. Security

### 11.1 Authentication and Authorisation

**Mechanism:** Payload CMS JWT authentication.

- JWT secret: `PAYLOAD_SECRET` environment variable (min 32 random bytes; never committed).
- JWT algorithm: `HS256`.
- Token lifetime: 2 hours (configurable in Payload config `tokenExpiration`).
- Token storage: **HttpOnly, Secure, SameSite=Strict cookie** named `payload-token`. Never written to `localStorage` or `sessionStorage` by the frontend (§6.4 acceptance criterion).
- Token refresh: not implemented for MVP. Users re-authenticate after expiry.

**Role-based access control (RBAC):**

| Role | Access |
|------|--------|
| `admin` | Full CRUD on all 13 collections; user management; can change any user's role |
| `editor` | Create, read, update (no delete) on: court-decisions, expert-witnesses, interpreters, courts, state-attorneys, bankruptcy-listings, bankruptcy-administrators, laws, news-posts, pages, galleries, documents |
| `member` | Read-only on all published content; access to `/clanovi/` (own bookmarks) |
| Anonymous | Read-only on all published content; no admin panel access |

**Collection access rules (Payload `access` config):**

```typescript
// Example: CourtDecisions collection
access: {
  read:   () => true,                            // public
  create: isAdminOrEditor,
  update: isAdminOrEditor,
  delete: isAdmin,
}

// isAdminOrEditor helper
const isAdminOrEditor = ({ req }) =>
  req.user?.role === 'admin' || req.user?.role === 'editor';

const isAdmin = ({ req }) => req.user?.role === 'admin';
```

**Password security:**
- bcrypt hash, cost factor 12 (Payload default).
- Passwords never returned in API responses (Payload removes `password` field from all GET responses).
- Reset tokens: single-use, 1-hour expiry, stored as bcrypt hash.

**Account lockout:**
- Payload built-in: 5 failed login attempts → account locked for 10 minutes.
- Additional protection: Caddy rate limit on `/api/users/login` (5 req/min/IP).

---

### 11.2 Input Validation Rules

All user-facing inputs are validated at two layers:

**Layer 1 — Client-side (Zod, immediate feedback):**
Prevents unnecessary network requests. Inline error messages shown per field.

**Layer 2 — Server-side (Zod + Payload collection hooks, authoritative):**
All requests validated regardless of client behaviour.

**Shared validation schemas (`web/src/api/types.ts` + mirrored in `cms/src/collections/`):**

```typescript
// Contact form
const ContactSchema = z.object({
  name:    z.string().min(2).max(200),
  email:   z.string().email().max(255),
  subject: z.enum(['prijedlog', 'kritika', 'suradnja', 'mediji', 'ostalo']),
  message: z.string().min(20).max(5000),
});

// Registration
const RegisterSchema = z.object({
  email:           z.string().email().max(255),
  password:        z.string().min(8).max(128)
                     .regex(/[a-zA-Z]/, 'Must contain a letter')
                     .regex(/[0-9]/,    'Must contain a number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

// Search query
const SearchQuerySchema = z.object({
  q:      z.string().min(2).max(500),
  locale: z.enum(['hr', 'en']).default('hr'),
  limit:  z.coerce.number().int().min(1).max(10).default(5),
});
```

**Rich text sanitisation:**
All Lexical JSON rendered via `LexicalRenderer.tsx` is passed through `DOMPurify.sanitize()` with a strict allowlist before being set as `innerHTML`. This prevents XSS from any injected content in CMS-stored Lexical rich text.

---

### 11.3 CORS Policy

CORS configured in `cms/src/payload.config.ts`:

```typescript
cors: [
  'https://sudacka-mreza.hr',          // production frontend
  'http://localhost:5173',              // Vite dev server
  'http://localhost:4093',              // dev web Nginx
],
```

- **Allowed methods:** `GET, POST, PATCH, DELETE, OPTIONS`
- **Allowed headers:** `Content-Type, Authorization`
- **Credentials:** `true` (required for HttpOnly cookie auth)
- All other origins receive `403 Forbidden` on preflight.

---

### 11.4 HTTP Security Headers

Set by Caddy (applies to all responses):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';   # Required for Vite inline scripts
  style-src 'self' 'unsafe-inline';    # Required for Tailwind inline styles
  img-src 'self' data: https://*.tile.openstreetmap.org;
  frame-src https://www.youtube.com https://player.vimeo.com;
  connect-src 'self';
  font-src 'self';
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';

X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

### 11.5 File Upload Security

- **MIME allowlist** enforced in Payload upload config (not client-reported `Content-Type` — Payload uses file-type detection):
  `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `audio/mpeg`, `video/mp4`
- **Max file size:** 50 MB (enforced at Payload layer and Caddy `request_body_max` directive).
- **File storage:** `cms/uploads/` (Docker volume, not web-accessible directly). Files served via Payload upload handler at `/api/media/file/:filename`.
- **Filename sanitisation:** Payload strips path traversal characters and URL-encodes the filename.
- `Documents` collection additionally restricts to: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` only.

---

## 12. Error Handling

### 12.1 Standard Error Response Format

**All Payload CMS API errors follow this envelope:**

```typescript
interface PayloadErrorResponse {
  errors: Array<{
    message: string;
    field?: string;   // present for field-level validation errors
    data?:  unknown;  // additional error context (optional)
  }>;
}
```

**HTTP status codes used:**

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation error (missing/invalid fields) |
| 401 | Unauthorized | Not authenticated (no valid JWT cookie) |
| 403 | Forbidden | Authenticated but insufficient role |
| 404 | Not Found | Document ID does not exist |
| 409 | Conflict | Unique constraint violation (e.g. duplicate email) |
| 413 | Payload Too Large | File upload exceeds 50 MB limit |
| 415 | Unsupported Media Type | File MIME type not in allowlist |
| 422 | Unprocessable Entity | Business logic error (e.g. reset token expired) |
| 429 | Too Many Requests | Caddy rate limit exceeded |
| 500 | Internal Server Error | Unexpected server-side exception |

---

### 12.2 Application Error Codes

Custom error codes used in `message` field for programmatic handling on the frontend:

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Email or password incorrect |
| `AUTH_ACCOUNT_LOCKED` | 401 | Too many failed login attempts |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT cookie has expired |
| `AUTH_INSUFFICIENT_ROLE` | 403 | User role does not permit this action |
| `VALIDATION_REQUIRED` | 400 | Required field missing |
| `VALIDATION_FORMAT` | 400 | Field format invalid |
| `VALIDATION_DUPLICATE` | 409 | Unique field already taken |
| `UPLOAD_SIZE_EXCEEDED` | 413 | File too large |
| `UPLOAD_TYPE_REJECTED` | 415 | MIME type not allowed |
| `SEARCH_QUERY_TOO_SHORT` | 400 | Search query < 2 chars |
| `CONTACT_RATE_LIMITED` | 429 | Contact form rate limit hit |
| `CONTACT_EMAIL_FAILED` | 500 | Resend API call failed |

---

### 12.3 Client-Side Error Handling Strategy

**API client (`web/src/api/client.ts`):**

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public errors: PayloadError[],
  ) {
    super(errors[0]?.message ?? 'Unknown error');
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',         // send JWT cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ errors: [] }));
    throw new ApiError(res.status, body.errors?.[0]?.message ?? 'API_ERROR', body.errors ?? []);
  }

  const data = await res.json();
  return ResponseSchema.parse(data);  // Zod parse validates shape
}
```

**React error boundaries:**
- `RootErrorBoundary` wraps the entire app. Catches unhandled errors, renders a full-page error state with a "Return to homepage" link.
- Route-level `Suspense` boundaries catch lazy-loading failures independently per page.

**Loading states:**
- All data-fetching components render a skeleton placeholder (matching the content layout) while `isLoading: true`.
- Empty states rendered when `docs.length === 0` with a meaningful message and a call-to-action.

**Form error display:**
- Field-level errors: displayed below the relevant `<input>` as `<p role="alert" aria-live="polite">` in red text.
- Form-level errors: rendered as an `<Alert type="error">` above the submit button.
- On successful submission: `<Alert type="success">` replaces the form or is inserted above it; form fields are cleared.

**Auth expiry handling:**
- The API client catches `ApiError` with `status === 401`. If the user was previously authenticated (i.e., `AuthContext.user` is set), it calls `AuthContext.logout()` and redirects to `/prijava/?expired=true`. The login page shows an informational alert if the `?expired` param is present.

---

## 13. Performance Requirements

### 13.1 Response Time Targets

| Operation | Target | Measurement Point |
|-----------|--------|------------------|
| Simple list query (paginated, no FTS) | < 100ms | Payload CMS → PostgreSQL round-trip |
| Full-text search query (pg_trgm, 10k docs) | < 500ms | Payload CMS → PostgreSQL round-trip |
| Single document fetch (with `depth=1`) | < 80ms | Payload CMS → PostgreSQL round-trip |
| Contact form POST (including Resend API) | < 3,000ms | End-to-end (Caddy to Resend and back) |
| RSS feed generation (20 items) | < 200ms | Payload custom endpoint |
| Global search (`/api/search`, 4 collections) | < 500ms | Payload custom endpoint |
| Vite SPA initial load (LCP) | < 3,000ms | Lighthouse on 4G throttled connection |
| Vite SPA route transition (cached) | < 100ms | React Router lazy chunk load (pre-warmed) |
| Leaflet jurisdiction map render | < 2,000ms | Time from navigation to map tiles visible |

---

### 13.2 Frontend Performance Targets (Lighthouse CI Gates)

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Lighthouse Performance | ≥ 90 | Hard CI gate via `@lhci/cli` |
| Lighthouse Accessibility | ≥ 95 | Hard CI gate |
| Lighthouse SEO | ≥ 95 | Hard CI gate |
| Lighthouse Best Practices | ≥ 90 | Hard CI gate |
| First Contentful Paint (FCP) | < 1,800ms | Measured at Lighthouse budget |
| Largest Contentful Paint (LCP) | < 2,500ms | |
| Total Blocking Time (TBT) | < 200ms | |
| Cumulative Layout Shift (CLS) | < 0.1 | |

**Techniques to meet targets:**
- All JS loaded lazily per route (React Router + Vite code splitting; `React.lazy` + `Suspense` on all page components).
- Images served with correct `width`/`height` attributes and `loading="lazy"` on below-fold images.
- Fonts: `@fontsource` packages provide WOFF2 with `font-display: swap`; no external CDN requests.
- Tailwind CSS 4 produces a minimal CSS bundle (unused utilities purged via content scanning).
- Nginx serves static assets with `Cache-Control: public, max-age=31536000, immutable` on hashed filenames.
- `robots.txt` and `sitemap.xml` served from Nginx static file directory.

---

### 13.3 Concurrent User Capacity

| Tier | Target | Notes |
|------|--------|-------|
| Steady state | 50 concurrent users | Typical non-profit judicial site traffic |
| Peak (major ruling published) | 200 concurrent users | Legal community alert scenarios |
| Absolute ceiling (this VPS spec) | 500 concurrent users | Nginx worker_processes auto; keepalive_timeout 15 |

**Rationale:** The site serves a specialist professional audience. Total estimated daily active users is 500–2,000. Peak events (publication of a notable ruling) may generate a short burst to 200 concurrent. The stack (Nginx static files + Payload Node.js + PostgreSQL + 4 GB swapfile) handles this comfortably on a 4 vCPU / 8 GB RAM VPS.

PostgreSQL `max_connections`: 100 (default). Payload CMS uses a connection pool (`@payloadcms/db-postgres` with `pool.max: 10`). No risk of connection exhaustion at target load.

---

### 13.4 Data Volume Expectations

| Collection | Initial (Demo Seed) | Year 1 Estimate | Year 5 Estimate |
|------------|--------------------|-----------------|-----------------| 
| CourtDecisions | 5 | 500 | 5,000 |
| ExpertWitnesses | 5 | 300 | 500 |
| Interpreters | 5 | 200 | 350 |
| Courts | 5 | 50 | 60 |
| StateAttorneys | 2 | 25 | 30 |
| BankruptcyListings | 5 | 100 | 500 |
| BankruptcyAdministrators | 3 | 50 | 100 |
| Laws | 5 | 50 | 80 |
| NewsPosts | 2 | 100 | 600 |
| Pages | 3 | 10 | 15 |
| Galleries | 3 | 20 | 60 |
| Documents | 5 | 100 | 300 |
| Users | 2 | 500 | 2,000 |
| Media (files) | ~15 | ~500 | ~3,000 |

**Storage estimate (Year 5):**
- Database: ~500 MB (including Lexical JSON rich text in `court_decisions.full_text_hr`)
- Uploads volume: ~15 GB (PDF-heavy; average 5 MB per PDF × 3,000 files)
- Docker images: ~2 GB

**Full-text search performance at 5,000 decisions:** PostgreSQL GIN indexes on `tsvector` columns maintain sub-100ms query time for the target dataset size. pg_trgm trigram indexes on `title_hr` support ILIKE-style partial matching at similar latency. No search infrastructure upgrade (Meilisearch, Elasticsearch) is required within the 5-year horizon.

---

### 13.5 Caching Strategy

| Layer | Strategy | TTL |
|-------|----------|-----|
| Nginx (static assets) | `Cache-Control: public, max-age=31536000, immutable` | 1 year (cache-busted by Vite content hash in filename) |
| Nginx (`index.html`) | `Cache-Control: no-cache, no-store, must-revalidate` | None (SPA shell must always be fresh) |
| Payload API (list responses) | No server-side cache for MVP. Caddy does not cache API responses. | — |
| Browser (SPA route data) | React component state only (no service worker for MVP). | Session lifetime |
| RSS feeds | Caddy `cache` directive: `Cache-Control: public, max-age=600` (10 min) | 10 minutes |
| PostgreSQL query plan cache | Automatic (shared_buffers default; no custom configuration for MVP) | — |

**Note:** Server-side caching of Payload API responses (e.g. Varnish, Redis) is a post-launch optimisation. At projected load levels, PostgreSQL with GIN indexes provides adequate performance without an additional cache layer.

---

*Technical specification authored by gigforge-engineer · GF-GFWEB-002 · 2026-03-21*
*This document extends the functional specification. Together they constitute the complete engineering contract for the build.*
