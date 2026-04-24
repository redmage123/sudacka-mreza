#!/usr/bin/env python3
"""
Turn raw JSONL sources into a supervised fine-tuning dataset.

For each RawDoc we produce one or more {"messages": [...]} rows ready for
TRL's SFT trainer. Two strategies are combined:

  A. Rule-based templates
     Fast, deterministic training data that doesn't require LLM calls. We
     generate obvious Q&A pairs from metadata (e.g. "What court decided
     this case?" → metadata.court_name). These stabilise factual recall.

  B. LLM-synthesised Q&A
     We ask the already-running Gemma 4 26B on the dev server to propose
     realistic Croatian-legal questions + answers grounded in the document
     text. Temperature 0.4, strict JSON output, filter out malformed rows.

Output: data/instructions/train.jsonl
        data/instructions/eval.jsonl  (held-out split)

The script is resumable: it tracks which source_ids have already been
synthesised and skips them (unless --force).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Iterator

import httpx
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    INSTRUCTIONS_DIR, RAW_DIR, dedupe_by_id, get_logger, load_config,
    read_jsonl, write_jsonl,
)

log = get_logger("build-instructions")


# ── The shared system prompt used at training time ────────────────────────
# Keep this stable — it's what the model will come to "expect" in production.
TRAINING_SYSTEM_PROMPT = (
    "Ti si pravni asistent specijaliziran za hrvatsko i europsko pravo. "
    "Odgovaraj precizno, citiraj relevantne propise i sudske odluke kada je "
    "moguće. Ako nisi siguran, reci otvoreno da ne znaš umjesto nagađanja."
)


# ── Rule-based templates ───────────────────────────────────────────────────
# Each template returns either None or a (question, answer) tuple.

def _court_template(doc: dict) -> tuple[str, str] | None:
    md = doc.get("metadata") or {}
    court = md.get("court_name")
    case = md.get("case_number")
    if not court or not case:
        return None
    return (
        f"Koji sud je donio odluku u predmetu {case}?",
        f"Predmet {case} donesen je u {court}.",
    )


def _decision_date_template(doc: dict) -> tuple[str, str] | None:
    md = doc.get("metadata") or {}
    case = md.get("case_number")
    date = md.get("date")
    if not case or not date:
        return None
    return (
        f"Kojeg datuma je donesena odluka u predmetu {case}?",
        f"Odluka u predmetu {case} donesena je {date}.",
    )


def _ecli_template(doc: dict) -> tuple[str, str] | None:
    md = doc.get("metadata") or {}
    ecli = md.get("ecli")
    case = md.get("case_number")
    if not ecli or not case:
        return None
    return (
        f"Koji je ECLI identifikator predmeta {case}?",
        f"Predmet {case} ima ECLI: {ecli}.",
    )


def _summary_template(doc: dict) -> tuple[str, str] | None:
    md = doc.get("metadata") or {}
    summary = md.get("summary")
    case = md.get("case_number")
    if not summary or len(summary) < 30 or not case:
        return None
    return (
        f"Sažmi kratko predmet {case}.",
        summary.strip(),
    )


RULE_TEMPLATES = [_court_template, _decision_date_template, _ecli_template, _summary_template]


def apply_rule_templates(doc: dict) -> list[tuple[str, str]]:
    out = []
    for fn in RULE_TEMPLATES:
        try:
            pair = fn(doc)
            if pair:
                out.append(pair)
        except Exception as e:
            log.debug("template %s failed on %s: %s", fn.__name__, doc.get("source_id"), e)
    return out


# ── LLM synthesis ─────────────────────────────────────────────────────────

LLM_USER_TEMPLATE = """You will read a single Croatian legal document. Generate up to {n} diverse question/answer pairs that a legal professional or law student might want to learn from this document.

Rules:
- Questions must be in Croatian.
- Answers must be in Croatian, grounded ONLY in the document text — never invent case numbers, dates, or statutes that are not present.
- Avoid trivial yes/no questions; prefer reasoning, interpretation, and summarisation.
- Output a valid JSON array only, no prose around it.

Format:
[
  {{"question": "...", "answer": "..."}},
  ...
]

Document title: {title}
Document source: {source}

