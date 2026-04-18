"""
Database helpers for scrape-case-law.py.
All DB access is via `docker exec psql` against the sudacka_mreza container.
"""

import re
import subprocess

from scraper_utils import (
    infer_decision_type, log, parse_date, slugify,
    get_listing_url, make_request, extract_decision_ids,
)


def escape_sql_str(s):
    """Escape a string for use in a PostgreSQL SQL statement."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def db_query(sql, verbose=False):
    """Run a SQL query against the sudacka_mreza DB via docker exec."""
    result = subprocess.run(
        ["docker", "exec", "sudacka-mreza-db-1", "psql", "-U", "postgres",
         "-d", "sudacka_mreza", "-t", "-c", sql],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        err = result.stderr.strip()
        log(f"  DB error: {err[:300]}", force=True)
        return None
    return result.stdout.strip()


def db_query_rows(sql):
    """Run SQL and return list of stripped rows."""
    result = subprocess.run(
        ["docker", "exec", "sudacka-mreza-db-1", "psql", "-U", "postgres",
         "-d", "sudacka_mreza", "-t", "--no-align", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        return []
    return [line.strip().split("|") for line in result.stdout.splitlines() if line.strip()]


def get_courts_map():
    """Build a court name → id lookup from the DB."""
    rows = db_query_rows("SELECT id, name FROM courts;")
    return {row[1].strip().lower(): int(row[0].strip()) for row in rows if len(row) >= 2 and row[0].strip()}


def resolve_court(court_name, courts_map):
    """Resolve court name to DB id via exact, normalised, and fuzzy matching."""
    court_name = court_name.strip()
    if not court_name:
        return None
    cn_lower = court_name.lower()

    cid = courts_map.get(cn_lower)
    if cid:
        return cid

    cn_norm = re.sub(r'\brepublike\s+hrvatske\b', 'rh', cn_lower, flags=re.I)
    cid = courts_map.get(cn_norm)
    if cid:
        return cid

    for name, cid in courts_map.items():
        name_norm = re.sub(r'\brh\b', 'republike hrvatske', name, flags=re.I)
        if cn_lower == name_norm or cn_norm == name.lower():
            return cid

    for name, cid in courts_map.items():
        if cn_lower in name:
            return cid

    for name, cid in courts_map.items():
        if name in cn_lower:
            return cid

    STOP = {'suda', 'sudov', 'sudova', 'sudski', 'hrvat'}
    scraped_words = {w for w in cn_lower.split() if len(w) >= 5 and w not in STOP}
    if scraped_words:
        for name, cid in courts_map.items():
            if all(w in name for w in scraped_words):
                return cid

    KNOWN_OVERRIDES = {
        "visoki upravni sud republike hrvatske": "upravni sud rh",
        "visoki kazneni sud republike hrvatske": "visoki kazneni sud rh",
        "visoki kazneni sud rh": "visoki kazneni sud rh",
    }
    override_key = KNOWN_OVERRIDES.get(cn_lower) or KNOWN_OVERRIDES.get(cn_norm)
    if override_key:
        cid = courts_map.get(override_key)
        if cid:
            return cid

    GENERIC = {'visoki', 'visoko', 'opcinski', 'općinski', 'županijski', 'zupanijski',
               'republike', 'hrvatska', 'hrvatske', 'grad', 'suda', 'sudov'}
    specific = {w for w in cn_lower.split() if len(w) >= 5 and w not in GENERIC and w not in STOP}
    if specific:
        best_overlap, best_cid = 0, None
        for name, cid in courts_map.items():
            overlap = sum(1 for w in specific if w in name)
            if overlap >= 1 and overlap == len(specific) and overlap > best_overlap:
                best_overlap, best_cid = overlap, cid
        if best_cid:
            return best_cid

    return None


def get_existing_slug_prefixes():
    """Return set of 8-char UUID prefixes from existing slugs."""
    rows = db_query_rows("SELECT slug FROM court_decisions;")
    prefixes = set()
    for row in rows:
        if row:
            m = re.search(r'--([a-f0-9]{8})$', row[0].strip())
            if m:
                prefixes.add(m.group(1))
    return prefixes


def get_records_needing_patch(min_text_len=0, limit=0):
    """Return list of (id, slug, text_len) for records that need patching."""
    if min_text_len > 0:
        where = f"full_text_plain IS NULL OR LENGTH(full_text_plain) < {min_text_len}"
    else:
        where = "full_text_plain IS NULL OR LENGTH(full_text_plain) = 0"
    limit_clause = f"LIMIT {limit}" if limit > 0 else ""
    sql = f"SELECT id, slug, COALESCE(LENGTH(full_text_plain), 0) FROM court_decisions WHERE {where} ORDER BY id {limit_clause};"
    rows = db_query_rows(sql)
    return [(int(r[0]), r[1].strip(), int(r[2])) for r in rows if len(r) >= 3]


def db_insert_decision(d, courts_map, verbose=False):
    """INSERT a new decision into the DB. Returns (ok, inserted_id_or_None)."""
    court_id = resolve_court(d["court_name"], courts_map)
    if not court_id:
        log(f"  ~ Skip (court not found): '{d['court_name']}'", force=True)
        return True, None

    decision_date = parse_date(d["decision_date_raw"]) or "2024-01-01T00:00:00.000Z"
    decision_type = infer_decision_type(d["registry_type"], d["court_name"])
    case_number = d["case_number"].strip() or f"ID-{d['source_id'][:8]}"
    title = f"{case_number} — {d['court_name']}" if d["court_name"] else case_number
    full_text_plain = (d["full_text_plain"] or "").replace("'", "''")
    summary = full_text_plain[:300]
    category = (d["category"][:200] if d["category"] else "").replace("'", "''")

    date_part = d["decision_date_raw"].replace(".", "-") if d["decision_date_raw"] else "x"
    slug = f"{slugify(title)}-{date_part}"[:148]
    slug = f"{slug}-{d['source_id'][:8]}"

    sql = f"""
