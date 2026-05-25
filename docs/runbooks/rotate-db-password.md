# Runbook: rotate the Postgres password (Toronto production)

Rotates the `postgres` role password for the live Sudačka Mreža deployment. Do
this because the old password (`Sudacka2026!SecureDB`) was committed to git
history and is considered compromised.

**Est. time:** ~10 min. **Downtime:** ~30–60 s for chat/API and editor filings
(while `cms` + `bankruptcy-ingest` recreate). The database is **not** restarted.

---

## Why this is not just "edit .env"

The `postgres_data` volume is already initialized. The container's
`POSTGRES_PASSWORD` env is consumed **only at first init** — for an existing
volume it is ignored. So you must change the role password **inside** the DB
(`ALTER USER`) *and* update `.env` so the clients (cms, bankruptcy-ingest) use
the new value. The two must stay in sync or new connections fail auth.

Existing open connections keep working after `ALTER USER` (Postgres does not
drop them), so there is a safe window to update `.env` and recreate the clients.

---

## 0. Pre-flight

```bash
ssh toronto-sudacka
cd ~/sudacka-mreza

# Confirm the stack is healthy before touching anything
docker compose ps
curl -s -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:4092/

# Fresh DB backup (rollback safety)
docker exec sudacka-mreza-db-1 pg_dump -U postgres -d sudacka_mreza \
  | gzip > ~/sudacka_mreza.pre-rotation.$(date +%Y%m%d_%H%M%S).sql.gz
ls -lh ~/sudacka_mreza.pre-rotation.*.sql.gz

# Backup the current .env
cp -a .env .env.pre-rotation.$(date +%s)
```

## 1. Generate a new URL-safe password

Use **alphanumeric only** — the old `!` had to be URL-encoded (`%21`) inside
`DATABASE_URI` and caused breakage. Avoid `@ : / ? # ! % &` etc.

```bash
NEW_PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32); echo "$NEW_PW"
```
Record `$NEW_PW` in the password manager now (you will lose the shell var).

## 2. Change the role password inside the DB (live, no restart)

```bash
docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza \
  -c "ALTER USER postgres WITH PASSWORD '$NEW_PW';"
```

Verify the new password authenticates over TCP (this is what cms/ingest use):

```bash
docker exec -e PGPASSWORD="$NEW_PW" sudacka-mreza-db-1 \
  psql "postgresql://postgres:$NEW_PW@127.0.0.1:5432/sudacka_mreza" -c "select 1;"
# expect: a row with "1"
```

## 3. Update `.env` (parse-modify-rewrite — never sed/hand-edit)

Run from your **local machine** (writes the helper, copies it, runs it):

```bash
cat > /tmp/set_pgpw.py << 'PY'
import pathlib, sys
pw = sys.argv[1]
p = pathlib.Path("/home/bbrelin/sudacka-mreza/.env")
lines = p.read_text(encoding="utf-8").splitlines()
out, seen = [], False
for ln in lines:
    if ln.startswith("POSTGRES_PASSWORD="):
        out.append(f"POSTGRES_PASSWORD={pw}"); seen = True
    else:
        out.append(ln)
if not seen:
    out.append(f"POSTGRES_PASSWORD={pw}")
p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("POSTGRES_PASSWORD updated in .env")
PY
scp /tmp/set_pgpw.py toronto-sudacka:/tmp/
ssh toronto-sudacka "cd ~/sudacka-mreza && python3 /tmp/set_pgpw.py '<PASTE_NEW_PW>'"
```

> `cms` builds `DATABASE_URI` from `${POSTGRES_PASSWORD}` in
> `docker-compose.yml`, so updating this one key covers both `cms` and
> `bankruptcy-ingest`. If any service overrides `DATABASE_URI` directly in
> `.env`, update that too.

## 4. Recreate the clients (NOT the db)

```bash
ssh toronto-sudacka 'cd ~/sudacka-mreza && \
  docker compose up -d --force-recreate --no-deps cms bankruptcy-ingest'
```

`--no-deps` ensures the `db` container is left running untouched. (Recreating
`db` would drop all connections and risk pgvector crash-recovery — do not.)

## 5. Verify

```bash
ssh toronto-sudacka 'cd ~/sudacka-mreza
  sleep 8
  docker compose ps
  docker compose logs --tail=30 cms | grep -iE "migrat|listen|error|password" || true
  curl -s -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:4092/
  curl -s -o /dev/null -w "ingest health %{http_code}\n" http://127.0.0.1:4095/health'
```

Then exercise an auth path end-to-end: log in to the admin/editor UI and load a
list that hits the DB (e.g. court decisions or bankruptcy listings). Confirm
no `password authentication failed` in `docker compose logs cms`.

## 6. Manual scripts / external tools

Anything that connects to the DB outside the containers must use the new
password via `DATABASE_URI` (the scraper scripts default to `postgres:postgres`
after the credential scrub and rely on the env var):

```bash
export DATABASE_URI="postgresql://postgres:<NEW_PW>@<db-host>:5432/sudacka_mreza"
```

On the host there is no published Postgres port, so run such scripts inside the
network or point `DATABASE_URI` at the container's network address. Also update
any **server-local untracked** scripts (`legacy-*.mjs`, `run-scraper.sh`,
`echr-scraper.mjs`, …) that still embed the old password, or switch them to read
`DATABASE_URI`.

---

## Rollback

If verification fails, revert both halves together:

```bash
ssh toronto-sudacka 'cd ~/sudacka-mreza
  OLD_PW="Sudacka2026!SecureDB"
  docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza \
    -c "ALTER USER postgres WITH PASSWORD '"'"'$OLD_PW'"'"';"
  cp -f .env.pre-rotation.* .env   # restore the most recent backup
  docker compose up -d --force-recreate --no-deps cms bankruptcy-ingest'
```

(If state is badly broken, restore the DB from the
`~/sudacka_mreza.pre-rotation.*.sql.gz` dump.)

## After success

- Delete the `.env.pre-rotation.*` backups once confident (they contain the old
  secret).
- Rotate is independent of `PAYLOAD_SECRET` and `PII_ENCRYPTION_KEY`; those are
  unchanged.
- The old password remains in git history on `feat/judge-dashboard-phase1` /
  `feat/chat-verification`; rotation is what actually neutralizes it. A history
  purge (BFG / `git filter-repo`) is optional cleanup, not a substitute.
```
