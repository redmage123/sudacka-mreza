#!/usr/bin/env python3
"""
Fetch specialised Croatian law areas not yet covered:
  - Commercial / company law (Zakon o trgovačkim društvima)
  - Tax law (Opći porezni zakon, dohodak, dobit, PDV)
  - Intellectual property (autorsko pravo, žig, patenti)
  - Consumer & competition law
  - Data protection / GDPR
  - Environmental law
  - Legal profession (odvjetništvo, javno bilježništvo)
  - Public procurement
  - International private law + arbitration
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

log = get_logger("fetch-specialised")


@dataclass
class Source:
    url: str
    source_type: str
    title: str
    author: str = ""
    year: int = 0
    area: str = ""


NN = "https://narodne-novine.nn.hr/clanci/sluzbeni"
HR = "https://hrcak.srce.hr/file"

SOURCES: list[Source] = [
    # ═══ Commercial / company law ═══════════════════════════════════════
    Source(f"{NN}/2011_12_152_3144.html", "legislation",
           "Zakon o trgovačkim društvima (pročišćeni tekst)",
           "Sabor RH", 2011, "commercial"),
    Source(f"{NN}/2022_10_114_1712.html", "legislation",
           "Zakon o izmjenama ZTD (NN 114/22)", "Sabor RH", 2022, "commercial"),
    Source(f"{NN}/2023_02_18_305.html", "legislation",
           "Zakon o izmjenama i dopunama ZTD (NN 18/23)",
           "Sabor RH", 2023, "commercial"),
    Source(f"{NN}/2003_03_49_624.html", "legislation",
           "Zakon o trgovini (pročišćeni tekst)", "Sabor RH", 2003, "commercial"),
    Source(f"{HR}/293555", "commentary",
           "Poslovni udjeli u d.o.o.",
           "E. Čulinović-Herc, S. Marinac Rumora, M. Braut Filipović",
           0, "commercial"),
    Source(f"{HR}/39822", "commentary",
           "Transparentnost statusnih i financijskih odnosa povezanih društava",
           "D. Jurić", 0, "commercial"),
    Source(f"{HR}/196901", "commentary",
           "Dodatne činidbe u društvu s ograničenom odgovornošću",
           "O. Bogdanović", 0, "commercial"),
    Source(f"{HR}/176432", "commentary",
           "Dužnost dioničara na lojalno postupanje",
           "", 0, "commercial"),
    Source(f"{HR}/110655", "commentary",
           "Odgovornost članova društva s ograničenom odgovornošću",
           "", 0, "commercial"),
    Source(f"{HR}/450337", "commentary",
           "Neki pravni prijepori kod pripajanja d.o.o.",
           "V. Švedl Blažeka", 0, "commercial"),
    Source(f"{HR}/316051", "commentary",
           "Protuponuditeljske mjere prema Nacrtu Zakona",
           "P. Miladin", 0, "commercial"),
    Source(f"{HR}/274026", "commentary",
           "Tvrtka društva (stručni rad)",
           "M. Bračun", 0, "commercial"),

    # ═══ Tax law ════════════════════════════════════════════════════════
    Source(f"{NN}/2000_12_127_2353.html", "legislation",
           "Opći porezni zakon (NN 127/00)", "Sabor RH", 2000, "tax"),
    Source(f"{NN}/2019_05_45_895.html", "legislation",
           "Pravilnik o provedbi Općeg poreznog zakona",
           "MF RH", 2019, "tax"),
    Source(f"{NN}/2020_03_32_691.html", "legislation",
           "Zakon o dopuni Općeg poreznog zakona (NN 32/20)",
           "Sabor RH", 2020, "tax"),
    Source(f"{NN}/2016_12_115_2525.html", "legislation",
           "Zakon o porezu na dohodak (NN 115/16)",
           "Sabor RH", 2016, "tax"),
    Source(f"{NN}/2020_03_32_692.html", "legislation",
           "Zakon o izmjeni Zakona o porezu na dohodak (NN 32/20)",
           "Sabor RH", 2020, "tax"),
    Source(f"{NN}/2016_12_115_2526.html", "legislation",
           "Zakon o izmjenama i dopunama Zakona o PDV-u (NN 115/16)",
           "Sabor RH", 2016, "tax"),
    Source(f"{NN}/2004_12_177_3067.html", "legislation",
           "Zakon o porezu na dobit (NN 177/04)",
           "Sabor RH", 2004, "tax"),

    # ═══ Intellectual property ══════════════════════════════════════════
    Source(f"{NN}/2021_10_111_1941.html", "legislation",
           "Zakon o autorskom pravu i srodnim pravima (NN 111/21)",
           "Sabor RH", 2021, "ip"),
    Source(f"{NN}/2017_06_62_1432.html", "legislation",
           "Zakon o izmjenama i dopunama ZAPSP (NN 62/17)",
           "Sabor RH", 2017, "ip"),
    Source(f"{NN}/2019_02_14_272.html", "legislation",
           "Zakon o žigu (NN 14/19)", "Sabor RH", 2019, "ip"),
    Source(f"{NN}/2018_05_46_863.html", "legislation",
           "Zakon o izmjenama Zakona o žigu (NN 46/18)",
           "Sabor RH", 2018, "ip"),
    Source(f"{NN}/2020_05_55_1106.html", "legislation",
           "Pravilnik o patentu (NN 55/20)",
           "DZIV", 2020, "ip"),
    Source(f"{NN}/2019_04_38_793.html", "legislation",
           "Pravilnik o žigu (NN 38/19)",
           "DZIV", 2019, "ip"),

    # ═══ Consumer & competition law ═════════════════════════════════════
    Source(f"{NN}/2009_07_79_1877.html", "legislation",
           "Zakon o zaštiti tržišnog natjecanja (NN 79/09)",
           "Sabor RH", 2009, "competition"),
    Source(f"{NN}/2021_04_41_810.html", "legislation",
           "Zakon o izmjenama i dopunama ZZTN (NN 41/21)",
           "Sabor RH", 2021, "competition"),
    Source(f"{NN}/2011_01_9_197.html", "legislation",
           "Uredba o načinu utvrđivanja mjerodavnog tržišta",
           "Vlada RH", 2011, "competition"),
    Source(f"{NN}/2011_01_9_195.html", "legislation",
           "Uredba o skupnom izuzeću sporazuma o prijenosu tehnologije",
           "Vlada RH", 2011, "competition"),
    Source(f"{NN}/2007_07_79_2485.html", "legislation",
           "Zakon o zaštiti potrošača (NN 79/07)",
           "Sabor RH", 2007, "consumer"),
    Source(f"{NN}/2019_02_14_279.html", "legislation",
           "Zakon o izmjenama i dopunama ZZP (NN 14/19)",
           "Sabor RH", 2019, "consumer"),

    # ═══ Data protection / GDPR ═════════════════════════════════════════
    Source(f"{NN}/2018_05_42_805.html", "legislation",
           "Zakon o provedbi Opće uredbe o zaštiti podataka (NN 42/18)",
           "Sabor RH", 2018, "data_protection"),
    Source(f"{NN}/2012_09_106_2300.html", "legislation",
           "Zakon o zaštiti osobnih podataka (pročišćeni tekst)",
           "Sabor RH", 2012, "data_protection"),
    Source(f"{NN}/2018_07_68_1391.html", "legislation",
           "Zakon o zaštiti fizičkih osoba u obradi osobnih podataka — kazneni dio",
           "Sabor RH", 2018, "data_protection"),
    Source(f"{NN}/2025_04_67_857.html", "legislation",
           "Zakon o provedbi Akta o digitalnim uslugama (NN 67/25)",
           "Sabor RH", 2025, "data_protection"),
    Source(f"{NN}/2025_07_106_1512.html", "legislation",
           "Pravilnik o radu AZOP (NN 106/25)",
           "AZOP", 2025, "data_protection"),

    # ═══ Environmental law ══════════════════════════════════════════════
    Source(f"{NN}/2014_01_8_119.html", "legislation",
           "Uredba o okolišnoj dozvoli (NN 8/14)",
           "Vlada RH", 2014, "environmental"),
    Source(f"{NN}/2022_01_3_31.html", "legislation",
           "Pravilnik o registru onečišćavanja okoliša (NN 3/22)",
           "MINGOR", 2022, "environmental"),

    # ═══ Legal profession & public procurement ══════════════════════════
    Source(f"{NN}/1993_08_78_1599.html", "legislation",
           "Zakon o javnom bilježništvu (NN 78/93)",
           "Sabor RH", 1993, "legal_profession"),
    Source(f"{NN}/2007_02_16_652.html", "legislation",
           "Zakon o izmjenama i dopunama ZoJB (NN 16/07)",
           "Sabor RH", 2007, "legal_profession"),
    Source(f"{NN}/2009_06_75_1787.html", "legislation",
           "Zakon o izmjenama i dopuni ZoJB (NN 75/09)",
           "Sabor RH", 2009, "legal_profession"),
    Source(f"{NN}/2016_12_120_2607.html", "legislation",
           "Zakon o javnoj nabavi (NN 120/16)",
           "Sabor RH", 2016, "procurement"),
    Source(f"{NN}/2022_10_114_1740.html", "legislation",
           "Zakon o izmjenama i dopunama ZJN (NN 114/22)",
           "Sabor RH", 2022, "procurement"),
    Source(f"{NN}/2003_07_117_1638.html", "legislation",
           "Zakon o Državnoj komisiji za kontrolu postupaka javne nabave",
           "Sabor RH", 2003, "procurement"),
    Source(f"{NN}/2021_04_43_843.html", "legislation",
           "Pravilnik o obrascima u ovršnom postupku i elektroničkoj komunikaciji (javni bilježnici)",
           "MPU", 2021, "legal_profession"),

    # ═══ International private law & arbitration ═══════════════════════
    Source(f"{HR}/377191", "commentary",
           "Međunarodno privatno pravo — interakcija", "", 0, "intl_private"),
    Source(f"{HR}/39805", "commentary",
           "Uredba Rim II: ujednačena pravila o pravu mjerodavnom za izvanugovorne obveze",
           "", 0, "intl_private"),
    Source(f"{HR}/158121", "commentary",
           "Izbor mjerodavnog prava u obiteljskim i statusnim stvarima",
           "", 0, "intl_private"),
    Source(f"{HR}/111683", "commentary",
           "Športsko arbitražno sudište HOO",
           "", 0, "arbitration"),
    Source(f"{HR}/146137", "commentary",
           "Zbornik PFZ — Posebni broj (2010), međunarodno privatno pravo",
           "", 2010, "intl_private"),
    Source(f"{HR}/325396", "commentary",
           "50 godina europske pravosudne suradnje",
           "", 0, "intl_private"),
    Source(f"{HR}/143287", "commentary",
           "Međunarodno pravo — 2. izmijenjeno izdanje",
           "", 0, "intl_private"),
    Source(f"{HR}/198342", "commentary",
           "Deliktni statut u hrvatskom pravu plovidbe",
           "", 0, "intl_private"),
    Source(f"{HR}/39996", "commentary",
           "Uvod u Načela europskog ugovornog prava",
           "S. Petrić", 0, "intl_private"),
    Source(f"{HR}/94815", "commentary",
           "Pravičnost i međunarodno pravo u razgraničenjima morskih prostora",
           "", 0, "intl_private"),
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

    cache_dir = Path(args.sources_dir or RAW_DIR / "specialised_law_sources")
    cache_dir.mkdir(parents=True, exist_ok=True)
    corpus_path = RAW_DIR / "specialised_law_corpus.jsonl"
    chunks_path = RAW_DIR / "specialised_law_chunks.jsonl"
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
