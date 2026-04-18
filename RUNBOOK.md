# Sudačka mreža — Operations Runbook

**Last updated:** 2026-03-21
**Maintained by:** GigForge Engineering
**Project:** sudacka-mreza.hr website rebuild

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Deployment](#deployment)
3. [Health Checks](#health-checks)
4. [Monitoring and Logging](#monitoring-and-logging)
5. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
6. [Backup and Restore](#backup-and-restore)
7. [Scaling](#scaling)
8. [Rollback Procedure](#rollback-procedure)
9. [Scheduled Maintenance](#scheduled-maintenance)
10. [Contact and Escalation](#contact-and-escalation)

---

## Service Overview

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| `db` | postgres:16-alpine | 5432 (internal) | PostgreSQL — primary database |
| `cms` | node:22 | 4094 | Payload CMS — REST API + Admin UI |
| `web` | nginx:alpine | 4093 | React SPA — static file server |

**External ports exposed:**
- `4093` → React frontend
- `4094` → Payload CMS API and Admin UI

In production, Caddy sits in front of both on port 443:
- `sudacka-mreza.hr` → web (4093)
- `sudacka-mreza.hr/api/*` → cms (4094)
- `sudacka-mreza.hr/admin/*` → cms (4094)
- `sudacka-mreza.hr/media/*` → cms (4094)

---

## Deployment

### Prerequisites

- Docker 24+ and Docker Compose 2.x
- `.env` file with production values (see README.md)
- At least 2 GB RAM, 20 GB disk

### First-time deployment

```bash
# 1. Clone the repository
git clone https://github.com/gigforge/sudacka-mreza.git
cd sudacka-mreza

# 2. Configure environment
cp .env.example .env
# Edit .env with production credentials:
#   POSTGRES_PASSWORD=<strong random password>
#   PAYLOAD_SECRET=<openssl rand -base64 48>
#   RESEND_API_KEY=<from Resend dashboard>
#   SERVER_URL=https://sudacka-mreza.hr

# 3. Build images
docker compose build --no-cache

# 4. Start all services
docker compose up -d

# 5. Verify health (see Health Checks section below)
curl http://localhost:4094/api/health

# 6. Create first admin user (first-time only)
# Navigate to http://localhost:4094/admin in a browser
# Follow the on-screen wizard to create the admin account
```

### Routine deployment (new code release)

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild affected images
docker compose build --no-cache cms    # if CMS changed
docker compose build --no-cache web    # if frontend changed

# 3. Rolling restart (avoids downtime)
docker compose up -d --no-deps cms
docker compose up -d --no-deps web

# 4. Verify health
curl http://localhost:4094/api/health
curl -I http://localhost:4093

# 5. Check logs for errors
docker compose logs --tail=50 cms
docker compose logs --tail=50 web
```

### Post-deployment checklist

- [ ] CMS health endpoint returns `{"status":"ok"}`
- [ ] Frontend returns HTTP 200
- [ ] Admin UI accessible at `/admin`
- [ ] Can log in with admin credentials
- [ ] Court decisions list loads correctly
- [ ] Expert witness search returns results
- [ ] Contact form submits without error (check Resend dashboard)
- [ ] Plausible analytics receives page views
- [ ] SSL certificate valid (check with `curl -I https://sudacka-mreza.hr`)

---

## Health Checks

### CMS API health

```bash
curl http://localhost:4094/api/health
# Expected: {"status":"ok"}
# If non-200: CMS is down or misconfigured
```

### Database health

```bash
docker compose exec db pg_isready -U postgres -d sudacka_mreza
# Expected: localhost:5432 - accepting connections
```

```bash
# Count records in key tables (sanity check after deploy)
docker compose exec db psql -U postgres -d sudacka_mreza -c "
  SELECT
    (SELECT count(*) FROM court_decisions) AS decisions,
    (SELECT count(*) FROM courts) AS courts,
    (SELECT count(*) FROM expert_witnesses) AS experts,
    (SELECT count(*) FROM interpreters) AS interpreters;
"
```

### Frontend (Nginx)

```bash
curl -I http://localhost:4093
# Expected: HTTP/1.1 200 OK, Content-Type: text/html
```

### HTTPS (production)

```bash
curl -I https://sudacka-mreza.hr
# Expected: HTTP/2 200, Server: Caddy
```

```bash
# Check SSL certificate expiry
echo | openssl s_client -connect sudacka-mreza.hr:443 2>/dev/null \
  | openssl x509 -noout -dates
# Not Before and Not After dates
# Caddy auto-renews; alert if expiry is < 30 days away
```

### All services at once

```bash
docker compose ps
# Expected: all services "Up (healthy)"
```

---

## Monitoring and Logging

### Log locations

| Service | Log access | What to watch |
|---------|-----------|---------------|
| CMS | `docker compose logs cms` | Request errors, hook failures, auth failures |
| Web (Nginx) | `docker compose logs web` | 4xx/5xx responses, unusual traffic |
| Database | `docker compose logs db` | Connection errors, slow queries, lock waits |

### Real-time log tail

```bash
# All services together
docker compose logs -f

# CMS only
docker compose logs -f cms

# Filter for errors only
docker compose logs cms 2>&1 | grep -E "(ERROR|error|FATAL|fatal)"
```

### Structured log patterns to watch

```bash
# Failed login attempts (potential brute-force)
docker compose logs cms | grep "Auth Passed\|incorrect"

# Slow queries (over 1s)
docker compose logs db | grep "duration:"

# 5xx errors from Nginx
docker compose logs web | grep " 5[0-9][0-9] "

# Hook failures (slug generation, search index)
docker compose logs cms | grep -i "hook"
```

### Plausible analytics

Plausible is self-hosted with ClickHouse. Access the dashboard at:
```
http://localhost:8000  (or https://analytics.sudacka-mreza.hr in production)
```

Key metrics to monitor weekly:
- Unique visitors
- Bounce rate
- Most visited pages (decisions, expert search)
- Traffic sources

### Disk usage

```bash
# Check database volume size
docker system df -v | grep postgres_data

# Check uploaded media size
du -sh /var/lib/docker/volumes/sudacka-mreza_media_files 2>/dev/null || \
  docker compose exec cms du -sh /app/media
```

Alert thresholds:
- DB volume > 10 GB: notify Dražen
- Disk usage > 80%: immediate action required

---

## Common Issues and Troubleshooting

### CMS fails to start

**Symptom:** `docker compose up` and CMS container exits immediately.

**Diagnosis:**
```bash
docker compose logs cms
```

**Common causes and fixes:**

| Error message | Fix |
|--------------|-----|
| `ECONNREFUSED 5432` | Database not ready yet — wait 10s and retry |
| `Invalid JWT secret` | `PAYLOAD_SECRET` too short (must be ≥ 32 chars) |
| `Cannot find module` | Run `docker compose build --no-cache cms` |
| `Port 4094 already in use` | `lsof -i :4094` and kill the process |
| `Database "sudacka_mreza" does not exist` | Run `docker compose down -v` and recreate volumes |

**Quick fix:**
```bash
docker compose down
docker compose up -d db
sleep 15
docker compose up -d cms
```

---

### Frontend shows blank page

**Symptom:** http://localhost:4093 returns 200 but shows nothing.

**Diagnosis:**
```bash
# Check Nginx is serving the built files
docker compose exec web ls /usr/share/nginx/html
# Expected: index.html, assets/, ...

# Check browser console for JS errors
```

**Fix:**
```bash
# Rebuild the frontend with correct API URL
docker compose build --no-cache web
docker compose up -d --no-deps web
```

---

### Database connection pool exhausted

**Symptom:** CMS logs show `remaining connection slots are reserved` or requests time out.

**Diagnosis:**
```bash
docker compose exec db psql -U postgres -d sudacka_mreza -c "
  SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
"
```

**Fix:**
```bash
# Restart CMS to release connections
docker compose restart cms

# If persistent, increase max_connections in PostgreSQL
# Edit docker-compose.yml:
#   db:
#     command: postgres -c max_connections=200
docker compose up -d --no-deps db
```

---

### Email sending fails (contact form / password reset)

**Symptom:** Contact form returns 200 but emails are not received.

**Diagnosis:**
```bash
docker compose logs cms | grep -i "resend\|email\|SMTP"
```

**Common causes:**
1. `RESEND_API_KEY` not set or expired
2. Sending domain not verified in Resend
3. `CONTACT_EMAIL` is a valid destination but deliverability issue

**Fix:**
```bash
# Verify the key is set
docker compose exec cms env | grep RESEND

# Test Resend API directly
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@mg.ai-elevate.ai","to":"drazen.komarica@gmail.com","subject":"Test","text":"Test"}'
```

---

### Search returns no results

**Symptom:** Searching for content that definitely exists returns 0 results.

**Diagnosis:**
```bash
# Check if searchVector is populated
docker compose exec db psql -U postgres -d sudacka_mreza -c "
  SELECT id, title_hr, search_vector IS NOT NULL AS has_vector
  FROM court_decisions
  LIMIT 5;
"
```

**Fix — Rebuild search index for all existing decisions:**
```bash
docker compose exec db psql -U postgres -d sudacka_mreza -c "
  UPDATE court_decisions
  SET search_vector = to_tsvector('simple',
    coalesce(title_hr, '') || ' ' || coalesce(full_text_hr, ''))
  WHERE search_vector IS NULL;
"
```

---

### pg_trgm extension missing

**Symptom:** Name fuzzy search throws `function similarity does not exist`.

**Fix:**
```bash
docker compose exec db psql -U postgres -d sudacka_mreza -c "
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
"
```

---

### Admin UI inaccessible (503)

**Symptom:** `/admin` returns 503 or gateway error.

**Diagnosis:**
```bash
docker compose ps cms          # Is it running?
docker compose logs cms | tail -20  # Any errors?
```

**Fix:**
```bash
docker compose restart cms
# Wait 30 seconds
curl http://localhost:4094/api/health
```

---

### Forgotten admin password

```bash
# Reset via Payload CLI
docker compose exec cms node -e "
  const payload = require('payload');
  payload.init({ secret: process.env.PAYLOAD_SECRET }).then(async () => {
    await payload.forgotPassword({ collection: 'users', data: { email: 'admin@example.com' } });
    console.log('Reset email sent');
    process.exit(0);
  });
"
```

Or use the admin UI's "Forgot Password" flow (if email is working).

---

## Backup and Restore

### Automated backup (daily recommended)

Add to crontab on the host:

```bash
# /etc/cron.d/sudacka-mreza-backup
0 2 * * * root /opt/sudacka-mreza/scripts/backup.sh >> /var/log/sudacka-mreza-backup.log 2>&1
```

**backup.sh:**
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/backups/sudacka-mreza"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
mkdir -p "$BACKUP_DIR"

# Database dump
docker compose -f /opt/sudacka-mreza/docker-compose.yml exec -T db \
  pg_dump -U postgres -d sudacka_mreza --format=custom \
  > "$BACKUP_DIR/db_$DATE.dump"

# Media files
docker compose -f /opt/sudacka-mreza/docker-compose.yml exec -T cms \
  tar -czf - /app/media \
  > "$BACKUP_DIR/media_$DATE.tar.gz"

# Retain 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "[$DATE] Backup complete: db_$DATE.dump + media_$DATE.tar.gz"
```

### Manual database backup

```bash
# Create dump
docker compose exec -T db \
  pg_dump -U postgres -d sudacka_mreza --format=custom \
  > backup_$(date +%Y-%m-%d).dump

# Verify dump
pg_restore --list backup_$(date +%Y-%m-%d).dump | head -20
```

### Restore database

```bash
# Stop CMS (prevent writes during restore)
docker compose stop cms

# Drop and recreate database
docker compose exec db psql -U postgres -c "
  DROP DATABASE IF EXISTS sudacka_mreza;
  CREATE DATABASE sudacka_mreza;
"

# Restore
docker compose exec -T db \
  pg_restore -U postgres -d sudacka_mreza --no-owner \
  < backup_2026-03-21.dump

# Start CMS
docker compose start cms

# Verify
curl http://localhost:4094/api/health
```

### Backup media files

```bash
# Backup
docker compose exec cms tar -czf - /app/media > media_backup_$(date +%Y-%m-%d).tar.gz

# Restore
docker compose exec -T cms tar -xzf - -C / < media_backup_2026-03-21.tar.gz
```

### Off-site backup

Copy backups to remote storage (e.g., S3-compatible):

```bash
# Install rclone and configure an "r2" remote
rclone copy /backups/sudacka-mreza r2:sudacka-mreza-backups --progress
```

---

## Scaling

### Current limits

At the current Docker Compose single-host setup:
- **db:** 512 MB RAM limit (`mem_limit: 512m`)
- **cms:** 600 MB RAM limit (`mem_limit: 600m`)
- **web:** Nginx, minimal memory usage

### Horizontal scaling (when needed)

The application is not stateful in the app layer (sessions are JWT in cookies; files are local). To scale CMS:

1. Move media storage to object storage (S3/R2) using `@payloadcms/storage-s3`
2. Use an external PostgreSQL instance (e.g., Supabase, RDS)
3. Run multiple CMS replicas behind a load balancer (Caddy or HAProxy)

### Database performance tuning

For high read loads (court decisions are read-heavy):

```bash
# Add to docker-compose.yml db service:
command: >
  postgres
  -c shared_buffers=256MB
  -c effective_cache_size=768MB
  -c max_connections=200
  -c work_mem=4MB
  -c maintenance_work_mem=64MB
  -c checkpoint_completion_target=0.9
  -c wal_buffers=16MB
  -c random_page_cost=1.1
```

### CDN (recommended for production)

Put Cloudflare (free tier) in front of `sudacka-mreza.hr`:
- Static assets cached at edge (React JS/CSS bundles)
- DDoS protection
- Croatian PoP reduces latency for local users

---

## Rollback Procedure

### Code rollback

```bash
# Find the last working commit
git log --oneline -10

# Roll back to specific commit
git checkout <commit-hash>

# Rebuild and restart
docker compose build --no-cache cms web
docker compose up -d --no-deps cms web

# Verify
curl http://localhost:4094/api/health
```

### Database rollback

Only needed if a migration broke data. Always backup before deploying.

```bash
# Stop CMS
docker compose stop cms

# Restore from last known-good backup
docker compose exec -T db \
  pg_restore -U postgres -d sudacka_mreza --clean --no-owner \
  < /backups/sudacka-mreza/db_YYYY-MM-DD.dump

# Start CMS at the old code version
git checkout <last-good-commit>
docker compose build --no-cache cms
docker compose up -d --no-deps cms
```

### Emergency rollback checklist

1. [ ] Confirm the issue (not a false alarm)
2. [ ] Notify Dražen Komarica that a rollback is in progress
3. [ ] Stop CMS: `docker compose stop cms`
4. [ ] Backup current DB state (before restore): `pg_dump ...`
5. [ ] Restore from last good backup
6. [ ] Checkout last good git commit
7. [ ] Rebuild image
8. [ ] Start CMS
9. [ ] Run health checks
10. [ ] Confirm with Dražen that site is operational

---

## Scheduled Maintenance

### Weekly tasks

- [ ] Check disk usage (`df -h`, `docker system df`)
- [ ] Review error logs for anomalies
- [ ] Verify backups are completing (check `/var/log/sudacka-mreza-backup.log`)
- [ ] Check Let's Encrypt certificate expiry (`openssl s_client ...`)
- [ ] Review Plausible analytics for unusual traffic spikes

### Monthly tasks

- [ ] Apply Docker image security updates: `docker compose pull && docker compose up -d`
- [ ] Review and rotate `PAYLOAD_SECRET` (requires re-login for all users)
- [ ] Prune old Docker images: `docker image prune -f`
- [ ] Test backup restore procedure in staging

### Dependency updates

```bash
# Update CMS dependencies
cd cms && npm audit && npm update

# Rebuild and test
docker compose build --no-cache cms
pytest backend/tests/ -v
docker compose up -d --no-deps cms
```

---

## Contact and Escalation

### Primary contacts

| Role | Name | Contact | Availability |
|------|------|---------|-------------|
| Site owner / client | Dražen Komarica | drazen.komarica@gmail.com | Business hours (CET) |
| GigForge Engineering | Lead Engineer | gigforge-engineer (internal agent) | On-demand |
| GigForge Operations | Operations Director | gigforge (internal agent) | On-demand |

### Escalation matrix

| Severity | Examples | Response time | Who to contact |
|----------|---------|---------------|----------------|
| P1 — Site down | All services 503, data loss, security breach | Immediate | GigForge Ops → Dražen |
| P2 — Partial outage | CMS admin down, email failing, search broken | < 2 hours | GigForge Engineering |
| P3 — Degraded | Slow load times, minor UI issues | < 24 hours | GigForge Engineering |
| P4 — Cosmetic | Typos, minor display issues | Next sprint | GigForge Engineering |

### Incident response

1. **Detect** — health check fails or user reports issue
2. **Triage** — `docker compose ps`, `docker compose logs`
3. **Mitigate** — apply fix or rollback (see above)
4. **Communicate** — notify Dražen if P1/P2
5. **Post-mortem** — document in `docs/incidents/YYYY-MM-DD.md`

### Useful commands quick reference

```bash
# Status overview
docker compose ps

# Restart specific service
docker compose restart cms

# View live logs
docker compose logs -f cms

# Open psql shell
docker compose exec db psql -U postgres -d sudacka_mreza

# Open bash in CMS container
docker compose exec cms sh

# Force full rebuild
docker compose down && docker compose build --no-cache && docker compose up -d
```