INSERT INTO court_decisions
  (title, court_id, decision_type, date, case_number,
   full_text_plain, summary, category, lang, slug, updated_at, created_at)
VALUES (
  {escape_sql_str(title[:500])},
  {court_id},
  {escape_sql_str(decision_type)}::enum_court_decisions_decision_type,
  {escape_sql_str(decision_date)}::timestamptz,
  {escape_sql_str(case_number[:200])},
  {escape_sql_str(full_text_plain)},
  {escape_sql_str(summary)},
  {escape_sql_str(category)},
  'hr'::enum_court_decisions_lang,
  {escape_sql_str(slug[:150])},
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;
""".strip()

    out = db_query(sql)
    if out is None:
        return False, None
    inserted_id = out.strip()
    if inserted_id:
        log(f"  + Inserted: {title[:60]} (id={inserted_id})", verbose)
        return True, inserted_id
    log(f"  ~ Skip (slug conflict): {title[:60]}", verbose)
    return True, None


def db_update_full_text(record_id, full_text_plain, summary, verbose=False):
    """UPDATE full_text_plain and summary for an existing record."""
    ftp = (full_text_plain or "").replace("'", "''")
    sql = f"""
UPDATE court_decisions
SET full_text_plain = {escape_sql_str(ftp)},
    summary = {escape_sql_str(ftp[:300])},
    updated_at = NOW()
WHERE id = {record_id};
""".strip()
    out = db_query(sql)
    if out is None:
        return False
    log(f"  ✓ Patched id={record_id}: {len(full_text_plain)} chars", verbose)
    return True


def find_uuid_for_prefix(prefix, delay=1.0, max_pages=1100):
    """Search listing pages to find the full UUID for a given 8-char prefix."""
    for page in range(1, max_pages + 1):
        url = get_listing_url(page)
        try:
            html = make_request(url, delay=delay)
        except Exception:
            return None
        ids = extract_decision_ids(html)
        if not ids:
            return None
        for uid in ids:
            if uid.startswith(prefix):
                return uid
    return None


def uuid_from_slug(slug):
    """Extract the 8-char UUID prefix from the end of a slug."""
    m = re.search(r'--([a-f0-9]{8})$', slug)
    return m.group(1) if m else None
