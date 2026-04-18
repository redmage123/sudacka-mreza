# ADR-0001: Choice of Backend Language
## Status: Accepted
## Date: 2026-03-21

## Context

The Sudačka Mreža rebuild requires a backend runtime that supports the chosen CMS (Payload CMS 3), integrates well with the PostgreSQL database, and can be maintained by a broad pool of developers over the platform's expected multi-year lifespan. The current backend is ASP.NET WebForms (.NET, C#), which works but creates a skills-mismatch with the chosen frontend stack and with the wider JavaScript/TypeScript ecosystem.

## Decision

**TypeScript on Node.js 20 LTS.**

Both the `cms/` (Payload CMS 3) and any custom server-side scripts use TypeScript. Node.js 20 LTS is the runtime.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Python (FastAPI)** | Payload CMS 3 is Node-only; running a separate Python API layer alongside Payload adds unnecessary complexity and a second runtime to maintain. Rejected in favour of a unified TypeScript stack. |
| **Go** | No first-class Payload CMS support. Go would require building the entire CMS, admin UI, and auth layer from scratch — a disproportionate effort for a pro-bono project. |
| **PHP (Laravel/WordPress)** | WordPress has poor support for the structured data models required (13 Payload collections with locale fields, tsvector hooks, JSONB geolocation). Laravel is capable but introduces a context switch from the TypeScript frontend. |
| **Stay on .NET / C#** | No Payload CMS support. No React ecosystem alignment. The team cannot maintain two separate language ecosystems. |
| **Python + Strapi** | Strapi is JavaScript-native (not TypeScript-first) and has weaker PostgreSQL full-text search support than Payload. FastAPI would then be an additional service with no admin UI benefit. |

## Consequences

**Positive:**
- Single language (TypeScript) across `web/` and `cms/` — shared type definitions possible; no context-switching for developers
- Payload CMS 3 is TypeScript-native; all collection configs, hooks, and endpoints are fully typed
- Large hiring pool; TypeScript/Node.js is the most common stack for freelance and civic-tech developers
- npm ecosystem gives access to all required libraries (leaflet, zod, i18next, etc.)

**Negative / Risks:**
- Node.js is single-threaded; CPU-bound workloads (e.g., bulk PDF processing during migration) should be offloaded to worker threads or a separate script
- Node.js memory usage for Payload can be higher than a compiled language at idle — mitigated by the 2 GB RAM recommendation in SPEC §10.3
- TypeScript compilation adds a build step; mitigated by Payload's built-in build tooling and Vite for the frontend
