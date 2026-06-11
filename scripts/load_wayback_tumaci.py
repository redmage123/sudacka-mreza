"""Load the MOJ sudski_tumaci.xml (recovered from Wayback Machine, 2019-09-22)
into Toronto's interpreters table.

The archive returns an HTML table: name | court | city | address | languages
(2559 rows). Dedupe against existing interpreters by normalized name.
"""
import re, subprocess, sys, unicodedata

XML = '/tmp/sudski_tumaci.xml'

def ssh_psql_select(sql):
    cmd = ['ssh', 'toronto-sudacka',
           f"docker exec sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -At -F'|' -c \"{sql}\""]
    return subprocess.check_output(cmd, text=True)

def ssh_psql_exec(sql):
    cmd = ['ssh', 'toronto-sudacka', 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -At']
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print('STDERR:', r.stderr[:500], file=sys.stderr)
    return r.stdout, r.returncode

def norm_name(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def slugify(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:64] or 'tumac'

def sql_quote(s):
    if s is None: return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

# Parse
print('[1/3] parse XML/HTML')
html = open(XML).read()
rows_raw = re.findall(r'<tr>(.*?)</tr>', html, re.S)
parsed = []
for r in rows_raw:
    cells = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
    cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
    if len(cells) >= 5:
        parsed.append(cells)
print(f'   {len(parsed)} rows parsed')

# Existing
print('[2/3] load existing interpreters')
out = ssh_psql_select("SELECT id, name FROM interpreters ORDER BY id")
existing = {}
for line in out.splitlines():
    if '|' not in line: continue
    eid, name = line.split('|', 1)
    existing[norm_name(name)] = int(eid)
print(f'   {len(existing)} existing interpreters')

# Plan
new_inserts, existing_updates = [], []
for cells in parsed:
    name, court_code, city, address, langs = cells[0], cells[1], cells[2], cells[3], cells[4]
    nk = norm_name(name)
    if not nk: continue
    rec = {
        'name': name, 'nk': nk,
        'court_code': court_code, 'city': city, 'address': address,
        'langs': langs,
    }
    if nk in existing:
        existing_updates.append((existing[nk], rec))
    else:
        new_inserts.append(rec)

print(f'   {len(existing_updates)} match existing, {len(new_inserts)} new')

# Apply
print('[3/3] apply')
batches = []
# Backfill city + address on existing if NULL (non-destructive enrichment)
for eid, rec in existing_updates:
    set_clauses = []
    if rec['city']: set_clauses.append(f"city = COALESCE(city, {sql_quote(rec['city'])})")
    if rec['address']: set_clauses.append(f"address = COALESCE(address, {sql_quote(rec['address'])})")
    if set_clauses:
        batches.append(f"UPDATE interpreters SET {', '.join(set_clauses)} WHERE id = {eid};")

# Insert new
for rec in new_inserts:
    name_q = sql_quote(rec['name'])
    addr_q = sql_quote(rec['address'] or None)
    city_q = sql_quote(rec['city'] or None)
    slug = f"{slugify(rec['name'])}-wb2019"
    slug_q = sql_quote(slug)
    batches.append(
        f"INSERT INTO interpreters (name, address, city, lang, slug, verified, created_at, updated_at) "
        f"VALUES ({name_q}, {addr_q}, {city_q}, 'hr', {slug_q}, false, NOW(), NOW()) "
        f"ON CONFLICT (slug) DO NOTHING;"
    )

print(f'   {len(batches)} statements; applying…')
CHUNK = 500
errs = 0
for i in range(0, len(batches), CHUNK):
    out, code = ssh_psql_exec('BEGIN;\n' + '\n'.join(batches[i:i+CHUNK]) + '\nCOMMIT;')
    if code != 0: errs += 1
print(f'   chunks done; errors={errs}')

# Status
out2 = ssh_psql_select("SELECT COUNT(*) FROM interpreters;")
print(f'---post: total interpreters = {out2.strip()}')
