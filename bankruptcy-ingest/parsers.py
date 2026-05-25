"""Attachment parsers for PDF, DOCX, image (OCR), and plain-text email bodies."""
from __future__ import annotations

import io
import logging
from pathlib import Path

import magic
import pdfplumber
import pytesseract
from docx import Document as DocxDocument
from PIL import Image

log = logging.getLogger(__name__)

# Tesseract language for Croatian + English fallback
TESSERACT_LANG = "hrv+eng"


def detect_mime(content: bytes) -> str:
    """Detect MIME type via libmagic."""
    return magic.from_buffer(content, mime=True)


def parse_pdf(content: bytes) -> str:
    """Extract text from a PDF attachment. Falls back to OCR if PDF has no text layer."""
    text_parts: list[str] = []
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
    except Exception as e:
        log.warning("pdfplumber failed: %s", e)

    combined = "\n\n".join(text_parts).strip()
    if len(combined) > 50:
        return combined

    # No extractable text — try OCR on rasterized pages (scanned PDFs)
    log.info("PDF has no text layer, attempting OCR")
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            ocr_parts = []
            for page in pdf.pages:
                # pdfplumber doesn't rasterize natively — use its page.to_image() from pdf2image
                img = page.to_image(resolution=200).original
                ocr_parts.append(pytesseract.image_to_string(img, lang=TESSERACT_LANG))
        return "\n\n".join(ocr_parts).strip()
    except Exception as e:
        log.error("OCR on PDF failed: %s", e)
        return combined


def parse_docx(content: bytes) -> str:
    """Extract text from a Word document."""
    doc = DocxDocument(io.BytesIO(content))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts).strip()


def parse_image(content: bytes) -> str:
    """OCR a scanned image (JPEG/PNG)."""
    img = Image.open(io.BytesIO(content))
    return pytesseract.image_to_string(img, lang=TESSERACT_LANG).strip()


def parse_plain(content: bytes) -> str:
    """Decode plain-text attachments."""
    for encoding in ("utf-8", "cp1250", "iso-8859-2", "latin-1"):
        try:
            return content.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace").strip()


import io
from odf.opendocument import load as odf_load
from odf.text import P
from odf.table import TableCell, TableRow, Table


def parse_odt(content: bytes) -> str:
    """Extract text from an OpenDocument Text file."""
    doc = odf_load(io.BytesIO(content))
    parts: list[str] = []
    for p in doc.getElementsByType(P):
        # odf elements have `childNodes`; get text content recursively
        text = ''.join(node.data if hasattr(node, 'data') else '' for node in p.childNodes)
        if text.strip():
            parts.append(text)
    return "\n".join(parts).strip()


def parse_ods(content: bytes) -> str:
    """Extract text from an OpenDocument Spreadsheet file."""
    doc = odf_load(io.BytesIO(content))
    parts: list[str] = []
    for table in doc.getElementsByType(Table):
        for row in table.getElementsByType(TableRow):
            cells: list[str] = []
            for cell in row.getElementsByType(TableCell):
                text = ''.join(
                    ''.join(n.data if hasattr(n, 'data') else '' for n in p.childNodes)
                    for p in cell.getElementsByType(P)
                )
                cells.append(text.strip())
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts).strip()


# parse_odp (presentations): same as parse_odt since slides are essentially text blocks
def parse_odp(content: bytes) -> str:
    return parse_odt(content)


def extract_text(filename: str, content: bytes) -> tuple[str, str]:
    """
    Return (detected_mime, extracted_text) for a single attachment.
    Dispatches to the right parser based on MIME detection or filename.
    """
    mime = detect_mime(content)
    ext = Path(filename).suffix.lower()

    # Route by MIME first, fall back to extension
    if mime == "application/pdf" or ext == ".pdf":
        return mime, parse_pdf(content)
    if mime in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",) or ext == ".docx":
        return mime, parse_docx(content)
    if mime.startswith("image/") or ext in (".jpg", ".jpeg", ".png", ".tiff", ".bmp"):
        return mime, parse_image(content)
    if mime.startswith("text/") or ext in (".txt", ".csv", ".eml"):
        return mime, parse_plain(content)

    if ext == '.odt' or mime == 'application/vnd.oasis.opendocument.text':
        return mime, parse_odt(content)
    if ext == '.ods' or mime == 'application/vnd.oasis.opendocument.spreadsheet':
        return mime, parse_ods(content)
    if ext == '.odp' or mime == 'application/vnd.oasis.opendocument.presentation':
        return mime, parse_odp(content)
    # Unknown — try text decode as last resort
    log.warning("Unknown MIME %s for %s; attempting plain-text decode", mime, filename)
    return mime, parse_plain(content)
