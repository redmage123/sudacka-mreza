"""Scrape the official sudovi.hr Drupal portal for the structured court data
the new Sudačka Mreža CMS schema needs: working hours, departments (odjeli),
and the human-readable jurisdiction text.

Two phases:

  fetch    download each court's pages into /tmp/sudovi-scrape/{slug}/.
  parse    walk the cached HTML and emit a single JSONL file with one
           normalised record per court.

Run from the Toronto host (which can reach sudovi.hr; the old
sudacka-mreza.hr scraper is unreachable because of the Cloud Carib block).

  python3 sudovi_hr_scraper.py fetch
  python3 sudovi_hr_scraper.py parse > /tmp/sudovi-courts.jsonl
"""
from __future__ import annotations

import html as html_lib
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://sudovi.hr"
CACHE = Path("/tmp/sudovi-scrape")
CACHE.mkdir(parents=True, exist_ok=True)

# Slug roots (everything *not* a system page; harvested from the directory).
INDEX_URL = f"{BASE}/hr/o-sudovima/sudovi-republike-hrvatske"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def fetch(url: str, dest: Path, force: bool = False) -> str:
    if dest.exists() and not force:
        return dest.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "hr,en;q=0.7"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8", errors="replace")
    except Exception as e:
        sys.stderr.write(f"  ! {url} -> {e}\n")
        return ""
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(body, encoding="utf-8")
    return body


def list_slugs() -> list[str]:
    html = fetch(INDEX_URL, CACHE / "_index.html")
    slugs = sorted(set(re.findall(r'href="/hr/([a-z]{2,8})"', html)))
    # Drop nav pages.
    BLOCK = {"impresum", "rocisnik", "sitemap"}
    return [s for s in slugs if s not in BLOCK]


def cmd_fetch() -> None:
    slugs = list_slugs()
    sys.stderr.write(f"slugs to fetch: {len(slugs)}\n")
    for i, s in enumerate(slugs, 1):
        sys.stderr.write(f"  [{i:>2}/{len(slugs)}] {s}\n")
        sdir = CACHE / s
        fetch(f"{BASE}/hr/{s}", sdir / "index.html")
        fetch(f"{BASE}/hr/{s}/o-sudovima/o-sudu", sdir / "o-sudu.html")
        # Polite to a public site that doesn't owe us anything.
        time.sleep(0.6)


# --- HTML extraction helpers -------------------------------------------------

