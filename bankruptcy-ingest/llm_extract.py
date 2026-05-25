"""LLM-based field extraction from bankruptcy-form text using Gemma 4."""
from __future__ import annotations

import json
import logging
import os
import re

import httpx

log = logging.getLogger(__name__)

LLM_ENDPOINT = os.environ.get("LLM_ENDPOINT", "http://176.9.99.103:11434/v1/chat/completions")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemma-4-26b-a4b")
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "120"))

SYSTEM_PROMPT = """You extract structured bankruptcy listing fields from Croatian legal form text.

Return STRICT JSON matching this schema — no prose, no markdown fences:
{
  "case_number": string|null,           // "Broj predmeta" e.g. "St-1234/2025"
  "debtor_name": string|null,           // "Stečajni dužnik" (company or person name)
  "debtor_oib": string|null,            // 11-digit OIB tax ID
  "court_name": string|null,            // "Sud" e.g. "Trgovački sud u Zagrebu"
  "administrator_name": string|null,    // "Stečajni upravitelj" (trustee's full name)
  "deadline": string|null,              // "Rok za ponudu" as YYYY-MM-DD
  "auction_date": string|null,          // "Datum dražbe" as YYYY-MM-DD
  "value_eur": number|null,             // numeric value in EUR
  "value_raw": string|null,             // the value text as shown (e.g. "84.300,00 EUR")
  "assets_description": string|null,    // free-text description of assets
  "contact_email": string|null,         // administrator's email
  "contact_phone": string|null,         // administrator's phone
  "address": string|null,               // asset location or administrator address
  "confidence": number                  // 0.0-1.0, your confidence in the extraction
}

Rules:
- Croatian dates like "06.05.2026." → "2026-05-06"
- Monetary values like "84.300,00 EUR" → value_eur: 84300.00, value_raw: "84.300,00 EUR"
- Set fields to null if not present or unclear
- confidence should reflect how many fields you extracted and how certain you are
- Output ONLY the JSON object, no other text"""


async def extract_fields(form_text: str) -> dict:
    """Call Gemma 4 to extract structured fields from a bankruptcy form text."""
    if not form_text or len(form_text.strip()) < 20:
        return {"confidence": 0.0, "error": "input too short"}

    # Cap input to avoid blowing past context window
    truncated = form_text[:15000]

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Extract fields from this bankruptcy form:\n\n{truncated}"},
        ],
        "stream": False,
        "temperature": 0.1,  # low temp for structured extraction
        "max_tokens": 1500,
    }

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post(LLM_ENDPOINT, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        log.error("LLM request failed: %s", e)
        return {"confidence": 0.0, "error": f"llm_request_failed: {e}"}

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        return {"confidence": 0.0, "error": "llm_empty_response"}

    # Parse JSON out of the response (strip fences just in case)
    cleaned = content.strip()
    if cleaned.startswith("```"):
        # remove code fence
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    # LLM sometimes includes a trailing closing brace mismatch or extra text — extract {...}
    m = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if m:
        cleaned = m.group(0)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        log.error("LLM returned invalid JSON: %s\nRaw: %r", e, content[:500])
        return {"confidence": 0.0, "error": "llm_invalid_json", "raw": content[:500]}

    # Sanity clamp confidence
    conf = parsed.get("confidence", 0.5)
    if not isinstance(conf, (int, float)):
        conf = 0.5
    parsed["confidence"] = max(0.0, min(1.0, float(conf)))

    return parsed
