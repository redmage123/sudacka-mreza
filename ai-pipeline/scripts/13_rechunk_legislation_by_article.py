#!/usr/bin/env python3
"""
Re-chunk all cached legislation sources on `Članak N.` boundaries so each
Croatian statute article becomes its own pgvector row. Non-legislation
sources (commentary, manuals) are left alone.

Output: data/raw/legislation_by_article_chunks.jsonl

The companion embedder replaces all existing legislation rows in
legal_sources with these per-article chunks and populates article_number.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RAW_DIR, get_logger  # noqa: E402

log = get_logger("article-chunk")


# ── Which cached directories contain legislation ───────────────────────────
# Each entry maps a cache dir → metadata (source_type, list of expected URLs).
# We don't actually need the URL-meta to match here; we just walk the files
# and re-parse, then look up the original metadata from the companion
# *_corpus.jsonl files that were emitted by the fetchers.
CACHE_DIRS = [
    "bankruptcy_sources",
    "civil_law_sources",
    "remaining_law_sources",
    "specialised_law_sources",
    "kazneni_zakon_sources",
]

# Splits on a line starting with "Članak 230." / "Članak 230a." etc.
# Capture trailing letter too (e.g. "Članak 217a.").
ARTICLE_RE = re.compile(r"(^|\n)[ \t]*Članak\s+(\d+[a-zA-Z]?)[\.\s]", re.MULTILINE)

# Maximum chunk size. If one article is bigger than this we split it again
# at paragraph boundaries — some procedural articles are giant.
MAX_ARTICLE_CHARS = 3500
MIN_CHUNK_CHARS = 180  # drop tiny preamble fragments


@dataclass
class SourceMeta:
    source_type: str
    title: str
    url: str
    author: str
    year: int


def load_corpus_metadata() -> dict[str, SourceMeta]:
    """Look up the URL, title, author, year for a cache_name from all the
    *_corpus.jsonl files the fetchers wrote earlier."""
    out: dict[str, SourceMeta] = {}
    for corpus_name in ["bankruptcy_corpus", "civil_law_corpus",
                        "remaining_law_corpus", "specialised_law_corpus"]:
        path = RAW_DIR / f"{corpus_name}.jsonl"
        if not path.exists():
            continue
        for line in path.open(encoding="utf-8"):
            d = json.loads(line)
            md = d.get("metadata", {})
            st = md.get("source_type")
            if st != "legislation":
                continue
            area = md.get("area") or ""
            full_st = f"{area}.legislation" if area else "legislation"
            out[d["source_id"]] = SourceMeta(
                source_type=full_st,
                title=d["title"],
                url=md.get("url", ""),
                author=md.get("author", ""),
                year=md.get("year") or 0,
            )
    # Kazneni zakon was ingested separately — synthesize its metadata from
    # the URL → cache_name hash.
    kz_urls = [
        ("https://narodne-novine.nn.hr/clanci/sluzbeni/2011_11_125_2498.html",
         "Kazneni zakon (NN 125/11)", 2011),
        ("https://narodne-novine.nn.hr/clanci/sluzbeni/2022_10_114_1714.html",
         "Zakon o izmjenama Kaznenog zakona (NN 114/22)", 2022),
    ]
    for url, title, year in kz_urls:
        cn = hashlib.sha1(url.encode()).hexdigest()[:16]
        out[cn] = SourceMeta("criminal.legislation", title, url, "Sabor RH", year)
    return out


def extract_pdf_text(path: Path) -> str:
    try:
        reader = PdfReader(str(path))
        return "\n\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception as e:
        log.warning("pypdf failed on %s: %s", path.name, e)
        return ""


def extract_html_text(path: Path) -> str:
    with path.open("rb") as f:
        b = f.read()
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


_HEADING_LOOKBACK = 140  # chars of context to inspect before a Članak


def _find_heading(text: str, cut: int) -> str | None:
    """Croatian statutes format articles as:
        <section heading e.g. POGLAVLJE X.>
        <article title e.g. Razbojništvo>
        Članak 230.
        (1) Tko...
    We want to attach the short article title to the article body so FTS
    on the title keyword (e.g. "razbojništvo") matches the article chunk.
    """
    lookback_start = max(0, cut - _HEADING_LOOKBACK)
    window = text[lookback_start:cut]
    lines = [ln.strip() for ln in window.rstrip("\n").split("\n")]
    # Walk backwards, grabbing contiguous short "heading-like" lines.
    grabbed: list[str] = []
    for ln in reversed(lines):
        if not ln:
            break  # blank line = end of heading block
        if len(ln) < 5 or len(ln) > 80:
            break
        if ln.startswith("(") or ln[0].isdigit():
            break
        if ln.endswith(".") and not ln.endswith("st."):
            # Looks like prose sentence from previous article; stop.
            break
        grabbed.append(ln)
        if len(grabbed) >= 2:
            break  # at most article-title + section-title
    if not grabbed:
        return None
    return "\n".join(reversed(grabbed))


def split_by_article(text: str) -> list[tuple[str | None, str]]:
    """Return (article_number, body) pairs. If no articles found, returns
    [(None, text)]. Preamble text before the first Članak is also emitted
    with article_number=None. Each article body is prefixed with its
    heading (e.g. "Razbojništvo") when present, so term-matching FTS
    queries (e.g. for "razbojništvo") hit the right chunk."""
    matches = list(ARTICLE_RE.finditer(text))
    if not matches:
        return [(None, text)]

    out: list[tuple[str | None, str]] = []
    first_start = matches[0].start()
    preamble = text[:first_start].strip()
    if len(preamble) >= MIN_CHUNK_CHARS:
        out.append((None, preamble))

    for i, m in enumerate(matches):
        num = m.group(2)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        heading = _find_heading(text, start)
        body = text[start:end].strip()
        if heading:
            body = heading + "\n" + body
        if len(body) < MIN_CHUNK_CHARS:
            continue
        if len(body) > MAX_ARTICLE_CHARS:
            parts = split_long_article(body)
            for p in parts:
                out.append((num, p))
        else:
            out.append((num, body))
    return out


def split_long_article(body: str) -> list[str]:
    """Split a single oversized article into ≤ MAX_ARTICLE_CHARS chunks
    at paragraph boundaries, preserving the article header in every piece."""
    # Extract the header line to include in each split
    header_match = re.match(r"^(Članak\s+\d+[a-zA-Z]?\.?)\s*\n", body)
    header = header_match.group(1) + "\n" if header_match else ""

    chunks: list[str] = []
    remaining = body
    while len(remaining) > MAX_ARTICLE_CHARS:
        # Try to break at a paragraph within the first MAX_ARTICLE_CHARS
        cut = remaining.rfind("\n\n", 0, MAX_ARTICLE_CHARS)
        if cut == -1 or cut < MAX_ARTICLE_CHARS // 2:
            cut = MAX_ARTICLE_CHARS
        chunks.append(remaining[:cut].rstrip())
        # Prefix the header on continuation chunks for retrieval grounding.
        remaining = header + remaining[cut:].lstrip()
    if remaining.strip():
        chunks.append(remaining.strip())
    return chunks


def main() -> int:
    metadata_by_id = load_corpus_metadata()
    log.info("loaded metadata for %d legislation sources", len(metadata_by_id))

    out_path = RAW_DIR / "legislation_by_article_chunks.jsonl"
    if out_path.exists():
        out_path.unlink()
    f = out_path.open("w", encoding="utf-8")

    total_articles = 0
    total_chunks = 0
    for cd in CACHE_DIRS:
        dir_path = RAW_DIR / cd
        if not dir_path.exists():
            continue
        for src_file in sorted(dir_path.iterdir()):
            cache_name = src_file.stem
            meta = metadata_by_id.get(cache_name)
            if not meta:
                log.debug("no metadata for %s — skipping", cache_name)
                continue

            if src_file.suffix == ".pdf":
                raw = extract_pdf_text(src_file)
            else:
                raw = extract_html_text(src_file)
            text = clean(raw)
            if len(text) < 500:
                continue

            pairs = split_by_article(text)
            articles_here = sum(1 for n, _ in pairs if n is not None)
            log.info("  %s → %d articles, %d total chunks",
                     meta.title[:60], articles_here, len(pairs))
            total_articles += articles_here

            for i, (art_num, piece) in enumerate(pairs):
                f.write(json.dumps({
                    "source_id": cache_name,
                    "source_type": meta.source_type,
                    "title": meta.title,
                    "url": meta.url,
                    "author": meta.author,
                    "year": meta.year,
                    "article_number": art_num,
                    "chunk_index": i,
                    "chunk_count": len(pairs),
                    "text": piece,
                }, ensure_ascii=False) + "\n")
                total_chunks += 1

    f.close()
    log.info("=== total %d articles, %d chunks ===", total_articles, total_chunks)
    return 0


if __name__ == "__main__":
    sys.exit(main())
