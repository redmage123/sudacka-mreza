#!/usr/bin/env python3
"""Fast full-text patcher — extracts UUIDs from slugs, fetches detail pages directly."""
import os, sys, time, re, json, subprocess, urllib.request
from html.parser import HTMLParser

DB_CMD = ["docker", "exec", "sudacka-mreza-db-1", "psql", "-U", "postgres", "-d", "sudacka_mreza", "-t", "-A", "-c"]
BASE_URL = "https://odluke.sudovi.hr/Document/Display/"
DELAY = 1.0
BATCH_SIZE = 50

class TextExtractor(HTMLParser):
    """Extract text from the decision detail page."""
    def __init__(self):
        super().__init__()
        self.in_content = False
        self.depth = 0
        self.text_parts = []
        self.target_classes = ['document-content', 'decision-text', 'content-body', 'odluka-tekst']
    
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get('class', '')
        if any(tc in cls for tc in self.target_classes):
            self.in_content = True
            self.depth = 0
        if self.in_content:
            self.depth += 1
            if tag == 'br':
                self.text_parts.append('\n')
            elif tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4', 'li'):
                self.text_parts.append('\n')
    
    def handle_endtag(self, tag):
        if self.in_content:
            self.depth -= 1
            if self.depth <= 0:
                self.in_content = False
    
    def handle_data(self, data):
        if self.in_content:
            self.text_parts.append(data)
    
    def get_text(self):
        return ' '.join(self.text_parts).strip()

def fetch_full_text(uuid):
    """Fetch decision detail page and extract text."""
    url = BASE_URL + uuid
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; SudackaMreza/1.0; judicial research)',
        'Accept': 'text/html',
        'Accept-Language': 'hr,en;q=0.5',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        
        # Try structured extraction first
        parser = TextExtractor()
        parser.feed(html)
        text = parser.get_text()
        
        if len(text) > 100:
            return text
        
        # Fallback: extract all text between specific markers
        # Look for the main content area
        patterns = [
            r'<div[^>]*class="[^"]*document[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*id="[^"]*content[^"]*"[^>]*>(.*?)</div>',
            r'<article[^>]*>(.*?)</article>',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
            if match:
                raw = match.group(1)
                clean = re.sub(r'<[^>]+>', ' ', raw)
                clean = re.sub(r'\s+', ' ', clean).strip()
                if len(clean) > 200:
                    return clean
        
        # Last resort: strip all tags from body
        body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
        if body_match:
            raw = body_match.group(1)
            # Remove script/style blocks
            raw = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', raw, flags=re.DOTALL | re.IGNORECASE)
            # Remove nav/header/footer
            raw = re.sub(r'<(nav|header|footer)[^>]*>.*?</\1>', '', raw, flags=re.DOTALL | re.IGNORECASE)
            clean = re.sub(r'<[^>]+>', ' ', raw)
            clean = re.sub(r'\s+', ' ', clean).strip()
            if len(clean) > 500:
                return clean
        
        return None
    except Exception as e:
        print(f"  Error fetching {uuid}: {e}")
        return None

def run_sql(sql):
    result = subprocess.run(DB_CMD + [sql], capture_output=True, text=True, timeout=30)
    return result.stdout.strip()

def main():
    # Get all records with NULL full_text and extract UUID from slug
    rows = run_sql("SELECT id, slug FROM court_decisions WHERE full_text IS NULL ORDER BY id;")
    if not rows:
        print("No records need patching")
        return
    
    records = []
    for line in rows.split('\n'):
        parts = line.split('|')
        if len(parts) == 2:
            rec_id = parts[0].strip()
            slug = parts[1].strip()
            # Extract UUID from end of slug (after --)
            uuid_match = re.search(r'--([0-9a-f]{8}[0-9a-f-]*)$', slug)
            if uuid_match:
                uuid_short = uuid_match.group(1)
                records.append((rec_id, uuid_short, slug))
    
    print(f"Found {len(records)} records to patch")
    
    # Test with first record to see the UUID format
    if records:
        test_id, test_uuid, test_slug = records[0]
        print(f"Test: id={test_id} uuid={test_uuid}")
        text = fetch_full_text(test_uuid)
        if text:
            print(f"  Got {len(text)} chars of text")
        else:
            print("  No text found — trying full UUID format")
            # The UUID might need dashes inserted
            if len(test_uuid) == 32:
                full_uuid = f"{test_uuid[:8]}-{test_uuid[8:12]}-{test_uuid[12:16]}-{test_uuid[16:20]}-{test_uuid[20:]}"
                text = fetch_full_text(full_uuid)
                if text:
                    print(f"  Got {len(text)} chars with full UUID format")
    
    patched = 0
    errors = 0
    
    for i, (rec_id, uuid, slug) in enumerate(records):
        text = fetch_full_text(uuid)
        if not text and len(uuid) == 32:
            full_uuid = f"{uuid[:8]}-{uuid[8:12]}-{uuid[12:16]}-{uuid[16:20]}-{uuid[20:]}"
            text = fetch_full_text(full_uuid)
        
        if text and len(text) > 100:
            # Escape for SQL
            escaped = text.replace("'", "''").replace("\\", "\\\\")
            # Also make plain text version
            plain = re.sub(r'<[^>]+>', '', text)
            plain_escaped = plain.replace("'", "''").replace("\\", "\\\\")
            
            sql = f"UPDATE court_decisions SET full_text = '{escaped}', full_text_plain = '{plain_escaped}' WHERE id = {rec_id};"
            try:
                run_sql(sql)
                patched += 1
                if patched % 10 == 0:
                    print(f"  Progress: {patched} patched, {errors} errors, {i+1}/{len(records)} processed")
            except Exception as e:
                errors += 1
                print(f"  SQL error for id={rec_id}: {e}")
        else:
            errors += 1
        
        if i < len(records) - 1:
            time.sleep(DELAY)
    
    print(f"\nDone: {patched} patched, {errors} failed, {len(records)} total")

if __name__ == "__main__":
    main()
