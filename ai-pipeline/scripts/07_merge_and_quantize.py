#!/usr/bin/env python3
"""
Merge the trained LoRA adapter back into the base model and export a GGUF
ready to drop into Ollama on the dev server.

Steps:
  1. Load 26B base in full precision (bf16) + apply LoRA adapter.
  2. Merge adapter weights into base → regular HF checkpoint.
  3. Convert merged HF checkpoint to GGUF F16 via llama.cpp's
     convert_hf_to_gguf.py.
  4. Quantize F16 GGUF → Q4_K_M via llama.cpp's `llama-quantize` binary.
  5. Write an Ollama Modelfile pointing at the quantized GGUF with the
     Croatian legal system prompt.

Requires: llama.cpp cloned next to this repo (or pass --llama-cpp).
Disk budget: ~110 GB temp (bf16 merged HF + F16 GGUF + Q4 GGUF).
VRAM budget for the merge: ~55 GB — use an A100 80GB pod or CPU-offload.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import get_logger, load_config  # noqa: E402

log = get_logger("merge-quantize")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--adapter", default=None, help="path to the LoRA adapter (defaults to train.output_dir/final)")
    ap.add_argument("--merged-dir", default=None, help="where to write the merged HF checkpoint")
    ap.add_argument("--llama-cpp", default="../llama.cpp",
                    help="path to a built llama.cpp checkout")
    ap.add_argument("--skip-merge", action="store_true")
    ap.add_argument("--skip-convert", action="store_true")
    ap.add_argument("--skip-quantize", action="store_true")
    args = ap.parse_args()

    cfg = load_config(args.config)
    tcfg = cfg["train"]
    xcfg = cfg["export"]

    adapter_path = Path(args.adapter or (Path(tcfg["output_dir"]) / "final"))
    merged_dir = Path(args.merged_dir or (Path(tcfg["output_dir"]) / "merged"))
    f16_gguf = Path(xcfg["gguf_output"]).with_suffix(".f16.gguf")
    q4_gguf = Path(xcfg["gguf_output"])
    llama_cpp = Path(args.llama_cpp)

    # ── 1. Merge adapter into base ────────────────────────────────────────
    if not args.skip_merge:
        log.info("=== merging adapter into base ===")
        # Gemma-4 uses `Gemma4ClippableLinear` wrappers that stock PEFT cannot
        # inject into. Point Unsloth at the adapter directory directly —
        # it reads `base_model_name_or_path` from adapter_config.json, loads
        # the base, unwraps the Clippable linears, and applies the adapter
        # in one shot. Then merge through Unsloth's helper.
        from unsloth import FastLanguageModel

        hf_token = cfg.get("hf_token") or os.environ.get("HF_TOKEN")
        log.info("loading adapter dir via Unsloth: %s", adapter_path)
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=str(adapter_path),
            max_seq_length=tcfg["max_seq_length"],
            dtype=None,
            load_in_4bit=cfg.get("load_in_4bit", True),
            token=hf_token,
        )
        log.info("merging LoRA weights → bf16 HF checkpoint (save_method=merged_16bit)...")
        merged_dir.mkdir(parents=True, exist_ok=True)
        model.save_pretrained_merged(
            str(merged_dir),
            tokenizer,
            save_method="merged_16bit",
        )
        log.info("merged checkpoint written to %s", merged_dir)

    # ── 2. Convert merged HF → F16 GGUF ───────────────────────────────────
    if not args.skip_convert:
        log.info("=== converting merged HF to F16 GGUF ===")
        conv_script = llama_cpp / "convert_hf_to_gguf.py"
        if not conv_script.exists():
            log.error("expected llama.cpp convert script at %s — pass --llama-cpp", conv_script)
            return 1
        f16_gguf.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            sys.executable, str(conv_script), str(merged_dir),
            "--outfile", str(f16_gguf), "--outtype", "f16",
        ], check=True)
        log.info("F16 GGUF → %s (%.1f GB)", f16_gguf, f16_gguf.stat().st_size / 1e9)

    # ── 3. Quantize F16 → Q4_K_M ──────────────────────────────────────────
    if not args.skip_quantize:
        log.info("=== quantizing to %s ===", xcfg["quantization"])
        # llama.cpp renamed the binary; try both locations.
        quant_bin = None
        for cand in ["build/bin/llama-quantize", "llama-quantize", "quantize"]:
            p = llama_cpp / cand
            if p.exists():
                quant_bin = p
                break
        if not quant_bin:
            log.error("could not find llama-quantize binary under %s", llama_cpp)
            return 1
        subprocess.run([str(quant_bin), str(f16_gguf), str(q4_gguf), xcfg["quantization"]], check=True)
        log.info("quantized GGUF → %s (%.1f GB)", q4_gguf, q4_gguf.stat().st_size / 1e9)

    # ── 4. Emit Ollama Modelfile ──────────────────────────────────────────
    modelfile_path = Path(tcfg["output_dir"]) / "Modelfile"
    modelfile = f"""FROM {q4_gguf.resolve()}
PARAMETER num_ctx 32768
PARAMETER num_gpu 99
PARAMETER temperature 0.4
PARAMETER stop <turn|>
SYSTEM \"\"\"{xcfg['ollama_system_prompt']}\"\"\"
"""
    modelfile_path.write_text(modelfile, encoding="utf-8")
    log.info("wrote Ollama Modelfile → %s", modelfile_path)
    log.info("to import on the dev server:")
    log.info("  scp %s %s  <dev-server>:/tmp/", modelfile_path, q4_gguf)
    log.info("  ssh <dev-server> 'ollama create %s -f /tmp/Modelfile'", xcfg["ollama_model_name"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
