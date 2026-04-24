#!/usr/bin/env python3
"""
Build the hybrid retrieval index over the Croatian legal corpus.

Reads every chunk from data/raw/*_chunks.jsonl + db_court_decisions.jsonl,
normalises them into Chunk records, embeds each via nomic-embed-text (Ollama),
and writes:
    indexes/default/chunks.jsonl   — the canonical chunk records
    indexes/default/dense.faiss    — FAISS IndexFlatIP over L2-normalised embeddings
    indexes/default/bm25.pkl       — pickled BM25Okapi over tokenized texts
    indexes/default/meta.json      — dims, counts, model name, build timestamp

Resumable: if dense.faiss exists and --force is not set, re-uses it. BM25 is
cheap to rebuild so it is always rebuilt.
"""
from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RAW_DIR, REPO_ROOT, get_logger  # noqa: E402
from retrieval import Chunk, Embedder, IndexPaths, iter_corpus_chunks, tokenize  # noqa: E402

import faiss  # type: ignore
from rank_bm25 import BM25Okapi  # type: ignore


log = get_logger("build_index")


def embed_in_batches(embedder: Embedder, texts: list[str], batch_size: int = 32) -> np.ndarray:
    """Embed texts with batched requests + a progress bar."""
    vectors: list[np.ndarray] = []
    for i in tqdm(range(0, len(texts), batch_size), desc="embed", unit="batch"):
        batch = texts[i:i + batch_size]
        arr = embedder.embed_batch(batch)
        vectors.append(arr)
    return np.vstack(vectors)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index-root", default=str(REPO_ROOT / "indexes" / "default"))
    ap.add_argument("--embed-endpoint", default="http://176.9.99.103:11434")
    ap.add_argument("--embed-model", default="nomic-embed-text")
    ap.add_argument("--token", default=os.getenv("OLLAMA_TOKEN"),
                    help="Bearer token for the nginx-fronted Ollama endpoint")
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--limit", type=int, default=None,
                    help="debug: limit number of chunks to index")
    ap.add_argument("--force", action="store_true",
                    help="rebuild dense index even if dense.faiss already exists")
    args = ap.parse_args()

    if not args.token:
        log.error("OLLAMA_TOKEN env not set and --token not passed")
        return 2

    index_root = Path(args.index_root)
    index_root.mkdir(parents=True, exist_ok=True)
    paths = IndexPaths(index_root)

    # ── 1. Collect chunks ──────────────────────────────────────────────────
    log.info("scanning %s for chunks…", RAW_DIR)
    chunks: list[Chunk] = []
    for c in iter_corpus_chunks(RAW_DIR):
        chunks.append(c)
        if args.limit and len(chunks) >= args.limit:
            break
    log.info("collected %d unique chunks", len(chunks))
    if not chunks:
        log.error("no chunks found — run the corpus scrape scripts first")
        return 1

    # Persist canonical chunk records (one source of truth for the retriever)
    with paths.chunks.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c.to_dict(), ensure_ascii=False) + "\n")
    log.info("wrote %s", paths.chunks)

    # ── 2. Dense index (embed via Ollama) ──────────────────────────────────
    if paths.faiss.exists() and not args.force:
        log.info("dense index exists at %s — skipping (use --force to rebuild)", paths.faiss)
        dense_index = faiss.read_index(str(paths.faiss))
        dim = dense_index.d
    else:
        embedder = Embedder(endpoint=args.embed_endpoint,
                            model=args.embed_model, token=args.token)
        texts = [c.text[:2000] for c in chunks]  # keep embed inputs reasonable
        t0 = time.monotonic()
        vectors = embed_in_batches(embedder, texts, batch_size=args.batch_size)
        log.info("embedded %d chunks in %.1fs (%.0f/s)",
                 len(vectors), time.monotonic() - t0,
                 len(vectors) / max(time.monotonic() - t0, 1e-6))

        dim = vectors.shape[1]
        dense_index = faiss.IndexFlatIP(dim)  # cosine since vectors are L2-normalised
        dense_index.add(vectors.astype(np.float32))
        faiss.write_index(dense_index, str(paths.faiss))
        log.info("wrote %s (dim=%d, n=%d)", paths.faiss, dim, dense_index.ntotal)

    # ── 3. BM25 index ──────────────────────────────────────────────────────
    log.info("tokenizing for BM25…")
    tokenized = [tokenize(c.text) for c in tqdm(chunks, desc="tokenize", unit="chunk")]
    log.info("fitting BM25Okapi…")
    bm25 = BM25Okapi(tokenized)
    with paths.bm25.open("wb") as f:
        pickle.dump(bm25, f)
    log.info("wrote %s", paths.bm25)

    # ── 4. Meta ────────────────────────────────────────────────────────────
    kinds: dict[str, int] = {}
    for c in chunks:
        kinds[c.kind] = kinds.get(c.kind, 0) + 1
    meta = {
        "n_chunks": len(chunks),
        "dim": int(dim),
        "embed_model": args.embed_model,
        "embed_endpoint": args.embed_endpoint,
        "built_at": int(time.time()),
        "kinds": kinds,
    }
    paths.meta.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    log.info("done — %s", meta)
    return 0


if __name__ == "__main__":
    sys.exit(main())
