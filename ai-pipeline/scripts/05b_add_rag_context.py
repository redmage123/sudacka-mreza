#!/usr/bin/env python3
"""
Rewrite the flat {system,user,assistant} train/eval rows into RAG-aware
supervised examples.

Problem the first fine-tune hit:  trained on naked-question examples, so at
inference — when chat.ts prepends a `--- CONTEXT ---\n[1]...\n[N]` block —
the model either regurgitates the passages or falls into a repeat-loop.

Fix:  for each existing row, inject a small retrieval context block into the
user message and force the answer to cite `[N]`.  Rows fall into 3 buckets:

  grounded (85%)
      The original source doc's excerpt is at a random index 1..K of the
      context; 3-4 distractor excerpts fill the rest.  The assistant
      answer is prefixed with `[N] ` where N is the correct index.

  refusal (10%)
      All K excerpts are random distractors.  The answer is rewritten to
      "Na temelju priloženih izvoda nije moguće odgovoriti na ovo
       pitanje."  This teaches the model to abstain instead of
       regurgitating when retrieval misses.

  no-context (5%)
      An empty context block.  Teaches the model that "no context"
      means "answer from parametric memory, tersely".

Output:  data/instructions/train_rag.jsonl, eval_rag.jsonl
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INSTRUCTIONS_DIR, RAW_DIR, get_logger  # noqa: E402

log = get_logger("rag-ctx")

K_EXCERPTS = 5                  # total passages in each context block
EXCERPT_CHARS = 600             # per passage — keeps full context ~ 3K tokens
MIN_EXCERPT_CHARS = 120         # drop too-short distractor candidates
GROUNDED_FRAC = 0.85
REFUSAL_FRAC = 0.10
NO_CTX_FRAC = 0.05              # must sum to 1

REFUSAL_LINE = (
    "Na temelju priloženih izvoda nije moguće odgovoriti na ovo pitanje. "
    "Preporučujem konzultaciju odgovarajućeg zakonskog teksta ili stručnjaka."
)


def load_docs() -> dict[str, dict]:
    """source_id → {title, text, source_type} from every corpus + chunks file."""
    out: dict[str, dict] = {}

    # Chunks files — each chunk is a candidate excerpt keyed by source_id
    # (same source_id appears N times, one per chunk).  We keep the LONGEST
    # chunk per source_id as the canonical excerpt, and also keep a list of
    # ALL chunks under _all_chunks so distractors can sample broadly.
    all_chunks: list[dict] = []
    chunk_files = list(RAW_DIR.glob("*_chunks.jsonl")) + [RAW_DIR / "legislation_by_article_chunks.jsonl"]
    for p in chunk_files:
        if not p.exists():
            continue
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                d = json.loads(line)
                sid = d.get("source_id")
                text = (d.get("text") or "").strip()
                if not sid or len(text) < MIN_EXCERPT_CHARS:
                    continue
                all_chunks.append(d)
                if sid not in out or len(text) > len(out[sid]["text"]):
                    out[sid] = {
                        "title": d.get("title", ""),
                        "text": text,
                        "source_type": d.get("source_type", ""),
                        "author": d.get("author", ""),
                        "url": d.get("url", ""),
                    }

    # Court-decision + corpus flat files — prefer these when they exist,
    # because their text contains the full answer context (court name, date).
    for p in RAW_DIR.glob("*.jsonl"):
        if p.name.endswith("_chunks.jsonl") or p.name == "legislation_by_article_chunks.jsonl":
            continue
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                sid = d.get("source_id")
                text = (d.get("text") or "").strip()
                if not sid or len(text) < MIN_EXCERPT_CHARS:
                    continue
                # db_court_decisions holds the full body; prefer it.
                out[sid] = {
                    "title": d.get("title", ""),
                    "text": text,
                    "source_type": (d.get("metadata") or {}).get("source_type", "")
                                    or d.get("source_type", ""),
                    "author": (d.get("metadata") or {}).get("court_name", "")
                              or d.get("author", ""),
                    "url": (d.get("metadata") or {}).get("url", "")
                           or d.get("url", ""),
                }
                all_chunks.append(
                    {"source_id": sid, "text": text,
                     "title": d.get("title", ""), "source_type": out[sid]["source_type"],
                     "author": out[sid]["author"]}
                )

    log.info("loaded %d unique source docs, %d candidate chunks for distractors",
             len(out), len(all_chunks))
    out["_all_chunks"] = all_chunks  # type: ignore
    return out


def excerpt_of(doc: dict, question: str | None = None) -> str:
    """Pick up to EXCERPT_CHARS of the doc's text.

    If the question contains a case number, ECLI, or a statute article
    reference that appears inside the doc, slice around the first hit so
    the relevant line lands in the excerpt.  Otherwise take the head.
    """
    text = doc["text"]
    if len(text) <= EXCERPT_CHARS:
        return text

    if question:
        # Look for case numbers like "Ovrv-12887/2024-4" or "K-230/22"
        for m in re.finditer(r"\b[A-ZŠĐČĆŽ][a-zšđčćž]*-?\s*\d+/\d{2,4}(?:-\d+)?\b", question):
            hit = text.find(m.group(0))
            if hit >= 0:
                start = max(0, hit - 80)
                return text[start:start + EXCERPT_CHARS].strip()
        # Article references like "čl. 230" or "članak 230"
        for m in re.finditer(r"\b(?:čl\.|članak|članku|članka)\s*\d+", question, flags=re.IGNORECASE):
            hit = text.lower().find(m.group(0).lower())
            if hit >= 0:
                start = max(0, hit - 80)
                return text[start:start + EXCERPT_CHARS].strip()
    return text[:EXCERPT_CHARS].strip()


def format_passage(idx: int, doc: dict, excerpt: str) -> str:
    header: str
    st = (doc.get("source_type") or "").lower()
    if "legislation" in st or "zakon" in (doc.get("title") or "").lower():
        kind = "PROPIS"
    elif "decision" in st or "sud" in (doc.get("author") or "").lower():
        kind = "SUDSKA ODLUKA"
    elif "commentary" in st:
        kind = "KOMENTAR"
    else:
        kind = "IZVOR"
    title = doc.get("title") or ""
    author = doc.get("author") or ""
    hdr_parts = [kind + ":", title[:120]]
    if author:
        hdr_parts.append("· " + author[:80])
    return f"[{idx}] {' '.join(p for p in hdr_parts if p).strip()}\n{excerpt}"


def build_context_row(
    original_question: str,
    gold_doc: dict | None,
    distractors: list[dict],
    correct_idx: int | None,
) -> tuple[str, int | None]:
    """Return (new_user_content, correct_idx_1based_or_None)."""
    passages: list[str] = []
    slot = correct_idx  # 1-based

    # Build a list of K docs in final order.  If gold is present, place it at
    # `slot`; otherwise pure distractors.
    if gold_doc is not None and slot is not None:
        docs_in_order: list[dict] = []
        d_iter = iter(distractors)
        for i in range(1, K_EXCERPTS + 1):
            if i == slot:
                docs_in_order.append(gold_doc)
            else:
                docs_in_order.append(next(d_iter))
    else:
        docs_in_order = distractors[:K_EXCERPTS]

    for i, d in enumerate(docs_in_order, 1):
        excerpt = excerpt_of(d, original_question if i == slot else None)
        passages.append(format_passage(i, d, excerpt))

    ctx_block = "\n\n".join(passages) if passages else "(nema dostupnih izvoda)"
    new_user = (
        "--- CONTEXT ---\n"
        + ctx_block
        + "\n--- END CONTEXT ---\n\n"
        + f"Pitanje: {original_question}"
    )
    return new_user, slot


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-train", default=str(INSTRUCTIONS_DIR / "train.jsonl"))
    ap.add_argument("--in-eval", default=str(INSTRUCTIONS_DIR / "eval.jsonl"))
    ap.add_argument("--out-train", default=str(INSTRUCTIONS_DIR / "train_rag.jsonl"))
    ap.add_argument("--out-eval", default=str(INSTRUCTIONS_DIR / "eval_rag.jsonl"))
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)

    log.info("loading corpus …")
    by_id = load_docs()
    all_chunks = by_id.pop("_all_chunks")  # type: ignore
    log.info("corpus ready (%d docs, %d chunks)", len(by_id), len(all_chunks))

    def pick_distractors(exclude_sid: str | None, n: int) -> list[dict]:
        out: list[dict] = []
        seen_sids: set[str] = {exclude_sid} if exclude_sid else set()
        for _ in range(n * 4):  # sample with retry
            if len(out) >= n:
                break
            c = rng.choice(all_chunks)
            if c.get("source_id") in seen_sids:
                continue
            seen_sids.add(c.get("source_id"))
            out.append(c)
        return out

    def rewrite_split(in_path: str, out_path: str, label: str) -> None:
        n_in = n_grounded = n_refusal = n_noctx = n_skip_no_doc = 0
        with open(in_path, encoding="utf-8") as fi, open(out_path, "w", encoding="utf-8") as fo:
            for line in fi:
                row = json.loads(line)
                n_in += 1
                msgs = row["messages"]
                sys_msg = msgs[0]
                user_q = msgs[1]["content"]
                assistant = msgs[2]["content"]
                sid = row.get("source_id")
                gold = by_id.get(sid or "")

                r = rng.random()
                if r < GROUNDED_FRAC and gold is not None:
                    slot = rng.randint(1, K_EXCERPTS)
                    distractors = pick_distractors(sid, K_EXCERPTS - 1)
                    if len(distractors) < K_EXCERPTS - 1:
                        # Not enough distractors; fall back to refusal path.
                        pass
                    new_user, correct = build_context_row(user_q, gold, distractors, slot)
                    new_assistant = f"[{correct}] {assistant}"
                    n_grounded += 1
                elif r < GROUNDED_FRAC + REFUSAL_FRAC:
                    distractors = pick_distractors(sid, K_EXCERPTS)
                    if len(distractors) < K_EXCERPTS:
                        n_skip_no_doc += 1
                        continue
                    new_user, _ = build_context_row(user_q, None, distractors, None)
                    new_assistant = REFUSAL_LINE
                    n_refusal += 1
                else:
                    # No-context — just a bare question; keep the original answer.
                    new_user = user_q
                    new_assistant = assistant
                    n_noctx += 1

                out_row = {
                    "messages": [
                        sys_msg,
                        {"role": "user", "content": new_user},
                        {"role": "assistant", "content": new_assistant},
                    ],
                    "source_id": sid,
                }
                fo.write(json.dumps(out_row, ensure_ascii=False) + "\n")
        log.info("%s: %d in → %d grounded, %d refusal, %d no-ctx, %d skipped (no doc)",
                 label, n_in, n_grounded, n_refusal, n_noctx, n_skip_no_doc)

    rewrite_split(args.in_train, args.out_train, "train")
    rewrite_split(args.in_eval, args.out_eval, "eval")
    return 0


if __name__ == "__main__":
    sys.exit(main())
