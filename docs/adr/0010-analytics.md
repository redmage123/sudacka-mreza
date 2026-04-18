# ADR-0010: Analytics Strategy
## Status: Accepted
## Date: 2026-03-21

## Context

The current site has zero analytics (identified as High issue #7 in SPEC §1.6). Sudačka Mreža has no visibility into how many users visit, which pages are most used, what search terms are entered, or where users drop off. Analytics are essential for understanding user behaviour and justifying grant funding.

However, the platform serves a Croatian audience under GDPR (EU General Data Protection Regulation). Any analytics solution must:
1. Not require a cookie consent banner (which degrades user experience and is frequently dismissed)
2. Not send user data to third-party servers
3. Comply with GDPR without requiring explicit consent
4. Provide meaningful data: pageviews, unique visitors, top pages, referrers, search queries

## Decision

**Umami self-hosted analytics** as the `analytics` Docker Compose service.

Umami is cookieless, privacy-first, and GDPR-compliant by design — it collects pageviews without setting cookies and without fingerprinting. No IP addresses are stored. The Umami dashboard is available at `/analytics/` (Caddy-proxied, basic-auth protected). The tracking script is loaded by the React SPA from the same origin — no third-party CDN calls.

A lightweight `<script>` tag is added to `index.html` pointing to the Umami script hosted by the `analytics` service.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Google Analytics 4** | Sends user data to Google servers — not GDPR-compliant without explicit cookie consent. Requires a consent banner. Rejected on privacy grounds appropriate for a judicial platform. Also, Google's data transfer to the US is contentious under GDPR post-Schrems II. |
| **Plausible (cloud)** | Plausible cloud is an excellent SaaS analytics tool (cookieless, GDPR-friendly) but has a monthly subscription fee. The self-hosted version (`plausible/analytics`) exists but requires ClickHouse, which adds significant complexity (ClickHouse needs 4 GB+ RAM). Not suitable for our 2 GB server. |
| **Plausible Community Edition** | The community edition removed ClickHouse dependency in v2. This is a valid alternative to Umami. Rejected in favour of Umami because Umami has a simpler Docker setup (single service + PostgreSQL, which we already have) and a cleaner embed script API. |
| **Fathom Analytics** | SaaS; monthly fee. Not appropriate for a pro-bono project. |
| **No analytics** | Not acceptable — the client currently has zero visibility. Analytics data will inform content decisions and support grant applications. |
| **Matomo (self-hosted)** | Matomo is full-featured but complex to configure. The default Matomo setup uses cookies (requires consent banner). Configuring cookieless Matomo requires additional steps. Umami is simpler and cookieless by default. |
| **Server-side access log analysis (GoAccess)** | Log analysis gives pageview counts but no referrer data, no search query tracking, and no real-time dashboard. Useful as a backup but not a primary analytics solution. |

## Consequences

**Positive:**
- Umami is cookieless — no cookie consent banner required under GDPR, ePrivacy Directive
- Self-hosted — no user data leaves the client's server
- Umami shares the existing PostgreSQL 16 database (separate schema) — no additional database service required
- The Umami admin dashboard is accessible at `https://sudacka-mreza.hr/analytics/` (Caddy-proxied, protected by basic auth configured in Caddyfile)
- Pageviews, bounce rate, top pages, referrers, and device breakdown are available within minutes of launch
- Removing Umami is as simple as removing the `analytics` service from compose — zero lock-in

**Negative / Risks:**
- Umami is less feature-rich than Google Analytics (no funnel analysis, no cohort reports, no user journey). Acceptable for a civic platform — pageviews and top-pages are sufficient.
- Umami adds ~100–200 MB RAM idle. Monitor server memory usage; can be stopped if resources are constrained (analytics is non-critical).
- Umami schema migrations must run on first startup — handled by Umami's built-in migration runner on container start.
- The Umami `UMAMI_DATABASE_URL` must point to the shared PostgreSQL instance using a separate database name (`umami`) — configured in `docker-compose.yml` environment variables.
