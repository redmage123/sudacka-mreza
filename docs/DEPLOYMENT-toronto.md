# Toronto production deployment

The live site `https://sudacka-mreza.hr` runs on the Toronto host from
`~/sudacka-mreza` via `docker-compose.yml` (this branch's compose is the production stack). This file documents the
production topology so it is reproducible from the repo (it previously existed
only on the server, in no branch).

## Topology

Four containers on an internal bridge network (`internal`); only the web
container publishes a port, and only on loopback (a host nginx/Caddy terminates
TLS and proxies in):

| Service             | Build / image            | Port (host)        | Role |
|---------------------|--------------------------|--------------------|------|
| `db`                | `pgvector/pgvector:pg16` | none (internal)    | Postgres + pgvector |
| `cms`               | `./cms`                  | none (internal)    | Payload CMS + API (`:4094`) |
| `web`               | `nginx:stable-alpine`    | `127.0.0.1:4092`   | serves prebuilt `web-dist/`, proxies `/api` |
| `bankruptcy-ingest` | `./bankruptcy-ingest`    | `127.0.0.1:4095`   | FastAPI: editor filings, PDF/OCR extract, mailgun webhook |

Key differences from the dev compose on the feature branches:

- Postgres is `pgvector/pgvector:pg16` (not `postgres:16-alpine`) and gets
  `mem_limit: 2g` (the 512m dev limit caused OOM kills under query load).
- The web container does **not** build the frontend. The frontend is built
  off-server (`web/`, `npm run build`) and the resulting `web-dist/` is rsynced
  to the host and mounted read-only. Only `cms` and `bankruptcy-ingest` build
  from source on the server.
- `/etc/msmtprc` is mounted read-only into `cms` and `bankruptcy-ingest` for the
  shared Gmail mail relay (2FA + filing notifications).

## Secrets

No secrets live in this repo. The compose file uses safe dev placeholders as
`${VAR:-default}` fallbacks; production values come from a server-side `.env`
(gitignored) and the `.pii-key` file (gitignored). See `.env.toronto.example`
for the full key list. The production `.env` must at minimum set
`POSTGRES_PASSWORD`, `PAYLOAD_SECRET`, and `PII_ENCRYPTION_KEY`.

## Deploy

```bash
# On the Toronto host, in ~/sudacka-mreza:
git pull                                            # pull latest source
docker compose -f docker-compose.yml up -d --build   # cms + ingest
# Frontend: build off-server, then rsync dist/ -> web-dist/ and:
docker compose -f docker-compose.yml restart web
```

The frontend bundle is shipped as a static `web-dist/` (built from `web/`); bump
`web/src/sw.ts` `CACHE_VERSION` when shipping a new build so the service worker
purges stale caches across clients.
