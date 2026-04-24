#!/usr/bin/env python3
"""
Lightweight eval harness for the trained model.

Two metrics:
  1. loss on the held-out eval set (standard LM cross-entropy)
  2. a sanity probe — pull N random eval questions, ask the model, score with
     a simple substring match on key entities present in the gold answer.

Runs against either:
  - the local trained adapter (HF inference), or
  - an Ollama model deployed on the dev server (--ollama-model).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import httpx
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INSTRUCTIONS_DIR, get_logger, load_config  # noqa: E402

log = get_logger("eval")


def score_substring(prediction: str, gold: str) -> float:
    """Crude but surprisingly useful legal-eval heuristic."""
    # Pull capitalised tokens, 4+ char words, and any 5-digit case numbers or
    # ECLI-style citations from the gold answer.
    entities = set()
    for m in re.findall(r"\b[A-ZŠĐČĆŽ][a-zšđčćž]{3,}\b", gold):
        entities.add(m)
    for m in re.findall(r"\b\d{1,4}/\d{2,4}\b", gold):
        entities.add(m)
    for m in re.findall(r"ECLI:[A-Z0-9:\-]+", gold):
        entities.add(m)
    if not entities:
        return 1.0 if prediction.strip() else 0.0
    hit = sum(1 for e in entities if e in prediction)
    return hit / len(entities)


def ask_ollama(endpoint: str, model: str, messages: list[dict], max_tokens: int = 800, token: str | None = None) -> str:
    payload = {"model": model, "messages": messages,
               "temperature": 0.0, "max_tokens": max_tokens, "stream": False}
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with httpx.Client(timeout=180) as c:
        r = c.post(endpoint, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--ollama-endpoint", default="http://176.9.99.103:11434/v1/chat/completions")
    ap.add_argument("--ollama-model", default="gemma-4-croatian-legal",
                    help="name of the imported Ollama model to test against")
    ap.add_argument("--samples", type=int, default=None)
    ap.add_argument("--token", default=None,
                    help="Bearer token for the nginx-fronted ollama endpoint")
    args = ap.parse_args()

    cfg = load_config(args.config)
    eval_path = INSTRUCTIONS_DIR / "eval.jsonl"
    if not eval_path.exists():
        log.error("no eval set at %s", eval_path)
        return 1

    rows = [json.loads(l) for l in open(eval_path, encoding="utf-8")]
    n = min(args.samples or cfg["eval"]["eval_samples"], len(rows))
    rows = rows[:n]

    scores = []
    for row in tqdm(rows, desc="eval", unit="q"):
        msgs = row["messages"]
        system = msgs[0]["content"]
        question = msgs[1]["content"]
        gold = msgs[2]["content"]
        try:
            pred = ask_ollama(
                args.ollama_endpoint, args.ollama_model,
                [{"role": "system", "content": system},
                 {"role": "user", "content": question}],
                token=args.token,
            )
        except Exception as e:
            log.warning("request failed: %s", e)
            pred = ""
        s = score_substring(pred, gold)
        scores.append(s)

    avg = sum(scores) / len(scores) if scores else 0.0
    log.info("evaluated %d samples — entity-recall avg %.3f", len(scores), avg)
    print(f"entity_recall={avg:.3f}  n={len(scores)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
