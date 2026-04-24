#!/usr/bin/env python3
"""
Hand-curated Croatian-legal probe.

Runs 10 open-ended legal questions against two Ollama models (fine-tune +
base), prints both answers side-by-side, and auto-scores citation presence
against a hand-curated list of expected article/statute tokens.

This is a scored _sanity_ probe, not a rigorous benchmark — the auto-score
just checks whether the expected citation tokens appear anywhere in the
answer. Read the free-form answers to judge correctness.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

SYSTEM_PROMPT = (
    "Ti si pravni asistent specijaliziran za hrvatsko i europsko pravo. "
    "Odgovaraj precizno, citiraj relevantne članke i presude, i koristi "
    "jezik stranke."
)

# Each probe: Croatian legal question + list of citation-token substrings
# that a correct answer should contain (case-sensitive, Croatian accents
# preserved). "any_of" groups mean: at least one of the items is enough.
PROBES = [
    {
        "q": "Koja je kazna za razbojništvo oružjem u Hrvatskoj i koji članak Kaznenog zakona to uređuje?",
        "expected": ["Kaznen", "razbojništv"],
        "expected_any_of": [["čl. 230", "članak 230", "230."]],
    },
    {
        "q": "Koji članak Kaznenog zakona definira teško ubojstvo?",
        "expected": ["Kaznen"],
        "expected_any_of": [["čl. 111", "članak 111", "111."]],
    },
    {
        "q": "Koji je zakonski rok za podnošenje žalbe na prvostupanjsku presudu u parničnom (građanskom) postupku?",
        "expected": ["15 dana", "žalb"],
        "expected_any_of": [["ZPP", "Zakon o parničnom postupku"]],
    },
    {
        "q": "Što je pretpostavka nevinosti i koji članak Ustava RH ili ZKP-a ju uređuje?",
        "expected": ["nevinost"],
        "expected_any_of": [["Ustav", "ZKP", "Zakon o kaznenom postupku"]],
    },
    {
        "q": "Koji je opći rok zastare za naplatu potraživanja prema Zakonu o obveznim odnosima?",
        "expected": ["zastar"],
        "expected_any_of": [["5 god", "pet godina", "ZOO", "Zakon o obveznim odnosima"]],
    },
    {
        "q": "Koje su osnovne obveze stečajnog upravitelja prema Stečajnom zakonu?",
        "expected": ["stečaj"],
        "expected_any_of": [["Stečajni zakon", "SZ"]],
    },
    {
        "q": "Koja je razlika između ovrhe na pokretninama i ovrhe na nekretninama?",
        "expected": ["pokretnin", "nekretnin", "ovrh"],
        "expected_any_of": [["OZ", "Ovršni zakon"]],
    },
    {
        "q": "Kako se utvrđuje mjesna nadležnost suda u radnim sporovima u Hrvatskoj?",
        "expected": ["nadležnost"],
        "expected_any_of": [["radn", "poslodav"]],
    },
    {
        "q": "Koja prava ima žrtva obiteljskog nasilja prema hrvatskom zakonu?",
        "expected": ["žrtv", "nasilj"],
        "expected_any_of": [["Zakon o zaštiti od nasilja u obitelji", "ZZN", "obiteljsko"]],
    },
    {
        "q": "Što znači načelo in dubio pro reo i u kojem članku ZKP-a je izraženo?",
        "expected": ["dubio", "reo"],
        "expected_any_of": [["ZKP", "Zakon o kaznenom postupku", "čl. 3", "članak 3"]],
    },
]


def ask(endpoint: str, model: str, question: str, max_tokens: int = 1500) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        "stream": False,
    }
    with httpx.Client(timeout=300) as c:
        r = c.post(endpoint, json=payload)
        r.raise_for_status()
        return r.json()["choices"][0]["message"].get("content") or ""


def score(answer: str, probe: dict) -> tuple[float, list[str], list[str]]:
    hits: list[str] = []
    misses: list[str] = []
    for tok in probe.get("expected", []):
        if tok in answer:
            hits.append(tok)
        else:
            misses.append(tok)
    for group in probe.get("expected_any_of", []):
        if any(t in answer for t in group):
            hits.append(group[0] + "(+alt)")
        else:
            misses.append("|".join(group))
    total = len(probe.get("expected", [])) + len(probe.get("expected_any_of", []))
    return (len(hits) / total if total else 0.0), hits, misses


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", default="http://localhost:11434/v1/chat/completions")
    ap.add_argument("--fine-tune", default="gemma-4-e4b-croatian-legal")
    ap.add_argument("--base", default="gemma-4-e4b-base")
    ap.add_argument("--out", default="probe_results.json")
    args = ap.parse_args()

    results = []
    ft_scores, base_scores = [], []
    for i, p in enumerate(PROBES, 1):
        print(f"\n{'='*72}\nQ{i}: {p['q']}")
        print(f"EXPECTED: {p.get('expected', []) + [g[0] for g in p.get('expected_any_of', [])]}")

        t0 = time.time()
        ft_ans = ask(args.endpoint, args.fine_tune, p["q"])
        ft_dt = time.time() - t0
        ft_score, ft_hits, ft_miss = score(ft_ans, p)
        ft_scores.append(ft_score)
        print(f"\n--- FINE-TUNE ({ft_dt:.1f}s, score {ft_score:.2f}, hits {ft_hits}, misses {ft_miss}):")
        print(ft_ans.strip()[:900])

        t0 = time.time()
        base_ans = ask(args.endpoint, args.base, p["q"])
        base_dt = time.time() - t0
        base_score, base_hits, base_miss = score(base_ans, p)
        base_scores.append(base_score)
        print(f"\n--- BASE ({base_dt:.1f}s, score {base_score:.2f}, hits {base_hits}, misses {base_miss}):")
        print(base_ans.strip()[:900])

        results.append({
            "q": p["q"],
            "expected": p.get("expected", []),
            "expected_any_of": p.get("expected_any_of", []),
            "fine_tune": {"answer": ft_ans, "score": ft_score, "hits": ft_hits, "misses": ft_miss, "seconds": ft_dt},
            "base": {"answer": base_ans, "score": base_score, "hits": base_hits, "misses": base_miss, "seconds": base_dt},
        })

    ft_avg = sum(ft_scores) / len(ft_scores)
    base_avg = sum(base_scores) / len(base_scores)
    summary = {
        "fine_tune_avg": ft_avg,
        "base_avg": base_avg,
        "lift_pp": ft_avg - base_avg,
        "n": len(PROBES),
        "results": results,
    }
    Path(args.out).write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\n{'='*72}")
    print(f"SUMMARY  (n={len(PROBES)})")
    print(f"  FINE-TUNE avg citation-score: {ft_avg:.3f}")
    print(f"  BASE      avg citation-score: {base_avg:.3f}")
    print(f"  LIFT:                          {ft_avg - base_avg:+.3f}")
    print(f"  full results -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
