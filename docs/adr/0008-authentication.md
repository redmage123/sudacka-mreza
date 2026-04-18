# ADR-0008: Authentication Strategy
## Status: Accepted
## Date: 2026-03-21

## Context

The platform has a member area (`/clanovi/`) with login-protected content (saved decisions, profile). The existing site has a working login/registration system (ASP.NET Forms Authentication). The new system must:
1. Support email + password authentication
2. Issue tokens that the React SPA can use to call protected Payload API endpoints
3. Store tokens securely (prevent XSS token theft)
4. Support three user roles: `admin`, `editor`, `member`
5. Allow future OAuth extension (Google/social login) without a full auth rewrite

The current site identified as Critical issue #2: credentials sent in cleartext over HTTP. The new system must enforce HTTPS (handled by Caddy; see ADR-0004).

## Decision

**Payload CMS 3 built-in authentication with JWT stored in HttpOnly cookies.**

Payload's `Users` collection uses Payload's built-in auth system. On login (`POST /api/users/login`), Payload sets an `HttpOnly; Secure; SameSite=Strict` cookie containing the JWT. The React SPA sends requests with `credentials: 'include'` — the browser attaches the cookie automatically. The JWT is never accessible to JavaScript, preventing XSS theft.

Three roles defined on the `Users` collection:
- `admin` — full access to all collections in Payload Admin
- `editor` — can create/edit content collections; cannot manage users
- `member` — can access member-area pages; cannot access Payload Admin

Password storage: bcrypt with cost factor 12 (Payload default).

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **localStorage JWT** | localStorage is accessible to JavaScript — any XSS vulnerability exposes the token. Not acceptable for a platform that handles personally identifiable data (expert witness contact information, user profiles). HttpOnly cookies are the correct choice. |
| **NextAuth / Auth.js** | Auth.js is designed for Next.js. Not applicable here (no Next.js; see ADR-0003). Would require running a separate authentication service alongside Payload. |
| **Supabase Auth** | SaaS; data leaves the client's server. Not acceptable for a self-hosted platform. |
| **Clerk / Auth0** | Same concern as Supabase — external SaaS auth providers send user data to third-party servers. Not appropriate for a Croatian judicial platform with GDPR obligations. |
| **Keycloak** | Excellent for enterprise SSO but enormous operational overhead (JVM, separate database, admin console). A judicial non-profit does not need Keycloak. |
| **Custom JWT implementation** | Rolling your own auth is a security antipattern. Payload's built-in auth is well-tested and handles token refresh, logout (token invalidation), and email verification. No benefit to custom implementation. |
| **Session cookies (server-side sessions)** | Payload uses JWT-based auth; session state is stateless. This fits the architecture (Payload can be scaled horizontally if needed). |

## Consequences

**Positive:**
- HttpOnly cookie prevents XSS token theft — JavaScript cannot access the JWT
- `SameSite=Strict` cookie attribute prevents CSRF (combined with Caddy's rate limits on `/api/users/login`)
- Payload manages token refresh automatically — the SPA's `useAuth` hook only needs to call `GET /api/users/me` to check authentication state on mount
- bcrypt cost factor 12 means brute-force attacks on leaked password hashes are computationally expensive
- Role-based access is enforced at the Payload collection level — `admin`/`editor` restrictions are in TypeScript code, not a separate middleware layer

**Negative / Risks:**
- `SameSite=Strict` means the cookie is not sent on cross-origin requests — the frontend must be served from the same domain as the API (both behind Caddy on `sudacka-mreza.hr`). In development, the Vite dev server runs on `:5173` and Payload on `:3001` — developers must either use a local proxy or use `SameSite=None; Secure` in dev. The dev `Caddyfile` handles this via a local proxy.
- Payload's JWT secret (`PAYLOAD_SECRET`) must be rotated if compromised — all active sessions are invalidated on rotation. Documented in `DEPLOYMENT.md`.
- Future OAuth (Google login) is possible via Payload's auth plugins but not in scope for Sprint 6 — noted in backlog
