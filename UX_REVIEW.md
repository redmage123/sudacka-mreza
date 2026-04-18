# UX Review — Sudačka Mreža Website
**Project:** GF-GFWEB-002
**Reviewer:** UX Designer, GigForge
**Date:** 2026-03-21
**Live site:** http://78.47.104.139:4092 (frontend) · http://78.47.104.139:4093/admin (CMS)
**Design spec:** `DESIGN.md`

---

## Executive Summary

The build is well-structured and largely faithful to the design spec. The token system, responsive layout, and accessibility scaffolding are solid. **One critical dark mode bug** affects every content heading on every page: it was identified and fixed as part of this review, along with three P1 issues. A set of P2 polish items remain for the next sprint.

---

## 1. Color Palette

| Check | Status | Notes |
|-------|--------|-------|
| Navy `#0D2B55` as nav background | ✅ Match | `globals.css` token correct; Header uses it |
| Gold `#C8941A` as CTA / accent | ✅ Match | Hero CTA, register button, footer headings |
| Dark mode surface `#1E293B` | ✅ Match | `.dark { --color-surface }` correct |
| Dark mode bg `#0F172A` | ✅ Match | `.dark { --color-bg }` correct |
| **Heading color in dark mode** | ❌ **P0 — FIXED** | See §5 |
| Gold on white small text | ✅ Respected | Gold only used on large/bold text per spec warning |
| Border/focus ring gold | ✅ Match | `--color-border-focus: #C8941A` / dark `#E0B040` |

### P0 — Fixed: All content headings invisible in dark mode

**Root cause:** Every `h1`, `h2`, section stat `p`, card title, and icon in content pages used `text-[color:var(--color-brand-navy)]`. In dark mode `--color-brand-navy` overrides to `#1A3F72` — a dark navy — which against `--color-bg` (`#0F172A`) yields ~1.35:1 contrast, effectively invisible.

**Affected files (34 total):** All pages in `pages/`, `components/layout/Sidebar.tsx`, `components/layout/Header.tsx` (dropdown), `components/ui/SearchBar.tsx` (suggestion highlight).

**Fix applied:**
1. Added `--color-heading` semantic token to `globals.css`:
   - Light: `#0D2B55` (= brand-navy, unchanged)
   - Dark: `#CBD5E1` (light-slate, contrast 8.9:1 on `--color-bg` — WCAG AAA)
2. Replaced `text-[color:var(--color-brand-navy)]` → `text-[color:var(--color-heading)]` across all 34 page files and 3 component files via targeted script.

---

## 2. Typography

| Check | Status | Notes |
|-------|--------|-------|
| Inter loaded via @fontsource | ✅ Match | 400/500/600/700 weights loaded |
| Source Serif 4 via @fontsource | ✅ Match | 400/400-italic/600 loaded |
| `--font-sans` = Inter | ✅ Match | `globals.css:57` correct |
| `--font-serif` = Source Serif 4 | ✅ Match | `globals.css:58` correct |
| `.prose` class uses serif + 1.75 line-height | ✅ Match | `globals.css:143–154` |
| **`.dark .prose` heading override** | ❌ **P1 — FIXED** | Missing; added `#A0C4FF` per spec |
| Heading weight 600–700 (bold) | ✅ Match | All h1: `font-bold`; h2: `font-bold`/`font-semibold` |
| `font-mono` for case numbers | ✅ Token defined | Not yet applied in decision detail (no content yet) |
| GDPR-safe self-hosting | ✅ Match | No Google Fonts requests |

### P1 — Fixed: Missing `.dark .prose` headings override

**File:** `web/src/styles/globals.css`
**Spec reference:** DESIGN.md §3 "Legal Document Prose"

The spec requires `.dark .prose { --tw-prose-headings: #A0C4FF; }`. This was absent, so court decision and law text headings would render in dark navy (illegible) in dark mode.

**Fix:** Added `.dark .prose` block after the base `.prose` block.

---

## 3. Dark Mode

| Check | Status | Notes |
|-------|--------|-------|
| `useDarkMode` hook — localStorage persist | ✅ Match | `hooks/useDarkMode.ts:8–9` |
| `useDarkMode` — `prefers-color-scheme` fallback | ✅ Match | `hooks/useDarkMode.ts:10` |
| `.dark` class toggled on `<html>` | ✅ Match | `hooks/useDarkMode.ts:15–18` |
| DarkModeToggle — sun/moon icons | ✅ Match | `components/layout/DarkModeToggle.tsx` |
| DarkModeToggle aria-label flips | ✅ Match | Label correctly inverted per mode |
| Dark mode CSS token overrides | ✅ Match | All 20+ tokens override in `.dark {}` block |
| **Content heading visibility in dark** | ❌ **P0 — FIXED** | See §1 |
| Surface/bg colors in dark | ✅ Match | Cards readable: `#1E293B` surface on `#0F172A` bg |
| Error/success/info semantic colors in dark | ✅ Match | All boosted for readability |

