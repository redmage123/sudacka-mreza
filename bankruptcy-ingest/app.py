"""
Bankruptcy-ingest service.

Receives inbound emails (via Mailgun webhook) from bankruptcy trustees,
extracts form fields from attachments using Gemma 4, and creates a
pending-review entry in the sudacka-mreza Payload CMS.

Endpoints:
  POST /webhook/mailgun  — Mailgun inbound route webhook
  POST /ingest/manual    — manual submission (for testing)
  GET  /health           — healthcheck
"""
from __future__ import annotations

import base64
import hmac
import hashlib
import logging
import os
from datetime import datetime, timezone

import httpx
import psycopg
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from typing import Annotated

from parsers import extract_text
from llm_extract import extract_fields

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("ingest")

app = FastAPI(title="Sudacka Mreza — Bankruptcy Ingest")

# Editor data-entry routes (PDF upload, extract, watermark, store)
from editor import router as editor_router
from workflow import router as workflow_router
app.include_router(editor_router)
app.include_router(workflow_router)

# ── Config ──────────────────────────────────────────────────────────────────
MAILGUN_SIGNING_KEY = os.environ.get("MAILGUN_SIGNING_KEY", "")  # for webhook sig verification
CMS_BASE = os.environ.get("CMS_BASE", "http://cms:4094")
CMS_API_KEY = os.environ.get("CMS_API_KEY", "")  # Payload API key with bankruptcy-listings write
DB_URL = os.environ.get(
    "DATABASE_URI",
    "postgresql://postgres:postgres@db:5432/sudacka_mreza",
)
AUTO_PUBLISH_THRESHOLD = float(os.environ.get("AUTO_PUBLISH_THRESHOLD", "0.95"))
ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL", "admin@sudacka-mreza.hr")


# ── Webhook signature verification ─────────────────────────────────────────
def verify_mailgun(token: str, timestamp: str, signature: str) -> bool:
    """HMAC-SHA256 verification for Mailgun inbound routes."""
    if not MAILGUN_SIGNING_KEY:
        log.warning("MAILGUN_SIGNING_KEY not set — skipping signature verification")
        return True  # allow through in dev; in prod this must be set
    expected = hmac.new(
        MAILGUN_SIGNING_KEY.encode(),
        msg=f"{timestamp}{token}".encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ── CMS write ───────────────────────────────────────────────────────────────
async def resolve_court_id(court_name: str | None) -> int | None:
    """Look up a court_id by name, with fuzzy fallback."""
    if not court_name:
        return None
    try:
        with psycopg.connect(DB_URL, connect_timeout=10) as conn, conn.cursor() as cur:
            # Exact match
            cur.execute("SELECT id FROM courts WHERE name = %s", (court_name,))
            row = cur.fetchone()
            if row:
                return row[0]
            # Fuzzy match via pg_trgm similarity if available
            cur.execute(
                "SELECT id FROM courts WHERE name %% %s ORDER BY similarity(name, %s) DESC LIMIT 1",
                (court_name, court_name),
            )
            row = cur.fetchone()
            if row:
                return row[0]
    except psycopg.Error as e:
        log.error("court lookup failed: %s", e)
    return None


async def create_pending_listing(
    fields: dict, raw_text: str, attachment_names: list[str], sender: str, subject: str
) -> dict:
    """Insert a new bankruptcy_listings row with status based on LLM confidence."""
    confidence = fields.get("confidence", 0.0)
    status = "active" if confidence >= AUTO_PUBLISH_THRESHOLD else "pending_review"

    # Validate required fields
    debtor_name = fields.get("debtor_name")
    case_number = fields.get("case_number") or f"INGEST-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    if not debtor_name:
        return {"ok": False, "error": "debtor_name missing — cannot create listing"}

    court_id = await resolve_court_id(fields.get("court_name"))
    if not court_id:
        # Fallback to Trgovački sud u Zagrebu (most common) and flag for review
        court_id = 117
        status = "pending_review"

    # Build assets JSONB
    assets = {
        "source": "email-ingest",
        "submitted_by": sender,
        "subject": subject,
        "attachments": attachment_names,
        "raw_extraction": fields,
        "raw_text_excerpt": raw_text[:2000],
        "confidence": confidence,
        "value_eur": fields.get("value_eur"),
        "value_raw": fields.get("value_raw"),
        "assets_description": fields.get("assets_description"),
        "auction_date": fields.get("auction_date"),
        "administrator_name": fields.get("administrator_name"),
    }

    deadline = fields.get("deadline")
    # Normalise deadline to ISO timestamp (end of day)
    deadline_sql = None
    if deadline:
        try:
            dt = datetime.strptime(deadline, "%Y-%m-%d")
            deadline_sql = dt.replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            ).isoformat()
        except ValueError:
            deadline_sql = None

    import json as _json
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
                    case_number, debtor_name, court_id, _json.dumps(assets, ensure_ascii=False),
                    deadline_sql, status,
                    fields.get("contact_email"), fields.get("contact_phone"),
                ),
            )
            new_id = cur.fetchone()[0]
            conn.commit()
        log.info(
            "Created listing id=%s case=%s status=%s conf=%.2f",
            new_id, case_number, status, confidence,
        )
        return {"ok": True, "id": new_id, "status": status, "confidence": confidence}
    except psycopg.Error as e:
        log.error("DB insert failed: %s", e)
        return {"ok": False, "error": f"db_error: {e}"}


# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Healthcheck — verifies DB reachable + LLM reachable."""
    db_ok = False
    llm_ok = False
    try:
        with psycopg.connect(DB_URL, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
            db_ok = cur.fetchone()[0] == 1
    except psycopg.Error:
        pass
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(os.environ.get("LLM_ENDPOINT", "http://176.9.99.103:11434/v1/chat/completions").replace("/v1/chat/completions", "/api/tags"))
            llm_ok = r.status_code == 200
    except httpx.HTTPError:
        pass
    return {"db": db_ok, "llm": llm_ok, "status": "ok" if (db_ok and llm_ok) else "degraded"}


@app.post("/webhook/mailgun")
async def webhook_mailgun(request: Request):
    """Receive an inbound email via Mailgun route. Mailgun sends multipart/form-data
    with fields including: sender, subject, body-plain, body-html, attachment-count,
    attachment-1, attachment-2, ... (actual files as multipart parts)."""
    form = await request.form()

    # Verify signature
    token = form.get("token", "")
    timestamp = form.get("timestamp", "")
    signature = form.get("signature", "")
    if not verify_mailgun(str(token), str(timestamp), str(signature)):
        log.warning("invalid Mailgun signature")
        raise HTTPException(status_code=401, detail="invalid signature")

    sender = str(form.get("sender") or form.get("from") or "unknown")
    subject = str(form.get("subject") or "(no subject)")
    body_plain = str(form.get("body-plain") or "")
    body_html = str(form.get("body-html") or "")

    # Collect attachments
    attachments_text = []
    attachment_names = []
    attachment_count = int(form.get("attachment-count", 0) or 0)
    for i in range(1, attachment_count + 1):
        key = f"attachment-{i}"
        if key not in form:
            continue
        upload: UploadFile = form[key]  # type: ignore
        content = await upload.read()
        filename = upload.filename or f"attachment-{i}"
        try:
            mime, text = extract_text(filename, content)
            log.info("parsed attachment %s (%s, %d chars)", filename, mime, len(text))
            attachments_text.append(f"\n\n--- attachment: {filename} ({mime}) ---\n{text}")
            attachment_names.append(filename)
        except Exception as e:
            log.error("attachment %s parse failed: %s", filename, e)
            attachment_names.append(f"{filename} (unparseable)")

    # Combine email body + attachment text for LLM
    combined = f"From: {sender}\nSubject: {subject}\n\n{body_plain}" + "".join(attachments_text)

    log.info("ingest input: %d chars from %s", len(combined), sender)

    fields = await extract_fields(combined)
    log.info("LLM extracted (conf=%.2f): %s", fields.get("confidence", 0), {k: fields.get(k) for k in ("case_number","debtor_name","court_name","deadline")})

    result = await create_pending_listing(fields, combined, attachment_names, sender, subject)

    return JSONResponse(
        {
            "accepted": True,
            "result": result,
            "extracted": fields,
        }
    )


@app.post("/ingest/manual")
async def ingest_manual(
    sender: Annotated[str, Form()],
    subject: Annotated[str, Form()] = "(manual test)",
    text: Annotated[str, Form()] = "",
    file: UploadFile | None = None,
):
    """Manual submission endpoint for testing without going through Mailgun."""
    combined = f"From: {sender}\nSubject: {subject}\n\n{text}"
    attachment_names: list[str] = []

    if file is not None:
        content = await file.read()
        filename = file.filename or "attachment"
        try:
            mime, ftext = extract_text(filename, content)
            combined += f"\n\n--- attachment: {filename} ({mime}) ---\n{ftext}"
            attachment_names.append(filename)
        except Exception as e:
            log.error("manual attachment parse failed: %s", e)
            attachment_names.append(f"{filename} (unparseable)")

    fields = await extract_fields(combined)
    result = await create_pending_listing(fields, combined, attachment_names, sender, subject)
    return {"result": result, "extracted": fields}
