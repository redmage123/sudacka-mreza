# Sudačka Mreža AI Pipeline

Retrieval-grounded Q&A over Croatian legal materials (statutes + court decisions
+ commentary). Answers come back with their supporting passages so the end user
can verify every claim against the primary source.

This directory is the **source of truth for the pipeline code**. The running
service on the GPU host executes from `/home/bbrelin/sudacka-finetune/` —
data, indexes, the Python venv and GGUF adapters live there and are not
version-controlled (regenerable). See *Sync to the live host* below.

## Architecture

```
question
  → [retrieve]      hybrid BM25+dense (nomic-embed-text), RRF fusion
                    + exact case-number lookup shortcut for judicial IDs
  → [confidence]    refuse early if retrieval signal is weak
  → [LLM]           Gemma 4 E4B Croatian-legal (v3-robust), think=False
  → [verify]        regex (citation validity, entity grounding)
                    + NLI judge (gemma-4-e4b-base) for paraphrase errors
  → [output]        structured: answer + passages + verification + NLI
```

The API never returns an answer without its supporting passages attached. That
contract is what makes this safe for legal work: the end user is the final
human-in-the-loop for the 2% the automation can't prove, and they can verify in
~15 seconds by reading the cited source.

## Files

- `scripts/retrieval.py` — hybrid retriever library; case-number shortcut
- `scripts/20_build_index.py` — FAISS + BM25 indexer
- `scripts/22_pipeline.py` — inference pipeline (retrieve → LLM → verify)
- `scripts/nli_verify.py` — semantic verifier (Gemma 4 E4B as judge)
- `scripts/23_eval_pipeline.py` — faithfulness eval harness
- `scripts/24_serve.py` — FastAPI endpoint (mounted at `:8191` on the GPU host,
  fronted by nginx bearer-auth on `:8190`)
- `scripts/01..13_*.py` — corpus collection + QLoRA training pipeline
  (NB: not deployed, only needed for periodic retraining)
- `deploy/sudacka-legal-ai.service` — systemd unit for the FastAPI endpoint
- `deploy/sudacka-legal-ai.nginx` — bearer-auth proxy in front of FastAPI
- `config.yaml` — corpus scraping + training config
- `Makefile` — `make index`, `make ask Q='…'`, `make pipeline-eval`, `make serve`
- `requirements.txt` — Python deps for the pipeline

## Production topology

- **GPU host** (Ollama + FastAPI): `/home/bbrelin/sudacka-finetune/` with a
  cached venv, FAISS index (24,587 chunks), BM25 pickle, and ~20 GB of model
  adapters. Ollama container on `127.0.0.1:11435`, nginx bearer-auth on
  `:11434`. Legal-AI FastAPI on `127.0.0.1:8191`, nginx bearer-auth on
  `:8190`.
- **CMS (Toronto)**: Payload server proxies `POST /api/legal-ai/ask` →
  `http://<gpu-host>:8190/ask` with the `LEGAL_AI_TOKEN` bearer token.
- **Web**: React page at `/pravni-asistent` calls same-origin `/api/legal-ai/ask`
  through the CMS; never sees a token.

## Sync to the live host

```bash
# From the sudacka-mreza repo root, on the GPU host:
rsync -a --delete \
    ai-pipeline/scripts/ ai-pipeline/deploy/ ai-pipeline/Makefile \
    ai-pipeline/config.yaml ai-pipeline/requirements.txt \
    /home/bbrelin/sudacka-finetune/
sudo systemctl restart sudacka-legal-ai
```

Index data and venv are not touched — only the Python source.

## Faithfulness eval (50 samples, v3-robust + NLI + case-ID shortcut)

| Metric | Value |
|---|---|
| answered | 98% |
| refused | 0% |
| flagged (verifier caught a possible issue) | 2% |
| retrieval_recall@6 | 98% |
| answered_faithfulness (regex) | 100% |
| NLI SUPPORTED | 100% (64/64 claims) |
| NLI UNSUPPORTED | 0 |

## Bearer tokens — NOT in this repo

- `OLLAMA_TOKEN` — used by the pipeline to call the Ollama nginx proxy.
  On the GPU host, stored in `/etc/sudacka-legal-ai.env` (mode 0640, root:bbrelin),
  read by the systemd unit via `EnvironmentFile=`.
- `LEGAL_AI_BEARER_TOKEN` — substituted into the nginx config at install time.
  See the comment in `deploy/sudacka-legal-ai.nginx`.
- CMS reads `LEGAL_AI_TOKEN` from its environment (see `.env.example`).

## Gotchas worth remembering

- **Gemma 4's thinking mode breaks OpenAI-compat.** `/v1/chat/completions`
  returns empty `content` when thinking tokens fill the stream. The pipeline
  uses native `/api/chat` with `"think": false`.
- **Model trails the real answer with context delimiters.** The pipeline's
  `trim_llm_output` strips anything after `--- END CONTEXT ---`, `Pitanje:`,
  etc. Otherwise the regex verifier fires on leaked boilerplate.
- **26B judge is too big.** `gemma-4-26b-a4b` won't coexist with the main
  model on the 20 GB dev GPU. `gemma-4-e4b-base` is the stable NLI judge.
- **Hybrid retrieval loses exact case-number lookups** in a corpus of 9,169
  similar court decisions. The retriever has a dedicated exact-id shortcut
  for Croatian judicial identifiers (`Pp-4159/2024-5` etc.).
