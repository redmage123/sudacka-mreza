# ADR-0006: Authentication — Payload Built-in JWT Auth
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The platform requires authentication for two purposes:
1. **CMS admin access** — Payload admin UI requires authenticated admin/editor users to manage content
2. **Member area** — registered users (Croatian judges, legal professionals) can access member-only content (saved decisions, exclusive resources)

The owner specified Payload's built-in JWT authentication.

Requirements:
- User registration (email + password)
- Login / logout
- Password reset via email
- Role-based access: `admin`, `editor`, `member`
- Secure session management (HttpOnly cookies)
- No OAuth for MVP (OAuth social login is a future enhancement)

---

## Decision

**Payload CMS built-in authentication** for all authentication needs.

Payload ships with a complete auth system:
- Email/password with bcrypt hashing (cost factor 12 by default)
- JWT tokens stored in HttpOnly cookies (`payload-token`)
- Access control per collection and per operation (read/create/update/delete)
- Built-in endpoints: `POST /api/users` (register), `POST /api/users/login`, `POST /api/users/logout`, `POST /api/users/forgot-password`, `POST /api/users/reset-password`, `GET /api/users/me`
- Email templates for password reset (integrated with Resend)

The React SPA reads the JWT from the HttpOnly cookie automatically on API requests (same-origin). For the bearer token flow (Axios with `withCredentials: true`), the cookie is sent automatically.

User roles are defined in the `Users` collection access control:
```typescript
// Only admin can create editors
// Anyone can register as member (with email verification)
// Admin-only fields are hidden from editor/member roles
```

---

## Alternatives Considered

**NextAuth.js v5**
- The earlier PROJECT_PLAN.md specified NextAuth v5, written when Next.js was the assumed framework
- Pros: Excellent OAuth support; well-documented; handles sessions, tokens, and providers
- Cons: NextAuth v5 is designed for Next.js — running it with plain React + Vite requires significant custom setup; Payload already has a complete auth system; maintaining two auth systems (Payload for CMS admin + NextAuth for frontend members) creates complexity and token management headaches
- Rejected: Owner chose React + Vite (not Next.js); Payload's built-in auth eliminates the need for a separate auth library

**Clerk**
- Pros: Excellent DX; handles all edge cases; pre-built UI components
- Cons: Hosted service — data stored on US servers; monthly cost for active users; vendor lock-in; overkill for this scale
- Rejected: Self-hosted requirement; data sovereignty

**JWT + custom Express endpoints**
- Build auth from scratch with jsonwebtoken + bcryptjs
- Pros: Complete control
- Cons: Payload already provides this, tested and maintained; reinventing auth is a security risk
- Rejected: Payload's built-in auth is the right tool

**Keycloak / Authentik (standalone IdP)**
- Enterprise-grade identity provider as a separate Docker service
- Pros: OAuth/OIDC standard; supports Croatian government IdP integration in the future
- Cons: Extreme operational overhead for this scale; requires significant setup; Keycloak alone needs 512MB RAM
- Deferred: Add Keycloak integration if Croatian e-Građani (national identity) login is required in a future phase

---

## Consequences

**Positive:**
- No additional auth library or service needed — auth is built into Payload
- The same Users collection serves both the CMS admin (admin/editor roles) and the member area (member role)
- Password reset email is handled by Payload's email integration (connected to Resend)
- Access control rules are colocated with collection definitions — easy to reason about

**Negative:**
- Payload's auth is JWT-only; no built-in session database (tokens are stateless). This means revocation requires either short token lifetimes or a custom token blacklist.
  - Mitigation: Set JWT expiry to 2 hours; use `POST /api/users/logout` to clear the cookie on the client side; implement a Redis-based token blacklist if session revocation becomes a requirement
- No OAuth/social login in MVP — users must register with email/password
  - Mitigation: Payload supports custom OAuth plugins; this is a Phase 3 enhancement

**Risk:**
- CSRF protection: Payload sets `SameSite=Strict` on the JWT cookie, which provides CSRF protection for same-origin requests. Cross-origin requests (e.g., if a third party embeds the Payload API) must use the `Authorization: Bearer` header. Ensure `CORS_ORIGIN` is set to `https://sudacka-mreza.hr` only — never `*`.
