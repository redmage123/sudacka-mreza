#!/usr/bin/env python3
"""
Fetch the remaining four Croatian law areas (criminal, administrative,
labour, constitutional) — primary legislation + open-access HRČAK
commentary. One pass produces a single JSONL of whole documents for the
fine-tune and a chunks JSONL for pgvector insertion.

Downstream pipeline is identical to 09_fetch_bankruptcy / 10_fetch_civil
— chunks file is fed to the existing embed_*_chunks.py helper.
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

log = get_logger("fetch-remaining")


@dataclass
class Source:
    url: str
    source_type: str    # 'legislation' | 'commentary'
    title: str
    author: str = ""
    year: int = 0
    area: str = ""      # 'criminal' | 'administrative' | 'labour' | 'constitutional'


NN = "https://narodne-novine.nn.hr/clanci/sluzbeni"
HR = "https://hrcak.srce.hr/file"

SOURCES: list[Source] = [
    # ═══ Criminal law ═══════════════════════════════════════════════════
    # Primary
    Source(f"{NN}/305328.html", "legislation", "Zakon o kaznenom postupku (pročišćeni tekst)",
           "Sabor RH", 2011, "criminal"),
    Source(f"{NN}/2017_07_70_1661.html", "legislation",
           "Zakon o izmjenama i dopunama ZKP (NN 70/17)", "Sabor RH", 2017, "criminal"),
    Source(f"{NN}/2013_05_56_1142.html", "legislation",
           "Zakon o izmjeni i dopunama ZKP (NN 56/13)", "Sabor RH", 2013, "criminal"),
    Source(f"{NN}/2025_04_72_935.html", "legislation",
           "Zakon o izmjenama i dopuni ZKP (NN 72/25)", "Sabor RH", 2025, "criminal"),
    Source(f"{NN}/2012_12_144_3076.html", "legislation",
           "Zakon o izmjenama i dopunama Kaznenog zakona (NN 144/12)",
           "Sabor RH", 2012, "criminal"),
    Source(f"{NN}/1997_10_110_1668.html", "legislation", "Kazneni zakon (NN 110/97)",
           "Sabor RH", 1997, "criminal"),
    Source(f"{NN}/2003_12_190_2986.html", "legislation",
           "Zakon o izvršavanju kazne zatvora (pročišćeni tekst)",
           "Sabor RH", 2003, "criminal"),
    # Commentary
    Source(f"{HR}/211754", "commentary", "Procesna prava obrane prema V. noveli ZKP",
           "L. Valković", 0, "criminal"),
    Source(f"{HR}/129686", "commentary",
           "Primjena izabranih elemenata prava na formalnu obranu iz prakse",
           "L. Valković, Z. Burić", 0, "criminal"),
    Source(f"{HR}/133066", "commentary",
           "Pravo okrivljenika na branitelja i na besplatnu pravnu pomoć",
           "M. Pajčić", 0, "criminal"),
    Source(f"{HR}/130364", "commentary",
           "Obrana po službenoj dužnosti: formalna obrana u hrvatskom kaznenom postupku",
           "A. Kvaternik", 0, "criminal"),
    Source(f"{HR}/132519", "commentary", "Pravni i praktični problemi dobre obrane okrivljenika",
           "", 0, "criminal"),
    Source(f"{HR}/261536", "commentary",
           "Prava obrane u različitim stadijima hrvatskog kaznenog postupka",
           "", 0, "criminal"),
    Source(f"{HR}/229293", "commentary",
           "Zaštita postupovnih prava obrane", "K. Vržina", 0, "criminal"),
    Source(f"{HR}/163404", "commentary",
           "Međunarodni zločini prema novom Kaznenom zakonu",
           "M. Munivrana Vajda", 0, "criminal"),
    Source(f"{HR}/20404", "commentary", "Opći dio kaznenog prava",
           "P. Novoselec", 2007, "criminal"),

    # ═══ Administrative law ═════════════════════════════════════════════
    # Primary
    Source(f"{NN}/2009_04_47_1065.html", "legislation", "Zakon o općem upravnom postupku (ZUP)",
           "Sabor RH", 2009, "administrative"),
    Source(f"{NN}/2021_10_110_1930.html", "legislation",
           "Zakon o izmjenama i dopuni ZUP (NN 110/21)", "Sabor RH", 2021, "administrative"),
    Source(f"{NN}/2024_03_36_564.html", "legislation", "Zakon o upravnim sporovima (NN 36/24)",
           "Sabor RH", 2024, "administrative"),
    Source(f"{NN}/2017_03_29_657.html", "legislation",
           "Zakon o izmjeni i dopuni Zakona o upravnim sporovima (NN 29/17)",
           "Sabor RH", 2017, "administrative"),
    # Commentary
    Source(f"{HR}/39990", "commentary",
           "Upravni spor u Hrvatskoj: sadašnje stanje i pravci reforme",
           "D. Đerđa", 2008, "administrative"),
    Source(f"{HR}/249640", "commentary",
           "Pravno uređenje i glavna obilježja upravnog postupka u RH",
           "", 0, "administrative"),
    Source(f"{HR}/225978", "commentary",
           "Prava i obveze upravnih sudova — sporna pitanja",
           "", 0, "administrative"),
    Source(f"{HR}/122273", "commentary", "Nova načela upravnog postupka",
           "M. Šikić, L. Ofak", 0, "administrative"),
    Source(f"{HR}/176438", "commentary", "Troškovi upravnog spora",
           "", 0, "administrative"),
    Source(f"{HR}/214332", "commentary",
           "Stranka u hrvatskom upravnom postupku",
           "", 0, "administrative"),
    Source(f"{HR}/40000", "commentary",
           "Pravna zaštita od šutnje uprave",
           "", 0, "administrative"),
    Source(f"{HR}/241502", "commentary",
           "Sudska i upravna praksa (zbornik)",
           "", 0, "administrative"),

    # ═══ Labour law ═════════════════════════════════════════════════════
    # Primary
    Source(f"{NN}/2014_07_93_1872.html", "legislation", "Zakon o radu (NN 93/14)",
           "Sabor RH", 2014, "labour"),
    Source(f"{NN}/1996_07_59_1183.html", "legislation", "Zakon o zaštiti na radu (NN 59/96)",
           "Sabor RH", 1996, "labour"),
    Source(f"{NN}/2010_11_130_3399.html", "legislation",
           "Zakon o mirovinskom osiguranju (pročišćeni tekst)",
           "Sabor RH", 2010, "labour"),
    Source(f"{NN}/2025_06_96_1305.html", "legislation",
           "Zakon o mirovinskom osiguranju (NN 96/25)",
           "Sabor RH", 2025, "labour"),
    Source(f"{NN}/2021_07_84_1557.html", "legislation",
           "Zakon o izmjenama i dopunama ZMO (NN 84/21)",
           "Sabor RH", 2021, "labour"),
    # Commentary
    Source(f"{HR}/315993", "commentary",
           "Izvanredni otkaz ugovora o radu s osvrtom na sudsku praksu",
           "", 0, "labour"),
    Source(f"{HR}/378356", "commentary",
           "Poslovno uvjetovani otkaz ugovora o radu", "", 0, "labour"),
    Source(f"{HR}/237846", "commentary",
           "Ugovor o radu i zakon o obveznim odnosima",
           "D. Milković", 0, "labour"),
    Source(f"{HR}/193313", "commentary", "Pravni vjesnik — radno pravo",
           "", 2014, "labour"),
    Source(f"{HR}/40002", "commentary",
           "Zaštita osobe u radnom odnosu od načela do realizacije",
           "M. Đ. Učur", 0, "labour"),
    Source(f"{HR}/275372", "commentary",
           "Definicija kolektivnog viška radnika u europskom i hrvatskom radnom pravu",
           "D. Gaži Kovačević", 0, "labour"),
    Source(f"{HR}/445857", "commentary",
           "Podredna primjena općih pravila obveznog prava na radnopravne odnose",
           "", 0, "labour"),
    Source(f"{HR}/171915", "commentary", "Jedinstveni ugovor o radu",
           "", 0, "labour"),
    Source(f"{HR}/252133", "commentary",
           "Ugovor o radu na određeno vrijeme",
           "", 0, "labour"),

    # ═══ Constitutional law ═════════════════════════════════════════════
    # Primary
    Source(f"{NN}/2010_07_85_2422.html", "legislation",
           "Ustav Republike Hrvatske (pročišćeni tekst)",
           "Sabor RH", 2010, "constitutional"),
    Source(f"{NN}/2002_05_49_967.html", "legislation",
           "Ustavni zakon o Ustavnom sudu RH (pročišćeni tekst)",
           "Sabor RH", 2002, "constitutional"),
    Source(f"{NN}/2002_03_29_629.html", "legislation",
           "Ustavni zakon o izmjenama i dopunama UZoUS RH (NN 29/02)",
           "Sabor RH", 2002, "constitutional"),
    # Commentary
    Source(f"{HR}/229997", "commentary",
           "Pravo na pristup sudu u praksi Europskog suda za ljudska prava",
           "D. Šarin", 0, "constitutional"),
    Source(f"{HR}/214461", "commentary",
           "Ustavni sud Republike Hrvatske kao…",
           "", 0, "constitutional"),
    Source(f"{HR}/331616", "commentary",
           "Pozitivna diskriminacija u regulaciji i zaštiti prava nacionalnih manjina",
           "M. Arlović", 0, "constitutional"),
    Source(f"{HR}/331664", "commentary",
           "Izbor odluka Ustavnog suda Republike Hrvatske",
           "", 0, "constitutional"),
    Source(f"{HR}/379218", "commentary",
           "Ustavna tužba kao posebno (supsidijarno) sredstvo zaštite",
           "", 0, "constitutional"),
    Source(f"{HR}/244894", "commentary",
           "Aspekti prava na pravično suđenje — pravo na suđenje u razumnom roku",
           "", 0, "constitutional"),
    Source(f"{HR}/107771", "commentary",
           "Pravo na javno okupljanje u hrvatskom i europskom pravu",
           "", 0, "constitutional"),
    Source(f"{HR}/199621", "commentary",
           "Hrvatska javna uprava — Ustavni sud RH",
           "", 0, "constitutional"),
    Source(f"{HR}/433120", "commentary",
           "Naknada štete prouzročene povredom prava",
           "M. Bukovac Puvača, S. Winkler", 0, "constitutional"),
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

    cache_dir = Path(args.sources_dir or RAW_DIR / "remaining_law_sources")
    cache_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = RAW_DIR / "remaining_law_corpus.jsonl"
    chunks_path = RAW_DIR / "remaining_law_chunks.jsonl"
    if corpus_path.exists():
        corpus_path.unlink()
    if chunks_path.exists():
        chunks_path.unlink()

    corpus_f = corpus_path.open("w", encoding="utf-8")
    chunks_f = chunks_path.open("w", encoding="utf-8")

    area_counts: dict[str, int] = {}
    total_docs = 0
    total_chunks = 0
    with httpx.Client() as client:
        for s in SOURCES:
            log.info("[%s] %s", s.area, s.title[:60])
            cache_name = hashlib.sha1(s.url.encode()).hexdigest()[:16]
            try:
                body, ct = fetch(client, s.url)
            except Exception as e:
                log.warning("fetch failed: %s", e)
                continue
            suffix = ".pdf" if "pdf" in ct or s.url.endswith(".pdf") else ".html"
            (cache_dir / f"{cache_name}{suffix}").write_bytes(body)

            if "pdf" in ct or s.url.lower().endswith(".pdf"):
                raw_text = extract_pdf(body)
            else:
                raw_text = extract_html(body)
            text = clean(raw_text)
            if len(text) < 500:
                log.warning("only %d chars — skipping", len(text))
                continue

            # Prefix area into source_type so embeddings carry it, e.g. 'criminal.legislation'.
            st = f"{s.area}.{s.source_type}" if s.area else s.source_type

            corpus_f.write(json.dumps({
                "source": f"area.{s.area}.{s.source_type}",
                "source_id": cache_name,
                "title": s.title,
                "text": text,
                "lang": "hr",
                "metadata": {"url": s.url, "author": s.author, "year": s.year,
                             "area": s.area, "source_type": s.source_type},
            }, ensure_ascii=False) + "\n")
            total_docs += 1
            area_counts[s.area] = area_counts.get(s.area, 0) + 1

            pieces = chunk(text)
            for i, piece in enumerate(pieces):
                chunks_f.write(json.dumps({
                    "source_id": cache_name,
                    "source_type": st,
                    "title": s.title,
                    "url": s.url,
                    "author": s.author,
                    "year": s.year,
                    "chunk_index": i,
                    "chunk_count": len(pieces),
                    "text": piece,
                }, ensure_ascii=False) + "\n")
                total_chunks += 1
            log.info("  → %d chunks", len(pieces))
            time.sleep(0.4)

    corpus_f.close()
    chunks_f.close()
    log.info("=== fetched %d docs, %d chunks ===", total_docs, total_chunks)
    log.info("by area: %s", area_counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
