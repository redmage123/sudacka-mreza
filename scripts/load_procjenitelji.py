"""Load Stalni sudski procjenitelji XLSX into Toronto's expert_witnesses table.

Schema: each row becomes an expert_witnesses row with expert_type='procjenitelj'.
Skip if a row with the same name already exists.

Run from openclaw box, talks to Toronto via SSH + docker exec psql.
"""
import openpyxl, re, subprocess, sys, unicodedata

XLSX = '/tmp/procjenitelji.xlsx'

def sh_psql(sql, capture=True):
    cmd = ['ssh', 'toronto-sudacka',
           f"docker exec sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -At -F'|' -c \"{sql}\""]
    r = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return r.stdout

def psql_exec(sql_lines):
    """Run multi-statement SQL via stdin to handle quoting better."""
    cmd = ['ssh', 'toronto-sudacka', 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -At']
    r = subprocess.run(cmd, input=sql_lines, capture_output=True, text=True, check=False)
    if r.returncode != 0:
        print('STDERR:', r.stderr[:500], file=sys.stderr)
    return r.stdout, r.returncode

def normalize_name(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def split_contact(c):
    if not c: return None, None
    s = c.replace('_x000D_', ' ').replace('\r', ' ').replace('\n', ' ')
    email = None
    em = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', s)
    if em: email = em.group(0).lower()
    phone = None
    ph = re.search(r'(?:\+?385[\s-]*|0)\s*\d[\d\s\-/().]{6,}\d', s)
    if ph: phone = re.sub(r'\s+', ' ', ph.group(0)).strip()
    return email, phone

def split_areas(s):
    if not s: return []
    s = s.replace('_x000D_', ' ').replace('\r', ' ').replace('\n', ' ').replace('|', ' ')
    parts = [p.strip(' -•·') for p in re.split(r'\s*[-•·]\s+|\s{2,}', s) if p.strip(' -•·')]
    return [p for p in parts if len(p) > 2]

def sql_quote(s):
    if s is None: return 'NULL'
    return "'" + s.replace("'", "''") + "'"

# Pull existing experts to dedupe against (by normalized name)
print('[1/3] load existing experts for dedupe')
out = sh_psql("SELECT id, name FROM expert_witnesses ORDER BY id")
existing = {}
for line in out.splitlines():
    if '|' not in line: continue
    eid, name = line.split('|', 1)
    existing[normalize_name(name)] = int(eid)
print(f'   {len(existing)} existing experts')

# Pull XLSX
print('[2/3] parse XLSX')
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb[wb.sheetnames[0]]
rows = list(ws.iter_rows(min_row=2, values_only=True))
print(f'   {len(rows)} rows from XLSX')

planned = []
for r in rows:
    name = (r[0] or '').strip()
    if not name: continue
    nk = normalize_name(name)
    addr_full = (r[3] or '').strip()
    email, phone = split_contact(r[4])
    areas = split_areas(r[5])
    typ = (r[1] or '').strip()  # 'Fizička osoba' / 'Pravna osoba'
    company = name if 'Pravna' in typ else None
    # Crack address into city if comma-separated
    city = None
    m_city = re.search(r',\s*\d{4,5}\s+([^,]+?)\s*(?:,|$)', addr_full)
    if m_city: city = m_city.group(1).strip()
    planned.append({
        'name': name, 'nk': nk, 'typ': typ, 'company': company,
        'address': addr_full or None, 'city': city,
        'email': email, 'phone': phone, 'areas': areas,
    })

new_inserts = [p for p in planned if p['nk'] not in existing]
existing_updates = [p for p in planned if p['nk'] in existing]
print(f'   {len(new_inserts)} new + {len(existing_updates)} already exist')

# Build SQL: mark existing experts as procjenitelj; insert new ones with expert_type='procjenitelj'.
print('[3/3] apply')

batches = []
# 1. update existing experts' expert_type
for p in existing_updates:
    eid = existing[p['nk']]
    batches.append(f"UPDATE expert_witnesses SET expert_type = 'procjenitelj' WHERE id = {eid} AND (expert_type IS NULL OR expert_type = '');")
# 2. insert new experts
for p in new_inserts:
    name_q = sql_quote(p['name'])
    company_q = sql_quote(p['company'])
    address_q = sql_quote(p['address'])
    city_q = sql_quote(p['city'])
    email_q = sql_quote(p['email'])
    phone_q = sql_quote(p['phone'])
    # slug
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', p['name']).encode('ascii','ignore').decode().lower()).strip('-')[:64] or 'procjenitelj'
    slug = f"{slug}-mojprocj"
    slug_q = sql_quote(slug)
    batches.append(
        f"INSERT INTO expert_witnesses (name, expert_type, company, address, city, email, phone, lang, slug, verified, created_at, updated_at) "
        f"VALUES ({name_q}, 'procjenitelj', {company_q}, {address_q}, {city_q}, {email_q}, {phone_q}, 'hr', {slug_q}, false, NOW(), NOW()) "
        f"ON CONFLICT (slug) DO NOTHING;"
    )

if not batches:
    print('nothing to do')
    sys.exit(0)

print(f'   {len(batches)} statements')
out, code = psql_exec('\n'.join(batches))
print(f'   psql exit={code}; lines={out.count(chr(10))}')

# Quick check
out2 = sh_psql("SELECT expert_type, COUNT(*) FROM expert_witnesses GROUP BY expert_type ORDER BY 2 DESC;")
print('---post---')
print(out2)