---

## 4. Responsive Breakpoints

| Check | Status | Notes |
|-------|--------|-------|
| Mobile header h-16, desktop h-20 | ✅ Match | `Header.tsx:115` |
| Desktop nav hidden below 1024px | ✅ Match | `hidden lg:flex` |
| Sidebar hidden below 1024px | ✅ Match | `hidden lg:block w-56` |
| Mobile hamburger visible below 1024px | ✅ Match | `lg:hidden` on button |
| MobileNav slide-in panel | ✅ Match | Full-width on mobile, fixed 320px |
| Focus trap in mobile nav | ✅ Match | `MobileNav.tsx:26–57` correctly traps focus |
| Escape closes mobile nav | ✅ Match | `MobileNav.tsx:34` |
| `max-w-7xl` content container | ✅ Match | Consistent across all pages |
| Grid: 1 col → 2 col (sm) → 3 col (lg) | ✅ Match | Quick-access, filters, stats bar |
| DataTable `hideOnMobile` columns | ✅ Match | `hidden sm:table-cell` on mobile-hidden cols |

---

## 5. Component Consistency

### Button

| Variant | Status |
|---------|--------|
| primary (navy bg) | ✅ |
| secondary (navy border) | ✅ |
| ghost | ✅ |
| danger (error red) | ✅ |
| loading state (spinner, aria-busy) | ✅ |
| 44px min touch target (all sizes) | ✅ WCAG §9.4 |
| icon/iconPosition/leftIcon/rightIcon | ✅ |

### Card

| Feature | Status |
|---------|--------|
| Surface bg + border + rounded | ✅ |
| `hoverable` shadow + border transition | ✅ |
| `header` / `footer` / `badge` slots | ✅ |
| `flush` (no body padding, for tables) | ✅ |
| `padding` sm/md/lg variants | ✅ |

### DataTable

| Feature | Status |
|---------|--------|
| Filter input + search icon | ✅ |
| Sortable columns + aria-sort | ✅ |
| Keyboard sort (Enter/Space) | ✅ |
| Pagination + result count | ✅ |
| Loading skeleton | ✅ |
| Empty state | ✅ |
| `hideOnMobile` columns | ✅ |
| Row click + keyboard Enter | ✅ |
| **Hardcoded Croatian strings** | ⚠️ P2 — see below |

### Badge

| Variant | Status |
|---------|--------|
| default, gold, success, warning, error, info | ✅ |
| neutral, closed | ✅ |
| **verified (with checkmark icon)** | ❌ P1 — FIXED |

### SearchBar

| Feature | Status |
|---------|--------|
| hero / default sizes | ✅ |
| Combobox ARIA (role, aria-expanded, aria-controls) | ✅ |
| Keyboard navigation (↑↓ Enter Escape) | ✅ |
| Loading spinner | ✅ |
| Suggestion highlight colour in dark mode | ❌ P1 — FIXED |

---

## 6. Accessibility

| Requirement | Status | Notes |
|-------------|--------|-------|
| Skip link `#main-content` | ✅ Match | `AppShell.tsx:67` |
| Focus management on route change | ✅ Match | `AppShell.tsx:54–62`, focuses h1 |
| `focus-visible` ring gold/2px | ✅ Match | `globals.css:113–117` |
| All buttons have accessible labels | ✅ | Hamburger, close, dark mode toggle |
| Input component warns on missing label (dev) | ✅ | `Input.tsx:23–25` |
| SearchBar combobox ARIA | ✅ | role=combobox, aria-activedescendant |
| DataTable `scope="col"` + `aria-sort` | ✅ | Correct per WCAG tables |
| MobileNav focus trap | ✅ | Keyboard users cannot escape the panel |
| `prefers-reduced-motion` | ✅ Match | `globals.css:157–162` |
| Print stylesheet (hide nav/footer) | ✅ Match | `globals.css:150–154` |
| WCAG AA contrast — light mode | ✅ | Body 16.7:1, inverse 13.4:1 |
| **WCAG AA contrast — dark mode headings** | ❌ P0 — FIXED | Was ~1.35:1; now 8.9:1 |
| Form error `role="alert"` + `aria-invalid` | ✅ | `Input.tsx:42–43, 59` |
| Lucide icons all `aria-hidden="true"` | ✅ | All SVG icons in pages |

---

## 7. Navigation

| Check | Status | Notes |
|-------|--------|-------|
| Language prefix routing `/:lang/...` | ✅ Match | `router.tsx:76–138` |
| Default redirect `/` → `/hr` | ✅ Match | `router.tsx:71–73` |
| All spec routes present | ✅ Match | Decisions, experts, courts, bankruptcy, etc. |
| Lazy loading with Suspense | ✅ Match | All pages code-split |
| **Breadcrumb in AppShell: `<a>` not `<Link>`** | ❌ **P1 — FIXED** | Caused full page reloads |
| Header dropdown ARIA | ✅ Match | `aria-expanded`, `role="menu"`, `role="menuitem"` |
| Active nav item gold underline | ✅ Match | `border-b-2 border-[color:var(--color-brand-gold)]` |
| Footer 3-column sitemap | ✅ Match | `Footer.tsx:44–64` |

