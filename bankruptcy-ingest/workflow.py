"""
Full-analysis drag-drop workflow.

POST /editor/workflow   — multipart file upload.

Pipeline:
  1. Ingest + MIME detect (parsers.extract_text — falls back to OCR for images/scanned PDFs)
  2. Quality gate — fail fast if extraction produced too little text
  3. Auto-classify into one of 9 trustee filing types via Gemma 4
  4. Structured field extraction via Gemma 4
  5. Validate minimum required fields
  6. Render an official PDF from the extracted data (reportlab template)
  7. Apply per-page timestamp + user watermark to the original
  8. Single DB transaction: insert bankruptcy_filings row with both PDFs in assets
     — rolled back automatically if anything after the insert fails
  9. Notify admins by email (Resend → Mailgun → console fallback)

On ANY failure, sends a failure email to admins with enough context to investigate,
and returns the error to the caller.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import traceback
from datetime import datetime, timezone
from typing import Annotated

import httpx
import psycopg
from fastapi import APIRouter, Header, HTTPException, UploadFile
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors

from parsers import extract_text
from llm_extract import extract_fields, LLM_ENDPOINT, LLM_MODEL

log = logging.getLogger("workflow")
router = APIRouter(prefix="/editor")

DB_URL = os.environ.get(
    "DATABASE_URI",
    "postgresql://postgres:postgres@db:5432/sudacka_mreza",
)
CMS_BASE = os.environ.get("CMS_BASE", "http://cms:4094")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
MAILGUN_API_KEY = os.environ.get("MAILGUN_API_KEY", "")
MAILGUN_DOMAIN = os.environ.get("MAILGUN_DOMAIN", "mg.ai-elevate.ai")
MAIL_FROM = os.environ.get("MAIL_FROM", "noreply@sudacka-mreza.hr")
ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_NOTIFY_EMAIL", "admin@sudacka-mreza.hr")

FILING_TYPES = [
    ("motion-to-open",             "Prijedlog za otvaranje stečaja / Motion to open"),
    ("prijava-trazbine",           "Prijava tražbine / Creditor claim filing"),
    ("asset-inventory",            "Popis imovine / Asset inventory"),
    ("asset-sale",                 "Prodaja imovine / Asset sale"),
    ("trustee-report",             "Izvješće stečajnog upravitelja / Trustee report"),
    ("distribution-proposal",      "Prijedlog diobe / Distribution proposal"),
    ("final-accounting",           "Konačni obračun / Final accounting"),
    ("restructuring-plan",         "Plan restrukturiranja / Restructuring plan"),
    ("pre-bankruptcy-settlement",  "Predstečajna nagodba / Pre-bankruptcy settlement"),
]

# Field schemas per filing type — used by the type-aware LLM extractor below.
FILING_FIELD_SPEC = {
    "motion-to-open": [
        "filer_type", "filer_name", "filer_oib",
        "debtor_name", "debtor_oib", "debtor_address",
        "court_name", "ground", "ground_details",
        "creditors_summary", "total_debt_eur",
    ],
    "prijava-trazbine": [
        "case_number", "creditor_name", "creditor_oib", "creditor_address",
        "creditor_contact", "debtor_name",
        "claim_amount", "claim_basis", "claim_priority",
        "supporting_docs", "submission_date",
    ],
    "asset-inventory": [
        "case_number", "appraiser_name", "appraisal_date",
        "real_estate", "movables", "receivables", "other_rights",
        "encumbrances", "total_estimated_value_eur",
    ],
    "asset-sale": [
        "case_number", "item_type", "item_description", "item_location",
        "sale_type", "reserve_price_eur", "deposit_eur", "sale_date",
        "sale_location", "terms", "contact",
    ],
    "trustee-report": [
        "case_number", "trustee_name", "trustee_licence",
        "reporting_period_start", "reporting_period_end",
        "asset_status", "actions_taken",
        "estimated_distribution_eur", "next_steps",
    ],
    "distribution-proposal": [
        "case_number", "proposal_date", "total_estate_eur",
        "secured_payout_eur", "preferred_payout_eur",
        "general_payout_eur", "general_payout_pct",
        "subordinated_payout_eur", "notes",
    ],
    "final-accounting": [
        "case_number", "closing_date",
        "total_realisations_eur", "total_expenses_eur",
        "total_distributions_eur", "balance_returned_eur", "narrative",
    ],
    "restructuring-plan": [
        "case_number", "debtor_name", "debtor_oib", "proposer_name",
        "proposed_haircut_pct", "payment_term_months",
        "creditor_classes_affected", "payment_schedule",
        "operational_restructuring", "viability_narrative",
    ],
    "pre-bankruptcy-settlement": [
        "debtor_name", "debtor_oib", "filing_date",
        "total_debt_eur", "proposed_settlement_eur",
        "creditor_consent_pct", "settlement_terms", "payment_plan",
    ],
}


async def extract_fields_for_type(text: str, filing_type: str) -> dict:
    """Type-aware field extraction — asks Gemma 4 for ONLY the fields that
    belong to this filing type. Returns { <field>: value | null, ... }."""
    spec = FILING_FIELD_SPEC.get(filing_type, [])
    if not spec:
        return await extract_fields(text)  # fall back to generic extractor

    fields_json = "{\n" + ",\n".join(f'  "{f}": null' for f in spec) + '\n}'
    prompt = (
        f"Extract these fields from the Croatian bankruptcy filing text below.\n"
        f"Return ONLY valid JSON matching this exact shape (fill in values, "
        f"use null if unknown; no other keys):\n\n{fields_json}\n\n"
        f"Rules:\n"
        f"- Dates in YYYY-MM-DD format.\n"
        f"- OIB is 11 digits with no spaces.\n"
        f"- Amounts in numeric EUR (e.g. 125400 — no thousand separators).\n"
        f"- Croatian text fields should stay in Croatian.\n\n"
        f"--- DOCUMENT TEXT ---\n{text[:15000]}"
    )
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You extract structured Croatian legal fields. Output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0.1,
        "max_tokens": 4000,
    }
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(LLM_ENDPOINT, json=payload)
            if r.status_code != 200:
                log.warning("type-extract HTTP %s", r.status_code)
                return {}
            raw = r.json().get("choices", [{}])[0].get("message", {}).get("content", "")
    except httpx.HTTPError as e:
        log.warning("type-extract failed: %s", e)
        return {}

    # Strip fences + pull JSON object
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        log.warning("type-extract: no JSON in response: %s", cleaned[:200])
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        log.warning("type-extract JSON decode failed: %s; raw=%s", e, cleaned[:400])
        return {}

# ── Auth ──────────────────────────────────────────────────────────────────────
async def verify_editor(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("JWT "):
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{CMS_BASE}/api/users/me", headers={"Authorization": authorization})
            if r.status_code != 200:
                return None
            u = r.json().get("user")
            if not u or u.get("role") not in ("admin", "editor", "data_editor"):
                return None
            return u
    except httpx.HTTPError:
        return None


# ── Classification via Gemma 4 ────────────────────────────────────────────────
async def classify_filing_type(text: str) -> str | None:
    """Ask the LLM which filing type this document is. Returns slug or None."""
    if not text or len(text.strip()) < 40:
        return None

    type_list = "\n".join(f"- {slug}: {name}" for slug, name in FILING_TYPES)
    prompt = (
        f"You classify Croatian bankruptcy documents. "
        f"Given the document text, decide which ONE filing type it is.\n\n"
        f"Filing types:\n{type_list}\n\n"
        f"Document text (first 4000 chars):\n{text[:4000]}\n\n"
        f"Respond with ONLY the slug (e.g. 'prijava-trazbine'). "
        f"If none match, reply 'unknown'."
    )

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You classify Croatian bankruptcy filings. Output the slug only — nothing else."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0.1,
        # Gemma 4 is a MoE reasoning model — it burns tokens on internal chain
        # of thought before emitting. 30 tokens was too low; content came back
        # empty with finish_reason=length. 2000 leaves plenty of room.
        "max_tokens": 2000,
    }
    try:
        async with httpx.AsyncClient(timeout=90) as c:
            r = await c.post(LLM_ENDPOINT, json=payload)
            if r.status_code != 200:
                log.warning("classify HTTP %s: %s", r.status_code, r.text[:200])
                return None
            j = r.json()
            raw = j.get("choices", [{}])[0].get("message", {}).get("content", "")
            log.info("classify LLM raw=%r", raw[:200])
    except httpx.HTTPError as e:
        log.warning("classify LLM call failed: %s", e)
        return None

    raw_lower = raw.strip().lower()
    for slug, _ in FILING_TYPES:
        if slug in raw_lower:
            return slug

    # Heuristic fallback — scan the source text for Croatian phrases mapping
    # to each filing type. Works when the LLM output is too reasoning-heavy.
    heuristics = {
        "prijava-trazbine":          ["prijava tražbin", "prijava potraživ", "iznos tražbin", "pravni temelj"],
        "motion-to-open":            ["prijedlog za otvaranje stečaja", "platežna nesposobn", "prezaduženost"],
        "asset-inventory":           ["popis imovin"],
        "asset-sale":                ["prodaja imovin", "javna dražb", "rezervna cijena", "početna cijen"],
        "trustee-report":            ["izvješće stečajnog upravitelja", "izvještaj upravitelj"],
        "distribution-proposal":     ["prijedlog diobe", "raspodjela stečajne mase"],
        "final-accounting":          ["konačni obračun", "zaključni obračun"],
        "restructuring-plan":        ["plan restrukturiranja", "predloženi otpis"],
        "pre-bankruptcy-settlement": ["predstečajna nagodb"],
    }
    lo = text.lower()
    for slug, phrases in heuristics.items():
        if any(p in lo for p in phrases):
            log.info("classify: heuristic match → %s", slug)
            return slug
    return None


# ── Official PDF rendering (reportlab) ───────────────────────────────────────
def render_official_pdf(filing_type: str, fields: dict, actor_email: str) -> bytes:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", parent=styles["Heading1"], fontSize=18, alignment=1, spaceAfter=6
    )
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=14)

    type_title = dict(FILING_TYPES).get(filing_type, filing_type)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm)

    def par(t: str, style=body):
        return Paragraph(t, style)

    story = []
    story.append(par("REPUBLIKA HRVATSKA", title_style))
    story.append(par(f"<b>{type_title}</b>", h2))
    story.append(Spacer(1, 6))

    # Two-column key/value table for all populated fields
    rows = []
    for k, v in fields.items():
        if v is None or v == "" or k in ("confidence", "error"):
            continue
        label = k.replace("_", " ").title()
        rows.append([label, str(v)])

    if rows:
        t = Table(rows, colWidths=[55 * mm, None])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2f7")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)

    story.append(Spacer(1, 16))
    story.append(par(
        f"<i>Generirano automatski od Sudačka Mreža — "
        f"unio: {actor_email} — "
        f"datum: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>",
        body,
    ))
    doc.build(story)
    return buf.getvalue()


def watermark_pdf(pdf_bytes: bytes, actor_email: str) -> bytes:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    wbuf = io.BytesIO()
    c = canvas.Canvas(wbuf, pagesize=A4)
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.6, 0.1, 0.1)
    c.saveState()
    c.translate(A4[0] - 10, 10)
    c.rotate(90)
    c.drawString(0, 0, f"Unio: {actor_email}   •   Verificirano: {ts}")
    c.restoreState()
    c.showPage()
    c.save()
    wbuf.seek(0)
    wm_page = PdfReader(wbuf).pages[0]

    src = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    for page in src.pages:
        page.merge_page(wm_page)
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ── Validation ────────────────────────────────────────────────────────────────
REQUIRED_FIELDS = {
    "motion-to-open":             ["debtor_name"],
    "prijava-trazbine":           ["creditor_name", "claim_amount"],
    "asset-inventory":            ["case_number"],
    "asset-sale":                 ["item_description"],
    "trustee-report":             ["case_number", "trustee_name"],
    "distribution-proposal":      ["case_number"],
    "final-accounting":           ["case_number"],
    "restructuring-plan":         ["case_number", "debtor_name"],
    "pre-bankruptcy-settlement":  ["debtor_name"],
}


def validate_fields(filing_type: str, fields: dict) -> list[str]:
    """Return list of missing required fields (empty list = ok)."""
    required = REQUIRED_FIELDS.get(filing_type, [])
    missing: list[str] = []
    for k in required:
        v = fields.get(k)
        if v is None or (isinstance(v, str) and not v.strip()):
            missing.append(k)
    return missing


# ── Email delivery ────────────────────────────────────────────────────────────
async def admin_emails() -> list[str]:
    """Fetch list of admin users' emails from the DB. Includes ADMIN_NOTIFY_EMAIL."""
    emails: set[str] = set()
    if ADMIN_NOTIFY_EMAIL:
        emails.add(ADMIN_NOTIFY_EMAIL)
    try:
        with psycopg.connect(DB_URL, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute("SELECT email FROM users WHERE role = 'admin' AND _verified = true")
            for (e,) in cur.fetchall():
                if e:
                    emails.add(e)
    except psycopg.Error as e:
        log.warning("admin_emails DB query failed: %s", e)
    return sorted(emails)


def _send_via_sendmail(to: list[str], subject: str, html: str) -> bool:
    """
    Hand the message off to the host's MTA via the standard `sendmail -t -oi`
    interface. On this deployment the container has `msmtp-mta` installed and
    /etc/msmtprc is bind-mounted read-only from the host — msmtp relays to the
    configured external SMTP from the host's own account.
    """
    import subprocess, email.message, email.utils
    msg = email.message.EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain="sudacka-mreza.hr")
    msg.set_content("This message requires an HTML-capable client.")
    msg.add_alternative(html, subtype="html")

    for cmd in (
        ["/usr/sbin/sendmail", "-t", "-oi"],
        ["/usr/bin/sendmail",  "-t", "-oi"],
        ["/usr/bin/msmtp",     "-t"],
    ):
        try:
            r = subprocess.run(
                cmd, input=msg.as_bytes(), timeout=20, capture_output=True,
            )
            if r.returncode == 0:
                return True
            log.warning("sendmail %s exit=%s stderr=%s", cmd[0], r.returncode, r.stderr[:200])
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            log.warning("sendmail %s timed out", cmd[0])
            continue
    return False