--- DOCUMENT BODY ---
{body}
"""


JSON_ARRAY_RE = re.compile(r"\[\s*\{.*\}\s*\]", re.DOTALL)


def llm_synthesise(client: httpx.Client, cfg: dict, doc: dict) -> list[tuple[str, str]]:
    icfg = cfg["instructions"]
    body = (doc.get("text") or "")[:12000]   # keep prompt under model ctx
    prompt = LLM_USER_TEMPLATE.format(
        n=icfg["requests_per_source"],
        title=doc.get("title", ""),
        source=doc.get("source", ""),
        body=body,
    )
    payload = {
        "model": icfg["llm_model"],
        "messages": [
            {"role": "system", "content": icfg["system_prompt"]},
            {"role": "user", "content": prompt},
        ],
        "temperature": icfg["temperature"],
        "max_tokens": icfg["max_new_tokens"],
        "stream": False,
    }
    try:
        r = client.post(icfg["llm_endpoint"], json=payload, timeout=180)
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        log.debug("LLM call failed for %s: %s", doc.get("source_id"), e)
        return []

    m = JSON_ARRAY_RE.search(content)
    if not m:
        return []
    try:
        arr = json.loads(m.group(0))
    except Exception:
        return []

    out = []
    for item in arr:
        q = str(item.get("question", "")).strip()
        a = str(item.get("answer", "")).strip()
        # Basic sanity guard: non-trivial length + distinct q/a.
        if len(q) >= 15 and len(a) >= 30 and q.lower() != a.lower():
            out.append((q, a))
    return out


# ── Output formatting ──────────────────────────────────────────────────────

def make_message_row(question: str, answer: str, source_id: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": TRAINING_SYSTEM_PROMPT},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ],
        "source_id": source_id,
    }


def load_all_raw(only_sources: list[str] | None) -> Iterator[dict]:
    for p in sorted(RAW_DIR.glob("*.jsonl")):
        for row in read_jsonl(p):
            if only_sources and row.get("source") not in only_sources:
                continue
            yield row


def load_done_source_ids() -> set[str]:
    """Scan existing instructions files for already-synthesised source_ids."""
    done: set[str] = set()
    for p in (INSTRUCTIONS_DIR / "train.jsonl", INSTRUCTIONS_DIR / "eval.jsonl"):
        if not p.exists():
            continue
        for row in read_jsonl(p):
            sid = row.get("source_id")
            if sid:
                done.add(sid)
    return done


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--sources", nargs="*", default=None,
                    help="limit to specific source names, e.g. db.court_decisions")
    ap.add_argument("--no-llm", action="store_true", help="skip LLM synthesis — rules only")
    ap.add_argument("--force", action="store_true", help="re-synthesise even if source_id is already present")
    ap.add_argument("--max-docs", type=int, default=None,
                    help="cap the number of raw docs processed (for smoke tests)")
    args = ap.parse_args()

    cfg = load_config(args.config)
    icfg = cfg["instructions"]
    holdout = float(cfg["eval"]["holdout_ratio"])

    done = set() if args.force else load_done_source_ids()
    if done:
        log.info("resuming — %d source_ids already processed", len(done))

    train_path = INSTRUCTIONS_DIR / "train.jsonl"
    eval_path = INSTRUCTIONS_DIR / "eval.jsonl"

    rng = random.Random(42)

    raw_docs = list(dedupe_by_id(load_all_raw(args.sources)))
    rng.shuffle(raw_docs)
    if args.max_docs:
        raw_docs = raw_docs[: args.max_docs]
    log.info("processing %d raw docs", len(raw_docs))

    def process_one(doc: dict) -> tuple[str, list[dict]]:
        sid = doc.get("source_id", "")
        if sid in done:
            return sid, []
        pairs: list[tuple[str, str]] = []
        pairs.extend(apply_rule_templates(doc))
        if not args.no_llm:
            # Open a short-lived client per worker to avoid sharing.
            with httpx.Client() as client:
                pairs.extend(llm_synthesise(client, cfg, doc))
        rows = [make_message_row(q, a, sid) for q, a in pairs]
        return sid, rows

    written_train = 0
    written_eval = 0

    with ThreadPoolExecutor(max_workers=icfg["parallel_workers"]) as pool:
        futures = {pool.submit(process_one, d): d for d in raw_docs}
        batch_train: list[dict] = []
        batch_eval: list[dict] = []
        for fut in tqdm(as_completed(futures), total=len(futures), desc="synth", unit="doc"):
            try:
                _sid, rows = fut.result()
            except Exception as e:
                log.debug("worker failed: %s", e)
                continue
            for row in rows:
                if rng.random() < holdout:
                    batch_eval.append(row)
                else:
                    batch_train.append(row)
            if len(batch_train) >= 200:
                written_train += write_jsonl(train_path, batch_train)
                batch_train.clear()
            if len(batch_eval) >= 50:
                written_eval += write_jsonl(eval_path, batch_eval)
                batch_eval.clear()
        if batch_train:
            written_train += write_jsonl(train_path, batch_train)
        if batch_eval:
            written_eval += write_jsonl(eval_path, batch_eval)

    log.info("wrote %d train rows and %d eval rows", written_train, written_eval)
    return 0


if __name__ == "__main__":
    sys.exit(main())
