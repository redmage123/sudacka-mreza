#!/usr/bin/env python3
"""
Pull the Sudačka Mreža CMS corpus into JSONL.

Output: data/raw/db_court_decisions.jsonl  (Croatian + ECHR + VSRH decisions)
        data/raw/db_laws.jsonl             (statutes, if any rows have text)

Each row is a RawDoc (see common.py). Full court text is pulled from
full_text_plain where present; decisions without plain text are skipped
rather than dragged through jsonb conversion — they usually need OCR or
haven't been ingested cleanly and would poison training.

Run from the Toronto server (fast, DB is local) or any host with an SSH
tunnel open on the DB port. Reads connection info from config.yaml.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RawDoc, RAW_DIR, get_logger, load_config, write_jsonl  # noqa: E402

log = get_logger("pull-db")


DECISIONS_SQL = """
SELECT cd.id, cd.title, cd.case_number, cd.decision_type, cd.date,
       cd.full_text_plain, cd.summary, cd.category, cd.lang,
       cd.ecli, cd.celex, cd.external_url, c.name AS court_name
FROM court_decisions cd
LEFT JOIN courts c ON c.id = cd.court_id
WHERE cd.full_text_plain IS NOT NULL
  AND length(cd.full_text_plain) >= 400
ORDER BY cd.id
"""

LAWS_SQL = """
SELECT l.id, l.title, l.type, l.year, l.description, l.full_text,
       l.category, l.lang, l.external_url, l.effective_date
FROM laws l
WHERE l.full_text IS NOT NULL
ORDER BY l.id
"""


def connect(cfg: dict) -> psycopg.Connection:
    db = cfg["db"]
    password = db.get("password") or os.environ.get("POSTGRES_PASSWORD", "")
    if not password:
        # This is the deploy default set in docker-compose; fine for local use.
        password = "Sudacka2026!SecureDB"
    return psycopg.connect(
        host=db["host"], port=db["port"], user=db["user"],
        dbname=db["name"], password=password, autocommit=True,
    )


def pull_decisions(conn: psycopg.Connection, out_path: Path) -> int:
    if out_path.exists():
        out_path.unlink()
    n = 0
    with conn.cursor() as cur:
        cur.execute(DECISIONS_SQL)
        rows = []
        for r in tqdm(cur, desc="court_decisions", unit="row"):
            (_id, title, case_number, decision_type, date,
             full_text_plain, summary, category, lang,
             ecli, celex, external_url, court_name) = r

            # Inject a short header so the LLM knows what it's reading.
            header_lines = []
            if court_name:
                header_lines.append(f"Sud: {court_name}")
            if case_number:
                header_lines.append(f"Poslovni broj: {case_number}")
            if date:
                header_lines.append(f"Datum: {date.date().isoformat()}")
            if decision_type:
                header_lines.append(f"Vrsta odluke: {decision_type}")
            if ecli:
                header_lines.append(f"ECLI: {ecli}")
            if celex:
                header_lines.append(f"CELEX: {celex}")
            header = "\n".join(header_lines)

            text = header + ("\n\n" if header else "") + (full_text_plain or "")

            # Choose a meaningful human title; fall back to case+court.
            safe_title = title or f"{court_name or 'Sudska odluka'} — {case_number or _id}"

            doc = RawDoc(
                source="db.court_decisions",
                source_id=f"cd:{_id}",
                title=safe_title,
                text=text,
                lang=str(lang or "hr"),
                metadata={
                    "court_name": court_name,
                    "case_number": case_number,
                    "decision_type": str(decision_type) if decision_type else None,
                    "date": date.date().isoformat() if date else None,
                    "summary": summary,
                    "category": category,
                    "ecli": ecli,
                    "celex": celex,
                    "external_url": external_url,
                },
            )
            rows.append(doc.to_dict())
            if len(rows) >= 200:
                n += write_jsonl(out_path, rows)
                rows.clear()
        if rows:
            n += write_jsonl(out_path, rows)
    return n


def pull_laws(conn: psycopg.Connection, out_path: Path) -> int:
    if out_path.exists():
        out_path.unlink()
    n = 0
    with conn.cursor() as cur:
        cur.execute(LAWS_SQL)
        rows: list[dict] = []
        for r in cur:
            (_id, title, type_, year, description, full_text_jsonb,
             category, lang, external_url, effective_date) = r
            # The DB stores law text as Lexical JSON; we only want the plain
            # paragraphs. If it's a string-ish JSON already, keep it.
            text = _flatten_lexical(full_text_jsonb) if isinstance(full_text_jsonb, (dict, list)) else str(full_text_jsonb)
            if not text or len(text) < 400:
                continue
            doc = RawDoc(
                source="db.laws",
                source_id=f"law:{_id}",
                title=title or f"Zakon {_id}",
                text=text,
                lang=str(lang or "hr"),
                metadata={
                    "type": str(type_) if type_ else None,
                    "year": int(year) if year is not None else None,
                    "description": description,
                    "category": category,
                    "external_url": external_url,
                    "effective_date": effective_date.date().isoformat() if effective_date else None,
                },
            )
            rows.append(doc.to_dict())
        if rows:
            n += write_jsonl(out_path, rows)
    return n


def _flatten_lexical(node) -> str:
    """Very forgiving Lexical JSON walker — stitches all text fragments."""
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        if "text" in node and isinstance(node["text"], str):
            return node["text"]
        if "children" in node:
            return "\n".join(_flatten_lexical(c) for c in node["children"])
        return ""
    if isinstance(node, list):
        return "\n".join(_flatten_lexical(c) for c in node)
    return ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--only", choices=["decisions", "laws"], default=None)
    args = ap.parse_args()

    cfg = load_config(args.config)
    conn = connect(cfg)
    log.info("connected to db %s@%s:%s/%s", cfg["db"]["user"], cfg["db"]["host"], cfg["db"]["port"], cfg["db"]["name"])

    if args.only in (None, "decisions"):
        out = RAW_DIR / "db_court_decisions.jsonl"
        n = pull_decisions(conn, out)
        log.info("wrote %d decisions to %s", n, out)
    if args.only in (None, "laws"):
        out = RAW_DIR / "db_laws.jsonl"
        n = pull_laws(conn, out)
        log.info("wrote %d laws to %s", n, out)

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
