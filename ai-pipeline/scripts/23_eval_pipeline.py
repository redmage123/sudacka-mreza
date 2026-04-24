#!/usr/bin/env python3
"""
Faithfulness eval for the full RAG pipeline.

For each row in eval.jsonl, run the pipeline (retriever → refusal gate →
LLM → verifier) and compute:

    retrieval_recall@k    did the gold source_id appear in retrieved passages?
    entity_recall         gold-answer entities present in produced answer
                          (same metric as 08_eval — for continuity)
    faithfulness          every actionable entity in the produced answer is
                          grounded in a cited retrieved passage (no invented
                          case numbers, articles, ECLIs or dates)
    citation_validity     every [N] in the answer refers to a real passage
    refusal_correctness   on out-of-scope questions, model refused

Also writes a per-row JSONL so you can inspect every failure case.

Usage:
    python3 scripts/23_eval_pipeline.py \
      --model gemma-4-e4b-croatian-legal-v3-robust \
      --samples 50 --out logs/eval/pipeline-<ts>.jsonl

Compare runs by re-running with --model swapped (v1-naked, v3-robust, etc).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INSTRUCTIONS_DIR, REPO_ROOT, get_logger  # noqa: E402
from retrieval import Embedder  # noqa: E402  # for dep check
from importlib import import_module  # noqa: E402
pipeline_mod = import_module("22_pipeline")  # dashes in filename, import by name
LegalQAPipeline = pipeline_mod.LegalQAPipeline
PipelineConfig = pipeline_mod.PipelineConfig
extract_entities = pipeline_mod.extract_entities
is_refusal = pipeline_mod.is_refusal

log = get_logger("eval_pipe")

# Gold-answer entity extractor (same as 08_eval for continuity)
def _gold_entities(gold: str) -> set[str]:
    ents: set[str] = set()
    for m in re.findall(r"\b[A-ZŠĐČĆŽ][a-zšđčćž]{3,}\b", gold):
        ents.add(m)
    for m in re.findall(r"\b\d{1,4}/\d{2,4}\b", gold):
        ents.add(m)
    for m in re.findall(r"ECLI:[A-Z0-9:\-]+", gold):
        ents.add(m)
    return ents


def entity_recall(prediction: str, gold: str) -> float:
    ents = _gold_entities(gold)
    if not ents:
        return 1.0 if prediction.strip() else 0.0
    hit = sum(1 for e in ents if e in prediction)
    return hit / len(ents)


def retrieval_recall(gold_source_id: str | None, passages: list[dict]) -> float | None:
    if not gold_source_id:
        return None
    for p in passages:
        if p.get("source_id") == gold_source_id:
            return 1.0
    return 0.0


def summarize(results: list[dict]) -> dict:
    def _avg(key, filter_none=True):
        vals = [r[key] for r in results if r.get(key) is not None] if filter_none \
               else [r.get(key, 0) for r in results]
        return sum(vals) / len(vals) if vals else 0.0

    n = len(results)
    statuses: dict[str, int] = {}
    for r in results:
        statuses[r.get("status", "?")] = statuses.get(r.get("status", "?"), 0) + 1

    answered = [r for r in results if r.get("status") == "answered"]
    flagged = [r for r in results if r.get("status") == "flagged"]
    refused_low = [r for r in results if r.get("status") == "refused_low_retrieval"]
    refused_model = [r for r in results if r.get("status") == "refused_by_model"]

    # NLI metrics: only set if we actually ran NLI
    nli_checked = [r for r in results if r.get("nli_faithful") is not None]
    nli_summary = None
    if nli_checked:
        total_claims = sum((r.get("nli_supported") or 0)
                           + (r.get("nli_partial") or 0)
                           + (r.get("nli_unsupported") or 0)
                           + (r.get("nli_neutral") or 0) for r in nli_checked)
        supported = sum(r.get("nli_supported") or 0 for r in nli_checked)
        partial = sum(r.get("nli_partial") or 0 for r in nli_checked)
        unsupported = sum(r.get("nli_unsupported") or 0 for r in nli_checked)
        neutral = sum(r.get("nli_neutral") or 0 for r in nli_checked)
        nli_summary = {
            "nli_rows_checked": len(nli_checked),
            "nli_faithful_rate": sum(r["nli_faithful"] for r in nli_checked) / len(nli_checked),
            "total_claims": total_claims,
            "claim_supported_pct": supported / total_claims if total_claims else 0.0,
            "claim_partial_pct": partial / total_claims if total_claims else 0.0,
            "claim_unsupported_pct": unsupported / total_claims if total_claims else 0.0,
            "claim_neutral_pct": neutral / total_claims if total_claims else 0.0,
        }

    return {
        "n": n,
        "status_breakdown": statuses,
        "retrieval_recall_at_k": _avg("retrieval_recall"),
        "entity_recall_avg": _avg("entity_recall"),
        "faithfulness_rate": _avg("faithfulness"),         # 1.0 if answer fully grounded (regex)
        "citation_validity_rate": _avg("citation_validity"),
        "refusal_rate": (len(refused_low) + len(refused_model)) / n if n else 0.0,
        "answered_pct": len(answered) / n if n else 0.0,
        "flagged_pct": len(flagged) / n if n else 0.0,
        # On rows where we answered (not refused), how often was the output trustworthy?
        "answered_faithfulness": (
            sum(1 for r in answered if r.get("faithfulness") == 1.0) / len(answered)
            if answered else 0.0
        ),
        "nli": nli_summary,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval-path", default=str(INSTRUCTIONS_DIR / "eval.jsonl"))
    ap.add_argument("--index-root", default=str(REPO_ROOT / "indexes" / "default"))
    ap.add_argument("--model", default="gemma-4-e4b-croatian-legal-v3-robust")
    ap.add_argument("--samples", type=int, default=50)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--k", type=int, default=6)
    ap.add_argument("--dense-threshold", type=float, default=0.55)
    ap.add_argument("--bm25-threshold", type=float, default=5.0)
    ap.add_argument("--nli", action="store_true",
                    help="run NLI semantic verifier (one extra LLM call per claim sentence)")
    ap.add_argument("--nli-model", default="gemma-4-e4b-base")
    ap.add_argument("--nli-max-claims", type=int, default=6)
    ap.add_argument("--token", default=os.getenv("OLLAMA_TOKEN"))
    ap.add_argument("--out", default=None,
                    help="where to write per-row JSONL (default: logs/eval/pipeline-<ts>-<model>.jsonl)")
    ap.add_argument("--summary-out", default=None,
                    help="where to write summary JSON (default alongside --out)")
    args = ap.parse_args()

    if not args.token:
        log.error("OLLAMA_TOKEN env not set and --token not passed")
        return 2

    ts = time.strftime("%Y%m%d-%H%M%S")
    out = Path(args.out) if args.out else (
        REPO_ROOT / "logs" / "eval" / f"pipeline-{ts}-{args.model}.jsonl"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    summary_out = Path(args.summary_out) if args.summary_out else out.with_suffix(".summary.json")

    rng = random.Random(args.seed)
    rows = [json.loads(l) for l in open(args.eval_path, encoding="utf-8")]
    rng.shuffle(rows)
    rows = rows[:args.samples]
    log.info("evaluating model=%s on %d samples", args.model, len(rows))

    cfg = PipelineConfig(
        index_root=args.index_root,
        llm_model=args.model,
        token=args.token,
        k=args.k,
        dense_threshold=args.dense_threshold,
        bm25_threshold=args.bm25_threshold,
        nli_verify=args.nli,
        nli_model=args.nli_model,
        nli_max_claims=args.nli_max_claims,
    )
    pipe = LegalQAPipeline(cfg)

    results: list[dict] = []
    with out.open("w", encoding="utf-8") as f:
        for row in tqdm(rows, desc=f"pipe[{args.model}]", unit="q"):
            msgs = row["messages"]
            question = msgs[1]["content"]
            gold = msgs[2]["content"]
            gold_sid = row.get("source_id")

            try:
                r = pipe.answer(question)
            except Exception as e:
                log.warning("pipeline error: %s", e)
                r = {"question": question, "answer": "", "status": "pipeline_error",
                     "error": str(e), "passages": [], "verification": None}

            answer = r.get("answer", "")
            passages = r.get("passages", [])
            verif = r.get("verification") or {}

            # Metrics
            er = entity_recall(answer, gold)
            rr = retrieval_recall(gold_sid, passages)
            faithfulness = 1.0 if verif.get("entities_grounded") else 0.0
            cit_valid = 1.0 if verif.get("citations_valid") else 0.0
            # For refusals, faithfulness is moot (nothing claimed) — mark None
            if r.get("status") in ("refused_low_retrieval", "refused_by_model"):
                faithfulness = None
                cit_valid = None

            nli_data = r.get("nli")
            nli_faithful = (1.0 if nli_data["faithful"] else 0.0) if nli_data else None

            row_result = {
                "question": question,
                "gold": gold,
                "gold_source_id": gold_sid,
                "status": r.get("status"),
                "answer": answer,
                "retrieval_dense": r.get("retrieval", {}).get("max_dense"),
                "retrieval_bm25": r.get("retrieval", {}).get("max_bm25"),
                "retrieval_confident": r.get("retrieval", {}).get("confident"),
                "entity_recall": er,
                "retrieval_recall": rr,
                "faithfulness": faithfulness,
                "citation_validity": cit_valid,
                "nli_faithful": nli_faithful,
                "nli_supported": nli_data.get("n_supported") if nli_data else None,
                "nli_partial": nli_data.get("n_partial") if nli_data else None,
                "nli_unsupported": nli_data.get("n_unsupported") if nli_data else None,
                "nli_neutral": nli_data.get("n_neutral") if nli_data else None,
                "ungrounded_entities": verif.get("ungrounded_entities") if verif else None,
                "cited_indices": verif.get("cited_indices") if verif else None,
                "invalid_citations": verif.get("invalid_citations") if verif else None,
                "error": r.get("error"),
            }
            results.append(row_result)
            f.write(json.dumps(row_result, ensure_ascii=False) + "\n")

    s = summarize(results)
    s["model"] = args.model
    s["k"] = args.k
    s["dense_threshold"] = args.dense_threshold
    s["bm25_threshold"] = args.bm25_threshold
    summary_out.write_text(json.dumps(s, indent=2, ensure_ascii=False))
    log.info("summary → %s", summary_out)
    print(json.dumps(s, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
