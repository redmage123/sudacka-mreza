# ADR-0009: Analytics — Plausible Community Edition (Self-Hosted)
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The current site has **no analytics whatsoever** — zero visibility into traffic, most-visited pages, search queries, or user behaviour. This is a significant operational blind spot for a civic organisation that reports to funders (Dutch Ministry of Foreign Affairs, Norwegian Ministry of Foreign Affairs, OSCE, etc.).

The analytics solution must:
- Be GDPR-compliant (Croatian data protection law follows EU GDPR)
- Not require a cookie consent banner (which degrades UX)
- Give meaningful data: page views, unique visitors, traffic sources, top pages, search terms
- Be self-hosted (data sovereignty — Croatian judicial platform data should not go to Google)
- Be free or low-cost for a pro-bono project

The owner specified Plausible (self-hosted, GDPR-compliant).

---

## Decision

**Plausible Community Edition (CE)** as the fifth Docker Compose service.

Plausible CE is cookieless — it does not set any cookies, does not track individuals, and is compliant with GDPR, CCPA, and ePrivacy Directive out of the box. No cookie consent banner needed.

The tracking script is a single `<script>` tag in `index.html`:
```html
<script defer data-domain="sudacka-mreza.hr" src="/stats/js/script.js"></script>
```

(The `/stats/js/script.js` path is proxied from the Plausible service via Nginx, avoiding ad-blocker detection of `plausible.io` as a hostname.)

Plausible CE requires:
- PostgreSQL (can share the same PostgreSQL instance OR use its own — we use its own database in the same PostgreSQL container for simplicity)
- ClickHouse (Plausible's analytics database — a separate container)

Note: Plausible CE adds **two** additional Docker containers (`analytics` for the Plausible app, `clickhouse` for the analytics time-series database). This increases the Docker Compose service count from 4 to 6.

**Deployment timing:** Plausible is NOT deployed in Phase 1. It is added in Phase 2 (story S2-14) after the core site is stable. The Plausible containers are defined in `docker-compose.yml` but commented out initially.

---

## Alternatives Considered

**Google Analytics 4 (GA4)**
- The most widely used analytics platform
- Cons: Requires cookie consent banner (GDPR); sends all data to Google (data sovereignty); Google has received GDPR enforcement actions from Austrian, French, and Italian DPAs specifically for GA data transfers to the US; adds ~45KB of third-party JavaScript; the client is a judicial organisation — having user behaviour sent to Google is inappropriate
- Rejected: GDPR compliance and data sovereignty requirements

**Umami (self-hosted)**
- A Plausible alternative, also cookieless and GDPR-compliant
- Pros: Simpler architecture (PostgreSQL only, no ClickHouse); slightly simpler self-hosted setup
- Cons: Less mature than Plausible; smaller community; fewer features (no funnels, goals, or traffic sources breakdown)
- Close call: If Plausible's ClickHouse requirement is too heavy for the VPS, Umami is the fallback. Document this in the operations guide.

**Matomo (self-hosted)**
- More feature-rich than Plausible
- Cons: Requires cookie consent even in cookieless mode (debated); significantly more complex self-hosted setup; PHP + MySQL stack in a TypeScript project; heavier resource usage
- Rejected: Complexity overkill; GDPR compliance more complex than Plausible

**No analytics**
- Acceptable for MVP Phase 1
- Rejected for final site: the organisation needs to report on reach to funders; analytics is a hard requirement for the final delivery

---

## Consequences

**Positive:**
- Zero cookie consent banner — clean UX
- GDPR-compliant out of the box — no legal exposure for the client
- Data stays on the client's own server — appropriate for a judicial organisation
- Plausible's dashboard is simple and readable by non-technical staff

**Negative:**
- Adds 2 containers (Plausible + ClickHouse) — increasing complexity from 4 to 6 services total
- ClickHouse is a memory-hungry process (~200–300MB). This must be accounted for in VPS sizing. The recommended 2GB VPS is sufficient but leaves less headroom.
- Plausible CE lags behind Plausible Cloud in features — some advanced features (custom properties, funnels) may not be available

**Risk:**
- Port conflict: The host already has a process on port 8000 (`course-creator-user-management-1`). Plausible's default port must be remapped to **4097** in `docker-compose.yml`. The Nginx vhost proxies `/stats/*` to `127.0.0.1:4097`. Do not use port 8000.
