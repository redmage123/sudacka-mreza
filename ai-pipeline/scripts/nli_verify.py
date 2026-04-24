"""
Semantic (NLI) verifier for legal answers.

Regex grounding in 22_pipeline.py catches invented entities (case numbers,
article refs, ECLI, dates). It does NOT catch paraphrase errors — e.g. model
cites the right article but drops a qualifier, or reverses a condition.

This module asks a stronger judge (gemma-4-26b-a4b by default) whether each
claim sentence in the answer is entailed by the cited passages. Output per
sentence:  SUPPORTED | PARTIAL | UNSUPPORTED | NEUTRAL.

Use sparingly — each check is an LLM call. Typical: one call per claim
sentence, 2-5 sentences per answer = 2-5s extra per question.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Literal

import httpx


Verdict = Literal["SUPPORTED", "PARTIAL", "UNSUPPORTED", "NEUTRAL", "PARSE_ERROR"]


SYSTEM = (
    "Ti si provjeritelj pravnih tvrdnji. Za svaku tvrdnju ti dajem "
    "relevantne izvode iz pravnih izvora. Odgovaraš SAMO jednom od "
    "četiri riječi: SUPPORTED, PARTIAL, UNSUPPORTED, NEUTRAL.\n"
    "SUPPORTED  — tvrdnja je u potpunosti potvrđena izvorima\n"
    "PARTIAL    — djelomično potvrđena (dio tvrdnje nije u izvorima)\n"
    "UNSUPPORTED — tvrdnja proturječi izvorima ili nije u njima\n"
    "NEUTRAL    — tvrdnja je generička / uvod bez činjenica\n"
    "Ne objašnjavaj. Samo jedna riječ."
)


def split_sentences(text: str) -> list[str]:
    """Croatian-aware sentence splitter. Keeps citation markers attached."""
    # Protect common abbreviations from being split
    t = re.sub(r"\b(čl|st|tč|br|god|str|al|npr|tzv)\.\s+",
               lambda m: m.group(0).replace(". ", ".# "), text)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-ZŠĐČĆŽ0-9\[])", t)
    return [p.replace(".# ", ". ").strip() for p in parts if p.strip()]


# Sentences that are conversational boilerplate (refusals, disclaimers) need
# not be NLI-checked — they make no factual claim about the world.
_NONCLAIM_RE = re.compile(
    r"(ne mogu odgovoriti|nije moguće odgovoriti|priloženi izvori|"
    r"dostupni izvodi|nisam siguran|preporučujem|sažetak izvoda)",
    flags=re.IGNORECASE,
)


def is_claim(sentence: str) -> bool:
    """Heuristic: skip greetings/refusals/structural markers."""
    if len(sentence) < 15:
        return False
    if _NONCLAIM_RE.search(sentence):
        return False
    return True


CITATION_RE = re.compile(r"\[(\d+)\]")


def cited_in(sentence: str, passages: list[dict]) -> list[dict]:
    """Return the passages a sentence cites. If no [N] markers, return all
    passages (the verifier checks against the full context)."""
    indices = [int(m) for m in CITATION_RE.findall(sentence)]
    if not indices:
        return passages
    out = []
    for i in indices:
        if 1 <= i <= len(passages):
            out.append(passages[i - 1])
    return out or passages


@dataclass
class ClaimCheck:
    sentence: str
    verdict: Verdict
    cited_indices: list[int]
    passages_checked: int
    raw: str = ""


@dataclass
class NLIResult:
    claim_checks: list[ClaimCheck]
    n_claims: int
    n_supported: int
    n_partial: int
    n_unsupported: int
    n_neutral: int
    faithful: bool = field(init=False)

    def __post_init__(self):
        # "faithful" = no UNSUPPORTED verdicts.
        # PARTIAL is flagged but not blocking — caller decides.
        # PARSE_ERROR means the judge failed; don't penalise the answer for
        # infrastructure issues.
        # n_claims == 0 means the answer has no substantive claims to verify
        # (too short, all boilerplate) — also not unfaithful.
        bad = sum(1 for c in self.claim_checks if c.verdict == "UNSUPPORTED")
        self.faithful = (bad == 0)


def _parse_verdict(text: str) -> Verdict:
    t = text.strip().upper()
    for v in ("SUPPORTED", "PARTIAL", "UNSUPPORTED", "NEUTRAL"):
        if v in t:
            return v  # type: ignore[return-value]
    return "PARSE_ERROR"


def nli_verify(answer: str, passages: list[dict],
               endpoint: str = "http://176.9.99.103:11434/api/chat",
               model: str = "gemma-4-e4b-base",
               token: str | None = None,
               max_claims: int = 8,
               timeout: float = 90.0) -> NLIResult:
    """Run NLI over each claim sentence in `answer`.

    `passages` is the metadata list from the pipeline — each must have
    `index` and `text`. We format checks as:

        Izvori:
        [N] <passage text>

        Tvrdnja: <sentence>

        Presuda:
    """
    client = httpx.Client(timeout=timeout)
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    sentences = split_sentences(answer)
    claims = [s for s in sentences if is_claim(s)][:max_claims]

    checks: list[ClaimCheck] = []
    for s in claims:
        cited = cited_in(s, passages)
        ctx = "\n\n".join(f"[{p['index']}] {p['text']}" for p in cited)
        user = f"Izvori:\n{ctx}\n\nTvrdnja: {s}\n\nPresuda (jedna riječ):"
        try:
            if endpoint.endswith("/api/chat"):
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                    "think": False,  # need the verdict word, not reasoning
                    "options": {"temperature": 0.0, "num_predict": 20},
                    "stream": False,
                }
                r = client.post(endpoint, headers=headers, json=body)
                r.raise_for_status()
                raw = r.json().get("message", {}).get("content", "")
            else:
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.0,
                    "max_tokens": 10,
                    "stream": False,
                }
                r = client.post(endpoint, headers=headers, json=body)
                r.raise_for_status()
                raw = r.json()["choices"][0]["message"]["content"]
            verdict = _parse_verdict(raw)
        except Exception as e:
            raw = f"ERROR: {e}"
            verdict = "PARSE_ERROR"
        checks.append(ClaimCheck(
            sentence=s,
            verdict=verdict,
            cited_indices=[int(m) for m in CITATION_RE.findall(s)],
            passages_checked=len(cited),
            raw=raw,
        ))

    counts: dict[str, int] = {}
    for c in checks:
        counts[c.verdict] = counts.get(c.verdict, 0) + 1

    return NLIResult(
        claim_checks=checks,
        n_claims=len(checks),
        n_supported=counts.get("SUPPORTED", 0),
        n_partial=counts.get("PARTIAL", 0),
        n_unsupported=counts.get("UNSUPPORTED", 0),
        n_neutral=counts.get("NEUTRAL", 0),
    )
