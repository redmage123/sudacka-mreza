#!/usr/bin/env python3
"""
Fetch Croatian civil-law corpus (primary legislation + HRČAK academic
commentary), parse to text, chunk, embed, and upsert into BOTH:

  - data/raw/civil_law_corpus.jsonl   (fine-tune raw corpus)
  - legal_sources pgvector table       (live RAG — via the companion
                                        embed_civil_law_chunks.py script)

Scope covers the five cornerstone Croatian civil-law acts:
  1. Zakon o obveznim odnosima (ZOO) — Obligations Act
  2. Zakon o vlasništvu i drugim stvarnim pravima — Property Act
  3. Zakon o nasljeđivanju — Inheritance Act
  4. Obiteljski zakon — Family Act
  5. Zakon o parničnom postupku (ZPP) — Civil Procedure Act

Plus their published amendments and 15+ open-access HRČAK papers that
explain the core doctrines (unjust enrichment, damages, co-ownership,
adverse possession, inheritance shares, etc).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
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

log = get_logger("fetch-civil")


@dataclass
class Source:
    url: str
    source_type: str    # 'legislation' | 'commentary'
    title: str
    author: str = ""
    year: int = 0


SOURCES: list[Source] = [
    # ── Zakon o obveznim odnosima (ZOO) ────────────────────────────────
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2005_03_35_707.html",
           "legislation", "Zakon o obveznim odnosima", "Sabor RH", 2005),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2018_03_29_586.html",
           "legislation", "Zakon o izmjenama ZOO (NN 29/18)", "Sabor RH", 2018),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2022_12_156_2517.html",
           "legislation", "Uredba o izmjeni ZOO (NN 156/22)", "Vlada RH", 2022),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_155_2365.html",
           "legislation", "Zakon o izmjenama i dopunama ZOO (NN 155/23)", "Sabor RH", 2023),

    # ── Zakon o vlasništvu i drugim stvarnim pravima ───────────────────
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2015_07_81_1548.html",
           "legislation", "Zakon o vlasništvu i drugim stvarnim pravima (pročišćeni tekst)",
           "Sabor RH", 2015),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2017_09_94_2194.html",
           "legislation", "Ispravak Zakona o vlasništvu (pročišćeni tekst)", "Sabor RH", 2017),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2025_03_52_674.html",
           "legislation", "Zakon o izmjeni Zakona o vlasništvu (NN 52/25)", "Sabor RH", 2025),

    # ── Zakon o nasljeđivanju ───────────────────────────────────────────
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2003_10_163_2350.html",
           "legislation", "Zakon o izmjeni Zakona o nasljeđivanju (NN 163/03)", "Sabor RH", 2003),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2013_10_127_2758.html",
           "legislation", "Zakon o izmjenama i dopunama Zakona o nasljeđivanju (NN 127/13)",
           "Sabor RH", 2013),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2019_02_14_281.html",
           "legislation", "Zakon o izmjeni i dopunama Zakona o nasljeđivanju (NN 14/19)",
           "Sabor RH", 2019),

    # ── Obiteljski zakon ────────────────────────────────────────────────
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2015_09_103_1992.html",
           "legislation", "Obiteljski zakon (NN 103/15)", "Sabor RH", 2015),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2019_10_98_1944.html",
           "legislation", "Zakon o izmjenama Obiteljskog zakona (NN 98/19)", "Sabor RH", 2019),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2023_12_156_2385.html",
           "legislation", "Zakon o izmjenama i dopunama Obiteljskog zakona (NN 156/23)",
           "Sabor RH", 2023),

    # ── Zakon o parničnom postupku (ZPP) ───────────────────────────────
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2011_12_148_2993.html",
           "legislation", "Zakon o parničnom postupku (pročišćeni tekst)", "Sabor RH", 2011),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2022_07_80_1170.html",
           "legislation", "Zakon o izmjenama i dopunama ZPP (NN 80/22)", "Sabor RH", 2022),
    Source("https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_146_2168.html",
           "legislation", "Zakon o izmjeni i dopunama ZPP (NN 146/25)", "Sabor RH", 2025),

    # ── Academic commentary: obligations & damages ─────────────────────
    Source("https://hrcak.srce.hr/file/230038",
           "commentary", "Obveznopravni odnos stjecanja bez osnove", "J. Uzelac"),
    Source("https://hrcak.srce.hr/file/208298",
           "commentary", "Naknada buduće štete", "J. Jug"),
    Source("https://hrcak.srce.hr/file/285037",
           "commentary", "Odgovornost Republike Hrvatske za štetu", "A. Mikecin"),
    Source("https://hrcak.srce.hr/file/359987",
           "commentary", "Protupravnost kao pretpostavka odgovornosti za štetu"),
    Source("https://hrcak.srce.hr/file/340052",
           "commentary", "Razgraničenje instituta doprinosa oštećenika vlastitoj šteti i podijeljene odgovornosti"),
    Source("https://hrcak.srce.hr/file/374012",
           "commentary", "Država i naknada štete u vrijeme prirodnih nepogoda"),
    Source("https://hrcak.srce.hr/file/161645",
           "commentary", "O odnosu materijalnog i procesnog prava (Zbornik PFZ)", "", 2013),
    Source("https://hrcak.srce.hr/file/394349",
           "commentary", "Izazovi postavljanja tužbenog zahtjeva"),

    # ── Academic commentary: property & real rights ────────────────────
    Source("https://hrcak.srce.hr/file/264179",
           "commentary", "Uspostava vlasništva posebnoga dijela nekretnine", "V. Prančić"),
    Source("https://hrcak.srce.hr/file/80370",
           "commentary", "Nekretnine kao objekti prava vlasništva i prava građenja",
           "P. Simonetti"),
    Source("https://hrcak.srce.hr/file/39985",
           "commentary", "Stjecanje prava vlasništva primjenom instituta dosjelosti"),
    Source("https://hrcak.srce.hr/file/20395",
           "commentary", "Građenje na tuđem zemljištu kao temelj stjecanja prava vlasništva",
           "", 2007),
    Source("https://hrcak.srce.hr/file/383564",
           "commentary", "Stjecanje prava vlasništva dosjelošću", "L. Brajković"),
    Source("https://hrcak.srce.hr/file/39998",
           "commentary", "Razvrgnuće suvlasničke zajednice", "A. Maganić"),
    Source("https://hrcak.srce.hr/file/448090",
           "commentary", "Problematika izvanknjižnog vlasništva nekretnina"),
    Source("https://hrcak.srce.hr/file/346096",
           "commentary", "Zabilježbe prema novom Zakonu o zemljišnim knjigama", "D. Kontrec"),

    # ── Academic commentary: inheritance & family ──────────────────────
    Source("https://hrcak.srce.hr/file/324643",
           "commentary", "Pravni položaj sunasljednika u Republici Hrvatskoj"),
    Source("https://hrcak.srce.hr/file/324649",
           "commentary", "Konverzija ugovora o doživotnom i dosmrtnom uzdržavanju",
           "D. Udiković"),
    Source("https://hrcak.srce.hr/file/324637",
           "commentary", "Nadležnost za raspravljanje ostavine"),
    Source("https://hrcak.srce.hr/file/330132",
           "commentary", "Imovinskopravni položaj osoba lišenih poslovne sposobnosti"),
    Source("https://hrcak.srce.hr/file/47756",
           "commentary", "Obiteljsko pravo i socijalna skrb — međuovisnost"),
    Source("https://hrcak.srce.hr/file/424675",
           "commentary", "Osobitosti nasljedno-pravnog instituta", "J. Kasap"),
]

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200


def fetch(client: httpx.Client, url: str) -> tuple[bytes, str]:
    r = client.get(url, follow_redirects=True, timeout=90,
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
    ap.add_argument("--sources-dir", default=None)
    args = ap.parse_args()

    cache_dir = Path(args.sources_dir or RAW_DIR / "civil_law_sources")
    cache_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = RAW_DIR / "civil_law_corpus.jsonl"
    chunks_path = RAW_DIR / "civil_law_chunks.jsonl"
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

            corpus_f.write(json.dumps({
                "source": f"civil_law.{s.source_type}",
                "source_id": cache_name,
                "title": s.title,
                "text": text,
                "lang": "hr",
                "metadata": {"url": s.url, "author": s.author, "year": s.year,
                             "source_type": s.source_type},
            }, ensure_ascii=False) + "\n")
            total_docs += 1

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
    return 0


if __name__ == "__main__":
    sys.exit(main())
