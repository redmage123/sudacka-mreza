#!/usr/bin/env python3
"""
Scrape Croatian primary legislation from Narodne Novine (NN).

NN's public site was refactored to the EU ELI schema; each issue is served
as a PDF under /eli/sluzbeni/{year}/{issue}/pdf. We:

  1. fetch the year-level listing, harvest distinct issue numbers
  2. for each issue download the PDF into a temp buffer
  3. extract text with pypdf (born-digital — NN PDFs have a text layer)
  4. write one JSONL row per issue

Output: data/raw/narodne_novine.jsonl
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import time
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from tqdm import tqdm
from tenacity import retry, stop_after_attempt, wait_exponential

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RawDoc, RAW_DIR, get_logger, load_config, write_jsonl  # noqa: E402

log = get_logger("scrape-nn")

BASE = "https://narodne-novine.nn.hr"
YEAR_SEARCH_URL = BASE + "/search.aspx?sort=datum_silazno&q=&godina={year}&kategorija=1"
ISSUE_PDF_RE = re.compile(r"^/eli/sluzbeni/(\d{4})/(\d+)/pdf$")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def fetch(client: httpx.Client, url: str) -> httpx.Response:
    r = client.get(url, follow_redirects=True, timeout=60)
    r.raise_for_status()
    return r


def discover_issues(client: httpx.Client, year: int) -> list[int]:
    r = fetch(client, YEAR_SEARCH_URL.format(year=year))
    soup = BeautifulSoup(r.text, "lxml")
    seen: set[int] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(BASE):
            href = href[len(BASE):]
        m = ISSUE_PDF_RE.match(href)
        if not m:
            continue
        if int(m.group(1)) != year:
            continue
        seen.add(int(m.group(2)))
    return sorted(seen)


_WS = re.compile(r"\n{3,}")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        chunks.append(t)
    text = "\n\n".join(chunks)
    return _WS.sub("\n\n", text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--dry-run", action="store_true", help="list issue numbers only")
    args = ap.parse_args()

    cfg = load_config(args.config)
    nn_cfg = cfg["narodne_novine"]
    delay = float(nn_cfg["request_delay_seconds"])
    max_per_year = int(nn_cfg["max_acts_per_year"])
    out_path = RAW_DIR / "narodne_novine.jsonl"
    if out_path.exists():
        out_path.unlink()

    with httpx.Client(headers={"User-Agent": nn_cfg["user_agent"]}) as client:
        total = 0
        for year in nn_cfg["years"]:
            log.info("=== year %s ===", year)
            try:
                issues = discover_issues(client, year)
            except Exception as e:
                log.warning("could not list year %s: %s", year, e)
                continue
            log.info("  %d distinct issues discovered", len(issues))
            if args.dry_run:
                print(year, issues)
                continue

            rows: list[dict] = []
            taken = 0
            for issue in tqdm(issues, desc=f"nn {year}", unit="issue"):
                if taken >= max_per_year:
                    break
                url = f"{BASE}/eli/sluzbeni/{year}/{issue}/pdf"
                try:
                    time.sleep(delay)
                    r = fetch(client, url)
                    body = extract_pdf_text(r.content)
                except Exception as e:
                    log.debug("skip %s: %s", url, e)
                    continue
                if len(body) < 1000:
                    log.debug("skipping empty-text issue %s/%s", year, issue)
                    continue
                doc = RawDoc(
                    source="narodne_novine",
                    source_id=f"nn:{year}/{issue}",
                    title=f"Narodne Novine {year}/{issue}",
                    text=body,
                    lang="hr",
                    metadata={"year": year, "issue": issue, "url": url},
                ).to_dict()
                rows.append(doc)
                taken += 1
                if len(rows) >= 10:
                    total += write_jsonl(out_path, rows)
                    rows.clear()
            if rows:
                total += write_jsonl(out_path, rows)
            log.info("year %s: wrote %d issues (total so far %d)", year, taken, total)
        log.info("FINAL: wrote %d NN issues to %s", total, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