### P1 — Fixed: Breadcrumb `<a href>` causes full page reloads

**File:** `web/src/components/layout/AppShell.tsx:37`
**Before:** `<a href={crumb.pathname}>`
**After:** `<Link to={crumb.pathname}>` (also added `Link` to imports)

SPA navigation was breaking for breadcrumb ancestors — React state was lost, page reloaded from server.

---

## 8. Visual Hierarchy — Homepage

| Section | Status | Notes |
|---------|--------|-------|
| Hero (navy bg, white text, gold CTA) | ✅ Match | `py-20`, `text-4xl`, centered |
| Hero CTA links to decisions search | ✅ Match | `/${locale}/sudska-praksa/pretraga` |
| Quick-access 3-column grid | ✅ Match | 6 cards: decisions/experts/interpreters/courts/bankruptcy/calculator |
| Quick-access icons (lucide) | ✅ Match | Scale, Users, Languages, Building2, FileText, Calculator |
| Latest news (5 posts, divider list) | ✅ Match | With skeleton loading, error fallback |
| Stats bar (4 live counters) | ✅ Match | With skeleton loading |
| **Heading hierarchy h1/h2 on homepage** | ⚠️ P2 | Quick-access cards use `h2` but there's no parent h2 |

---

## 9. P1 Fixes Summary (all applied)

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| P1-01 | `globals.css` | Missing `.dark .prose` heading override | Added `.dark .prose { --tw-prose-headings: #A0C4FF }` |
| P1-02 | `AppShell.tsx:37` | `<a href>` in breadcrumb (full page reload) | Changed to `<Link to>` |
| P1-03 | `ExpertsPage.tsx:209` | Verified badge uses `variant="success"` (no checkmark) | Changed to `variant="verified"` |

---

## 10. P0 Fixes Summary (applied)

| ID | Files | Issue | Fix Applied |
|----|-------|-------|-------------|
| P0-01 | 34 page files + 3 component files | `text-[color:var(--color-brand-navy)]` on headings invisible in dark mode (~1.35:1 contrast) | Added `--color-heading` token (light: `#0D2B55`, dark: `#CBD5E1`); replaced all heading usages |

---

## 11. Remaining P2 Issues (next sprint)

| ID | File | Issue | Suggested Fix |
|----|------|-------|---------------|
| P2-01 | `DataTable.tsx:69,248–249` | Hardcoded Croatian strings (`"Filtriraj..."`, `"Nema podataka."`, `"rezultata"`) | Pass through i18n props or accept translated props |
| P2-02 | `DecisionsSearchPage.tsx`, `ExpertsPage.tsx`, `InterpretersPage.tsx` | Raw `<select>` elements bypass the `<Select>` UI component (no consistent error/aria handling) | Replace with `<Select>` from `components/ui/Input.tsx` |
| P2-03 | `router.tsx:63` | Suspense fallback is an empty div (aria-busy but no visible/screen-reader content) | Add a visible `<Skeleton>` or loading text |
| P2-04 | `HomePage.tsx:165` | Quick-access card titles use `<h2>` but the grid section has no parent `<h2>` heading (heading hierarchy skip) | Add a visually-hidden `<h2>` section title, or change card titles to `<h3>` |
| P2-05 | `PlaceholderPage.tsx` | Redundant `dark:text-[color:var(--color-brand-gold)]` after P0 fix (heading token already handles dark) | Remove redundant dark: override |
| P2-06 | `CourtsPage.tsx:97` | Tab active state uses `text-[color:var(--color-heading)]` (post-fix) — verify contrast on subtle bg | Check visually; consider `--color-brand-gold` for active tab indicator instead |
| P2-07 | `ExpertsPage.tsx:131` | TODO comment `Sprint 6: upgrade to multi-select` | Implement multi-select speciality filter |

---

## 12. What Matches the Spec Well

- **Color system:** All 20+ CSS custom property tokens match `DESIGN.md §2` exactly
- **Font loading:** Self-hosted Inter + Source Serif 4 via @fontsource — GDPR-safe, no external requests
- **Component API surface:** Button, Card, Badge, DataTable, SearchBar, Input/Select/Textarea all match the spec interfaces in `DESIGN.md §6`
- **Responsive grid:** Breakpoints (`sm:640px`, `lg:1024px`), max-width container, sidebar hide/show — all per spec
- **Dark mode infrastructure:** CSS var overrides, localStorage persist, `prefers-color-scheme` fallback — all per spec
- **Accessibility scaffolding:** Skip link, focus management on route change, reduced-motion, print stylesheet, combobox ARIA, focus trap in mobile nav — all per spec
- **Route structure:** All 30+ routes match the spec sitemap
- **Print stylesheet:** Hides header/footer/nav in print, black-on-white — per spec
