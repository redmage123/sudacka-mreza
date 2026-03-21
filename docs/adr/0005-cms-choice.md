# ADR-0005: CMS — Payload CMS 3 (Standalone)
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The platform has a substantial amount of content that must be editable by non-technical staff: news posts, court decisions, expert witness profiles, laws, gallery items, and static pages. The CMS must:
- Provide a usable admin interface for a Croatian lawyer/judge (Dražen) with no coding skills
- Support rich text editing for legal documents (block-based editor, not a full Word clone)
- Handle file uploads (PDFs for court decisions and laws, images for galleries)
- Expose a REST and/or GraphQL API consumed by the React SPA
- Support user roles (admin, editor, member)
- Be self-hosted (data sovereignty — Croatian judicial data)
- Be TypeScript-native
- Have a strong collections/document model (not a page-builder)

The owner specified Payload CMS 3.

---

## Decision

**Payload CMS 3** in **standalone mode** (not embedded in Next.js).

Standalone mode means Payload runs as its own Node.js/Express process (`cms/` directory), completely independent of the React frontend. It exposes:
- REST API at `/api/`
- GraphQL at `/graphql`
- Admin UI at `/admin/`

The React SPA fetches all data from Payload's REST API at runtime.

Why standalone over embedded (Payload inside Next.js App Router)?
- The owner chose React + Vite, not Next.js — there is no Next.js to embed Payload into
- Standalone mode gives a cleaner separation: the frontend team can rebuild and redeploy `web/` without touching `cms/`, and vice versa
- For a client handoff, two independent services are easier to reason about than an interleaved Next.js + Payload codebase

---

## Alternatives Considered

**Strapi v4**
- Pros: Popular, mature, good REST/GraphQL API, self-hosted
- Cons: Strapi's TypeScript support is secondary to JavaScript; the admin UI is more complex than Payload's; Strapi v4 → v5 migration issues have been problematic; collection type system is less flexible than Payload's for legal data structures
- Rejected: Payload's TypeScript-first approach and simpler admin UI are better fits

**Directus**
- Pros: Excellent admin UI; strong REST API; database-first (works with existing PostgreSQL schemas)
- Cons: Less TypeScript integration; the Lexical rich text editor in Payload is better suited for legal document editing than Directus's TipTap; Payload's Local API for migration scripts is a significant advantage
- Rejected: Payload's Local API is essential for the bulk data migration from the old ASP.NET site

**Contentful / Sanity (hosted headless CMS)**
- Pros: Zero infrastructure to manage; excellent DX; Sanity has strong structured content support
- Cons: Monthly cost for the content volume; data hosted on US servers (data sovereignty concern for Croatian judicial data); vendor lock-in; cannot self-host
- Rejected: Self-hosting required; cost and sovereignty concerns

**WordPress (Headless)**
- Pros: Dražen or his team may already know WordPress; massive ecosystem; REST API available
- Cons: WordPress REST API is poorly structured for custom data models; PHP codebase in a TypeScript project is jarring; security overhead of maintaining a PHP+MySQL stack alongside PostgreSQL; the Gutenberg editor is not good for legal document data models
- Rejected: Wrong tool for this data model; PHP in a TypeScript project is a maintenance burden

**Custom Express API (no CMS)**
- Build a custom REST API from scratch with Express + Drizzle
- Pros: Complete control; no framework constraints
- Cons: No admin UI — Dražen would need developer assistance to add any content; no file upload handling; no rich text editing; we'd be building Payload from scratch
- Rejected: An admin UI is a hard requirement

---

## Consequences

**Positive:**
- `payload generate:types` generates TypeScript types for all collections, shared with the frontend — zero type drift between API and consumer
- Payload's Local API allows migration scripts to import thousands of records directly into the database without HTTP overhead — critical for the data migration phase
- Lexical editor in Payload handles legal rich text well (bold, italic, links, headings, lists — the right level of formatting for legal documents without being a full Word processor)
- Payload's access control system maps directly to our three roles (admin/editor/member)
- Admin UI is clean and usable for non-technical editors

**Negative:**
- Payload CMS 3 is a relatively recent major version (released 2024) — some rough edges and breaking changes are expected
- Standalone mode requires an extra service in Docker Compose vs. embedding in Next.js
- Croatian localisation of the Payload admin UI requires custom translations (Payload supports admin UI localisation but Croatian strings must be written)
- If Payload is abandoned or has a breaking v4, the migration cost is non-trivial

**Risk:**
- Payload v3's PostgreSQL adapter uses Drizzle under the hood. Drizzle is also relatively new. Any Drizzle bugs affect Payload's database layer. Mitigation: pin exact versions (`payload@3.x.x`, not `payload@^3`) and test database operations thoroughly.
- The Lexical editor outputs a custom JSON format, not standard HTML. The frontend must use Payload's `@payloadcms/richtext-lexical/client` serialiser to convert to HTML, then sanitise with DOMPurify. This is mandatory — never render Payload rich text as raw JSON.
