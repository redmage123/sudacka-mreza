"""
Editor data-entry endpoints, invoked by the React /editor UI via nginx proxy.

  POST /editor/extract    Upload a PDF, run LLM extraction, return fields
                          WITHOUT inserting anything. Used for preview/edit.
  POST /editor/finalize   Take edited fields + original PDF, apply a
                          timestamp/user watermark, upload to Payload media,
                          create bankruptcy_listing with status=pending_review,
                          return the new listing id.

The intent is to keep this Python service the single owner of PDF handling
(it already has pdfplumber/pytesseract + the LLM connection), so the React
page only orchestrates.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Annotated

import httpx
import psycopg
from fastapi import APIRouter, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from parsers import extract_text
from llm_extract import extract_fields

log = logging.getLogger("editor")
router = APIRouter(prefix="/editor")

DB_URL = os.environ.get(
    "DATABASE_URI",
    "postgresql://postgres:postgres@db:5432/sudacka_mreza",
)
CMS_BASE = os.environ.get("CMS_BASE", "http://cms:4094")
PAYLOAD_SECRET = os.environ.get("PAYLOAD_SECRET", "")


async def verify_editor_token(authorization: str | None) -> dict | None:
    """
    Verify Authorization: JWT <token> and return the user doc if role in
    {'admin', 'editor', 'data_editor'}, else None. Reuses the CMS /api/users/me
    endpoint so we don't duplicate JWT decoding here.
    """
    if not authorization or not authorization.startswith("JWT "):
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"{CMS_BASE}/api/users/me",
                headers={"Authorization": authorization},
            )
            if r.status_code != 200:
                return None
            data = r.json()
            user = data.get("user")
            if not user:
                return None
            if user.get("role") not in ("admin", "editor", "data_editor"):
                return None
            return user
    except httpx.HTTPError:
        return None


def _watermark_pdf(pdf_bytes: bytes, actor_email: str) -> bytes:
    """
    Apply a per-page timestamp+actor watermark to every page of the PDF.
    Returns the watermarked PDF as bytes.
    """
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line1 = f"Unio: {actor_email}"
    line2 = f"Verificirano: {ts}"

    # Build a single-page watermark PDF.
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.6, 0.1, 0.1)
    c.saveState()
    c.translate(A4[0] - 10, 10)
    c.rotate(90)
    c.drawString(0, 0, f"{line1}   •   {line2}")
    c.restoreState()
    c.showPage()
    c.save()
    buf.seek(0)

    wm_reader = PdfReader(buf)
    wm_page = wm_reader.pages[0]

    src = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    for page in src.pages:
        page.merge_page(wm_page)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@router.post("/extract")
async def extract_endpoint(
    file: UploadFile,
    authorization: Annotated[str | None, Header()] = None,
):
    user = await verify_editor_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Editor role required")

    content = await file.read()
    try:
        mime, text = extract_text(file.filename or "unknown", content)
    except Exception as e:
        log.error("extract parse failed: %s", e)
        raise HTTPException(status_code=422, detail=f"Unable to parse: {e}")

    fields = await extract_fields(text)
    return {
        "ok": True,
        "filename": file.filename,
        "mime": mime,
        "extractedText": text[:20000],
        "fields": fields,
        # Echo the original PDF back as base64 so the client can send the same
        # bytes to /finalize without re-uploading.
        "pdfBase64": base64.b64encode(content).decode("ascii"),
    }


@router.post("/filing")
async def filing_endpoint(
    payload: dict,
    authorization: Annotated[str | None, Header()] = None,
):
    """
    Submit a trustee filing. Body shape:
      { filingType: str, caseNumber: str|null,
        data: dict, attachmentBase64: str|null, attachmentFilename: str|null }
    Returns { ok, filingId, status }.
    """
    user = await verify_editor_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Editor role required")

    filing_type = payload.get("filingType")
    if not filing_type:
        raise HTTPException(status_code=400, detail="filingType is required")
    case_number = payload.get("caseNumber")
    data = payload.get("data") or {}
    att_b64 = payload.get("attachmentBase64")
    att_name = payload.get("attachmentFilename")

    # If an attachment was uploaded, apply a watermark before storing.
    if att_b64:
        try:
            raw = base64.b64decode(att_b64)
            # Only attempt watermarking if it parses as a PDF.
            if raw[:5] == b"%PDF-":
                raw = _watermark_pdf(raw, user.get("email") or f"user#{user['id']}")
                att_b64 = base64.b64encode(raw).decode("ascii")
        except (ValueError, Exception) as e:
            log.warning("watermark skipped for %s: %s", att_name, e)

    try:
        with psycopg.connect(DB_URL, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO bankruptcy_filings
                    (filing_type, case_number, data, attachment_filename,
                     attachment_base64, status, submitted_by,
                     published_at, updated_at, created_at)
                VALUES (%s, %s, %s::jsonb, %s, %s, 'pending_review', %s,
                        NOW(), NOW(), NOW())
                RETURNING id
                """,
                (filing_type, case_number, json.dumps(data, ensure_ascii=False),
                 att_name, att_b64, user.get("email")),
            )
            filing_id = cur.fetchone()[0]
            conn.commit()
    except psycopg.Error as e:
        log.error("filing insert failed: %s", e)
        raise HTTPException(status_code=500, detail=f"DB insert failed: {e}")

    return {"ok": True, "filingId": filing_id, "status": "pending_review"}


