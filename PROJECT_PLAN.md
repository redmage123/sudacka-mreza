# Sudačka Mreža — Project Plan
**Project:** GF-GFWEB-002
**Client:** Dražen Komarica (drazen.komarica@gmail.com)
**GigForge Lead:** gigforge-engineer
**Engagement:** Pro-bono
**Date:** 2026-03-20

---

## Executive Summary

The current sudacka-mreza.hr is a 2009 ASP.NET site with critical security and usability failures: no HTTPS (login credentials sent in cleartext), a broken Flash-dependent Jurisdiction Finder, malicious ad injection, an IE7 compatibility shim, and an 18-year-old jQuery version. The site is not mobile responsive and has placeholder SEO metadata.

The refactor delivers a modern Next.js 15 + Payload CMS + PostgreSQL stack that restores all existing functionality, fixes all critical issues, and adds new features (interactive map, full-text search, news, analytics) while keeping content editing simple for non-technical staff.

---

## What We Can Build Immediately (Without Client Assets)

The following can be built in parallel with waiting for client data — no blocking dependency:

| What | Deliverable |
|---|---|
| Next.js project scaffold | App Router, TypeScript, Tailwind CSS 4, next-intl |
| Payload CMS setup | All collections defined; admin UI running |
| PostgreSQL schema | All tables migrated, full-text indexes in place |
| Design system | Colour tokens, typography scale, component library |
| All UI pages | Homepage, search, courts, experts, contact (with dummy data) |
| Court fee calculator | Fully functional (pure front-end logic, no DB needed) |
| Interactive map | Leaflet.js jurisdiction finder with OpenStreetMap tiles |
| Bilingual structure | HR/EN routing and translation file structure |
| Contact form | Validated, emails routed via Resend |
| Auth system | NextAuth.js v5 login/register flows |
| Docker Compose | Full local dev environment + production compose |
| CI/CD | GitHub Actions with lint, test, build |
| HTTPS setup | Caddy config ready to deploy to production |

**We can have a fully functional demo with dummy data in ~5 working days.** Real data import happens in parallel once client provides the database export.

---

## Phases

### Phase 0 — Discovery & Assets (Client-blocked)
**Timeline:** Days 1–5 (waiting on client)
**GigForge starts building immediately; this runs in parallel**

Client must provide:
- [ ] Database export (SQL Server dump) OR written consent to scrape the public site
- [ ] All media files from server (`user-folders/`, `gallery/` directories) — FTP/SFTP access or zip download
- [ ] Admin panel login credentials (for any member-only content not publicly visible)
- [ ] Confirmation: which content exists in English? Which is Croatian-only?
- [ ] Jurisdiction boundary data (GeoJSON) — or confirmation to use public GADM shapefile for Croatia
- [ ] Hosting decision: keep current host or migrate? (GigForge recommends new VPS for clean start)
- [ ] DNS/domain access for Let's Encrypt TXT record verification

---

### Phase 1 — Foundation & Design (Days 1–5, starts immediately)

**Sprint goal:** Working demo environment with design system and all pages in place.

| Story | Deliverable | Agent |
|---|---|---|
| S1-01 | Project scaffold: Next.js 15, Payload CMS, PostgreSQL, Docker Compose | gigforge-devops |
| S1-02 | Design system: colour tokens, typography, component library (Button, Card, Badge, etc.) | gigforge-dev-frontend |
| S1-03 | Homepage: hero, search bar, feature cards, news teaser, donor strip | gigforge-dev-frontend |
| S1-04 | Global navigation + mobile hamburger menu | gigforge-dev-frontend |
| S1-05 | Bilingual routing: next-intl, HR/EN language switcher | gigforge-dev-frontend |
| S1-06 | Payload CMS: define all collections and fields | gigforge-dev-backend |
| S1-07 | Auth: NextAuth.js v5, login/register/forgot password pages | gigforge-dev-backend |
| S1-08 | GitHub Actions CI: lint, test, build | gigforge-devops |
| S1-09 | Caddy + Let's Encrypt config (staging + production) | gigforge-devops |

**Definition of done:** `npm run dev` works, all pages render with dummy data, design system documented, CI green.

---

### Phase 2 — Core Features (Days 6–12)