def strip_tags(s: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", s, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html_lib.unescape(re.sub(r"\s+", " ", s)).strip()


def main_block(html: str) -> str:
    """Return the <main> ... </main> region (or the whole body if missing)."""
    m = re.search(r"<main[\s\S]*?</main>", html, flags=re.I)
    return m.group(0) if m else html


def first_h1(html: str) -> str:
    m = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", html, flags=re.I)
    return strip_tags(m.group(1)) if m else ""


def extract_working_hours(html: str) -> dict | None:
    """Pull a working-hours block. sudovi.hr puts this either inline on the
    landing page or on /priopcenja/radno-vrijeme. Heuristic: section starting
    at 'Radno vrijeme', up to ~400 chars of context, then look for HH,MM-HH,MM
    or HH:MM-HH:MM patterns."""
    text = strip_tags(main_block(html))
    idx = text.lower().find("radno vrijeme")
    if idx < 0:
        return None
    window = text[idx:idx + 600]
    # Don't try to split per day — sudovi.hr typically gives one line for the
    # whole work week and a separate line for "prijem stranaka". Store both
    # verbatim under notes; populate weekdays uniformly only when there's a
    # clear M-F range that applies to all five.
    party = re.search(
        r"Radno\s*vrijeme\s*(?:za\s*prijem\s*stranaka|stranke|stranaka)[^A-Z]{0,30}([\d,:.\s-]{6,30})",
        window, flags=re.I,
    )
    overall = re.search(
        r"Radno\s*vrijeme\s*(?:suda)?[^A-Z]{0,80}?(\d{1,2}[,:.]\d{2}\s*-\s*\d{1,2}[,:.]\d{2})",
        window, flags=re.I,
    )

    def normalize_range(s: str) -> str:
        return re.sub(r"\s+", "", s).replace(",", ":")

    hours_text = None
    if overall:
        hours_text = normalize_range(overall.group(1))
    party_text = normalize_range(party.group(1)) if party else None

    if not hours_text and not party_text:
        return None

    out = {}
    if hours_text:
        for day in ("monday", "tuesday", "wednesday", "thursday", "friday"):
            out[day] = hours_text + (f" (stranke {party_text})" if party_text else "")
    # Notes capture additional info (party hours when no overall range, etc.).
    notes_bits = []
    if party_text and not hours_text:
        notes_bits.append(f"Prijem stranaka: {party_text}")
    if notes_bits:
        out["notes"] = " | ".join(notes_bits)
    return out


def extract_departments(html: str) -> list[dict]:
    """Departments appear as sidebar menu items under the court's o-sudu page.
    Pattern: links titled like 'Građanski odjel', 'Kazneni odjel', 'Odjel za …'.
    """
    main = main_block(html)
    # Drupal sidebar menu uses <a> with text containing 'odjel' or 'pisarnic' etc.
    found = re.findall(r"<a[^>]*>\s*([^<]{2,80})\s*</a>", main, flags=re.I)
    out = []
    seen = set()
    for raw in found:
        text = strip_tags(raw)
        key = text.lower()
        if not text or len(text) < 4 or key in seen:
            continue
        if not any(p in key for p in ("odjel", "pisarn", "ured predsj", "tajništ",
                                     "glasnogovor", "kabinet", "uprav")):
            continue
        seen.add(key)
        # Classify into the schema's enum.
        if "pisarn" in key:
            t = "registry"
        elif "predsj" in key:
            t = "president"
        elif "tajništ" in key:
            t = "secretary"
        elif "glasnogovor" in key:
            t = "spokesperson"
        else:
            t = "other"
        out.append({"name": text, "type": t})
    return out


# Regex to recognise the boilerplate jurisdiction text shared by all county
# courts (rješavaju o žalbama protiv odluka općinskih sudova ...).
BOILERPLATE_PATTERNS = (
    "rješavaju o žalbama protiv odluka",
    "obavljaju i druge poslove određene zakonom",
)


def extract_jurisdiction_text(html: str) -> str | None:
    text = strip_tags(main_block(html))
    # The o-sudu page exposes 'Nadležnost:' followed by inline content. Pull
    # up to the next obvious heading or footer marker.
    idx = text.find("Nadležnost")
    if idx < 0:
        return None
    chunk = text[idx:idx + 4000]
    # Cut at any of these markers (signalling end of the jurisdiction
    # paragraph and start of footer / next section).
    for stop in ("Footer", "IMPRESUM", "Unutarnje ustrojstvo", "Godišnji raspored"):
        i = chunk.find(stop)
        if i > 200:
            chunk = chunk[:i]
            break
    chunk = chunk.replace("Nadležnost", "").lstrip(": -").strip()
    if any(p in chunk for p in BOILERPLATE_PATTERNS) and len(chunk) > 400:
        # Boilerplate — skip; this is the same text for every county court and
        # describes the role rather than the geographic area. Better to leave
        # empty than to fill every court with the same paragraph.
        return None
    return chunk[:2000] if chunk else None


# --- Parse pass --------------------------------------------------------------

def cmd_parse() -> None:
    slugs = sorted(p.name for p in CACHE.iterdir() if p.is_dir() and not p.name.startswith("_"))
    out_count = 0
    for s in slugs:
        sdir = CACHE / s
        idx_html = (sdir / "index.html").read_text(encoding="utf-8") if (sdir / "index.html").exists() else ""
        osu_html = (sdir / "o-sudu.html").read_text(encoding="utf-8") if (sdir / "o-sudu.html").exists() else ""
        if not idx_html:
            sys.stderr.write(f"  [skip] {s}: no index\n")
            continue
        court_name = first_h1(idx_html)
        if not court_name:
            sys.stderr.write(f"  [skip] {s}: no h1\n")
            continue
        rec = {
            "slug": s,
            "name": court_name,
            "departments": extract_departments(osu_html),
            "time_availability": extract_working_hours(idx_html) or {},
            "jurisdiction_text": extract_jurisdiction_text(osu_html),
        }
        print(json.dumps(rec, ensure_ascii=False))
        out_count += 1
    sys.stderr.write(f"emitted {out_count} records\n")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in {"fetch", "parse"}:
        print(__doc__)
        sys.exit(1)
    {"fetch": cmd_fetch, "parse": cmd_parse}[sys.argv[1]]()
