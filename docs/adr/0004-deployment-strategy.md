# ADR-0004: Deployment Strategy — Docker Compose + Caddy
## Status: Accepted
## Date: 2026-03-21
## Decider: Chris Novak (CTO)

---

## Context

The project needs a deployment strategy that:
- Can run locally for development with a single command
- Deploys to a VPS with HTTPS and auto-renewing SSL
- Is simple enough for the client (Dražen) to restart services or check logs without GigForge assistance
- Has a clear upgrade path (scale vertically, add services)
- Fits GigForge's standard practices

The owner specified Docker Compose.

The current site runs on an unmanaged server at a static IP (69.61.26.116), likely with manual deployments. The new site will move to a fresh VPS.

---

## Decision

**Docker Compose** with four services:

```yaml
services:
  caddy:      # HTTPS reverse proxy + Let's Encrypt
  web:        # React SPA (Nginx serving Vite build)
  cms:        # Payload CMS 3 (Node.js)
  db:         # PostgreSQL 16
```

Optional fifth service (added later):
```yaml
  analytics:  # Plausible CE (self-hosted, privacy-preserving)
```

**Caddy** as the reverse proxy — chosen over Nginx+Certbot because Caddy handles Let's Encrypt certificate provisioning and renewal with zero configuration. The entire HTTPS setup is:
```
sudacka-mreza.hr {
    handle /api/* { reverse_proxy cms:3001 }
    handle /admin/* { reverse_proxy cms:3001 }
    handle { reverse_proxy web:80 }
}
```
No cron jobs for certificate renewal, no certbot setup, no annual certificate expiry surprises.

---

## Alternatives Considered

**Railway / Fly.io (PaaS)**
- Pros: Zero infrastructure management; automatic scaling; no SSH access needed
- Cons: Higher monthly cost (~€20-40/mo for this stack vs. €10-15/mo for a VPS); less control for a civic organisation; data sovereignty concern for Croatian judicial data being on US infrastructure; harder to self-host Plausible analytics
- Rejected: Cost and data sovereignty concerns; client is likely more comfortable with a VPS they own

**Kubernetes (k3s)**
- Pros: Scalable; industry standard for large deployments
- Cons: Massive operational overhead for a 4-service application with <10k daily users; requires k3s expertise to maintain; overkill by several orders of magnitude
- Rejected: Wildly disproportionate to the scale

**Single Docker container (all services)**
- Using supervisord to run PostgreSQL + Node.js inside one container
- Pros: Simpler to reason about for non-DevOps people
- Cons: Violates single-responsibility principle; no independent restart per service; shared resource limits; upgrading any single component requires rebuilding the whole container
- Rejected: Bad practice; makes debugging harder, not easier

**Nginx + Certbot instead of Caddy**
- Nginx is more widely understood than Caddy
- Pros: More documentation and Stack Overflow answers; more operators know Nginx
- Cons: Certbot requires a cron job for renewal; Nginx TLS config has many footguns (old cipher suites, OCSP stapling, etc.); Caddy gets all of this right by default; renewal failures have historically been the #1 cause of HTTPS outages for small sites
- Rejected: Caddy's automatic certificate management is significantly safer for a civic site that cannot have HTTPS outages

---

## Consequences

**Positive:**
- `docker compose up -d` starts the entire stack from scratch in under 2 minutes
- Caddy eliminates all manual SSL certificate management forever
- Each service restarts independently (`docker compose restart cms`)
- Database upgrades, CMS upgrades, and frontend deploys are all independent
- Persistent data in named Docker volumes (`db_data`, `media_data`) survives container restarts
- Easy to add services (Meilisearch, Redis for caching) without restructuring

**Negative:**
- Client (Dražen) needs basic Docker knowledge to run operational commands — mitigated by a `OPERATIONS.md` guide with exact copy-paste commands
- Docker Compose is not as resilient as Kubernetes for crash recovery — mitigated by `restart: unless-stopped` on all services
- No horizontal scaling — this is a single-VPS deployment; acceptable for this traffic level

**Risk:**
- The VPS must have enough RAM for all four services. Estimated: Caddy (50MB) + Nginx/web (20MB) + Payload CMS (300MB) + PostgreSQL (200MB) = ~600MB. A 1GB VPS is the minimum; 2GB recommended. This must be communicated to the client when selecting a server.
- Docker volume backups are critical. A `docker compose exec db pg_dump` cron job MUST be set up on day one. See `OPERATIONS.md` for the backup script.
