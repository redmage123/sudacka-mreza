#!/usr/bin/env python3
"""Fast patcher v2 — paginated DB reads, direct UUID extraction."""
import os, sys, time, re, subprocess, urllib.request

DB_CMD = ["docker", "exec", "sudacka-mreza-db-1", "psql", "-U", "postgres", "-d", "sudacka_mreza", "-t", "-A", "-c"]
BASE_URL = "https://odluke.sudovi.hr/Document/Display/"
DELAY = 1.0

def run_sql(sql):
    result = subprocess.run(DB_CMD + [sql], capture_output=True, text=True, timeout=30)
    return result.stdout.strip()

def fetch_text(uuid):
    url = BASE_URL + uuid
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; SudackaMreza/1.0)',
        'Accept': 'text/html',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        # Extract text from body, strip nav/script/style
        body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
        if not body:
            return None
        raw = body.group(1)
        raw = re.sub(r'<(script|style|nav|header|footer)[^>]*>.*?</\1>', '', raw, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', raw)
        text = re.sub(r'\s+', ' ', text).strip()
        return text if len(text) > 200 else None
    except Exception as e:
        return None

patched = 0
errors = 0
offset = 0
batch = 100

print(f"Starting full-text patch for court decisions")
print(f"Fetching from: {BASE_URL}")
sys.stdout.flush()

while True:
    rows = run_sql(f"SELECT id, slug FROM court_decisions WHERE full_text IS NULL ORDER BY id LIMIT {batch} OFFSET {offset};")
    if not rows:
        break
    
    lines = [l for l in rows.split('\n') if '|' in l]
    if not lines:
        break
    
    for line in lines:
        parts = line.split('|', 1)
        rec_id = parts[0].strip()
        slug = parts[1].strip()
        
        uuid_match = re.search(r'--([0-9a-f]{8,})$', slug)
        if not uuid_match:
            errors += 1
            continue
        
        uuid = uuid_match.group(1)
        text = fetch_text(uuid)
        
        if text and len(text) > 200:
            escaped = text.replace("'", "''")
            try:
                run_sql(f"UPDATE court_decisions SET full_text = '{escaped}' WHERE id = {rec_id};")
                patched += 1
            except Exception:
                errors += 1
        else:
            errors += 1
        
        if (patched + errors) % 20 == 0:
            print(f"  Progress: {patched} patched, {errors} skipped, offset={offset}")
            sys.stdout.flush()
        
        time.sleep(DELAY)
    
    # Don't increment offset — we're filtering WHERE full_text IS NULL
    # so processed records drop out of the query
    
    # But if nothing was patched in this batch, move offset forward
    if patched == 0 and errors >= batch:
        offset += batch

print(f"\nDone: {patched} patched, {errors} failed/skipped")
