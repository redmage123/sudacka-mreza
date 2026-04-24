"""
Shared utilities — config loading, JSONL IO, logging, Postgres helpers.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

import yaml


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
INSTRUCTIONS_DIR = DATA_DIR / "instructions"
ADAPTERS_DIR = REPO_ROOT / "adapters"


def get_logger(name: str) -> logging.Logger:
    """Opinionated logger — pretty format, INFO by default, DEBUG via env."""
    root = logging.getLogger()
    if not root.handlers:
        level = logging.DEBUG if os.getenv("DEBUG") else logging.INFO
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)-7s %(name)-24s %(message)s",
            datefmt="%H:%M:%S",
        )
    return logging.getLogger(name)


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    """Load config.yaml, applying env-var overrides where `*_env` keys point."""
    path = Path(path) if path else REPO_ROOT / "config.yaml"
    with open(path) as f:
        cfg = yaml.safe_load(f)

    # Resolve *_env indirections (e.g. db.password_env = "POSTGRES_PASSWORD")
    for section, values in list(cfg.items()):
        if isinstance(values, dict):
            for k, v in list(values.items()):
                if k.endswith("_env") and isinstance(v, str):
                    resolved = os.getenv(v, "")
                    values[k.removesuffix("_env")] = resolved

    for d in (DATA_DIR, RAW_DIR, INSTRUCTIONS_DIR, ADAPTERS_DIR):
        d.mkdir(parents=True, exist_ok=True)
    return cfg


@dataclass
class RawDoc:
    """One unit of raw training source — serialised as a JSONL row."""

    source: str            # 'db.court_decisions', 'narodne_novine', 'eurlex', 'textbook'
    source_id: str         # stable id within that source (URL, DB id, filename)
    title: str
    text: str
    lang: str              # ISO code — 'hr', 'en', 'de' typically
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "source_id": self.source_id,
            "title": self.title,
            "text": self.text,
            "lang": self.lang,
            "metadata": self.metadata,
        }


def write_jsonl(path: str | Path, rows: Iterable[dict[str, Any]]) -> int:
    """Append-only JSONL writer. Returns row count written."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(path, "a", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            n += 1
    return n


def read_jsonl(path: str | Path) -> Iterator[dict[str, Any]]:
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def dedupe_by_id(rows: Iterable[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    seen: set[str] = set()
    for r in rows:
        key = f"{r.get('source','')}:{r.get('source_id','')}"
        if key in seen:
            continue
        seen.add(key)
        yield r


def fail(msg: str, code: int = 1) -> "None":
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)