**Sprint goal:** All primary features working with dummy data; ready for real data import.

| Story | Deliverable | Agent |
|---|---|---|
| S2-01 | Case law search: PostgreSQL full-text (tsvector), search UI with filters | gigforge-dev-backend + frontend |
| S2-02 | Expert witness directory: search by name/speciality/location, profile pages | gigforge-dev-backend + frontend |
| S2-03 | Interpreter directory: search by name/language pair, profile pages | gigforge-dev-backend + frontend |
| S2-04 | Courts directory: list + detail pages, embedded map pin | gigforge-dev-frontend |
| S2-05 | State attorney offices: list + detail pages | gigforge-dev-frontend |
| S2-06 | Jurisdiction finder: Leaflet.js map, Croatian GADM polygons, click → court | gigforge-dev-frontend |
| S2-07 | Bankruptcy portal: listings with search/filter, administrator profiles | gigforge-dev-backend + frontend |
| S2-08 | Laws archive: browse and download PDFs by category | gigforge-dev-frontend |
| S2-09 | Court fee calculator: form-based, client-side calculation | gigforge-dev-frontend |
| S2-10 | News section: Payload-managed posts, RSS feed, category filter | gigforge-dev-backend + frontend |
| S2-11 | Contact form: validated, Resend email delivery | gigforge-dev-backend |
| S2-12 | Media galleries: photo (lightbox), video (YouTube embed), audio | gigforge-dev-frontend |
| S2-13 | Member area: login-gated content page | gigforge-dev-frontend |
| S2-14 | Analytics: Plausible self-hosted setup + script injection | gigforge-devops |

---

### Phase 3 — Data Migration (Days 8–14, overlaps Phase 2)

**Blocked on Phase 0 assets from client.**

| Task | Description |
|---|---|
| M-01 | Build Python migration script: parse SQL Server dump → JSON |
| M-02 | Import court decisions into PostgreSQL via Payload Local API |
| M-03 | Import expert witnesses |
| M-04 | Import interpreters |
| M-05 | Import courts directory |
| M-06 | Import state attorney offices |
| M-07 | Upload all PDFs (laws, expert papers) to Payload Media |
| M-08 | Build URL redirect map (old .aspx URLs → new clean URLs) |
| M-09 | Spot-check: verify record counts, 50 random records across all collections |

---

### Phase 4 — SEO, Accessibility, Polish (Days 13–16)

| Story | Deliverable |
|---|---|
| S4-01 | Real meta tags on all pages (title, description, Open Graph, Twitter Card) |
| S4-02 | Structured data: LegalOrganization, BreadcrumbList, FAQPage schemas |
| S4-03 | sitemap.xml (dynamic, auto-generated by Next.js) |
| S4-04 | robots.txt |
| S4-05 | 301 redirects for all old .aspx URLs (via Next.js middleware or Caddy rewrites) |
| S4-06 | WCAG 2.1 AA audit: keyboard nav, focus indicators, ARIA labels, contrast ratios |
| S4-07 | Print-friendly CSS (preserve existing functionality) |
| S4-08 | Lighthouse audit to ≥90 on all four metrics |
| S4-09 | Cross-browser test: Chrome, Firefox, Safari, Edge |
| S4-10 | Mobile test: iOS Safari, Android Chrome |

---

### Phase 5 — QA & Client Review (Days 17–19)

| Task | Description |
|---|---|
| QA-01 | Run pre-qa-check.sh: coverage, lint, security, Docker |
| QA-02 | Acceptance Tester sign-off: all acceptance criteria verified |
| QA-03 | Client Advocate sign-off: experienced as the client |
| QA-04 | Staging deployment: deploy to staging URL for Dražen to review |
| QA-05 | Client review session: walk through all features with Dražen |
| QA-06 | Incorporate client feedback |

---

### Phase 6 — Production Launch (Day 20)

| Task | Description |
|---|---|
| L-01 | DNS cutover: point sudacka-mreza.hr to new server IP |
| L-02 | Let's Encrypt certificate issuance (automated by Caddy) |
| L-03 | Verify HTTPS works on all URLs |
| L-04 | Verify 301 redirects are working for all old .aspx URLs |
| L-05 | Verify analytics is receiving data |
| L-06 | Monitor error logs for 24h |
| L-07 | Remove old server / notify old host |
| L-08 | Update copyright year and legal notices |

