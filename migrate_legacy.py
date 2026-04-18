#!/usr/bin/env python3
"""
Sudačka Mreža — Legacy DB → Payload CMS migration
Maps:
  sudovi      → /api/courts          (skips existing records by name)
  suci        → SKIPPED              (no Judges collection in Payload CMS)
  odvjetnici  → /api/state-attorneys (maps Croatian state attorneys)

Source:  sudacka-mreza-db-1 (postgres-sudacka-1 container never existed;
         legacy tables live in the same DB as Payload)
Target:  Payload REST API at http://localhost:4093/api
Auth:    JWT in /tmp/jwt_token.txt (obtained via admin@sudacka-mreza.hr)
DB conn: via docker exec (port 5432 not exposed to host)
"""

import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────

API_BASE = "http://localhost:4093/api"
TOKEN_FILE = "/tmp/jwt_token.txt"
CONTAINER = "sudacka-mreza-db-1"
PSQL_USER = "postgres"
PSQL_DB = "sudacka_mreza"
BATCH_LOG = 50

# Court type mapping: vrstaid (1-10 = Croatian) → Payload enum
COURT_TYPE_MAP = {
    1: "municipal",       # Općinski sud
    2: "commercial",      # Trgovački sud
    3: "misdemeanour",    # Prekršajni sud
    4: "administrative",  # Upravni sud
    5: "county",          # Županijski sud
    6: "high_commercial", # Visoki trgovački sud
    7: "misdemeanour",    # Visoki prekršajni sud (closest match)
    8: "supreme",         # Vrhovni sud
    9: "constitutional",  # Ustavni sud
    10: None,             # EU courts — skip
}


# ── DB helpers ────────────────────────────────────────────────────────────────

def db_query(sql: str) -> list[dict]:
    """Run a SQL query via docker exec psql, return list of row dicts."""
    cmd = [
        "docker", "exec", CONTAINER,
        "psql", "-U", PSQL_USER, "-d", PSQL_DB,
        "-A",  # unaligned output
        "-F", "\t",  # tab separator
        "--no-psqlrc",
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr[:300]}")

    lines = result.stdout.strip().splitlines()
    if len(lines) < 2:
        return []  # header only or empty

    headers = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        if line.startswith("(") and line.endswith(")"):
            continue  # row count footer
        values = line.split("\t")
        row = {}
        for h, v in zip(headers, values):
            row[h] = None if v == "" else v
        rows.append(row)
    return rows


# ── API helpers ───────────────────────────────────────────────────────────────

def load_token() -> str:
    with open(TOKEN_FILE) as f:
        return f.read().strip()


def api_post(path: str, payload: dict, token: str) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"JWT {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:300]}")


def api_get_all(path: str, token: str) -> list[dict]:
    """Fetch all pages of a collection, return all docs."""
    docs = []
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        req = urllib.request.Request(f"{API_BASE}{path}{sep}limit=100&page={page}&depth=0")
        req.add_header("Authorization", f"JWT {token}")
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.load(r)
        docs.extend(resp.get("docs", []))
        if not resp.get("hasNextPage"):
            break
        page += 1
    return docs


# ── City extraction ────────────────────────────────────────────────────────────

def extract_city(address: str | None) -> str:
    if not address:
        return "Nepoznato"
    m = re.search(r"\d{5}\s+(.+?)(?:,|$)", address)
    if m:
        return m.group(1).strip()
    parts = [p.strip() for p in address.split(",") if p.strip()]
    return parts[-1] if parts else address[:50]


# ── Courts migration ──────────────────────────────────────────────────────────

def migrate_courts(token: str) -> dict:
    print("\n── Courts (sudovi → /api/courts) ──")

    existing = api_get_all("/courts", token)
    existing_names = {d["name"] for d in existing}
    print(f"  Existing in Payload: {len(existing_names)}")

    rows = db_query("""
        SELECT s.id, s.naziv0, s.adresa0, s.email, s.www, s.tel, s.fax, s.vrstaid
        FROM sudovi s
        WHERE s.vrstaid BETWEEN 1 AND 10
          AND s.aktivan = true
          AND s.naziv0 IS NOT NULL AND s.naziv0 <> ''
        ORDER BY s.id
    """)
    print(f"  Source rows (active Croatian): {len(rows)}")

    created = skipped = errors = 0
    for i, row in enumerate(rows, 1):
        name = row.get("naziv0") or ""
        if not name or name in existing_names:
            skipped += 1
            continue

        vrstaid = int(row.get("vrstaid") or 0)
        court_type = COURT_TYPE_MAP.get(vrstaid)
        if court_type is None:
            skipped += 1
            continue

        city = extract_city(row.get("adresa0"))
        payload_doc = {
            "name": name,
            "type": court_type,
            "city": city,
        }
        if row.get("adresa0"):
            payload_doc["address"] = row["adresa0"]
        if row.get("email"):
            payload_doc["email"] = row["email"]
        if row.get("www"):
            payload_doc["website"] = row["www"]
        if row.get("tel"):
            payload_doc["phone"] = row["tel"]
        if row.get("fax"):
            payload_doc["fax"] = row["fax"]

        try:
            api_post("/courts", payload_doc, token)
            created += 1
            existing_names.add(name)
        except RuntimeError as e:
            errors += 1
            if errors <= 5:
                print(f"  ERROR [{row['id']}] {name}: {e}")

        if i % BATCH_LOG == 0:
            print(f"  ... {i}/{len(rows)} (created={created} skip={skipped} err={errors})")

    print(f"  ✓ Courts: created={created} skipped={skipped} errors={errors}")
    return {"created": created, "skipped": skipped, "errors": errors}


