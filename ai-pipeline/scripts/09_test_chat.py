#!/usr/bin/env python3
"""
Interactive test of the trained Croatian-legal adapter.

Loads base Gemma-4 E4B + the LoRA adapter in 4-bit on the dev-server GPU
(same VRAM budget as training — no merge step required). Runs either:

  --questions-file /path/to/questions.txt    # one Q per line, prints answers
  --batch                                    # runs a built-in smoke battery
  (no flag)                                  # interactive REPL

Examples:
  python scripts/09_test_chat.py --batch
  python scripts/09_test_chat.py
  python scripts/09_test_chat.py --adapter adapters/gemma-4-e4b-croatian-legal/checkpoint-1000
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import get_logger, load_config  # noqa: E402

log = get_logger("test-chat")

SYSTEM_PROMPT = (
    "Ti si pravni asistent specijaliziran za hrvatsko i europsko pravo. "
    "Odgovaraj precizno, citiraj relevantne članke i presude, i koristi "
    "jezik stranke."
)

SMOKE_QUESTIONS = [
    "Koja je kazna za razbojništvo oružjem u Hrvatskoj?",
    "Koji članak Kaznenog zakona regulira teško ubojstvo?",
    "Koji je rok za podnošenje žalbe na prvostupanjsku presudu u građanskom postupku?",
    "Koja je razlika između ovrhe na pokretninama i ovrhe na nekretninama?",
    "Koje su obveze stečajnog upravitelja prema Stečajnom zakonu?",
    "Što je pretpostavka nevinosti u hrvatskom kaznenom pravu?",
    "Koji su zakonski rokovi zastare za naplatu potraživanja?",
    "Kako se utvrđuje nadležnost suda u radnim sporovima?",
    "Koja prava ima žrtva obiteljskog nasilja prema hrvatskom zakonu?",
    "Što je in dubio pro reo i u kojem članku ZKP-a je definirano?",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--adapter", default=None,
                    help="path to the LoRA adapter dir (defaults to train.output_dir/final)")
    ap.add_argument("--batch", action="store_true",
                    help="run the built-in smoke battery")
    ap.add_argument("--questions-file", default=None,
                    help="newline-separated questions to ask")
    ap.add_argument("--max-new-tokens", type=int, default=512)
    ap.add_argument("--temperature", type=float, default=0.3)
    ap.add_argument("--top-p", type=float, default=0.9)
    ap.add_argument("--base-model", action="store_true",
                    help="skip adapter — query the base model for comparison")
    args = ap.parse_args()

    cfg = load_config(args.config)
    tcfg = cfg["train"]
    adapter_dir = Path(args.adapter or (Path(tcfg["output_dir"]) / "final"))
    if not args.base_model and not adapter_dir.exists():
        log.error("adapter dir not found: %s", adapter_dir)
        return 1

    # Heavy imports only when actually running
    import torch
    from unsloth import FastLanguageModel
    from unsloth.chat_templates import get_chat_template
    from peft import PeftModel

    log.info("loading base model (4-bit) %s", cfg["base_model"])
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=cfg["base_model"],
        max_seq_length=tcfg["max_seq_length"],
        dtype=None,
        load_in_4bit=cfg.get("load_in_4bit", True),
        token=cfg.get("hf_token"),
    )
    tokenizer = get_chat_template(tokenizer, chat_template="gemma")
    text_tokenizer = getattr(tokenizer, "tokenizer", tokenizer)

    if not args.base_model:
        log.info("applying LoRA adapter from %s", adapter_dir)
        model = PeftModel.from_pretrained(model, str(adapter_dir))

    FastLanguageModel.for_inference(model)
    model.eval()

    def ask(question: str) -> str:
        msgs = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ]
        rendered = tokenizer.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=True
        )
        enc = text_tokenizer(rendered, return_tensors="pt", add_special_tokens=False)
        input_ids = enc["input_ids"].to(model.device)
        attn = enc["attention_mask"].to(model.device)
        with torch.inference_mode():
            out = model.generate(
                input_ids=input_ids,
                attention_mask=attn,
                max_new_tokens=args.max_new_tokens,
                do_sample=args.temperature > 0,
                temperature=args.temperature,
                top_p=args.top_p,
                pad_token_id=text_tokenizer.pad_token_id or text_tokenizer.eos_token_id,
            )
        prompt_len = input_ids.shape[1]
        completion = out[0, prompt_len:]
        return text_tokenizer.decode(completion, skip_special_tokens=True).strip()

    # Run mode
    if args.questions_file:
        qs = [ln.strip() for ln in Path(args.questions_file).read_text(encoding="utf-8").splitlines() if ln.strip()]
    elif args.batch:
        qs = SMOKE_QUESTIONS
    else:
        qs = None

    if qs is not None:
        for i, q in enumerate(qs, 1):
            print(f"\n=== Q{i}: {q}")
            print(f"--- A: {ask(q)}")
        return 0

    # Interactive REPL
    print("\nCroatian-legal REPL  (empty line or ^C to quit)")
    print(f"Model: {cfg['base_model']} + {'BASE ONLY' if args.base_model else adapter_dir.name}")
    try:
        while True:
            q = input("\n> ").strip()
            if not q:
                break
            print(ask(q))
    except (KeyboardInterrupt, EOFError):
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
