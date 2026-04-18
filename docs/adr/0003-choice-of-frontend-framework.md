# ADR-0003: Choice of Frontend Framework
## Status: Accepted
## Date: 2026-03-21

## Context

The frontend must replace a 2008-era ASP.NET WebForms site with a modern, responsive, accessible SPA. Requirements include: bilingual HR/EN content, interactive Leaflet map, client-side search/filter across multiple collections, user authentication, and a component library serving 30+ distinct page types. The client explicitly specified React 19 + Vite 6 + React Router 7.

## Decision

**React 19 + Vite 6 + React Router 7** as the SPA framework.

The frontend is a pure client-side SPA. Vite builds static files that are served by Nginx in Docker. All data is fetched from the Payload CMS REST API at runtime. React Router 7 handles all client-side routing.

SEO for content pages (case law decisions, news posts) that need indexing is handled by `vite-plugin-prerender` at build time — generating static HTML shells for critical routes.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Next.js 15 (App Router)** | Client specifically did not request Next.js. Next.js would add Server Components, RSC, and a more complex deployment model. For a Payload CMS standalone architecture (where Payload is the API server), a pure React SPA is simpler — no SSR server to run, just static files in Nginx. Next.js also pulls in its own routing, which conflicts with running React Router 7 as the client specified. |
| **Vue 3 / Nuxt** | Client-specified React. No reason to deviate. |
| **Svelte / SvelteKit** | Client-specified React. Svelte is an excellent choice in general but not what was requested. |
| **Remix** | React Router 7 is the evolution of Remix — the routing concepts are equivalent. Using React Router 7 as a standalone library (without the full Remix server) is the correct approach here since we have a dedicated Payload CMS backend. |
| **Vanilla JS + Alpine.js** | Insufficient for the component complexity required (30+ pages, interactive DataTable, auth context, bilingual state, Leaflet integration). |
| **Angular** | Not requested; significantly more opinionated and heavier; no advantage for this use case. |

## Consequences

**Positive:**
- React 19 Actions API simplifies form submission state management (contact form, login, register) without external form libraries
- React Router 7's type-safe `createBrowserRouter` gives fully typed route params — no more `useParams()` returning `string | undefined`
- Vite 6 HMR is near-instant; developer experience is excellent for a 30+ page component library build
- The SPA architecture gives clean separation: frontend can be rebuilt/redeployed without touching Payload CMS
- Lazy-loading all route components via `React.lazy()` keeps initial bundle small (< 200 KB gzipped target)
- `@fontsource` packages bundle fonts locally — no Google Fonts CDN calls; GDPR-clean

**Negative / Risks:**
- Pure SPA means JavaScript must execute before content is visible — mitigated by `vite-plugin-prerender` for critical SEO pages and by Nginx serving the HTML shell with a fast TTFB
- `vite-plugin-prerender` adds build complexity and requires all prerendered routes to be known at build time — acceptable for the static pages, less suitable for dynamic routes (individual court decisions); those rely on client-side rendering + structured data JSON-LD
- React Router 7 (v7.x) is a relatively recent API; some patterns are still maturing compared to React Router 6
