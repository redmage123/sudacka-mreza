"""Map the court codes from the wayback vještaci XLSX to court_id and create
expert_witnesses_rels rows (assignedCourts).

Court code shape: '<type-abbr> <city-or-name>', e.g.
  OS Karlovac     → Općinski sud u Karlovcu
  TS Karlovac     → Trgovački sud u Karlovcu
  ŽS Pula - Pola  → Županijski sud u Puli
  VS              → Vrhovni sud Republike Hrvatske
  USRH            → Ustavni sud Republike Hrvatske
  VTS             → Visoki trgovački sud Republike Hrvatske
  VPSRH           → Visoki prekršajni sud RH
  VUSRH           → Visoki upravni sud RH
"""
import openpyxl, re, subprocess, sys, unicodedata

XLSX = '/tmp/vjestaci_2017.xlsx'

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
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()

def norm_name(s):
    return re.sub(r'[^a-z0-9]+', ' ', deaccent(s)).strip()

def sql_quote(s):
    return "'" + str(s).replace("'", "''") + "'"

# Build court code mapping.
# 1) Pull all courts from DB.
print('[1/4] load courts')
out = ssh_psql_select("SELECT id, type, name FROM courts ORDER BY id")
courts = []
for line in out.splitlines():
    if '|' not in line: continue
    parts = line.split('|', 2)
    if len(parts) < 3: continue
    cid, ctype, cname = parts
    courts.append((int(cid), ctype, cname))
print(f'   {len(courts)} courts in DB')

# 2) Helpers to find a court by type + city substring.
def stem(s, n=3):
    """First n alpha chars (deaccented) — handles Croatian noun declension
    where the same city stem appears in different cases (Karlovac/Karlovcu,
    Pula/Puli, Rijeka/Rijeci)."""
    return deaccent(s)[:n]

def find_court(court_type, place):
    """court_type: 'municipal'/'commercial'/'county'/etc.
       place: city name as substring of court name (declension-aware)."""
    target_stem = stem(place)
    if not target_stem: return None
    candidates = []
    for cid, ctype, cname in courts:
        if ctype != court_type: continue
        # Court name typically reads "Trgovački sud u Karlovcu" — check each
        # word's stem against the target stem.
        for word in deaccent(cname).split():
            if word.startswith(target_stem) or target_stem.startswith(word[:4]):
                candidates.append((cid, cname))
                break
    if not candidates: return None
    # Prefer the shorter (more canonical) name, skipping ZK-odjel sublocations.
    candidates.sort(key=lambda x: (' - ' in x[1], len(x[1]), x[0]))
    return candidates[0][0]

def find_singleton(court_type):
    for cid, ctype, cname in courts:
        if ctype == court_type: return cid
    return None

# 3) Code-to-court resolver.
SUPREME = find_singleton('supreme')
HIGHCOM = find_singleton('high_commercial')

# Some court codes use city abbreviations that diverge from the full name.
PLACE_ALIAS = {
    'PU': 'Pula',
    'OS': 'Osijek',  # also used as a "type" prefix; never appears as place alone here
    'ZG': 'Zagreb',
    'KA': 'Karlovac',
    'ST': 'Split',
    'RI': 'Rijeka',
    'VŽ': 'Varaždin', 'VZ': 'Varaždin',
    'SL': 'Slavonski Brod',
    'SK': 'Sisak',
    'BJ': 'Bjelovar',
    'DU': 'Dubrovnik',
    'PŽ': 'Požega', 'PZ': 'Požega',
    'GS': 'Gospić',
    'ČK': 'Čakovec', 'CK': 'Čakovec',
    'NG': 'Novi Zagreb',
    'KP': 'Koprivnica',
    'ZD': 'Zadar',
    'VK': 'Vukovar',
    'VU': 'Vukovar',
    'ŠI': 'Šibenik', 'SI': 'Šibenik',
    'VT': 'Virovitica',
}

def resolve_one(part: str):
    """Resolve a single court code segment like 'TS Karlovac' or 'ŽS Pula'."""
    # Canonicalize case: codes are sometimes 'Žs Zagreb' or 'žs Varaždin' in
    # the XLSX.
    part = part.strip()
    if not part: return None
    # Uppercase only the type-prefix (first word, up to 3 letters).
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
    type_map = {
        'OS': 'municipal',
        'TS': 'commercial',
        'PS': 'misdemeanour',
        'US': 'administrative',
        'ZS': 'county',
    }
    type_canon = type_map.get(type_pref)
    if not type_canon: return None
    return find_court(type_canon, place_norm)