# ── State Attorneys migration ─────────────────────────────────────────────────

def migrate_state_attorneys(token: str) -> dict:
    """
    Maps odvjetnici → state-attorneys.
    odvjetnici contains public prosecutors / state attorneys (državni odvjetnici).
    The table has no address/city — city defaults to 'Hrvatska'.
    """
    print("\n── State Attorneys (odvjetnici → /api/state-attorneys) ──")

    existing = api_get_all("/state-attorneys", token)
    existing_names = {d["name"] for d in existing}
    print(f"  Existing in Payload: {len(existing_names)}")

    rows = db_query("""
        SELECT o.id, o.ime0, o.prezime0, o.email, o.www, o.cv0
        FROM odvjetnici o
        WHERE o.aktivan = true
          AND o.ime0 IS NOT NULL AND o.ime0 <> ''
          AND o.prezime0 IS NOT NULL AND o.prezime0 <> ''
        ORDER BY o.id
    """)
    print(f"  Source rows (active): {len(rows)}")

    created = skipped = errors = 0
    for i, row in enumerate(rows, 1):
        full_name = f"{row.get('ime0', '')} {row.get('prezime0', '')}".strip()
        if not full_name or full_name in existing_names:
            skipped += 1
            continue

        payload_doc = {
            "name": full_name,
            "city": "Hrvatska",
        }
        if row.get("email"):
            payload_doc["email"] = row["email"]

        try:
            api_post("/state-attorneys", payload_doc, token)
            created += 1
            existing_names.add(full_name)
        except RuntimeError as e:
            errors += 1
            if errors <= 5:
                print(f"  ERROR [{row['id']}] {full_name}: {e}")

        if i % BATCH_LOG == 0:
            print(f"  ... {i}/{len(rows)} (created={created} skip={skipped} err={errors})")

    print(f"  ✓ State Attorneys: created={created} skipped={skipped} errors={errors}")
    return {"created": created, "skipped": skipped, "errors": errors}


# ── Judges / suci ─────────────────────────────────────────────────────────────

def report_suci_skipped():
    count_rows = db_query("SELECT COUNT(*) AS cnt FROM suci WHERE aktivan = true")
    cnt = count_rows[0].get("cnt", "?") if count_rows else "?"
    print(f"\n── Judges (suci) — SKIPPED ──")
    print(f"  Active judges in legacy DB: {cnt}")
    print(f"  No 'judges' collection exists in Payload CMS.")
    print(f"  Available person collections: state-attorneys, expert-witnesses, interpreters.")
    print(f"  Action required: add a Judges collection to the CMS if this data is needed.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Sudačka Mreža — Legacy DB → Payload CMS Migration")
    print("=" * 60)
    print()
    print("Note: 'postgres-sudacka-1' container never existed.")
    print("All legacy data is in sudacka-mreza-db-1 alongside Payload tables.")
    print()

    token = load_token()
    print(f"Auth: JWT loaded OK")

    # Quick auth check
    req = urllib.request.Request(f"{API_BASE}/courts?limit=1")
    req.add_header("Authorization", f"JWT {token}")
    with urllib.request.urlopen(req, timeout=10) as r:
        check = json.load(r)
    print(f"API: reachable — current courts count = {check.get('totalDocs', '?')}")

    t0 = time.time()

    courts_stats = migrate_courts(token)
    attorneys_stats = migrate_state_attorneys(token)
    report_suci_skipped()

    elapsed = time.time() - t0

    print()
    print("=" * 60)
    print(f"Migration complete in {elapsed:.1f}s")
    print(f"  courts:          created={courts_stats['created']} "
          f"skipped={courts_stats['skipped']} errors={courts_stats['errors']}")
    print(f"  state-attorneys: created={attorneys_stats['created']} "
          f"skipped={attorneys_stats['skipped']} errors={attorneys_stats['errors']}")
    print(f"  judges:          SKIPPED (no collection in Payload CMS)")
    print("=" * 60)


if __name__ == "__main__":
    main()
