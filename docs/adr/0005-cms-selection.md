# ADR-0005: CMS Selection
## Status: Accepted
## Date: 2026-03-21

## Context

The platform has 13 distinct content types (court decisions, expert witnesses, interpreters, courts, news posts, pages, galleries, documents, laws, etc.), each with bilingual (HR/EN) locale variants. Content editors must be able to manage records without touching code. The CMS must support: REST API, rich text editing, file uploads, user/role management, and bilingual content — all self-hosted with no ongoing SaaS licence cost (this is a pro-bono engagement for a non-profit).

The client explicitly requested Payload CMS 3 standalone.

## Decision

**Payload CMS 3 in standalone mode.**

Payload runs as a separate Docker service (`cms`, port 3001). It serves:
- The Payload Admin UI (`/admin/`) — for content editors
- The REST API (`/api/*`) — consumed by the React SPA
- The GraphQL API (`/api/graphql`) — available for future integrations

Payload's `@payloadcms/db-postgres` adapter connects to PostgreSQL 16. Collections are defined in TypeScript files — they are version-controlled alongside the application code. Payload's Lexical editor handles rich text for court decisions and legal documents.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **WordPress + REST API** | WordPress is PHP; requires a second runtime alongside Node.js. The Gutenberg block editor is poor for legal document editing compared to Lexical. ACF/custom post types for 13 complex collections becomes unwieldy. Security surface is significantly larger (WordPress is the most targeted CMS on the internet). |
| **Strapi v4** | Strapi is JavaScript (not TypeScript-first). Its PostgreSQL support is less mature than Payload 3's. Collection config is partly generated via a GUI rather than code — harder to version control and review. Strapi's file upload handling is more complex to configure. |
| **Directus** | Directus is an excellent headless CMS but requires defining schema via the GUI/API rather than in code — collections are not version-controlled TypeScript files. For a legal platform where schema changes must be reviewed, code-defined collections are preferable. |
| **Sanity** | SaaS-hosted content lake. No self-hosting option that keeps all data on the client's own server. Ongoing subscription cost. Not acceptable for a pro-bono non-profit engagement. |
| **Contentful / Prismic** | SaaS with ongoing licence costs. Data not on client's server. Not acceptable. |
| **Custom Express/Fastify API** | Building auth, file uploads, admin UI, Lexical rich text editing, locale support, and 13 collection CRUDs from scratch is weeks of work that Payload provides out of the box. No benefit to building it ourselves. |
| **Next.js + Payload (integrated mode)** | Payload 3 supports running inside a Next.js app. However, the client requested a standalone Payload service alongside a pure React SPA. The standalone mode gives cleaner separation and avoids Next.js complexity on the backend. |

## Consequences

**Positive:**
- All 13 collections defined as TypeScript files in `cms/src/collections/` — schema is version-controlled, code-reviewed, and auditable
- Payload's built-in auth (JWT + HttpOnly cookies) means no separate auth library; role-based access (admin/editor/member) is first-class
- Lexical editor handles legal document formatting (headings, numbered lists, footnotes) without custom rich text infrastructure
- Locale support (`?locale=hr` / `?locale=en`) is built in — bilingual content without any additional library
- Payload Local API in tests avoids HTTP round-trips — collection tests run in-process using the same Payload instance
- Admin UI is available at `/admin/` on day 1 — content editors can begin entering data before the frontend is complete

**Negative / Risks:**
- Payload 3 is a relatively new major version (released 2024); some edge cases and plugins may not have stabilised. Mitigated by pinning to a specific minor version and reading the changelog before upgrading.
- Payload generates Drizzle migration files automatically — developers must be careful not to run `payload migrate` on production without reviewing the migration diff
- Payload's REST API follows its own query syntax (`?where[field][operator]=value`) — frontend developers must learn this convention; documented in `docs/api.md`
