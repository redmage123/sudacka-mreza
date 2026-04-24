#!/usr/bin/env python3
"""
Production serving endpoint for the legal Q&A pipeline.

Design rule: the API never returns an answer without its supporting
passages attached.  The client can render the answer plus collapsible
source panels — the end user always has the ability to verify every
claim against the source in ~15 seconds.  That is the human-in-the-loop
we keep.

Endpoints:
    GET  /health           — liveness
    POST /ask              — {question} → structured answer
    GET  /passage/{id}     — fetch a chunk by chunk_id (for UI deep-links)

Run:
    OLLAMA_TOKEN=... uvicorn scripts.24_serve:app --host 0.0.0.0 --port 8190
or:
    OLLAMA_TOKEN=... python3 scripts/24_serve.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO_ROOT, get_logger  # noqa: E402
from importlib import import_module  # noqa: E402
pipeline_mod = import_module("22_pipeline")
LegalQAPipeline = pipeline_mod.LegalQAPipeline
PipelineConfig = pipeline_mod.PipelineConfig

log = get_logger("serve")


# ── Config from env ──────────────────────────────────────────────────────
INDEX_ROOT = os.getenv("INDEX_ROOT", str(REPO_ROOT / "indexes" / "default"))
LLM_MODEL = os.getenv("LLM_MODEL", "gemma-4-e4b-croatian-legal")
NLI_ENABLED = os.getenv("NLI_VERIFY", "0") == "1"
NLI_MODEL = os.getenv("NLI_MODEL", "gemma-4-e4b-base")
TOKEN = os.getenv("OLLAMA_TOKEN")
if not TOKEN:
    raise RuntimeError("OLLAMA_TOKEN not set")

cfg = PipelineConfig(
    index_root=INDEX_ROOT,
    llm_model=LLM_MODEL,
    token=TOKEN,
    nli_verify=NLI_ENABLED,
    nli_model=NLI_MODEL,
)
pipe = LegalQAPipeline(cfg)
log.info("pipeline ready — model=%s nli=%s", LLM_MODEL, NLI_ENABLED)


# ── API models ───────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    k: int | None = Field(None, ge=1, le=20)


class PassageOut(BaseModel):
    index: int
    chunk_id: str
    source_id: str
    kind: str
    title: str
    url: str
    text: str
    case_number: str | None = None
    article_number: str | None = None


class AskResponse(BaseModel):
    question: str
    answer: str
    status: str                 # answered | refused_low_retrieval | refused_by_model | flagged | flagged_nli | llm_error
    passages: list[PassageOut]  # ALWAYS returned — never an answer without sources
    trustworthy: bool           # convenience: status == 'answered' and all verif checks passed
    # Diagnostics so the UI can surface uncertainty to the user
    retrieval: dict
    verification: dict | None
    nli: dict | None


app = FastAPI(
    title="Sudačka Mreža Legal Q&A",
    version="1.0.0",
    description=(
        "Hrvatsko pravo — upit + izvori. Svaki odgovor dolazi s pripadajućim "
        "pasusima. Ako izvori ne potkrepljuju odgovor, sustav odbija odgovoriti."
    ),
)


@app.get("/health")
def health():
    return {"status": "ok", "model": LLM_MODEL, "n_chunks": len(pipe.retriever.chunks)}


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    try:
        if req.k:
            pipe.cfg.k = req.k
        r = pipe.answer(req.question)
    except Exception as e:
        log.exception("pipeline error")
        raise HTTPException(status_code=500, detail=f"pipeline error: {e}")

    trustworthy = r.get("status") == "answered"
    return {
        "question": r["question"],
        "answer": r.get("answer", ""),
        "status": r["status"],
        "passages": r.get("passages", []),
        "trustworthy": trustworthy,
        "retrieval": r.get("retrieval", {}),
        "verification": r.get("verification"),
        "nli": r.get("nli"),
    }


@app.get("/passage/{chunk_id}")
def get_passage(chunk_id: str):
    for c in pipe.retriever.chunks:
        if c.chunk_id == chunk_id:
            return c.to_dict()
    raise HTTPException(status_code=404, detail="chunk not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8190")))
