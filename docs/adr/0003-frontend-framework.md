# ADR-0003: Frontend Framework — React 19 + Vite 6 + React Router 7
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The current site is a server-rendered ASP.NET WebForms application. The rebuild requires a modern frontend that is:
- Mobile-first responsive (current site is completely non-responsive)
- Bilingual (Croatian + English) with clean URL-based language switching
- Capable of rendering interactive features: Leaflet map, full-text search with real-time filtering, court fee calculator, media galleries
- Maintainable by Croatian developers who are likely familiar with React (the dominant Croatian frontend ecosystem)
- SEO-friendly (case law decisions and expert profiles must be indexable)

The owner specified React 19 + Vite 6 + React Router 7.

---

## Decision

**React 19** with **Vite 6** as the build tool and **React Router 7** for client-side routing.

This is a **pure SPA architecture**: Vite builds static assets, Nginx serves them, all data is fetched at runtime from the Payload CMS REST API.

SEO is handled via:
- `vite-plugin-ssg` for static HTML generation of known routes at build time
- `react-helmet-async` for per-page `<head>` management
- Build-time sitemap generation via the Payload API

This is **not** Next.js. The owner explicitly chose React + Vite, and the PROJECT_PLAN.md's earlier Next.js reference is superseded by the owner's current tech stack decision.

---

## Alternatives Considered

**Next.js 15 (App Router)**
- The earlier PROJECT_PLAN.md was written assuming Next.js
- Pros: SSR/SSG built-in (no vite-plugin-ssg needed); better SEO out of the box; Payload CMS has a Next.js plugin that enables embedded mode
- Cons: More complex deployment (Next.js server required, not static files); the owner explicitly chose React + Vite, not Next.js; Payload CMS standalone mode is cleaner than embedded mode for a team handoff scenario
- Rejected: Owner's decision is final

**Vue 3 + Nuxt**
- Pros: Good SSR support; Vue 3 Composition API is ergonomic
- Cons: Smaller Croatian developer community; less ecosystem alignment with Payload CMS (which provides React admin UI); team is React-focused
- Rejected: Not specified by owner; React is the right choice for this team

**Svelte / SvelteKit**
- Pros: Excellent performance; SSR built-in; minimal bundle size
- Cons: Smallest developer pool in Croatia; significant migration complexity if handed to local devs
- Rejected: Niche choice for a civic platform that needs long-term local maintenance

**Vanilla TypeScript (no framework)**
- Appropriate for very simple sites
- Rejected: Too complex a UI (interactive maps, filterable tables, galleries, authenticated areas) to build without a component framework

---

## Consequences

**Positive:**
- React 19 includes concurrent features, `use()` hook, and improved Suspense — beneficial for the search/pagination-heavy pages
- Vite 6 provides extremely fast HMR and build times
- React Router 7 (formerly Remix Router) provides data loading patterns (`loader`, `action`) that are well-suited for the search and form pages
- Largest frontend developer community in Croatia — easy to hand off

**Negative:**
- Pure SPA requires extra work for SEO (`vite-plugin-ssg`) compared to Next.js where SSG is built-in
- React Router 7's data API (`loader`/`action`) is a newer pattern — engineers must read v7 docs, not v5/v6 examples
- Two separate deployment units (web SPA + CMS) vs. one Next.js app — adds operational complexity, mitigated by Docker Compose

**Risk:**
- `vite-plugin-ssg` must generate HTML for every important route at build time. If a new court decision is added to the CMS, the frontend must be rebuilt and redeployed to generate its static HTML. Mitigation: set up a Payload webhook that triggers a GitHub Actions workflow rebuild on content publish. This is planned for Phase 4.
- React 19's `use()` hook and concurrent features are still relatively new. Engineers should use proven patterns for data fetching (React Query) rather than experimental concurrent features for now.