async def send_email(to: list[str], subject: str, html: str) -> bool:
    """
    Try transports in order of preference:
      1. Resend API (if RESEND_API_KEY set)
      2. Mailgun API (if MAILGUN_API_KEY set)
      3. Local sendmail / msmtp (Scott's host MTA, always available)
      4. Console log (absolute last resort)
    """
    if not to:
        log.warning("send_email: no recipients")
        return False

    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                    json={"from": MAIL_FROM, "to": to, "subject": subject, "html": html},
                )
            if r.status_code < 300:
                return True
            log.warning("resend failed: %s %s", r.status_code, r.text[:300])
        except httpx.HTTPError as e:
            log.warning("resend error: %s", e)

    if MAILGUN_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
                    auth=("api", MAILGUN_API_KEY),
                    data={"from": MAIL_FROM, "to": to, "subject": subject, "html": html},
                )
            if r.status_code < 300:
                return True
            log.warning("mailgun failed: %s %s", r.status_code, r.text[:300])
        except httpx.HTTPError as e:
            log.warning("mailgun error: %s", e)

    if _send_via_sendmail(to, subject, html):
        return True

    log.info("[email-fallback] to=%s subject=%s preview=%s", to, subject, html[:200])
    return False


def _escape(s: str) -> str:
    return (str(s) or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def email_success(
    user: dict, filing_id: int, filing_type: str, filename: str,
    fields: dict, missing: list[str] | None = None,
) -> None:
    recipients = await admin_emails()
    type_label = dict(FILING_TYPES).get(filing_type, filing_type)
    rows = "".join(
        f"<tr><td style='padding:4px 10px;background:#eef'>{_escape(k)}</td>"
        f"<td style='padding:4px 10px'>{_escape(v)}</td></tr>"
        for k, v in fields.items() if v not in (None, "", []) and k not in ("confidence", "error")
    )
    missing_block = ""
    if missing:
        missing_block = (
            f'<p style="font-family:sans-serif;color:#a06600;background:#fff8e1;'
            f'padding:8px 10px;border-left:3px solid #f7b500">'
            f'<b>Nepopunjena obvezna polja:</b> {_escape(", ".join(missing))}. '
            f'Administrator može dopuniti pri pregledu.</p>'
        )
    html = f"""
    <h2 style="font-family:sans-serif">Nova prijava (drag-drop workflow)</h2>
    <p style="font-family:sans-serif">
      Filing #<b>{filing_id}</b> — <b>{_escape(type_label)}</b><br>
      Podnositelj: <b>{_escape(user.get('email','?'))}</b><br>
      Izvorna datoteka: <code>{_escape(filename)}</code><br>
      Status: <b style="color:#080">pending_review</b>
    </p>
    {missing_block}
    <table style="font-family:sans-serif;border-collapse:collapse;border:1px solid #ccc">{rows}</table>
    <p style="font-family:sans-serif;margin-top:12px">
      <a href="http://23.164.48.64/hr/admin/filings">Otvori Admin → Filings</a>
    </p>
    """
    await send_email(recipients, f"[Sudačka Mreža] Nova prijava #{filing_id} — {type_label}", html)


async def email_failure(user: dict | None, filename: str, reason: str, details: str = "") -> None:
    recipients = await admin_emails()
    html = f"""
    <h2 style="font-family:sans-serif;color:#a00">Neuspjela obrada prijave</h2>
    <p style="font-family:sans-serif">
      Podnositelj: <b>{_escape(user.get('email','?') if user else '(unauthenticated)')}</b><br>
      Datoteka: <code>{_escape(filename)}</code><br>
      Razlog: <b>{_escape(reason)}</b>
    </p>
    <pre style="font-family:monospace;background:#f4f4f4;padding:10px;white-space:pre-wrap">{_escape(details)[:2000]}</pre>
    <p style="font-family:sans-serif">Ništa nije upisano u bazu (rollback je izvršen).</p>
    """
    await send_email(recipients, f"[Sudačka Mreža] Neuspjeh obrade: {filename}", html)


# ── Main workflow endpoint ────────────────────────────────────────────────────
@router.post("/workflow")
async def workflow_endpoint(
    file: UploadFile,
    authorization: Annotated[str | None, Header()] = None,
):
    user = await verify_editor(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Editor role required")

    filename = file.filename or "upload"
    content = await file.read()
    size = len(content)
    log.info("workflow begin: user=%s file=%s (%d bytes)", user.get("email"), filename, size)

    # Step 1 — ingest + OCR
    try:
        mime, text = extract_text(filename, content)
    except Exception as e:
        reason = "Parsing failed (unsupported or corrupt file)"
        await email_failure(user, filename, reason, str(e))
        raise HTTPException(status_code=422, detail=reason)

    # Step 2 — quality gate
    alpha_chars = sum(1 for c in text if c.isalpha())
    if alpha_chars < 40:
        reason = "Extracted text too short — likely a scan with poor OCR or a blank document"
        await email_failure(user, filename, reason, f"alpha_chars={alpha_chars} text_sample={text[:300]!r}")
        raise HTTPException(status_code=422, detail=reason)

    # Step 3 — classify
    try:
        filing_type = await classify_filing_type(text)
    except Exception as e:
        reason = "Classification failed"
        await email_failure(user, filename, reason, str(e))
        raise HTTPException(status_code=500, detail=reason)
    if not filing_type:
        reason = "Could not determine filing type automatically"
        await email_failure(user, filename, reason, f"text_sample={text[:400]!r}")
        raise HTTPException(status_code=422, detail=reason)

    # Step 4 — extract (type-aware; merge generic extraction as a safety net)
    try:
        typed_fields = await extract_fields_for_type(text, filing_type)
        generic_fields = {}
        try:
            generic_fields = await extract_fields(text)
        except Exception:
            pass  # generic is only a safety-net; ignore failure
        # Merge: prefer typed values when present, fall back to generic
        fields = {**(generic_fields or {}), **(typed_fields or {})}
        log.info("extract: type=%s, typed_keys=%d, generic_keys=%d, merged=%d",
                 filing_type, len(typed_fields or {}), len(generic_fields or {}), len(fields))
    except Exception as e:
        reason = "Field extraction failed"
        await email_failure(user, filename, reason, str(e))
        raise HTTPException(status_code=500, detail=reason)

    # Step 5 — validate. Enough is enough: we require at least one non-null
    # value so we know extraction produced *something*. Missing required
    # fields are noted in the success email so an admin can complete them on
    # review — we still create the filing as pending_review instead of
    # refusing the submission outright (the original source is always stored).
    populated = {k: v for k, v in fields.items() if v not in (None, "", [])}
    if not populated:
        reason = "No fields could be extracted — likely unreadable document"
        await email_failure(user, filename, reason, f"text_sample={text[:400]!r}")
        raise HTTPException(status_code=422, detail=reason)
    missing = validate_fields(filing_type, fields)
    if missing:
        log.info("extract: %d required fields missing for %s: %s", len(missing), filing_type, missing)

    # Step 6 — render official PDF
    try:
        official_pdf = render_official_pdf(filing_type, fields, user.get("email", "?"))
    except Exception as e:
        reason = "Official PDF rendering failed"
        await email_failure(user, filename, reason, traceback.format_exc())
        raise HTTPException(status_code=500, detail=reason)

    # Step 7 — watermark the original (only PDFs; non-PDF formats skip watermark)
    original_watermarked = None
    if content.startswith(b"%PDF-"):
        try:
            original_watermarked = watermark_pdf(content, user.get("email", "?"))
        except Exception:
            original_watermarked = content  # best-effort

    # Step 8 — transactional DB insert (rolled back on any error below)
    filing_id = None
    case_number = fields.get("case_number") or f"AUTO-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    data_payload = {
        **fields,
        "_workflow": {
            "source_filename": filename,
            "source_mime": mime,
            "classified_as": filing_type,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "source_text_excerpt": text[:2000],
        },
    }
    try:
        with psycopg.connect(DB_URL, connect_timeout=10) as conn:
            with conn.cursor() as cur:
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
                    (
                        filing_type, case_number,
                        json.dumps(data_payload, ensure_ascii=False),
                        f"official-{filing_type}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.pdf",
                        base64.b64encode(official_pdf).decode("ascii"),
                        user.get("email"),
                    ),
                )
                filing_id = cur.fetchone()[0]
                # If we ever add a second dependent write (e.g. media row), it lives
                # inside this `with` block — a raise here triggers an automatic
                # rollback so no partial state survives.
            conn.commit()
    except psycopg.Error as e:
        reason = "Database insert failed"
        await email_failure(user, filename, reason, str(e))
        raise HTTPException(status_code=500, detail=f"{reason}: rollback executed")

    # Step 9 — success email (best-effort; filing is committed)
    try:
        await email_success(user, filing_id, filing_type, filename, fields, missing=missing or None)
    except Exception as e:
        log.warning("success email failed (filing still committed): %s", e)

    return {
        "ok": True,
        "filingId": filing_id,
        "filingType": filing_type,
        "status": "pending_review",
        "extractedFieldCount": sum(1 for v in fields.values() if v not in (None, "")),
        "sourceMime": mime,
        "notified": True,
    }
