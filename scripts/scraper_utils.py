"""
Utility helpers for scrape-case-law.py:
logging, HTTP, text/date helpers, scraping primitives, and checkpoint I/O.
"""

import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "https://odluke.sudovi.hr"
DEFAULT_CHECKPOINT = "/tmp/scrape-case-law-checkpoint.json"

DECISION_TYPE_MAP = {
    "kazneni": "criminal", "krivički": "criminal", "kazn": "criminal",
    "k-": "criminal", "kov": "criminal", "prekršaj": "criminal",
    "prekrsaj": "criminal", "pp-": "criminal",
    "trgovački": "commercial", "trgovacki": "commercial", "trgov": "commercial",
    "st": "commercial", "stečaj": "commercial", "stecaj": "commercial",
    "pž": "commercial",
    "upravni": "administrative", "uprav": "administrative",
    "us": "administrative", "usrh": "administrative",
    "ustavni": "constitutional",
    "europski sud": "ecj", "europski sud za ljudska prava": "ecthr",
    "esljp": "ecthr", "eu sud": "ecj", "c-": "ecj", "t-": "ecj",
}

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SudackaMreza/1.0; legal research; contact: anon@mpudt.hr)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "hr,en;q=0.9",
}


# ── Logging ───────────────────────────────────────────────────────────────────

def log(msg, verbose=False, force=False):
    if force or verbose:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {msg}", flush=True)


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def make_request(url, headers=None, timeout=30, delay=1.0):
    """Fetch a URL with rate limiting and error handling."""
    time.sleep(delay)
    req_headers = dict(REQUEST_HEADERS)
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited (429) — waiting 30s before retry")
            time.sleep(30)
            return make_request(url, headers, timeout, 0)
        raise
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error fetching {url}: {e.reason}")


# ── Text helpers ──────────────────────────────────────────────────────────────

def strip_html(html):
    """Strip HTML tags, style/script blocks, return plain text."""
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.S | re.I)
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def slugify(text):
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text[:120]


def parse_date(date_str):
    """Parse Croatian date DD.MM.YYYY → ISO 8601."""
    try:
        cleaned = date_str.strip().rstrip(".")
        parts = cleaned.split(".")
        if len(parts) == 3 and all(p.strip() for p in parts):
            d, m, y = parts[0].strip().zfill(2), parts[1].strip().zfill(2), parts[2].strip()
            if len(y) == 4 and y.isdigit():
                return f"{y}-{m}-{d}T00:00:00.000Z"
    except Exception:
        pass
    return None


def infer_decision_type(registry_type, court_name):
    """Map registry type and court name to Payload decision_type enum."""
    combined = f"{registry_type} {court_name}".lower()
    for keyword, dtype in DECISION_TYPE_MAP.items():
        if keyword in combined:
            return dtype
    return "civil"


# ── Scraping primitives ───────────────────────────────────────────────────────

def get_listing_url(page, legal_area=None):
    """Build a listing URL."""
    if legal_area:
        return f"{BASE_URL}/Document/DisplayList?page={page}&sk={urllib.parse.quote(legal_area)}"
    return f"{BASE_URL}/Document/DisplayList?page={page}"


def extract_decision_ids(page_html):
    """Extract decision UUIDs from a listing page."""
    return re.findall(r'/Document/View\?id=([a-f0-9-]{36})', page_html)


def scrape_decision(decision_id, delay=1.0):
    """Scrape a single decision detail page, return extracted fields."""
    url = f"{BASE_URL}/Document/View?id={decision_id}"
    html = make_request(url, delay=delay)

    meta = {}
    items = re.findall(
        r'data-metadata-type="([^"]+)"[^>]*>.*?<p class="metadata-title[^"]*"[^>]*>([^<]+)</p>.*?<p class="metadata-content[^"]*"[^>]*>(.*?)</p>',
        html, re.S
    )
    for dtype, _title, content in items:
        clean = strip_html(content).strip()
        if dtype not in meta:
            meta[dtype] = clean

    full_text_html = ""
    full_text_plain = ""
    idx = html.find('class="decision-text"')
    if idx >= 0:
        section = html[idx:]
        start = section.find('>') + 1
        end = section.find('</html>')
        if end > start:
            full_text_html = section[start:end].strip()
        elif start > 0:
            full_text_html = section[start:start + 200000].strip()

    if full_text_html:
        full_text_plain = re.sub(r'\s+', ' ', strip_html(full_text_html)).strip()

    legal_areas = re.findall(r'href="[^"]*sk=([^"&]+)"', html)
    category = urllib.parse.unquote(legal_areas[0]) if legal_areas else ""

    return {
        "source_id": decision_id,
        "source_url": url,
        "case_number": meta.get("decision-number", ""),
        "court_name": meta.get("court", ""),
        "decision_date_raw": meta.get("decision-date", ""),
        "registry_type": meta.get("court-registry-type", ""),
        "decision_type_raw": meta.get("decision-type", ""),
        "finality": meta.get("decision-finality", ""),
        "publication_date_raw": meta.get("publication-date", ""),
        "category": category,
        "full_text_html": full_text_html,
        "full_text_plain": full_text_plain,
    }


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {
            "scraped_ids": [], "page": 1, "imported": 0,
            "errors": 0, "patched": 0, "patch_errors": 0,
        }


def save_checkpoint(path, state):
    with open(path, "w") as f:
        json.dump(state, f, indent=2)
