#!/usr/bin/env python3
"""
Fetch Croatian bankruptcy-law sources (primary legislation + open-access
academic commentary + Judicial Academy manuals), parse to text, chunk,
embed, and upsert into BOTH:

  - data/raw/bankruptcy_corpus.jsonl (fine-tune raw corpus)
  - legal_sources pgvector table     (live RAG)

Source list is curated — only open-access / public-domain material. See
README for licence provenance.

Run on the dev server (reaches Ollama for embedding + Toronto Postgres via
the bankruptcy-ingest container for the vector insert).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RAW_DIR, get_logger  # noqa: E402

log = get_logger("fetch-bankruptcy")


@dataclass
class Source:
    url: str
    source_type: str    # 'legislation' | 'commentary' | 'manual'
    title: str
    author: str = ""
    year: int = 0


SOURCES: list[Source] = [
    # Primary legislation
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2015_06_71_1365.html",
           "legislation", "Stečajni zakon", "Sabor RH", 2015),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2022_03_36_431.html",
           "legislation", "Zakon o izmjenama i dopunama Stečajnog zakona", "Sabor RH", 2022),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2015_09_100_1936.html",
           "legislation", "Zakon o stečaju potrošača", "Sabor RH", 2015),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2018_07_67_1364.html",
           "legislation", "Zakon o izmjenama i dopunama Zakona o stečaju potrošača", "Sabor RH", 2018),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2012_10_108_2361.html",
           "legislation", "Zakon o financijskom poslovanju i predstečajnoj nagodbi", "Sabor RH", 2012),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2013_06_81_1705.html",
           "legislation", "Zakon o izmjenama i dopunama ZFPPN", "Sabor RH", 2013),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/1996_06_44_852.html",
           "legislation", "Stečajni zakon (1996 — historical)", "Sabor RH", 1996),

    # HRČAK open-access academic commentary
    Source("https://hrcak.srce.hr/file/77927",
           "commentary", "Temeljni pojmovi i nazivi stečajnoga prava", "M. Dika"),
    Source("https://hrcak.srce.hr/file/132257",
           "commentary", "Stečajna kaznena djela", "D. Majstorović"),
    Source("https://hrcak.srce.hr/file/130068",
           "commentary", "Posebni (partikularni) stečajni postupak u hrvatskom pravu", "J. Garašić"),
    Source("https://hrcak.srce.hr/file/255337",
           "commentary", "Prijava tražbina stranih vjerovnika prema Europskoj uredbi", "J. Garašić"),
    Source("https://hrcak.srce.hr/file/208219",
           "commentary", "(Još jedna) reforma stečajnog zakonodavstva", "D. Bodul, A. Vuković"),
    Source("https://hrcak.srce.hr/file/294151",
           "commentary", "Razumni rok u stečajnom postupku", "S. Grbić, D. Bodul, J. Čuveljak"),
    Source("https://hrcak.srce.hr/file/171949",
           "commentary", "Načelo socijalnog postupanja u stečaju", "V. Smokvina, D. Bodul, A. Vuković"),
    Source("https://hrcak.srce.hr/file/39812",
           "commentary", "Zalaganje pokretnih stvari određenih po rodu"),
    Source("https://hrcak.srce.hr/file/349154",
           "commentary", "Posljedice primjene Zakona o financijskom poslovanju"),
    Source("https://hrcak.srce.hr/file/441976",
           "commentary", "Zbornik radova Veleučilišta u Šibeniku 2023"),

    # Pravosudna akademija training manuals
    Source("https://www.pak.hr/cke/obrazovni%20materijali/stecajpotrosaca.pdf",
           "manual", "Stečaj potrošača — priručnik za polaznike", "Pravosudna akademija"),
    Source("https://www.pak.hr/cke/obrazovni%20materijali/Zakon%20o%20stecaju%20potrosaca.pdf",
           "manual", "Zakon o stečaju potrošača — priručnik", "Pravosudna akademija"),
]


CHUNK_SIZE = 2000       # chars per chunk fed to embedder
CHUNK_OVERLAP = 200     # overlap between consecutive chunks


def fetch(client: httpx.Client, url: str) -> tuple[bytes, str]:
    r = client.get(url, follow_redirects=True, timeout=60,
                   headers={"User-Agent": "sudacka-finetune/1.0 (training corpus)"})
    r.raise_for_status()
    return r.content, r.headers.get("content-type", "")


def extract_pdf(b: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(b))
        return "\n\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception as e:
        log.warning("pdf parse failed: %s", e)
        return ""


def extract_html(b: bytes) -> str:
    soup = BeautifulSoup(b, "lxml")
    for tag in soup(["script", "style", "noscript", "nav", "aside", "header", "footer", "form"]):
        tag.decompose()
    body = soup.find("div", class_="clanak-txt") or soup.find("main") or soup.body
    if not body:
        return ""
    text = body.get_text("\n", strip=True)
    return re.sub(r"\n{3,}", "\n\n", text)


def clean(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk(text: str) -> list[str]:
    out: list[str] = []
    n = len(text)
    if n <= CHUNK_SIZE:
        return [text] if text.strip() else []
    pos = 0
    while pos < n:
        end = min(n, pos + CHUNK_SIZE)
        # Try to break at a paragraph boundary
        if end < n:
            nl = text.rfind("\n\n", pos, end)
            if nl > pos + CHUNK_SIZE // 2:
                end = nl
        piece = text[pos:end].strip()
        if len(piece) >= 200:
            out.append(piece)
        if end >= n:
            break
        pos = end - CHUNK_OVERLAP
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-embed", action="store_true",
                    help="only fetch + write JSONL; skip embedding/DB insert")
    ap.add_argument("--sources-dir", default=None,
                    help="where to cache downloaded source files (defaults to data/raw/bankruptcy_sources)")
    args = ap.parse_args()

    cache_dir = Path(args.sources_dir or RAW_DIR / "bankruptcy_sources")
    cache_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = RAW_DIR / "bankruptcy_corpus.jsonl"
    chunks_path = RAW_DIR / "bankruptcy_chunks.jsonl"
    if corpus_path.exists():
        corpus_path.unlink()
    if chunks_path.exists():
        chunks_path.unlink()

    corpus_f = corpus_path.open("w", encoding="utf-8")
    chunks_f = chunks_path.open("w", encoding="utf-8")

    total_docs = 0
    total_chunks = 0
    with httpx.Client() as client:
        for s in SOURCES:
            log.info("fetching %s", s.url)
            cache_name = hashlib.sha1(s.url.encode()).hexdigest()[:16]
            try:
                body, ct = fetch(client, s.url)
            except Exception as e:
                log.warning("fetch failed for %s: %s", s.url, e)
                continue
            # Cache the raw bytes for reproducibility
            suffix = ".pdf" if "pdf" in ct or s.url.endswith(".pdf") else ".html"
            (cache_dir / f"{cache_name}{suffix}").write_bytes(body)

            if "pdf" in ct or s.url.lower().endswith(".pdf"):
                raw_text = extract_pdf(body)
            else:
                raw_text = extract_html(body)
            text = clean(raw_text)
            if len(text) < 500:
                log.warning("source %s yielded only %d chars — skipping", s.title, len(text))
                continue

            # One whole-document row for the fine-tune corpus
            corpus_f.write(json.dumps({
                "source": f"bankruptcy.{s.source_type}",
                "source_id": cache_name,
                "title": s.title,
                "text": text,
                "lang": "hr",
                "metadata": {"url": s.url, "author": s.author, "year": s.year,
                             "source_type": s.source_type},
            }, ensure_ascii=False) + "\n")
            total_docs += 1

            # Chunk for pgvector insert
            pieces = chunk(text)
            for i, piece in enumerate(pieces):
                chunks_f.write(json.dumps({
                    "source_id": cache_name,
                    "source_type": s.source_type,
                    "title": s.title,
                    "url": s.url,
                    "author": s.author,
                    "year": s.year,
                    "chunk_index": i,
                    "chunk_count": len(pieces),
                    "text": piece,
                }, ensure_ascii=False) + "\n")
                total_chunks += 1
            log.info("  %s → %d chunks (%d chars)", s.title[:60], len(pieces), len(text))
            time.sleep(0.5)

    corpus_f.close()
    chunks_f.close()
    log.info("=== fetched %d docs, %d chunks ===", total_docs, total_chunks)
    log.info("corpus: %s", corpus_path)
    log.info("chunks: %s", chunks_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
