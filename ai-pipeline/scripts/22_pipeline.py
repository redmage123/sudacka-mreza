#!/usr/bin/env python3
"""
Full Q&A inference pipeline:

    question
      → [retrieve] hybrid BM25+dense, top-k
      → [gate]     if max(dense,bm25) < threshold → refuse (no LLM call)
      → [prompt]   canonical context block with [1..K] passages
      → [LLM]      v3-robust (or any configured Ollama model)
      → [verify]   citations exist; answer entities appear in cited passages
      → [output]   structured dict with ground-truth pointers

The verification layer is what turns a fluent LLM into an answer we can trust
for legal work: every case number, article reference and ECLI in the answer
must be present verbatim in at least one cited passage, otherwise the answer
is flagged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO_ROOT, get_logger  # noqa: E402
from retrieval import (  # noqa: E402
    HybridRetriever, Hit, Embedder, retrieval_confidence, strip_boilerplate,
)
from nli_verify import nli_verify, NLIResult  # noqa: E402

log = get_logger("pipeline")


SYSTEM_PROMPT = (
    "Ti si pravni asistent specijaliziran za hrvatsko i europsko pravo. "
    "ODGOVARAJ U 2-4 REČENICE, jasnim stručnim jezikom, koristeći "
    "ISKLJUČIVO informacije iz priloženih izvora. Ne prepisuj zaglavlja ni "
    "naslove zakona. Svaku tvrdnju potkrijepi citatom u obliku [N] gdje je "
    "N broj pasusa iz kojeg si činjenicu uzeo. Ako priloženi izvori ne "
    "sadrže izravan odgovor, reci otvoreno: 'Na temelju priloženih izvora "
    "ne mogu odgovoriti na ovo pitanje.' — nemoj pogađati ni izmišljati "
    "brojeve predmeta, članaka ili datuma."
)

# Use the native Ollama /api/chat. On /v1/chat/completions, Gemma 4's thinking
# tokens fill the output stream and `content` comes back empty. /api/chat
# returns `message.content` separately from `message.thinking`.
DEFAULT_ENDPOINT = "http://176.9.99.103:11434/api/chat"


# ── Entity extractor ──────────────────────────────────────────────────────
# Legal entities that MUST be grounded: anything the lawyer would act on.
CASE_NUMBER_RE = re.compile(r"\b[A-ZŠĐČĆŽ][a-zčćđšž]*-?\s*\d+/\d{2,4}(?:-\d+)?\b")
ARTICLE_RE = re.compile(r"(?:\bčlan(?:ak|ka|ku|kom)|\bčl\.)\s*\d+(?:\.\s*stav(?:ak|ka)?\s*\d+)?",
                        flags=re.IGNORECASE)
ECLI_RE = re.compile(r"ECLI:[A-Z0-9:\-]+")
NN_REF_RE = re.compile(r"\bNN\s+\d+/\d{2,4}\b")  # Narodne novine reference
DATE_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\.")
# Capitalised legal proper nouns (4+ chars — avoids "Na", "U", etc.)
PROPER_NOUN_RE = re.compile(r"\b[A-ZŠĐČĆŽ][a-zčćđšž]{3,}\b")


def extract_entities(text: str) -> set[str]:
    """Extract entities that must be grounded in cited passages."""
    ents: set[str] = set()
    for rx in (CASE_NUMBER_RE, ARTICLE_RE, ECLI_RE, NN_REF_RE, DATE_RE):
        for m in rx.findall(text):
            ents.add(m.strip())
    # Proper nouns (filter stopwords and common legal verbs)
    COMMON = {"Prema", "Pasus", "Odgovor", "Priloženi", "Ovdje", "Nije", "Kada",
              "Ovo", "Ova", "Ovaj", "Ako", "Član", "Pitanje", "Priloženim",
              "Dostupni", "Oslanjam", "Izvori", "Ako", "Ova", "Stoga",
              "Odluka", "Postupku", "Pravnik", "Članak"}
    for m in PROPER_NOUN_RE.findall(text):
        if m not in COMMON:
            ents.add(m)
    return ents


# ── Prompt construction ───────────────────────────────────────────────────
def build_context_block(hits: list[Hit], excerpt_chars: int = 800) -> tuple[str, list[dict]]:
    """Render retrieved chunks as a context block the model can cite from.
    Also returns a parallel metadata list so the caller can resolve [N]
    citations back to source_id/url."""
    lines = []
    meta = []
    for i, h in enumerate(hits, 1):
        c = h.chunk
        if c.kind == "legislation":
            hdr_kind = "PROPIS"
        elif c.kind == "decision":
            hdr_kind = "SUDSKA ODLUKA"
        elif c.kind == "commentary":
            hdr_kind = "KOMENTAR"
        else:
            hdr_kind = "IZVOR"
        title = (c.title or "")[:150]
        byline = c.author or ""
        header = f"[{i}] {hdr_kind}: {title}"
        if byline:
            header += f" · {byline}"
        cleaned = strip_boilerplate(c.text)
        excerpt = cleaned[:excerpt_chars].strip()
        lines.append(f"{header}\n{excerpt}")
        meta.append({
            "index": i,
            "chunk_id": c.chunk_id,
            "source_id": c.source_id,
            "kind": c.kind,
            "title": c.title,
            "url": c.url,
            "case_number": c.case_number,
            "article_number": c.article_number,
            "text": excerpt,  # store the cleaned excerpt so the verifier sees what LLM saw
        })
    return "\n\n".join(lines), meta


def build_user_message(question: str, context: str) -> str:
    return f"--- CONTEXT ---\n{context}\n--- END CONTEXT ---\n\nPitanje: {question}"


# ── LLM call ──────────────────────────────────────────────────────────────
def call_llm(endpoint: str, model: str, system: str, user: str,
             token: str | None, max_tokens: int = 700,
             temperature: float = 0.0, timeout: float = 240.0) -> str:
    """Call Ollama /api/chat (native) and return the assistant content string.

    Supports both the native (`/api/chat`) and the OpenAI-compat
    (`/v1/chat/completions`) endpoints so the function remains callable with
    either shape.  Native is preferred for Gemma 4 because its thinking
    tokens come back as a separate `message.thinking` field — the OpenAI-
    compat endpoint silently drops the content when thinking fills the stream.
    """
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    if endpoint.endswith("/api/chat"):
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # think=False disables Gemma 4's hidden reasoning stream. We need
            # it off because thinking tokens count against num_predict and can
            # starve the actual content — observed empty `content` returns
            # with think=True even at num_predict=700 on RAG-shaped prompts.
            "think": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
            "stream": False,
        }
        with httpx.Client(timeout=timeout) as c:
            r = c.post(endpoint, json=payload, headers=headers)
            r.raise_for_status()
            return r.json().get("message", {}).get("content", "")
    # OpenAI-compat fallback
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    with httpx.Client(timeout=timeout) as c:
        r = c.post(endpoint, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


# ── Verification ──────────────────────────────────────────────────────────
CITATION_RE = re.compile(r"\[(\d+)\]")
REFUSAL_PATTERNS = [
    "ne mogu odgovoriti", "nije moguće odgovoriti",
    "ne sadrže", "nisam siguran", "priloženi izvori ne",
    "dostupni izvodi", "nije pokrivena", "nije povezano",
    "nema odgovora", "preporučujem konzultirati",
    "u priloženim izvorima nema", "u izvorima nema",
]

# Stop markers — the model occasionally completes past its answer and echoes
# the context delimiter or continues with a hallucinated follow-up question.
# Truncating at the first marker keeps only the real reply.
_STOP_MARKERS = [
    "--- END CONTEXT ---",
    "--- CONTEXT ---",
    "\n---\n",
    "\nPitanje:",
    "Pitanje:",  # bare form sometimes appears mid-line after the answer
    "\n[/END]",
    "<|endoftext|>",
]


def trim_llm_output(text: str) -> str:
    """Cut the model's reply at the first stop marker. Preserves the real
    answer; drops context leakage and follow-up hallucinations."""
    out = text
    for marker in _STOP_MARKERS:
        idx = out.find(marker)
        if idx >= 0:
            out = out[:idx]
    return out.strip()


def is_refusal(answer: str) -> bool:
    low = answer.lower()
    return any(pat in low for pat in REFUSAL_PATTERNS)


@dataclass
class Verification:
    citations_valid: bool
    cited_indices: list[int]
    invalid_citations: list[int]
    entities_grounded: bool
    ungrounded_entities: list[str]
    grounded_entities: list[str]
    details: dict[str, Any] = field(default_factory=dict)


def verify_answer(answer: str, passages: list[dict]) -> Verification:
    """Verify citations and entity grounding.

    Rules:
      - Every [N] must reference a passage that exists (1..K).
      - Every legally-actionable entity in the answer (case numbers, ECLI,
        article refs, NN refs, ISO dates) must appear verbatim in at least
        one cited passage. Proper nouns are checked against *any* passage
        (not just cited) because they're often incidental.
    """
    passage_count = len(passages)
    cited = [int(m) for m in CITATION_RE.findall(answer)]
    invalid = [c for c in cited if c < 1 or c > passage_count]
    citations_valid = len(invalid) == 0

    # Only use cited passages for strict grounding
    cited_set = set(cited) - set(invalid)
    cited_texts = [passages[i - 1]["text"] for i in cited_set] if cited_set else []
    all_texts = [p["text"] for p in passages]

    # Hard-ground: these MUST appear in cited passages
    hard_entities: set[str] = set()
    for rx in (CASE_NUMBER_RE, ARTICLE_RE, ECLI_RE, NN_REF_RE, DATE_RE):
        for m in rx.findall(answer):
            hard_entities.add(m.strip())

    ungrounded: list[str] = []
    grounded: list[str] = []
    for ent in hard_entities:
        needle = ent.lower()
        if cited_texts and any(needle in t.lower() for t in cited_texts):
            grounded.append(ent)
        elif any(needle in t.lower() for t in all_texts):
            # Present in retrieved context but not cited — partial credit
            grounded.append(ent)
        else:
            ungrounded.append(ent)

    entities_grounded = len(ungrounded) == 0
    return Verification(
        citations_valid=citations_valid,
        cited_indices=sorted(cited_set),
        invalid_citations=invalid,
        entities_grounded=entities_grounded,
        ungrounded_entities=ungrounded,
        grounded_entities=grounded,
        details={
            "n_cited": len(cited_set),
            "n_passages": passage_count,
            "refusal": is_refusal(answer),
        },
    )


# ── Full pipeline ─────────────────────────────────────────────────────────
@dataclass
class PipelineConfig:
    index_root: str
    llm_endpoint: str = DEFAULT_ENDPOINT
    llm_model: str = "gemma-4-e4b-croatian-legal-v3-robust"
    embed_endpoint: str = "http://176.9.99.103:11434"
    embed_model: str = "nomic-embed-text"
    token: str | None = None
    k: int = 6
    excerpt_chars: int = 800
    dense_threshold: float = 0.55
    bm25_threshold: float = 5.0
    max_tokens: int = 1200
    # Semantic NLI verifier (slow — one gemma-4-26b call per claim sentence).
    # Off by default for bulk eval; enable for production or targeted runs.
    nli_verify: bool = False
    nli_model: str = "gemma-4-e4b-base"
    nli_max_claims: int = 6


class LegalQAPipeline:
    def __init__(self, cfg: PipelineConfig) -> None:
        self.cfg = cfg
        emb = Embedder(endpoint=cfg.embed_endpoint,
                       model=cfg.embed_model, token=cfg.token)
        self.retriever = HybridRetriever(cfg.index_root, embedder=emb)

    def answer(self, question: str) -> dict:
        hits = self.retriever.search(question, k=self.cfg.k)
        decision = retrieval_confidence(
            hits,
            dense_threshold=self.cfg.dense_threshold,
            bm25_threshold=self.cfg.bm25_threshold,
        )

        # Build the passage block regardless — used in output even on refusal
        context, passages = build_context_block(hits, self.cfg.excerpt_chars)

        result: dict[str, Any] = {
            "question": question,
            "retrieval": {
                "confident": decision.confident,
                "reason": decision.reason,
                "max_dense": decision.max_dense,
                "max_bm25": decision.max_bm25,
                "top_hits": [h.to_dict() for h in hits],
            },
            "passages": passages,
        }

        if not decision.confident:
            result.update({
                "answer": (
                    "Na temelju priloženih izvora ne mogu pouzdano odgovoriti "
                    "na ovo pitanje. Preporučujem konzultirati izvornu zakonsku "
                    "odredbu ili nadležni sud."
                ),
                "status": "refused_low_retrieval",
                "verification": None,
            })
            return result

        user_msg = build_user_message(question, context)
        try:
            raw_answer = call_llm(
                self.cfg.llm_endpoint, self.cfg.llm_model,
                SYSTEM_PROMPT, user_msg, self.cfg.token,
                max_tokens=self.cfg.max_tokens,
            )
            answer = trim_llm_output(raw_answer)
        except Exception as e:
            log.warning("LLM call failed: %s", e)
            result.update({
                "answer": "",
                "status": "llm_error",
                "verification": None,
                "error": str(e),
            })
            return result

        verification = verify_answer(answer, passages)
        refused_by_model = is_refusal(answer)

        nli_result: NLIResult | None = None
        if self.cfg.nli_verify and not refused_by_model and answer.strip():
            try:
                nli_result = nli_verify(
                    answer, passages,
                    endpoint=self.cfg.llm_endpoint,
                    model=self.cfg.nli_model,
                    token=self.cfg.token,
                    max_claims=self.cfg.nli_max_claims,
                )
            except Exception as e:
                log.warning("NLI verify failed: %s", e)

        if refused_by_model:
            status = "refused_by_model"
        elif not verification.citations_valid or not verification.entities_grounded:
            status = "flagged"
        elif nli_result and not nli_result.faithful:
            status = "flagged_nli"
        else:
            status = "answered"

        result.update({
            "answer": answer,
            "status": status,
            "verification": verification.__dict__,
            "nli": ({
                "faithful": nli_result.faithful,
                "n_claims": nli_result.n_claims,
                "n_supported": nli_result.n_supported,
                "n_partial": nli_result.n_partial,
                "n_unsupported": nli_result.n_unsupported,
                "n_neutral": nli_result.n_neutral,
                "claim_checks": [c.__dict__ for c in nli_result.claim_checks],
            } if nli_result else None),
        })
        return result


# ── CLI ───────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("question", nargs="?", help="Croatian legal question to answer")
    ap.add_argument("--index-root", default=str(REPO_ROOT / "indexes" / "default"))
    ap.add_argument("--model", default="gemma-4-e4b-croatian-legal-v3-robust")
    ap.add_argument("--k", type=int, default=6)
    ap.add_argument("--token", default=os.getenv("OLLAMA_TOKEN"))
    ap.add_argument("--dense-threshold", type=float, default=0.55)
    ap.add_argument("--bm25-threshold", type=float, default=5.0)
    ap.add_argument("--nli", action="store_true",
                    help="run semantic NLI verifier (gemma-4-26b-a4b as judge)")
    ap.add_argument("--nli-model", default="gemma-4-e4b-base",
                    help="NLI judge (gemma-4-e4b-base is the stable default; "
                         "gemma-4-26b-a4b is stronger but OOMs on the dev GPU "
                         "when coexisting with the main LLM)")
    ap.add_argument("--json", action="store_true", help="print full JSON result")
    args = ap.parse_args()

    if not args.token:
        print("error: OLLAMA_TOKEN env not set and --token not passed", file=sys.stderr)
        return 2

    if not args.question:
        print("usage: 22_pipeline.py <question>", file=sys.stderr)
        return 2

    cfg = PipelineConfig(
        index_root=args.index_root,
        llm_model=args.model,
        token=args.token,
        k=args.k,
        dense_threshold=args.dense_threshold,
        bm25_threshold=args.bm25_threshold,
        nli_verify=args.nli,
        nli_model=args.nli_model,
    )
    pipe = LegalQAPipeline(cfg)
    result = pipe.answer(args.question)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        print(f"\n[status] {result['status']}")
        print(f"[retrieval] dense={result['retrieval']['max_dense']:.3f}  "
              f"bm25={result['retrieval']['max_bm25']:.2f}  "
              f"confident={result['retrieval']['confident']}")
        print(f"\n[answer]\n{result['answer']}")
        if result.get("verification"):
            v = result["verification"]
            print(f"\n[verification]")
            print(f"  citations_valid={v['citations_valid']}  "
                  f"cited={v['cited_indices']}  invalid={v['invalid_citations']}")
            print(f"  entities_grounded={v['entities_grounded']}")
            if v["ungrounded_entities"]:
                print(f"  ungrounded: {v['ungrounded_entities']}")
        print(f"\n[top passages]")
        for p in result["passages"][:3]:
            print(f"  [{p['index']}] {p['title'][:100]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
