"""Map the court codes from the wayback sudski_tumaci.xml to court_id and
create interpreters_rels rows (assignedCourts).

Reuses the same code-resolution logic as map_vjestaci_to_courts.py.
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

def deaccent(s):
    return unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()

def norm_name(s):
    return re.sub(r'[^a-z0-9]+', ' ', deaccent(s)).strip()

def slugify(s):
    s = deaccent(s)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:64] or 'tumac'

def sql_quote(s):
    if s is None: return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

# Same court resolver as the vještaci mapper.
print('[1/5] load courts')
out = ssh_psql_select("SELECT id, type, name FROM courts ORDER BY id")
courts = []
for line in out.splitlines():
    if '|' not in line: continue
    parts = line.split('|', 2)
    if len(parts) < 3: continue
    cid, ctype, cname = parts
    courts.append((int(cid), ctype, cname))
print(f'   {len(courts)} courts')

def stem(s, n=3):
    return deaccent(s)[:n]

def find_court(court_type, place):
    target_stem = stem(place)
    if not target_stem: return None
    candidates = []
    for cid, ctype, cname in courts:
        if ctype != court_type: continue
        for word in deaccent(cname).split():
            if word.startswith(target_stem) or target_stem.startswith(word[:4]):
                candidates.append((cid, cname))
                break
    if not candidates: return None
    candidates.sort(key=lambda x: (' - ' in x[1], len(x[1]), x[0]))
    return candidates[0][0]

def find_singleton(court_type):
    for cid, ctype, cname in courts:
        if ctype == court_type: return cid
    return None

SUPREME = find_singleton('supreme')
HIGHCOM = find_singleton('high_commercial')

PLACE_ALIAS = {
    'PU': 'Pula',  'OS': 'Osijek',  'ZG': 'Zagreb', 'KA': 'Karlovac',
    'ST': 'Split', 'RI': 'Rijeka',  'VŽ': 'Varaždin', 'VZ': 'Varaždin',
    'SL': 'Slavonski Brod', 'SK': 'Sisak', 'BJ': 'Bjelovar', 'DU': 'Dubrovnik',
    'PŽ': 'Požega', 'PZ': 'Požega', 'GS': 'Gospić', 'ČK': 'Čakovec', 'CK': 'Čakovec',
    'NG': 'Novi Zagreb', 'KP': 'Koprivnica', 'ZD': 'Zadar',
    'VK': 'Vukovar', 'VU': 'Vukovar', 'ŠI': 'Šibenik', 'SI': 'Šibenik',
    'VT': 'Virovitica',
}

def resolve_one(part: str):
    part = part.strip()
    if not part: return None
    m_pref = re.match(r'^(\S{1,3})(\s+.*)?$', part)
    if m_pref:
        part = m_pref.group(1).upper() + (m_pref.group(2) or '')
    c_head = re.split(r'\s*-\s*', part, 1)[0].strip()
    upper = deaccent(c_head).upper()
    if upper in ('VS', 'VRH'): return SUPREME
    if upper in ('VTS',): return HIGHCOM
    m = re.match(r'^([A-ZŽ]{1,3})\s+(.+)$', c_head, re.UNICODE)
    if not m: return None
    type_pref = deaccent(m.group(1)).upper()
    place = m.group(2).strip()
    place_norm = PLACE_ALIAS.get(deaccent(place).upper(), place)
    type_map = {'OS':'municipal','TS':'commercial','PS':'misdemeanour','US':'administrative','ZS':'county'}
    type_canon = type_map.get(type_pref)
    if not type_canon: return None
    return find_court(type_canon, place_norm)

def resolve_code(code: str):
    if not code: return []
    parts = re.split(r'\s*[/,]\s*|(?:\s{2,})', code.strip())
    parts = [p.strip() for p in parts if p.strip()]
    out = []
    seen = set()
    for p in parts:
        cid = resolve_one(p)
        if cid and cid not in seen:
            seen.add(cid)
            out.append(cid)
    return out

# Parse the XML (HTML table really).
print('[2/5] parse XML')
html = open(XML).read()
rows_raw = re.findall(r'<tr>(.*?)</tr>', html, re.S)
pairs = []
for r in rows_raw:
    cells = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
    cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
    if len(cells) >= 2:
        pairs.append((cells[0], cells[1]))  # (name, court_code)
print(f'   {len(pairs)} (name, court_code) pairs')

# Resolve codes
print('[3/5] resolve codes')
distinct = sorted(set(c for _, c in pairs))
resolved_map = {c: resolve_code(c) for c in distinct}
res_count = sum(1 for v in resolved_map.values() if v)
total_ids = sum(len(v) for v in resolved_map.values())
print(f'   {res_count}/{len(distinct)} codes resolved → {total_ids} court_ids')
print('   unresolved:', [c for c, v in resolved_map.items() if not v][:8])

# Pull interpreters by slug + name (broader than just wb2019 because the
# loader matched many to existing rows, leaving them without that suffix).
print('[4/5] pull interpreter ids')
out = ssh_psql_select("SELECT id, slug, name FROM interpreters")
by_slug, by_name = {}, {}
for line in out.splitlines():
    if '|' not in line: continue
    parts = line.split('|', 2)
    if len(parts) < 3: continue
    iid, slug, name = int(parts[0]), parts[1], parts[2]
    by_slug[slug] = iid
    by_name[norm_name(name)] = iid
print(f'   {len(by_slug)} interpreters by slug; {len(by_name)} by normalized name')

# Build inserts
print('[5/5] build rels')
batches = []
linked = unlinked_court = unlinked_int = 0
seen_pair = set()
for name, code in pairs:
    cids = resolved_map.get(code) or []
    if not cids:
        unlinked_court += 1
        continue
    iid = by_slug.get(f'{slugify(name)}-wb2019') or by_name.get(norm_name(name))
    if iid is None:
        unlinked_int += 1
        continue
    for ord_i, cid in enumerate(cids, start=1):
        key = (iid, cid)
        if key in seen_pair: continue
        seen_pair.add(key)
        batches.append(
            f"INSERT INTO interpreters_rels (\"order\", parent_id, path, courts_id) "
            f"SELECT {ord_i}, {iid}, 'assignedCourts', {cid} "
            f"WHERE NOT EXISTS (SELECT 1 FROM interpreters_rels WHERE parent_id = {iid} AND path = 'assignedCourts' AND courts_id = {cid});"
        )
        linked += 1

print(f'   plan: {linked} new rels, {unlinked_court} unresolved courts, {unlinked_int} unmatched interpreters')

if '--dry-run' in sys.argv:
    print('dry-run; not writing')
    sys.exit(0)

CHUNK = 500
errs = 0
for i in range(0, len(batches), CHUNK):
    _, code = ssh_psql_exec('BEGIN;\n' + '\n'.join(batches[i:i+CHUNK]) + '\nCOMMIT;')
    if code != 0: errs += 1
print(f'   applied {len(batches)} inserts; errors={errs}')

out = ssh_psql_select("SELECT COUNT(*) FROM interpreters_rels WHERE path='assignedCourts';")
print(f"   total assignedCourts rels in DB: {out.strip()}")
out = ssh_psql_select("SELECT COUNT(DISTINCT parent_id) FROM interpreters_rels WHERE path='assignedCourts';")
print(f"   distinct interpreters with >=1 court: {out.strip()}")
