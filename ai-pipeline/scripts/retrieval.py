"""
Hybrid retrieval library — BM25 + dense (nomic-embed-text via Ollama) with
reciprocal rank fusion, plus a confidence gate.

Runtime flow:
    Chunk store + FAISS dense index + BM25 built once by 20_build_index.py.
    Retriever loads both, runs a hybrid query, fuses ranks via RRF, returns
    top-k chunks with fused score and each side's per-chunk signal so the
    caller can decide whether retrieval is confident enough to answer.
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import httpx
import numpy as np

try:
    import faiss  # type: ignore
except ImportError:
    faiss = None  # built-index path will raise; retrieval-only callers unaffected


# Case-number pattern — matches the Croatian judicial identifier format
# used on court decisions (e.g. "Pp-6773/2024-7", "Ovrv-102985/2024-5",
# "Gž R-130/2024-2", "P-215/2022-35"). Used for exact-id retrieval shortcut.
CASE_NUMBER_RE = re.compile(
    r"\b[A-ZŠĐČĆŽ][a-zčćđšž]*(?:\s+[A-ZŠĐČĆŽ])?-?\s*\d+/\d{2,4}(?:-\d+)?\b"
)


# Croatian-aware tokenizer: keep diacritics, lowercase, strip punctuation.
# Hard-coded stopwords are minimal — BM25 handles IDF well enough that a big
# stoplist hurts more than helps on a legal corpus where "članak" is signal.
_STOPWORDS = {
    "i", "u", "na", "je", "su", "se", "da", "sa", "od", "do", "za", "o",
    "te", "ili", "kao", "ne", "nije", "a", "ako", "bi", "s", "k", "pa",
    "što", "kada", "koji", "koja", "koje", "koju", "kojih",
}


def normalize_text(text: str) -> str:
    """Lower + NFC (keep Croatian diacritics) + collapse whitespace."""
    text = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    """Tokenizer for BM25. Splits on non-letters, keeps diacritics, drops
    stopwords and 1-char tokens."""
    text = normalize_text(text)
    toks = re.findall(r"[a-zčćđšžáéíóú0-9][a-zčćđšžáéíóú0-9\-/]*", text)
    return [t for t in toks if len(t) > 1 and t not in _STOPWORDS]


@dataclass
class Chunk:
    """A retrievable unit — a passage normalized from any source file."""
    chunk_id: str              # unique across the whole corpus
    source_id: str             # original id from source file
    kind: str                  # legislation | decision | commentary | other
    title: str
    text: str
    url: str = ""
    author: str = ""           # court name / issuing body
    case_number: str = ""
    article_number: str | None = None
    date: str = ""             # ISO date if known
    year: int | None = None

    def to_dict(self) -> dict:
        return self.__dict__

    @staticmethod
    def from_dict(d: dict) -> "Chunk":
        return Chunk(**{k: d.get(k) for k in Chunk.__dataclass_fields__})


# ── Boilerplate stripper ─────────────────────────────────────────────────
# Narodne-novine chunks start with navigation / publication boilerplate
# ("Upute za korištenje", "Elektronička pošta", "Početna stranica", "NN XX/YY",
# "HRVATSKI SABOR", classification codes, etc.) that chews up context window
# and encourages the model to parrot headers back instead of answering.
_BOILERPLATE_LINES = {
    "upute za korištenje", "elektronička pošta", "početna stranica",
    "hrvatski sabor", "sabor rh", "narodne novine",
    "natrag na vrh", "uvoz u favorites",
}
_BOILERPLATE_PREFIX_RE = re.compile(
    r"^(klasa|urbroj|zagreb|predsjednik|proglašavam|na temelju članka 89|"
    r"odlukom|nn\s+\d+/\d{2,4}|s\.r\.|br\.\s*\d+)",
    flags=re.IGNORECASE,
)


def strip_boilerplate(text: str) -> str:
    """Drop lines that are clearly publication metadata, not legal content.
    Keeps the substantive body; safe to call on any chunk."""
    out: list[str] = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            out.append("")
            continue
        low = s.lower()
        if low in _BOILERPLATE_LINES:
            continue
        if _BOILERPLATE_PREFIX_RE.match(s):
            continue
        # Drop page-number lines like "1365" or "I." "II." roman numeral TOCs
        if re.fullmatch(r"\d{1,6}\.?", s) or re.fullmatch(r"[IVX]{1,5}\.?", s):
            continue
        out.append(line)
    # Collapse resulting multi-blank runs
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    return cleaned or text  # never return empty — fall back to original


@dataclass
class Hit:
    chunk: Chunk
    bm25_score: float = 0.0
    bm25_rank: int | None = None
    dense_score: float = 0.0
    dense_rank: int | None = None
    fused_score: float = 0.0

    def to_dict(self) -> dict:
        d = self.chunk.to_dict()
        d.update({
            "bm25_score": self.bm25_score,
            "bm25_rank": self.bm25_rank,
            "dense_score": self.dense_score,
            "dense_rank": self.dense_rank,
            "fused_score": self.fused_score,
        })
        return d


# ── Embeddings via Ollama nomic-embed-text ────────────────────────────────
class Embedder:
    """Ollama-backed embedder.  Uses /api/embed (batched) — returns 768-d
    vectors for nomic-embed-text."""

    def __init__(self,
                 endpoint: str = "http://176.9.99.103:11434",
                 model: str = "nomic-embed-text",
                 token: str | None = None,
                 timeout: float = 120.0) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.Client(timeout=timeout)
        self._dim: int | None = None

    @property
    def dim(self) -> int:
        if self._dim is None:
            v = self.embed_one("probe")
            self._dim = v.shape[0]
        return self._dim

    def embed_one(self, text: str) -> np.ndarray:
        arr = self.embed_batch([text])
        return arr[0]

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        """Ollama /api/embed takes a list and returns {embeddings: [[...]]}."""
        r = self._client.post(
            f"{self.endpoint}/api/embed",
            json={"model": self.model, "input": texts},
            headers=self.headers,
        )
        r.raise_for_status()
        data = r.json()
        embs = data.get("embeddings") or [data.get("embedding")]
        arr = np.asarray(embs, dtype=np.float32)
        # Normalize for cosine-via-dot-product
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return arr / norms


# ── Index store ────────────────────────────────────────────────────────────
@dataclass
class IndexPaths:
    root: Path
    chunks: Path = field(init=False)
    faiss: Path = field(init=False)
    bm25: Path = field(init=False)
    meta: Path = field(init=False)

    def __post_init__(self):
        self.chunks = self.root / "chunks.jsonl"
        self.faiss = self.root / "dense.faiss"
        self.bm25 = self.root / "bm25.pkl"
        self.meta = self.root / "meta.json"


# ── Retriever (runtime) ────────────────────────────────────────────────────
class HybridRetriever:
    """Hybrid BM25 + dense retriever with reciprocal rank fusion."""

    def __init__(self,
                 index_root: str | Path,
                 embedder: Embedder | None = None,
                 rrf_k: int = 60) -> None:
        if faiss is None:
            raise RuntimeError("faiss not installed — pip install faiss-cpu")
        self.paths = IndexPaths(Path(index_root))
        self.rrf_k = rrf_k
        self._load_chunks()
        self._load_faiss()
        self._load_bm25()
        self._build_case_index()
        self.embedder = embedder or Embedder()

    def _build_case_index(self) -> None:
        """Map case_number → chunk index. Hybrid retrieval ranks semantically
        similar decisions (templates overlap heavily) and loses exact-id
        matches in a 9k-decision corpus; this hash gives O(1) lookup so
        questions like "Sažmi kratko predmet Pp-4159/2024-5" always land on
        the right chunk before the hybrid layer runs."""
        self._case_index: dict[str, int] = {}
        for i, c in enumerate(self.chunks):
            cn = (c.case_number or "").strip()
            if not cn:
                continue
            # Canonical key for lookup (exact, and with whitespace normalized)
            self._case_index.setdefault(cn, i)
            normalized = re.sub(r"\s+", " ", cn)
            self._case_index.setdefault(normalized, i)

    def _load_chunks(self) -> None:
        self.chunks: list[Chunk] = []
        with self.paths.chunks.open(encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    self.chunks.append(Chunk.from_dict(json.loads(line)))

    def _load_faiss(self) -> None:
        self.faiss_index = faiss.read_index(str(self.paths.faiss))

    def _load_bm25(self) -> None:
        import pickle
        with self.paths.bm25.open("rb") as f:
            self.bm25 = pickle.load(f)

    def exact_case_hits(self, query: str, limit: int = 3) -> list[int]:
        """Return chunk indices for any case numbers that appear verbatim in
        the query. Case-number lookups are the one retrieval task where
        hybrid semantic+BM25 reliably fails on a corpus of near-identical
        court-decision templates, so we handle them as a keyed lookup."""
        out: list[int] = []
        seen: set[int] = set()
        for m in CASE_NUMBER_RE.findall(query):
            cn = m.strip()
            idx = self._case_index.get(cn)
            if idx is None:
                cn_norm = re.sub(r"\s+", " ", cn)
                idx = self._case_index.get(cn_norm)
            if idx is not None and idx not in seen:
                out.append(idx)
                seen.add(idx)
                if len(out) >= limit:
                    break
        return out

    def search(self, query: str, k: int = 6, oversample: int = 4) -> list[Hit]:
        """Return top-k fused hits for the query. `oversample` multiplies how
        many hits each side contributes before fusion.

        If the query contains a Croatian case-number identifier that matches
        a known decision, those chunks are promoted to the top unconditionally
        — hybrid retrieval alone loses exact-id matches among near-identical
        court-decision templates."""
        over_k = k * oversample

        exact_ids = self.exact_case_hits(query)

        # BM25
        q_toks = tokenize(query)
        bm25_scores = self.bm25.get_scores(q_toks) if q_toks else np.zeros(len(self.chunks))
        bm25_top = np.argsort(bm25_scores)[::-1][:over_k]

        # Dense
        qv = self.embedder.embed_one(query).reshape(1, -1).astype(np.float32)
        dense_scores, dense_ids = self.faiss_index.search(qv, over_k)
        dense_scores = dense_scores[0]
        dense_ids = dense_ids[0]

        # Reciprocal Rank Fusion
        scores: dict[int, dict] = {}
        for rank, idx in enumerate(bm25_top):
            scores.setdefault(int(idx), {"bm25_rank": None, "dense_rank": None})
            scores[int(idx)]["bm25_rank"] = rank
            scores[int(idx)]["bm25_score"] = float(bm25_scores[idx])
        for rank, idx in enumerate(dense_ids):
            if idx == -1:
                continue
            scores.setdefault(int(idx), {"bm25_rank": None, "dense_rank": None})
            scores[int(idx)]["dense_rank"] = rank
            scores[int(idx)]["dense_score"] = float(dense_scores[rank])

        for idx, s in scores.items():
            rrf = 0.0
            if s["bm25_rank"] is not None:
                rrf += 1.0 / (self.rrf_k + s["bm25_rank"])
            if s["dense_rank"] is not None:
                rrf += 1.0 / (self.rrf_k + s["dense_rank"])
            s["fused_score"] = rrf

        ranked = sorted(scores.items(), key=lambda kv: kv[1]["fused_score"], reverse=True)

        # Interleave: exact case-ID hits first, then the hybrid ranking with
        # those IDs removed. Preserves hybrid ordering for non-case queries.
        exact_set = set(exact_ids)
        ordered: list[tuple[int, dict]] = []
        for ex_idx in exact_ids:
            s = scores.get(ex_idx, {})
            # Synthesise a score so the Hit carries signal for debugging.
            s = {**s, "fused_score": s.get("fused_score", 1.0) + 10.0}
            ordered.append((ex_idx, s))
        for idx, s in ranked:
            if idx in exact_set:
                continue
            ordered.append((idx, s))
            if len(ordered) >= k:
                break
        ordered = ordered[:k]

        hits: list[Hit] = []
        for idx, s in ordered:
            hits.append(Hit(
                chunk=self.chunks[idx],
                bm25_score=s.get("bm25_score", 0.0),
                bm25_rank=s.get("bm25_rank"),
                dense_score=s.get("dense_score", 0.0),
                dense_rank=s.get("dense_rank"),
                fused_score=s["fused_score"],
            ))
        return hits


# ── Confidence gate ────────────────────────────────────────────────────────
@dataclass
class RetrievalDecision:
    confident: bool
    reason: str
    top_hit: Hit | None
    max_dense: float
    max_bm25: float
    exact_match: bool = False   # an exact case-ID hit was promoted to the top


def retrieval_confidence(hits: list[Hit],
                         dense_threshold: float = 0.55,
                         bm25_threshold: float = 5.0) -> RetrievalDecision:
    """Decide whether retrieval is good enough to answer.

    Conservative: both sides must signal. Dense is cosine (normalized
    embeddings dotted), so 0.55 is a reasonable floor for "semantically
    related." BM25 score of 5.0 roughly means at least one strong rare-term
    match for Croatian legal vocabulary.

    Exact case-ID hits (fused_score above the hybrid ceiling of ~0.03)
    always pass — the retriever promoted them on a keyed lookup, so dense /
    BM25 scores for those chunks are not meaningful.
    """
    if not hits:
        return RetrievalDecision(False, "no hits", None, 0.0, 0.0, False)
    max_dense = max((h.dense_score for h in hits), default=0.0)
    max_bm25 = max((h.bm25_score for h in hits), default=0.0)
    exact = any(h.fused_score >= 1.0 for h in hits)

    if exact:
        return RetrievalDecision(True, "exact case-id match", hits[0],
                                 max_dense, max_bm25, True)

    if max_dense < dense_threshold and max_bm25 < bm25_threshold:
        return RetrievalDecision(
            False,
            f"low confidence (dense={max_dense:.2f} < {dense_threshold}, "
            f"bm25={max_bm25:.1f} < {bm25_threshold})",
            hits[0], max_dense, max_bm25, False,
        )
    return RetrievalDecision(True, "ok", hits[0], max_dense, max_bm25, False)


# ── Chunk-record normalisation (used by the index builder) ─────────────────
def normalize_chunk_row(row: dict, source_file: str) -> Chunk | None:
    """Flatten heterogeneous source rows into the canonical Chunk.

    Returns None if the row is unusable (no text, no source_id, etc.).
    """
    text = (row.get("text") or "").strip()
    if len(text) < 120:
        return None
    source_id = row.get("source_id")
    if not source_id:
        return None

    md = row.get("metadata") or {}
    st = (row.get("source_type") or md.get("source_type") or "").lower()

    if "legislation" in st or "zakon" in (row.get("title") or "").lower():
        kind = "legislation"
    elif "decision" in st or "court" in (row.get("source") or "").lower():
        kind = "decision"
    elif "commentary" in st:
        kind = "commentary"
    else:
        kind = "other"

    chunk_idx = row.get("chunk_index")
    chunk_id = f"{source_id}:{chunk_idx}" if chunk_idx is not None else source_id

    return Chunk(
        chunk_id=chunk_id,
        source_id=str(source_id),
        kind=kind,
        title=(row.get("title") or "")[:400],
        text=text,
        url=row.get("url") or md.get("url") or "",
        author=row.get("author") or md.get("court_name") or "",
        case_number=md.get("case_number") or "",
        article_number=(str(row["article_number"])
                        if row.get("article_number") not in (None, "")
                        else None),
        date=md.get("date") or "",
        year=row.get("year") if isinstance(row.get("year"), int) else None,
    )


def iter_corpus_chunks(raw_dir: Path) -> Iterable[Chunk]:
    """Stream chunks from every relevant raw/*.jsonl file."""
    seen_ids: set[str] = set()
    # Prefer *_chunks.jsonl (already chunked sources)
    chunk_files = sorted(raw_dir.glob("*_chunks.jsonl"))
    for p in chunk_files:
        with p.open(encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                c = normalize_chunk_row(row, p.name)
                if c is None or c.chunk_id in seen_ids:
                    continue
                seen_ids.add(c.chunk_id)
                yield c

    # Also include court decisions (already one per doc, treat whole as chunk)
    court_file = raw_dir / "db_court_decisions.jsonl"
    if court_file.exists():
        with court_file.open(encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                c = normalize_chunk_row(row, court_file.name)
                if c is None or c.chunk_id in seen_ids:
                    continue
                seen_ids.add(c.chunk_id)
                yield c
