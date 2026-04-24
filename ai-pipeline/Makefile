# Sudačka-finetune pipeline. Each target is idempotent.
# Standard run order:
#   make corpus            # all data collection
#   make instructions      # synth Q&A from corpus
#   make train             # QLoRA on GPU
#   make export            # merge + quantize + Modelfile
#   make eval              # sanity-check the deployed model
#
# Data-collection targets can run on the Toronto server; train/export/eval
# require a CUDA GPU and the training-side requirements.

PY := python3
CONFIG := config.yaml

.PHONY: all corpus db nn eurlex pdfs instructions train smoke-train export eval clean

all: corpus instructions train export

# ── Data collection ────────────────────────────────────────────────────────
corpus: db nn eurlex pdfs

db:
	$(PY) scripts/01_pull_db_corpus.py --config $(CONFIG)

nn:
	$(PY) scripts/02_scrape_narodne_novine.py --config $(CONFIG)

eurlex:
	$(PY) scripts/03_scrape_eurlex.py --config $(CONFIG)

pdfs:
	$(PY) scripts/04_ingest_pdfs.py --config $(CONFIG)

# ── Instruction synthesis ──────────────────────────────────────────────────
instructions:
	$(PY) scripts/05_build_instructions.py --config $(CONFIG)

# Quick check that templates work without LLM calls (free, fast).
instructions-rules-only:
	$(PY) scripts/05_build_instructions.py --config $(CONFIG) --no-llm

# ── Training ───────────────────────────────────────────────────────────────
train:
	$(PY) scripts/06_train_qlora.py --config $(CONFIG)

# Verify the training loop fits in VRAM before committing to a full run.
smoke-train:
	$(PY) scripts/06_train_qlora.py --config $(CONFIG) --smoke-test

train-resume:
	$(PY) scripts/06_train_qlora.py --config $(CONFIG) --resume

# ── Export + quantization ──────────────────────────────────────────────────
export:
	$(PY) scripts/07_merge_and_quantize.py --config $(CONFIG)

# ── Eval against the deployed Ollama model ────────────────────────────────
eval:
	$(PY) scripts/08_eval.py --config $(CONFIG)

# ── Retrieval pipeline ─────────────────────────────────────────────────────
# Requires OLLAMA_TOKEN in the environment.
#
# Standard run order for the production QA pipeline:
#   make index         # build FAISS + BM25 over the corpus (one time)
#   make ask Q="..."   # smoke-test a single question
#   make pipeline-eval # faithfulness eval across all Gemma variants
#   make serve         # start the FastAPI service on :8190

INDEX_ROOT ?= indexes/default
PIPE_MODEL ?= gemma-4-e4b-croatian-legal
PIPE_SAMPLES ?= 50

.PHONY: index ask pipeline-eval serve

index:
	$(PY) scripts/20_build_index.py --index-root $(INDEX_ROOT)

index-force:
	$(PY) scripts/20_build_index.py --index-root $(INDEX_ROOT) --force

ask:
	@[ -n "$(Q)" ] || (echo "usage: make ask Q='<pitanje>'" >&2; exit 2)
	$(PY) scripts/22_pipeline.py --model $(PIPE_MODEL) --index-root $(INDEX_ROOT) "$(Q)"

ask-nli:
	@[ -n "$(Q)" ] || (echo "usage: make ask-nli Q='<pitanje>'" >&2; exit 2)
	$(PY) scripts/22_pipeline.py --nli --model $(PIPE_MODEL) --index-root $(INDEX_ROOT) "$(Q)"

pipeline-eval:
	$(PY) scripts/23_eval_pipeline.py --model $(PIPE_MODEL) --index-root $(INDEX_ROOT) --samples $(PIPE_SAMPLES)

pipeline-eval-all:
	@for m in gemma-4-e4b-croatian-legal gemma-4-e4b-croatian-legal-v2-rag gemma-4-e4b-croatian-legal-v3-robust gemma-4-26b-a4b; do \
	  echo "=== $$m ===" ; \
	  $(PY) scripts/23_eval_pipeline.py --model $$m --index-root $(INDEX_ROOT) --samples $(PIPE_SAMPLES) ; \
	done

serve:
	LLM_MODEL=$(PIPE_MODEL) INDEX_ROOT=$(INDEX_ROOT) $(PY) scripts/24_serve.py

# ── Cleanup ────────────────────────────────────────────────────────────────
clean:
	rm -rf data/raw/*.jsonl data/instructions/*.jsonl
