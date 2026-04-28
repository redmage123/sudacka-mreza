"""
LoRA fine-tune of gemma-4-e4b-base on the EUR-Lex corpus.

Inputs:
  - /workspace/eurlex/corpus.jsonl  — one document per line, fields:
      celex, lang, date, text
  - Base model: gemma-4-e4b-base (the same model already loaded on the pod)

Outputs:
  - /workspace/finetune/gemma-4-e4b-eurlex-v1/
        adapter_config.json + adapter_model.safetensors  (LoRA)
        merged.gguf      (Q4_K_M, ready for Ollama)
        Modelfile        (Ollama Modelfile pointing at merged.gguf)
        train.log

Pipeline (Unsloth + transformers):
  1. Load gemma-4-e4b-base in 4-bit
  2. Prepare with PEFT LoRA (r=64, alpha=16, target_modules=qkvogp+down_proj)
  3. Tokenize the corpus into 4096-token chunks, packing
  4. SFT for N epochs on language-modelling objective (no instruction format —
     this is continued pretraining on legal text)
  5. Merge LoRA into base, export to GGUF, build Modelfile
  6. Optionally `ollama create gemma-4-e4b-eurlex-v1` if --register

Run on RunPod RTX A5000 (24 GB):
    pip install --quiet 'unsloth[colab]' 'transformers>=4.42' 'datasets' 'peft' 'trl' 'accelerate'
    python finetune-gemma-eurlex.py --epochs=1 --max-seq-len=4096 --register

Estimated wall time: ~12-20 hours for 100K docs at A5000 throughput.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Soft import so this file can be linted without GPU deps installed.
try:
    import torch  # type: ignore
    from datasets import Dataset  # type: ignore
    from transformers import AutoTokenizer, TrainingArguments  # type: ignore
    from trl import SFTTrainer  # type: ignore
    from unsloth import FastLanguageModel  # type: ignore
except ImportError as e:  # pragma: no cover
    print(f"missing GPU deps: {e!r}\nrun: pip install 'unsloth[colab]' transformers datasets peft trl accelerate", file=sys.stderr)
    sys.exit(2)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", default="/workspace/eurlex/corpus.jsonl")
    p.add_argument("--base", default="unsloth/gemma-3n-E4B-it-bnb-4bit")
    p.add_argument("--out", default="/workspace/finetune/gemma-4-e4b-eurlex-v1")
    p.add_argument("--max-seq-len", type=int, default=4096)
    p.add_argument("--epochs", type=int, default=1)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--batch-size", type=int, default=1)
    p.add_argument("--grad-accum", type=int, default=8)
    p.add_argument("--lora-r", type=int, default=64)
    p.add_argument("--lora-alpha", type=int, default=16)
    p.add_argument("--lora-dropout", type=float, default=0.0)
    p.add_argument("--register", action="store_true",
                   help="run 'ollama create' on the merged GGUF when done")
    p.add_argument("--max-docs", type=int, default=0,
                   help="cap on docs (0 = use all)")
    return p.parse_args()


def load_corpus(path: str, max_docs: int) -> Dataset:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            t = (obj.get("text") or "").strip()
            if len(t) < 500:
                continue
            rows.append({"text": t})
            if max_docs and len(rows) >= max_docs:
                break
    print(f"loaded {len(rows)} docs from {path}")
    return Dataset.from_list(rows)


def main() -> None:
    args = parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("loading base model + tokenizer (4-bit)…")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base,
        max_seq_length=args.max_seq_len,
        dtype=None,  # auto
        load_in_4bit=True,
    )
    # Gemma 3n loads as a multimodal Processor. SFTTrainer wants a plain
    # PreTrainedTokenizer — unwrap if needed.
    if hasattr(tokenizer, "tokenizer"):
        tokenizer = tokenizer.tokenizer
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    ds = load_corpus(args.corpus, args.max_docs)

    print("starting SFT trainer…")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        dataset_text_field="text",
        max_seq_length=args.max_seq_len,
        packing=True,
        args=TrainingArguments(
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=args.grad_accum,
            num_train_epochs=args.epochs,
            learning_rate=args.lr,
            warmup_ratio=0.03,
            logging_steps=20,
            save_steps=500,
            save_total_limit=2,
            output_dir=str(out / "checkpoints"),
            optim="adamw_8bit",
            bf16=torch.cuda.is_bf16_supported(),
            fp16=not torch.cuda.is_bf16_supported(),
            report_to="none",
        ),
    )
    trainer.train()

    print("saving LoRA adapters…")
    model.save_pretrained(str(out / "lora"))
    tokenizer.save_pretrained(str(out / "lora"))

    print("merging LoRA into base + exporting GGUF Q4_K_M…")
    model.save_pretrained_gguf(
        str(out),
        tokenizer,
        quantization_method="q4_k_m",
    )

    # Ollama Modelfile pointing at the produced GGUF.
    gguf = next(out.glob("*.gguf"))
    modelfile = out / "Modelfile"
    modelfile.write_text(
        f"FROM {gguf.name}\n"
        f"PARAMETER num_ctx 8192\n"
        f"PARAMETER temperature 0.3\n"
        f"PARAMETER stop \"<end_of_turn>\"\n"
        f"PARAMETER stop \"<start_of_turn>\"\n"
        f"PARAMETER stop \"<eos>\"\n"
        f"SYSTEM \"\"\"You are a legal assistant trained on EU and Croatian law. "
        f"Cite statute names and article numbers verbatim, in their original language.\"\"\"\n"
    )
    print(f"wrote {modelfile}")

    if args.register:
        env = os.environ.copy()
        env.setdefault("OLLAMA_HOST", "127.0.0.1:11434")
        env.setdefault("OLLAMA_MODELS", "/workspace/ollama/models")
        subprocess.run(
            ["ollama", "create", "gemma-4-e4b-eurlex-v1", "-f", str(modelfile)],
            cwd=str(out), check=True, env=env,
        )
        print("registered as gemma-4-e4b-eurlex-v1 in Ollama")


if __name__ == "__main__":
    main()
