#!/usr/bin/env python3
"""
QLoRA fine-tune Gemma 4 26B-A4B on the Croatian legal instruction dataset.

Runs on the RunPod RTX 4090 Community pod (24 GB). Memory budget:
  - 26B in 4-bit NF4                    ~14 GB
  - LoRA adapter params                 <1  GB
  - Activations (seq=2048, batch=1, GC) ~6  GB
  - Paged AdamW 8-bit optimizer state   ~2  GB
  Total                                 ~23 GB — fits with ~1 GB headroom.

Expected duration on an RTX 4090 for ~5000 training rows × 2 epochs:
  roughly 30-40 hours → ~$14-17 on the Community tier.

Resumable: pass --resume to continue from the newest checkpoint in output_dir.
Use --smoke-test for a 20-step dry run on 200 rows to verify the pipeline
fits in VRAM before you commit to the full run.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INSTRUCTIONS_DIR, get_logger, load_config  # noqa: E402

log = get_logger("train")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--resume", action="store_true",
                    help="resume from the newest checkpoint-* in output_dir")
    ap.add_argument("--smoke-test", action="store_true",
                    help="tiny run (20 steps, 200 samples) for pipeline validation")
    ap.add_argument("--output-dir", default=None,
                    help="override train.output_dir from config")
    ap.add_argument("--train-file", default="train.jsonl",
                    help="filename under data/instructions/ to train on "
                         "(e.g. train_rag.jsonl for RAG-aware data)")
    args = ap.parse_args()

    cfg = load_config(args.config)
    tcfg = cfg["train"]
    smoke = args.smoke_test or tcfg.get("smoke_test", False)

    # Heavy imports only when we actually train — lets scripts 01-05 run on
    # a machine without CUDA/Unsloth installed.
    import torch
    from datasets import load_dataset
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    from trl import SFTConfig, SFTTrainer

    output_dir = Path(args.output_dir or tcfg["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    log.info("output: %s", output_dir)
    log.info("cuda available: %s  devices=%d", torch.cuda.is_available(), torch.cuda.device_count())

    train_path = INSTRUCTIONS_DIR / args.train_file
    if not train_path.exists():
        log.error("no training data at %s — run 05_build_instructions.py first", train_path)
        return 1

    ds = load_dataset("json", data_files=str(train_path), split="train")
    if smoke:
        ds = ds.select(range(min(200, len(ds))))
        log.info("SMOKE TEST MODE — dataset truncated to %d rows", len(ds))
    else:
        log.info("dataset loaded — %d rows", len(ds))

    # ── Model ──────────────────────────────────────────────────────────────
    hf_token = cfg.get("hf_token") or os.environ.get("HF_TOKEN")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=cfg["base_model"],
        max_seq_length=tcfg["max_seq_length"],
        dtype=None,              # auto
        load_in_4bit=cfg.get("load_in_4bit", True),
        token=hf_token,
    )

    # Gemma 4 ships a correct chat template; Unsloth exposes a cleaner alias.
    tokenizer = get_chat_template(tokenizer, chat_template="gemma")

    model = FastLanguageModel.get_peft_model(
        model,
        r=tcfg["lora_r"],
        lora_alpha=tcfg["lora_alpha"],
        lora_dropout=tcfg["lora_dropout"],
        bias="none",
        target_modules=tcfg["target_modules"],
        use_gradient_checkpointing="unsloth",
        random_state=tcfg["seed"],
    )

    # ── Dataset formatting ─────────────────────────────────────────────────
    # We only train on text. Gemma 4 ships as a multi-modal processor that
    # wraps a text tokenizer — render the chat with `tokenize=False` and
    # encode the resulting string with the inner text tokenizer to avoid the
    # processor's image/video code path.
    max_len = tcfg["max_seq_length"]
    text_tokenizer = getattr(tokenizer, "tokenizer", tokenizer)

    def tokenize_row(example):
        msgs = example.get("messages") or []
        if not msgs:
            return {"input_ids": [], "attention_mask": [], "labels": []}
        rendered = tokenizer.apply_chat_template(
            msgs,
            tokenize=False,
            add_generation_prompt=False,
        )
        enc = text_tokenizer(
            rendered,
            truncation=True,
            max_length=max_len,
            add_special_tokens=False,
            return_attention_mask=True,
        )
        ids = enc["input_ids"]
        mask = enc.get("attention_mask") or [1] * len(ids)
        return {
            "input_ids": ids,
            "attention_mask": mask,
            "labels": list(ids),
        }

    ds = ds.map(tokenize_row, remove_columns=ds.column_names)
    before = len(ds)
    ds = ds.filter(lambda ex: len(ex["input_ids"]) > 8)
    log.info("tokenized %d rows (dropped %d empty)", len(ds), before - len(ds))
    if len(ds) == 0:
        log.error("no rows survived tokenization — aborting")
        return 1
    log.info("dataset tokenized — first example len=%d", len(ds[0]["input_ids"]))

    # ── Trainer config ─────────────────────────────────────────────────────
    sft_config = SFTConfig(
        output_dir=str(output_dir),
        num_train_epochs=tcfg["num_train_epochs"] if not smoke else 1,
        per_device_train_batch_size=tcfg["per_device_train_batch_size"],
        gradient_accumulation_steps=tcfg["gradient_accumulation_steps"],
        learning_rate=tcfg["learning_rate"],
        lr_scheduler_type=tcfg["lr_scheduler_type"],
        warmup_ratio=tcfg["warmup_ratio"],
        weight_decay=tcfg["weight_decay"],
        max_grad_norm=tcfg["max_grad_norm"],
        optim=tcfg["optim"],
        logging_steps=tcfg["logging_steps"],
        save_steps=tcfg["save_steps"] if not smoke else 10,
        save_total_limit=tcfg["save_total_limit"],
        max_steps=20 if smoke else -1,
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        gradient_checkpointing=tcfg["gradient_checkpointing"],
        max_length=tcfg["max_seq_length"],
        packing=False,
        seed=tcfg["seed"],
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=ds,
        args=sft_config,
    )

    resume_from = None
    if args.resume:
        ckpts = sorted(output_dir.glob("checkpoint-*"),
                       key=lambda p: int(p.name.split("-")[-1]))
        if ckpts:
            resume_from = str(ckpts[-1])
            log.info("resuming from %s", resume_from)

    trainer.train(resume_from_checkpoint=resume_from)

    log.info("training complete; saving final adapter")
    trainer.save_model(str(output_dir / "final"))
    tokenizer.save_pretrained(str(output_dir / "final"))
    log.info("final adapter saved to %s", output_dir / "final")
    return 0


if __name__ == "__main__":
    sys.exit(main())
