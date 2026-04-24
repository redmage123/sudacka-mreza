#!/usr/bin/env python3
"""
Build a retrieval-robust training set.

Lesson from v2-rag: a uniform surface pattern (always `--- CONTEXT ---`,
always `[N] ` answer prefix, always one-sentence reply) trained the model
to reproduce the FRAME rather than learn grounded retrieval.  When eval
later fed it a naked question, the model tried to force the frame onto
the question, hallucinated a context, and regressed vs v1.

This script fixes that by making the training data heterogeneous along
three axes:

  1. MODE — what the example is teaching
       naked    40%   Original v1-style naked-question / direct-answer.
                      Preserves the skill v2 lost.
       grounded 30%   Single-passage answer with inline citation.
       multi    10%   Answer requires combining 2-3 passages.
       refusal  10%   Answer not in context; model must abstain.
       contra   5%    Two passages contradict; cite authoritative source.
       off_topic 5%   Context is unrelated to question; refuse cleanly.

  2. PROMPT FRAME — how the context is presented
       Six rotating templates (Croatian section headers, EU style, bullet
       list, implicit, sometimes no header at all). Breaks the model's
       ability to memorize "after `Pitanje:` always output `[N]`".

  3. ANSWER FORMAT — how citations appear
       inline · trailing · explicit ("Prema [1], ...") · multi ([1][2]) ·
       plain (naked questions have no citations). Breaks the
       "always start with [N] " habit.

Output: data/instructions/train_robust.jsonl + eval_robust.jsonl
Target size: ~10k train / 600 eval — smaller than v2 because the value
is in diversity, not volume. One-epoch training at ~800-token average
seq length ≈ ~3h instead of 13h.
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

log = get_logger("robust")

# ── Mix ratios (must sum to 1.0) ───────────────────────────────────────────
MODES = {
    "naked":     0.40,
    "grounded":  0.30,
    "multi":     0.10,
    "refusal":   0.10,
    "contra":    0.05,
    "off_topic": 0.05,
}
assert abs(sum(MODES.values()) - 1.0) < 1e-6

# ── Context construction knobs ─────────────────────────────────────────────
K_MIN, K_MAX = 3, 6       # passages per context (varied — not fixed 5)
EXCERPT_MIN, EXCERPT_MAX = 350, 700   # varied excerpt size
MIN_CHUNK_CHARS = 120

# ── Six prompt frames — rotated uniformly to break structural memorization ─
def _fr_canonical(ctx: str, q: str) -> str:
    return f"--- CONTEXT ---\n{ctx}\n--- END CONTEXT ---\n\nPitanje: {q}"

def _fr_labeled_hr(ctx: str, q: str) -> str:
    return f"Kontekst:\n{ctx}\n\nPitanje: {q}"

def _fr_bulleted(ctx: str, q: str) -> str:
    # passages already numbered; add a little list styling
    bullets = "\n".join("• " + line for line in ctx.split("\n\n"))
    return f"Izvori:\n{bullets}\n\nPitanje: {q}"

def _fr_implicit(ctx: str, q: str) -> str:
    # no header at all — model must infer
    return f"{ctx}\n\n{q}"

def _fr_instruction(ctx: str, q: str) -> str:
    return (f"Odgovori na sljedeće pitanje koristeći priložene izvore. "
            f"Citiraj brojem pasusa u uglatim zagradama:\n\n{ctx}\n\nPitanje: {q}")

def _fr_brackets_trailing(ctx: str, q: str) -> str:
    return f"{q}\n\n(Raspoloživi izvori — pogledaj ih prije odgovora:)\n{ctx}"

FRAMES = [_fr_canonical, _fr_labeled_hr, _fr_bulleted, _fr_implicit, _fr_instruction, _fr_brackets_trailing]


def format_passage(idx: int, doc: dict, excerpt: str) -> str:
    st = (doc.get("source_type") or "").lower()
    if "legislation" in st or "zakon" in (doc.get("title") or "").lower():
        kind = "PROPIS"
    elif "decision" in st or "sud" in (doc.get("author") or "").lower():
        kind = "SUDSKA ODLUKA"
    elif "commentary" in st:
        kind = "KOMENTAR"
    else:
        kind = "IZVOR"
    title = (doc.get("title") or "")[:120]
    author = (doc.get("author") or "")[:80]
    hdr = f"[{idx}] {kind}: {title}" + (f" · {author}" if author else "")
    return f"{hdr}\n{excerpt}"


# ── Answer-style rotators ──────────────────────────────────────────────────
def _ans_inline(body: str, cites: list[int]) -> str:
    marker = "".join(f"[{c}]" for c in cites)
    # Insert citation before the final period if there is one
    if body.rstrip().endswith("."):
        return body.rstrip()[:-1] + f" {marker}."
    return f"{body} {marker}"

def _ans_trailing(body: str, cites: list[int]) -> str:
    marker = "".join(f"[{c}]" for c in cites)
    sep = "" if body.rstrip().endswith(".") else "."
    return f"{body}{sep} {marker}"

def _ans_explicit(body: str, cites: list[int]) -> str:
    lead = "Prema " + " i ".join(f"izvoru [{c}]" for c in cites)
    # Lowercase first letter of body to merge into a sentence
    if body and body[0].isupper() and body[:4].lower() != body[:4].upper():
        body = body[0].lower() + body[1:]
    return f"{lead}, {body}"

def _ans_preamble(body: str, cites: list[int]) -> str:
    marker = "".join(f"[{c}]" for c in cites)
    return f"Na temelju priloženih izvoda: {body} {marker}"


ANSWER_STYLES = [_ans_inline, _ans_trailing, _ans_explicit, _ans_preamble]

REFUSAL_LINES = [
    "Na temelju priloženih izvoda nije moguće odgovoriti na ovo pitanje.",
    "Priloženi izvori ne sadrže informaciju relevantnu za ovo pitanje.",
    "U navedenim pasusima nema odgovora; preporučujem konzultirati izvornu zakonsku odredbu ili nadležni sud.",
    "Dostupni izvodi ne obuhvaćaju ovu temu. Za pouzdan odgovor potrebno je pogledati relevantan zakon.",
    "Ova tema nije pokrivena priloženim izvorima.",
]

CONTRA_LEAD = [
    "Izvori nisu usklađeni: ",
    "Pasusi [{a}] i [{b}] daju različite brojke. ",
    "U priloženim izvorima postoji razlika: ",
]


# ── Corpus loader (same shape as 05b) ──────────────────────────────────────
def load_corpus() -> tuple[dict[str, dict], list[dict]]:
    by_id: dict[str, dict] = {}
    all_chunks: list[dict] = []
    chunk_paths = list(RAW_DIR.glob("*_chunks.jsonl")) + [RAW_DIR / "legislation_by_article_chunks.jsonl"]
    for p in chunk_paths:
        if not p.exists():
            continue
        with p.open(encoding="utf-8") as fh:
            for line in fh:
                d = json.loads(line)
                sid = d.get("source_id")
                text = (d.get("text") or "").strip()
                if not sid or len(text) < MIN_CHUNK_CHARS:
                    continue
                all_chunks.append(d)
                if sid not in by_id or len(text) > len(by_id[sid]["text"]):
                    by_id[sid] = {
                        "title": d.get("title", ""),
                        "text": text,
                        "source_type": d.get("source_type", ""),
                        "author": d.get("author", ""),
                    }
    # corpus flat files (court decisions, etc.)
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
                if not sid or len(text) < MIN_CHUNK_CHARS:
                    continue
                md = d.get("metadata") or {}
                by_id[sid] = {
                    "title": d.get("title", ""),
                    "text": text,
                    "source_type": md.get("source_type", "") or d.get("source_type", ""),
                    "author": md.get("court_name", "") or d.get("author", ""),
                }
                all_chunks.append({
                    "source_id": sid, "text": text,
                    "title": d.get("title", ""),
                    "source_type": by_id[sid]["source_type"],
                    "author": by_id[sid]["author"],
                })
    return by_id, all_chunks


def excerpt_from(doc: dict, want: int, question: str | None = None) -> str:
    """Take a `want`-char excerpt. If question contains a case number or
    article reference and it appears in doc, slice around that hit."""
    text = doc["text"]
    if len(text) <= want:
        return text
    if question:
        for pat in [r"\b[A-ZŠĐČĆŽ][a-zšđčćž]*-?\s*\d+/\d{2,4}(?:-\d+)?\b",
                    r"\b(?:čl\.|članak|članku|članka)\s*\d+"]:
            m = re.search(pat, question, flags=re.IGNORECASE)
            if m:
                hit = text.lower().find(m.group(0).lower())
                if hit >= 0:
                    start = max(0, hit - 60)
                    return text[start:start + want].strip()
    return text[:want].strip()


def pick_distractors(all_chunks: list[dict], rng: random.Random,
                     exclude_sid: str | None, n: int) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = {exclude_sid} if exclude_sid else set()
    for _ in range(n * 6):
        if len(out) >= n:
            break
        c = rng.choice(all_chunks)
        if c.get("source_id") in seen:
            continue
        seen.add(c.get("source_id"))
        out.append(c)
    return out


def build_context(docs: list[dict], rng: random.Random, question: str | None = None) -> str:
    passages = []
    for i, d in enumerate(docs, 1):
        want = rng.randint(EXCERPT_MIN, EXCERPT_MAX)
        ex = excerpt_from(d, want, question if i == 1 else None)
        passages.append(format_passage(i, d, ex))
    return "\n\n".join(passages)


def mutate_for_contra(gold_doc: dict, rng: random.Random) -> dict:
    """Return a second 'gold-like' doc with one numeric value altered,
    so the model must pick the authoritative citation."""
    t = gold_doc["text"]
    # Replace the first year-range "X to Y godina" with a different range
    m = re.search(r"(\d{1,2})\s*(?:do|-)\s*(\d{1,2})\s*godin", t)
    if not m:
        return gold_doc
    a = int(m.group(1)); b = int(m.group(2))
    new_a = max(1, a - rng.randint(1, 3))
    new_b = b + rng.randint(1, 5)
    mutated = t.replace(m.group(0), f"{new_a} do {new_b} godin", 1)
    return {
        **gold_doc,
        "text": mutated,
        "title": (gold_doc.get("title") or "") + " (izmjena)",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-train", default=str(INSTRUCTIONS_DIR / "train.jsonl"))
    ap.add_argument("--in-eval", default=str(INSTRUCTIONS_DIR / "eval.jsonl"))
    ap.add_argument("--out-train", default=str(INSTRUCTIONS_DIR / "train_robust.jsonl"))
    ap.add_argument("--out-eval", default=str(INSTRUCTIONS_DIR / "eval_robust.jsonl"))
    ap.add_argument("--target-train", type=int, default=10000,
                    help="total training rows to emit (fewer, more diverse)")
    ap.add_argument("--target-eval", type=int, default=600)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    log.info("loading corpus…")
    by_id, all_chunks = load_corpus()
    log.info("%d docs · %d chunks", len(by_id), len(all_chunks))

    def pick_mode() -> str:
        r = rng.random()
        cum = 0.0
        for name, p in MODES.items():
            cum += p
            if r < cum:
                return name
        return "naked"

    def build_row(src_row: dict) -> dict | None:
        msgs = src_row["messages"]
        sys_msg = msgs[0]
        q = msgs[1]["content"]
        a_orig = msgs[2]["content"]
        sid = src_row.get("source_id")
        gold = by_id.get(sid or "")
        mode = pick_mode()
        # Avoid RAG modes if no gold doc available
        if mode in ("grounded", "multi", "contra") and gold is None:
            mode = "refusal" if rng.random() < 0.5 else "naked"

        K = rng.randint(K_MIN, K_MAX)
        frame = rng.choice(FRAMES)
        ans_fn = rng.choice(ANSWER_STYLES)

        if mode == "naked":
            new_user = q
            new_assistant = a_orig
        elif mode == "grounded":
            slot = rng.randint(1, K)
            distractors = pick_distractors(all_chunks, rng, sid, K - 1)
            if len(distractors) < K - 1:
                return None
            docs = distractors[:]
            docs.insert(slot - 1, gold)
            ctx = build_context(docs, rng, q)
            new_user = frame(ctx, q)
            new_assistant = ans_fn(a_orig, [slot])
        elif mode == "multi":
            # Place gold + a second "related" doc (another chunk from same
            # source if available, else just gold twice at different slots)
            related = None
            for c in all_chunks:
                if c.get("source_id") == sid and c.get("text") != gold["text"]:
                    related = {
                        "title": c.get("title", ""),
                        "text": c["text"],
                        "source_type": c.get("source_type", ""),
                        "author": c.get("author", ""),
                    }
                    break
            if related is None:
                # fall back to single-grounded
                return build_row({**src_row, "_force_mode": "grounded"})  # shallow retry
            slot1 = rng.randint(1, K - 1)
            slot2 = rng.randint(slot1 + 1, K)
            distractors = pick_distractors(all_chunks, rng, sid, K - 2)
            if len(distractors) < K - 2:
                return None
            docs = distractors[:]
            docs.insert(slot1 - 1, gold)
            docs.insert(slot2 - 1, related)
            ctx = build_context(docs, rng, q)
            new_user = frame(ctx, q)
            new_assistant = ans_fn(a_orig, sorted([slot1, slot2]))
        elif mode == "refusal":
            distractors = pick_distractors(all_chunks, rng, sid, K)
            if len(distractors) < K:
                return None
            ctx = build_context(distractors, rng, None)
            new_user = frame(ctx, q)
            new_assistant = rng.choice(REFUSAL_LINES)
        elif mode == "contra":
            slot1 = rng.randint(1, K - 1)
            slot2 = rng.randint(slot1 + 1, K)
            mutated = mutate_for_contra(gold, rng)
            distractors = pick_distractors(all_chunks, rng, sid, K - 2)
            if len(distractors) < K - 2:
                return None
            docs = distractors[:]
            docs.insert(slot1 - 1, gold)
            docs.insert(slot2 - 1, mutated)
            ctx = build_context(docs, rng, q)
            new_user = frame(ctx, q)
            lead = rng.choice(CONTRA_LEAD).format(a=slot1, b=slot2)
            # Lean on the authoritative (original) passage, note discrepancy
            new_assistant = f"{lead}Oslanjam se na pasus [{slot1}] kao autoritativni: {a_orig} [{slot1}]. Pasus [{slot2}] navodi drugačije brojke."
        else:  # off_topic
            distractors = pick_distractors(all_chunks, rng, sid, K)
            if len(distractors) < K:
                return None
            ctx = build_context(distractors, rng, None)
            new_user = frame(ctx, q)
            new_assistant = (
                rng.choice(REFUSAL_LINES)
                + " Postavljeno pitanje nije povezano s priloženim izvorima."
            )

        return {
            "messages": [sys_msg,
                         {"role": "user", "content": new_user},
                         {"role": "assistant", "content": new_assistant}],
            "source_id": sid,
            "mode": mode,
        }

    def rewrite(in_path: str, out_path: str, target: int, label: str):
        with open(in_path, encoding="utf-8") as fi:
            pool = [json.loads(l) for l in fi]
        rng.shuffle(pool)
        counts: dict[str, int] = {}
        written = 0
        i = 0
        with open(out_path, "w", encoding="utf-8") as fo:
            while written < target and i < len(pool) * 3:
                src = pool[i % len(pool)]
                i += 1
                row = build_row(src)
                if row is None:
                    continue
                counts[row["mode"]] = counts.get(row["mode"], 0) + 1
                fo.write(json.dumps(row, ensure_ascii=False) + "\n")
                written += 1
        log.info("%s: wrote %d · mode counts %s", label, written, counts)

    rewrite(args.in_train, args.out_train, args.target_train, "train_robust")
    rewrite(args.in_eval, args.out_eval, args.target_eval, "eval_robust")
    return 0


if __name__ == "__main__":
    sys.exit(main())
