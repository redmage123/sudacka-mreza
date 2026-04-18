# ADR-0004: Deployment Strategy
## Status: Accepted
## Date: 2026-03-21

## Context

The platform needs a deployment strategy that: runs reliably on a low-cost VPS (1–2 vCPU, 2 GB RAM, ~€10–20/mo), supports automatic HTTPS renewal, isolates services from each other, is reproducible across environments, and can be maintained by a non-specialist administrator. The client explicitly requested Docker Compose.

## Decision

**Docker Compose with Caddy as the edge reverse proxy.**

Five services:
1. `caddy` — Caddy 2 reverse proxy; handles TLS (Let's Encrypt HTTP-01), routes traffic, rate-limits login/contact endpoints, sets security headers
2. `web` — Nginx Alpine serving the Vite-built React SPA static files
3. `cms` — Payload CMS 3 Node.js process (port 3001, internal only)
4. `db` — PostgreSQL 16 with a named volume for persistence and a healthcheck
5. `analytics` — Umami self-hosted analytics (cookieless, GDPR-compliant)

A `docker-compose.prod.yml` override file supplies production-specific values (registry image tags, `restart: unless-stopped`, no dev bind mounts).

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Railway / Fly.io (PaaS)** | Client is not confirmed on a new host (BLK-5 blocker). PaaS adds ongoing platform cost and vendor lock-in. Docker Compose keeps all options open — can run on any VPS, DigitalOcean, Hetzner, or the client's existing server. |
| **Kubernetes (K8s)** | Gross overkill for a 5-service stack on a single VPS. Operational burden is 10× Docker Compose for no benefit at this scale. |
| **Single container** | Running everything in one container removes service isolation, makes scaling individual components impossible, and complicates health checks. |
| **Nginx as edge proxy** | Nginx can reverse-proxy but has no built-in Let's Encrypt integration. Auto-renewing TLS certs with Nginx requires Certbot cron jobs — more moving parts than Caddy's zero-config HTTPS. |
| **Traefik as edge proxy** | A valid alternative to Caddy. Rejected because the `Caddyfile` syntax is simpler for the rate-limiting and header configuration required here, and Caddy's automatic HTTPS is more reliable in practice on a single-host setup. |
| **Serverless (AWS Lambda / Vercel)** | Payload CMS 3 standalone is a long-running Node.js process — not suitable for serverless cold-start constraints. PostgreSQL also requires a persistent connection pool, which is poorly suited to serverless. |

## Consequences

**Positive:**
- `docker compose up` brings the entire stack from zero in < 2 minutes — reproducible on any machine with Docker installed
- Caddy auto-renews Let's Encrypt certs via HTTP-01 challenge with zero configuration beyond the `Caddyfile`
- Named PostgreSQL volume persists data across container restarts and `compose up/down` cycles
- `restart: unless-stopped` in prod compose ensures all services recover automatically after a reboot
- Caddy rate-limits `/api/users/login` (5 req/min) and `/api/contact` (3 req/min) at the edge before traffic reaches Node.js
- `scripts/backup.sh` uses `pg_dump` inside the `db` container — no external tools needed; outputs compressed `.sql.gz` with 7-day retention

**Negative / Risks:**
- All 5 services share one host's resources — no horizontal scaling. Acceptable at expected traffic levels for a Croatian judicial information site.
- Let's Encrypt HTTP-01 challenge requires ports 80 and 443 to be publicly reachable — client must provide DNS/domain control (BLK-3 blocker)
- PostgreSQL exposed on port 5432 in dev compose must be removed in prod override — enforced by `docker-compose.prod.yml`
- Umami analytics service adds ~200 MB RAM idle; can be removed if server resources are constrained
