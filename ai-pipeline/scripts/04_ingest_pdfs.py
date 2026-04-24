#!/usr/bin/env python3
"""
Ingest textbook PDFs from config.textbooks.input_dir into JSONL chunks.

Strategy:
  1. Try pypdf's text layer extraction first (fast, works for born-digital PDFs).
  2. If the extracted text is too short for the page count, assume scanned and
     shell out to `tesseract -l hrv+eng` for OCR (requires tesseract + hrv data).
  3. Split long books into overlapping chunks sized between
     textbooks.min_chunk_chars and textbooks.max_chunk_chars so the instruction
     synthesis step has manageable inputs.

Output: data/raw/textbooks.jsonl
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RawDoc, RAW_DIR, get_logger, load_config, write_jsonl  # noqa: E402

log = get_logger("ingest-pdfs")


def pypdf_text(path: Path) -> tuple[str, int]:
    """Return (text, page_count). Text may be empty for scanned PDFs."""
    reader = PdfReader(str(path))
    chunks = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        chunks.append(t)
    return "\n\n".join(chunks), len(reader.pages)


def ocr_text(path: Path) -> str:
    """OCR fallback via tesseract + pdftoppm. Requires both on PATH."""
    if shutil.which("tesseract") is None or shutil.which("pdftoppm") is None:
        log.warning("tesseract/pdftoppm not installed — skipping OCR for %s", path.name)
        return ""
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        # Render pages as 300 dpi PNGs, then run tesseract on each.
        subprocess.run(
            ["pdftoppm", "-r", "300", "-png", str(path), str(td_path / "page")],
            check=True, timeout=600,
        )
        full = []
        for png in sorted(td_path.glob("page-*.png")):
            r = subprocess.run(
                ["tesseract", str(png), "-", "-l", "hrv+eng", "--psm", "1"],
                check=True, capture_output=True, timeout=120,
            )
            full.append(r.stdout.decode("utf-8", errors="ignore"))
        return "\n\n".join(full)


_WS = re.compile(r"[ \t]+")
_PARA = re.compile(r"\n{3,}")


def clean(text: str) -> str:
    text = _WS.sub(" ", text)
    text = _PARA.sub("\n\n", text)
    return text.strip()


def chunk(text: str, min_chars: int, max_chars: int) -> list[str]:
    """Greedy paragraph-aware chunker."""
    out: list[str] = []
    buf: list[str] = []
    size = 0
    for para in text.split("\n\n"):
        if size + len(para) > max_chars and size >= min_chars:
            out.append("\n\n".join(buf))
            buf = [para]
            size = len(para)
        else:
            buf.append(para)
            size += len(para) + 2
    if buf:
        out.append("\n\n".join(buf))
    # Drop anything below the floor; likely garbage from page headers.
    return [c for c in out if len(c) >= min_chars]


def fingerprint(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()[:12]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    args = ap.parse_args()
    cfg = load_config(args.config)
    tb_cfg = cfg["textbooks"]
    input_dir = Path(tb_cfg["input_dir"])
    out_path = RAW_DIR / "textbooks.jsonl"
    if out_path.exists():
        out_path.unlink()
    if not input_dir.exists():
        log.info("no textbooks directory at %s — skipping", input_dir)
        return 0

    pdfs = sorted([p for p in input_dir.rglob("*.pdf")])
    if not pdfs:
        log.info("no PDFs in %s — skipping", input_dir)
        return 0

    total_chunks = 0
    for pdf in tqdm(pdfs, desc="pdfs", unit="pdf"):
        try:
            text, pages = pypdf_text(pdf)
        except Exception as e:
            log.warning("pypdf failed on %s: %s", pdf.name, e)
            text, pages = "", 0

        needs_ocr = tb_cfg["ocr_fallback"] and (not text.strip() or len(text) < 100 * max(pages, 1))
        if needs_ocr:
            log.info("OCR fallback for %s", pdf.name)
            try:
                text = ocr_text(pdf)
            except Exception as e:
                log.warning("OCR failed on %s: %s", pdf.name, e)
                continue

        text = clean(text)
        if len(text) < tb_cfg["min_chunk_chars"]:
            log.info("skipping %s — too little text after cleaning", pdf.name)
            continue

        fp = fingerprint(pdf)
        chunks = chunk(text, tb_cfg["min_chunk_chars"], tb_cfg["max_chunk_chars"])
        rows = [
            RawDoc(
                source="textbook",
                source_id=f"{fp}#{i}",
                title=f"{pdf.stem} (ch. {i+1}/{len(chunks)})",
                text=c,
                lang="hr",
                metadata={
                    "filename": pdf.name,
                    "chunk_index": i,
                    "chunk_count": len(chunks),
                    "pages": pages,
                },
            ).to_dict()
            for i, c in enumerate(chunks)
        ]
        total_chunks += write_jsonl(out_path, rows)

    log.info("ingested %d textbook chunks to %s", total_chunks, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