---

## Suggested Timeline

| Phase | Working Days | Start |
|---|---|---|
| Phase 1 — Foundation | Days 1–5 | Immediately |
| Phase 2 — Core features | Days 6–12 | Day 6 |
| Phase 3 — Data migration | Days 8–14 | When client provides assets |
| Phase 4 — SEO & polish | Days 13–16 | Day 13 |
| Phase 5 — QA & client review | Days 17–19 | Day 17 |
| Phase 6 — Launch | Day 20 | Day 20 |

**Total: ~20 working days (4 calendar weeks) once client provides assets.**

The fastest path to go-live: Dražen provides the database export and media files within the first 5 days. This allows the migration to run in parallel with Phase 2, and we can launch on schedule.

---

## Client Communication — What to Send Dražen

### Initial Message (to send now)

> Dear Dražen,
>
> I hope you're well. We've had the chance to dig properly into sudacka-mreza.hr, and I'm genuinely glad we did — it's a valuable resource for the Croatian legal community, and it deserves a solid technical foundation to match. We've put together a full specification and a phased project plan, and I think you'll be pleased with what we've mapped out.
>
> Before I get into the details, there's one thing I want to flag straight away, because it's urgent: **during our analysis we detected a malicious third-party script injected into your site's `<head>` section, loading from a domain called `new-adversting.com`**. This script was redirecting our browser mid-session on several pages. Your users may be experiencing the same thing right now. This is the single most pressing issue with the current site, and migrating to the new platform will eliminate it entirely. In the meantime, if you or your current hosting provider can access the server files, it's worth contacting them to have the injection removed — or at minimum alerting them that the site has been compromised.
>
> The good news is that everything else we found is fixable, and we can start building immediately while you gather what we need on your end.
>
> To get started, we need the following from you:
>
> 1. **Database export** — a backup/dump of the site's database, or FTP/SFTP access to the server
> 2. **Media files** — the `user-folders/` and `gallery/` directories from the web server
> 3. **Admin login** — credentials for the site admin to access any members-only content
> 4. **English content** — which sections have English translations vs. Croatian only?
> 5. **Hosting preference** — stay on current host or move to a new server?
> 6. **DNS access** — you'll need to be able to add a TXT record for HTTPS certificate verification
> 7. **Jurisdiction boundary data** — if you have GeoJSON files for Croatian court regions, great; if not, we can use public data
>
> Once we have items 1 and 2 we can begin importing your data. We can have a working demo of the new site in front of you within the first week — real layout, real structure, your branding — so you can see exactly what we're building before we go live.
>
> Shall we schedule a 30-minute call to walk you through the plan?

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Client unable to provide DB dump | Medium | High | Build scraper to extract structured data from public site |
| Flash Jurisdiction Finder data not recoverable | Medium | Medium | Croatian court jurisdiction boundaries available from public GADM/OS data |
| Large PDF/media archive | Medium | Medium | Phase migrations; batch upload with progress tracking |
| Current hosting provider unresponsive | Low | Medium | Scrape what's public; launch with what we have |
| Malicious ad script re-injection | High (it's on current host) | — | Non-issue after migration — new server, new code |
| Client delayed on reviews | Medium | Low | Async review process; async feedback via GitHub Issues or shared doc |

---

## Success Criteria

- [ ] All current features replicated on the new site
- [ ] Jurisdiction Finder works (Leaflet map replacing broken Flash widget)
- [ ] HTTPS active with auto-renewing Let's Encrypt certificate
- [ ] No malicious ad injection
- [ ] Site loads on mobile devices (all viewport sizes)
- [ ] Lighthouse scores ≥ 90 on Performance, Accessibility, SEO, Best Practices
- [ ] WCAG 2.1 AA compliant
- [ ] All old .aspx URLs redirect 301 to new URLs (no broken backlinks)
- [ ] Dražen can manage content without developer assistance via Payload admin UI
- [ ] Analytics active and receiving data
- [ ] Two languages (HR + EN) working correctly

---

*GigForge Engineering — gigforge-engineer@team.gigforge.ai*