def resolve_code(code: str):
    """Return a list of court_ids for a (possibly multi-court) code string."""
    if not code: return []
    # A single cell may list several courts separated by '/', ',', or whitespace
    # runs ≥ 2 chars. Split conservatively.
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

# 4) Parse XLSX and build (slug, court_code) pairs.
print('[2/4] parse XLSX')
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb[wb.sheetnames[0]]
import re as _re
def slugify(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return _re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:64] or 'vjestak'

rows = []
for r in ws.iter_rows(min_row=2, values_only=True):
    first = (r[0] or '').strip() if r[0] else ''
    last = (r[1] or '').strip() if r[1] else ''
    code = (r[2] or '').strip() if r[2] else ''
    if not first and not last: continue
    if not code: continue
    name = f'{first} {last}'.strip()
    rows.append((name, code))
print(f'   {len(rows)} (name, code) pairs')

# 5) Resolve codes to court_ids (list).
print('[3/4] resolve codes')
distinct = sorted(set(c for _, c in rows))
print(f'   {len(distinct)} distinct codes')
resolved_map = {c: resolve_code(c) for c in distinct}
resolved_count = sum(1 for v in resolved_map.values() if v)
total_ids = sum(len(v) for v in resolved_map.values())
print(f'   resolved {resolved_count}/{len(distinct)} codes → {total_ids} court_ids')
print('   unresolved sample:', [c for c, v in resolved_map.items() if not v][:10])

# 6) Pull expert ids by slug (the loader saved them as `<slug>-wb2017`)
print('[4/4] pull expert ids by slug')
out = ssh_psql_select("SELECT id, slug, name FROM expert_witnesses WHERE slug LIKE '%-wb2017' OR expert_type = 'vjestak'")
expert_by_slug = {}
expert_by_name = {}
for line in out.splitlines():
    if '|' not in line: continue
    parts = line.split('|', 2)
    if len(parts) < 3: continue
    eid, slug, name = int(parts[0]), parts[1], parts[2]
    expert_by_slug[slug] = eid
    expert_by_name[norm_name(name)] = eid
print(f'   {len(expert_by_slug)} by slug; {len(expert_by_name)} distinct names')

# 7) Build INSERTs into expert_witnesses_rels.
batches = []
linked = 0
unlinked_expert = 0
unlinked_court = 0
seen_pair = set()
for name, code in rows:
    cids = resolved_map.get(code) or []
    if not cids:
        unlinked_court += 1
        continue
    slug = f"{slugify(name)}-wb2017"
    eid = expert_by_slug.get(slug) or expert_by_name.get(norm_name(name))
    if eid is None:
        unlinked_expert += 1
        continue
    for ord_i, cid in enumerate(cids, start=1):
        key = (eid, cid)
        if key in seen_pair: continue
        seen_pair.add(key)
        batches.append(
            f"INSERT INTO expert_witnesses_rels (\"order\", parent_id, path, courts_id) "
            f"SELECT {ord_i}, {eid}, 'assignedCourts', {cid} "
            f"WHERE NOT EXISTS (SELECT 1 FROM expert_witnesses_rels WHERE parent_id = {eid} AND path = 'assignedCourts' AND courts_id = {cid});"
        )
        linked += 1

print(f'\n   plan: {linked} new assignedCourts rels, {unlinked_court} rows with unresolved court, {unlinked_expert} unmatched expert names')

if '--dry-run' in sys.argv:
    print('dry-run; not writing')
    sys.exit(0)

CHUNK = 500
errs = 0
for i in range(0, len(batches), CHUNK):
    out, code = ssh_psql_exec('BEGIN;\n' + '\n'.join(batches[i:i+CHUNK]) + '\nCOMMIT;')
    if code != 0: errs += 1
print(f'   applied {len(batches)} inserts; errors={errs}')

# Final tally
out = ssh_psql_select("SELECT COUNT(*) FROM expert_witnesses_rels WHERE path = 'assignedCourts';")
print(f"   total assignedCourts rels in DB: {out.strip()}")
out = ssh_psql_select("SELECT COUNT(DISTINCT parent_id) FROM expert_witnesses_rels WHERE path = 'assignedCourts';")
print(f"   distinct experts with at least 1 court: {out.strip()}")