@router.post("/finalize")
async def finalize_endpoint(
    pdfBase64: Annotated[str, Form()],
    fieldsJson: Annotated[str, Form()],
    authorization: Annotated[str | None, Header()] = None,
):
    user = await verify_editor_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Editor role required")

    try:
        pdf_bytes = base64.b64decode(pdfBase64)
        fields = json.loads(fieldsJson)
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Bad payload: {e}")

    watermarked = _watermark_pdf(pdf_bytes, user.get("email") or f"user#{user['id']}")

    # Store the watermarked PDF bytes in the listing's assets JSONB column as
    # base64. Simpler than routing through Payload's Media collection (which
    # needs a multipart bridge that the custom Express server doesn't
    # currently provide) and keeps the PDF co-located with its extracted
    # metadata. Admins reviewing the submission can download it from the
    # CMS record.
    fname = f"bankruptcy-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_b64_out = base64.b64encode(watermarked).decode("ascii")
    media_id = None

    # Create the bankruptcy listing. Resolve court by name (best-effort).
    court_id = None
    court_name = fields.get("court_name")
    if court_name:
        try:
            with psycopg.connect(DB_URL, connect_timeout=10) as conn, conn.cursor() as cur:
                cur.execute("SELECT id FROM courts WHERE name = %s LIMIT 1", (court_name,))
                row = cur.fetchone()
                if row:
                    court_id = row[0]
                else:
                    cur.execute(
                        "SELECT id FROM courts WHERE name %% %s ORDER BY similarity(name, %s) DESC LIMIT 1",
                        (court_name, court_name),
                    )
                    row = cur.fetchone()
                    if row:
                        court_id = row[0]
        except psycopg.Error as e:
            log.warning("court lookup failed: %s", e)

    assets = {
        "source": "editor-ui",
        "submitted_by": user.get("email"),
        "watermarked_pdf_base64": pdf_b64_out,
        "watermarked_pdf_filename": fname,
        "raw_extraction": fields,
        "raw_text_excerpt": fields.get("assets_description"),
        "confidence": fields.get("confidence"),
        "value_eur": fields.get("value_eur"),
        "value_raw": fields.get("value_raw"),
        "assets_description": fields.get("assets_description"),
        "auction_date": fields.get("auction_date"),
        "administrator_name": fields.get("administrator_name"),
    }

    deadline_sql = None
    if fields.get("deadline"):
        try:
            dt = datetime.strptime(fields["deadline"], "%Y-%m-%d")
            deadline_sql = dt.replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            ).isoformat()
        except ValueError:
            deadline_sql = None

    case_number = fields.get("case_number") or (
        f"EDITOR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    debtor_name = fields.get("debtor_name") or "(unknown)"

    listing_id = None
    try:
        with psycopg.connect(DB_URL, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO bankruptcy_listings
                    (case_number, debtor_name, court_id, assets, deadline, status,
                     contact_email, contact_phone, published_at, updated_at, created_at)
                VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s, %s, NOW(), NOW(), NOW())
                RETURNING id
                """,
                (
                    case_number, debtor_name, court_id, json.dumps(assets, ensure_ascii=False),
                    deadline_sql, "pending_review",
                    fields.get("contact_email"), fields.get("contact_phone"),
                ),
            )
            listing_id = cur.fetchone()[0]
            conn.commit()
    except psycopg.Error as e:
        log.error("listing insert failed: %s", e)
        raise HTTPException(status_code=500, detail=f"DB insert failed: {e}")

    return {
        "ok": True,
        "listingId": listing_id,
        "mediaId": media_id,
        "status": "pending_review",
    }
