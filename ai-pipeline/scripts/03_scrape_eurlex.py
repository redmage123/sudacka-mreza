#!/usr/bin/env python3
"""
Fetch EU law in Croatian from EUR-Lex.

EUR-Lex exposes documents via stable CELEX identifiers. We use the public
HTTP content endpoint with the language path /HRV/TXT/HTML which returns
the official Croatian-language version.

Strategy:
  1. Use EUR-Lex's listing endpoint (sector-specific) to discover CELEX IDs.
  2. For each ID, fetch /legal-content/HRV/TXT/HTML/?uri=CELEX:<id>.
  3. Extract the <div id="TexteOnly"> (or fallback) and strip chrome.

Sectors we care about:
  - 3 = Directives / Regulations (secondary legislation)
  - 6 = ECJ case-law (judgments, orders)

Output: data/raw/eurlex.jsonl
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from tqdm import tqdm
from tenacity import retry, stop_after_attempt, wait_exponential

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RawDoc, RAW_DIR, get_logger, load_config, write_jsonl  # noqa: E402

log = get_logger("scrape-eurlex")

BASE = "https://eur-lex.europa.eu"
SEARCH_URL = (
    BASE
    + "/search.html?lang=hr&scope=EURLEX&type=quick&sortOneOrder=desc"
    + "&sortOne=DD&DTS_DOM=EU_LAW&DTS_SUBDOM=LEGISLATION"
    + "&DD_YEAR={year}&qid={qid}&page={page}"
)
# Friendlier: use the SPARQL endpoint for bulk CELEX discovery.
SPARQL = "https://publications.europa.eu/webapi/rdf/sparql"
SPARQL_QUERY = """
PREFIX cdm:  <http://publications.europa.eu/ontology/cdm#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?celex WHERE {{
  ?doc cdm:resource_legal_id_celex ?celex .
  ?doc cdm:work_created_by_agent ?agent .
  FILTER (STRSTARTS(STR(?celex), "{sector}"))
  FILTER (STRLEN(STR(?celex)) >= 10)
}}
LIMIT {limit}
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def fetch(client: httpx.Client, url: str, **kw) -> httpx.Response:
    r = client.get(url, follow_redirects=True, timeout=30, **kw)
    r.raise_for_status()
    return r


def sparql_celex(client: httpx.Client, sector: str, limit: int) -> list[str]:
    """Discover CELEX IDs starting with a given sector digit ('3', '6', ...)."""
    q = SPARQL_QUERY.format(sector=sector, limit=limit)
    r = client.post(
        SPARQL,
        data={"query": q, "format": "application/sparql-results+json"},
        timeout=60,
    )
    r.raise_for_status()
    out = r.json()
    bindings = out.get("results", {}).get("bindings", [])
    return [b["celex"]["value"] for b in bindings if "celex" in b]


def fetch_document_hr(client: httpx.Client, celex: str) -> tuple[str, str]:
    """Return (title, body) for a given CELEX id in Croatian."""
    url = f"{BASE}/legal-content/HR/TXT/HTML/?uri=CELEX:{celex}"
    r = fetch(client, url)
    soup = BeautifulSoup(r.text, "lxml")
    # Title lives in <p class="doc-ti"> or <h1> depending on layout.
    title_el = soup.select_one("p.doc-ti, h1")
    title = title_el.get_text(strip=True) if title_el else f"CELEX {celex}"
    # Body: <div id="TexteOnly"> if present (HTML render), else <main>.
    body_el = soup.find("div", id="TexteOnly") or soup.find("main") or soup.body
    if not body_el:
        return title, ""
    for tag in body_el(["script", "style", "noscript", "nav", "aside", "footer"]):
        tag.decompose()
    text = body_el.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return title, text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    args = ap.parse_args()

    cfg = load_config(args.config)
    el = cfg["eurlex"]
    delay = float(el["request_delay_seconds"])
    out_path = RAW_DIR / "eurlex.jsonl"
    if out_path.exists():
        out_path.unlink()

    total = 0
    with httpx.Client(headers={
        "User-Agent": "sudacka-finetune/1.0 (+training corpus)",
        "Accept-Language": "hr",
    }) as client:
        for sector in el["sectors"]:
            log.info("=== sector %s ===", sector)
            try:
                celex_list = sparql_celex(client, sector, el["max_docs_per_sector"])
            except Exception as e:
                log.warning("SPARQL discovery failed for sector %s: %s", sector, e)
                continue
            log.info("  discovered %d CELEX ids", len(celex_list))

            rows: list[dict] = []
            for celex in tqdm(celex_list, desc=f"eurlex {sector}", unit="doc"):
                try:
                    time.sleep(delay)
                    title, body = fetch_document_hr(client, celex)
                except Exception as e:
                    log.debug("skip %s: %s", celex, e)
                    continue
                if len(body) < 500:
                    continue
                doc = RawDoc(
                    source="eurlex",
                    source_id=f"celex:{celex}",
                    title=title,
                    text=body,
                    lang="hr",
                    metadata={"celex": celex, "sector": sector,
                              "url": f"{BASE}/legal-content/HR/TXT/HTML/?uri=CELEX:{celex}"},
                ).to_dict()
                rows.append(doc)
                if len(rows) >= 50:
                    total += write_jsonl(out_path, rows)
                    rows.clear()
            if rows:
                total += write_jsonl(out_path, rows)
        log.info("wrote %d EUR-Lex docs to %s", total, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
