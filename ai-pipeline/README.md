# sudacka-finetune

QLoRA fine-tune pipeline for `gemma-4-26b-a4b` targeted at Croatian legal
reasoning. Trains on the Sudačka Mreža corpus (10K+ court decisions),
Croatian primary legislation (Narodne Novine), EU law in Croatian
(EUR-Lex), and any textbooks you drop into `textbooks/`.

Expected final artifact: a Q4_K_M GGUF + Ollama `Modelfile` that replaces
the vanilla 26B currently served on the dev server.

## Pipeline stages

| Script | Runs on | Purpose |
|---|---|---|
| `01_pull_db_corpus.py` | Toronto (CPU) | Postgres → `data/raw/db_*.jsonl` |
| `02_scrape_narodne_novine.py` | anywhere (CPU) | HR statutes → `data/raw/narodne_novine.jsonl` |
| `03_scrape_eurlex.py` | anywhere (CPU) | EU law HR → `data/raw/eurlex.jsonl` |
| `04_ingest_pdfs.py` | anywhere (CPU; `tesseract` for OCR) | textbooks → `data/raw/textbooks.jsonl` |
| `05_build_instructions.py` | anywhere (calls dev-server Gemma for synthesis) | → `data/instructions/{train,eval}.jsonl` |
| `06_train_qlora.py` | RunPod GPU | adapter at `adapters/gemma-4-26b-croatian-legal/` |
| `07_merge_and_quantize.py` | RunPod A100 or CPU-offload | merged HF + F16 GGUF + Q4_K_M GGUF + Modelfile |
| `08_eval.py` | anywhere | entity-recall sanity check against the Ollama model |

All stages are resumable. Each reads from its input JSONL if present.

## Quick start

### 1. Install
```bash
cd ~/sudacka-finetune
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # skip the GPU libs if CPU-only for collection
```

### 2. Set env vars
```bash
export HF_TOKEN=<your hugging face token>
export POSTGRES_PASSWORD=<Sudacka DB password>
```
The HF token needs Gemma 4 gated-repo access. Confirmed already granted on
`bbrelin`.

### 3. Collect corpus (on Toronto server, ~1-2h)
Tunnel the Sudačka DB first, or run this on 23.164.48.64 directly:
```bash
make corpus       # or: make db nn eurlex pdfs individually
```

### 4. Synthesise instructions (~4-8h, uses dev-server Gemma)
```bash
make instructions
# For a fast rule-only dataset (no LLM calls, no internet):
make instructions-rules-only
```

### 5. Smoke-test the trainer (on RunPod, 10-15 min)
Verifies VRAM fits the 26B + LoRA before committing to the full run.
```bash
make smoke-train
```

### 6. Full training (on RunPod, ~30-40h on 4090 / ~10-15h on A100)
```bash
make train
# If the pod disconnects mid-run:
make train-resume
```

### 7. Merge + quantize (requires an A100/H100 pod or CPU w/ 64+GB RAM)
```bash
# First build llama.cpp next to this repo:
#   git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp && make
make export
```

### 8. Import into Ollama on the dev server
```bash
# From RunPod:
scp adapters/gemma-4-26b-croatian-legal.gguf bbrelin@176.9.99.103:/tmp/
scp adapters/gemma-4-26b-croatian-legal/Modelfile bbrelin@176.9.99.103:/tmp/
# On 176.9.99.103:
ollama create gemma-4-croatian-legal -f /tmp/Modelfile
ollama run gemma-4-croatian-legal "Objasni isplatni red u stečaju."
```

### 9. Evaluate
```bash
make eval
```

## Hyperparameters — where to tune

All in `config.yaml`. Most common changes:

- `train.lora_r` / `train.lora_alpha` — higher = more capacity but more VRAM and over-fitting risk. 32/64 is the default here; 64/128 is viable on A100.
- `train.max_seq_length` — raise to 4096 if you move to an A100 80GB.
- `instructions.requests_per_source` — more Q&A pairs per doc = larger dataset but longer synthesis time.
- `narodne_novine.max_acts_per_year` + `eurlex.max_docs_per_sector` — raise these for fuller coverage once a smoke-train works.

## VRAM budget on RTX 4090 (24 GB)

| Component | Approx |
|---|---|
| 26B base at NF4 | 14 GB |
| LoRA adapter + activations (seq=2048, GC) | 6 GB |
| Paged AdamW 8-bit state | 2 GB |
| Cache + headroom | 1–2 GB |
| **Total** | ~23 GB |

If OOM: drop `max_seq_length` to 1024, then 512. If still OOM, rent a
larger pod (A100 40GB @ $1.19/hr or 80GB @ $1.89/hr).

## What's in the training dataset

From `data/raw/`:
- **Sudačka DB**: ~9,170 Croatian court decisions with full text, 620 ECHR, 514 VSRH
- **Narodne Novine**: up to 120 Acts of Parliament per year × 7 years = ~840 statutes
- **EUR-Lex**: 1,500 directives/regulations + 1,500 ECJ cases in Croatian
- **Textbooks**: whatever you put in `textbooks/` (OCR'd if scanned)

After instruction synthesis:
- Rule-based pairs (court/date/ECLI/summary) × ~9,500 decisions ≈ 30,000 rows
- LLM-synthesised Q&A × up to 3 per doc × ~14,000 docs ≈ 42,000 rows
- Combined ~70,000 training rows (5% held out for eval)

## Known limitations

1. **Narodne Novine scraping is pagination-limited** — the initial pull grabs the first page of each year's listing. For deeper coverage, implement the paginator in `extract_act_links`.
2. **EUR-Lex SPARQL endpoint rate-limits aggressively.** If you see 429s, reduce `eurlex.max_docs_per_sector` or add a longer request_delay.
3. **LLM synthesis cost:** the dev-server Gemma is free but slow. ~14K doc synthesis = 42K requests × ~3 s each = ~35 h wall clock. Parallelism is set at 4 workers; raising it helps until the GPU saturates.
4. **Copyright:** court decisions and NN statutes are public domain in Croatia. EU law is public domain. Textbooks are not — only include what you're licensed to train on.
5. **Evaluation is deliberately crude** — entity-recall substring scoring gives a rough signal, not a publication-quality benchmark. For a real eval, swap in LegalBench-HR or similar once available.
