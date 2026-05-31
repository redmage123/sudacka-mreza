"""Parse pass v4 — fixes the double-pad regex bug in v3.

The pad-leading-zero regex `\b(\d):(\d{2})\b` was matching '0:00' inside an
already-padded '09:00', producing '009:00'. Reworked: normalisation happens
once in `_find_range` and `normalize_time` is gone."""
import html as html_lib
import json
import re
from pathlib import Path

CACHE = Path("/tmp/sudovi-scrape")
OUT = Path("/tmp/sudovi-courts.jsonl")


def strip_tags(s: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", s, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html_lib.unescape(re.sub(r"\s+", " ", s)).strip()


def extract_name(idx_html: str) -> str:
    m = re.search(r"<title[^>]*>([^<]+)</title>", idx_html, flags=re.I)
    if not m:
        return ""
    return re.split(r"\s*\|\s*Sudovi\b", html_lib.unescape(m.group(1)).strip(), 1)[0].strip()


def _fmt_hm(value: str) -> str:
    """'7,30' -> '07:30'  ;  '7' -> '07:00'  ;  '08:00' -> '08:00'"""
    v = value.replace(",", ":").replace(".", ":").strip()
    if ":" in v:
        h, m = v.split(":", 1)
        return f"{int(h):02d}:{m[:2]}"
    return f"{int(v):02d}:00"


PATTERNS = (
    re.compile(r"(\d{1,2}[,:.]\d{2})\s*[-–]\s*(\d{1,2}[,:.]\d{2})"),
    re.compile(r"od\s*(\d{1,2}[,:.]\d{2})\s*do\s*(\d{1,2}[,:.]\d{2})", re.I),
    re.compile(r"\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![,:.])"),
)


def _find_range(text: str) -> str | None:
    for p in PATTERNS:
        m = p.search(text)
        if m:
            return f"{_fmt_hm(m.group(1))}-{_fmt_hm(m.group(2))}"
    return None


def extract_working_hours(idx_html: str) -> dict:
    text = strip_tags(idx_html)
    party = None
    overall = None
    notes = []
    for m in re.finditer(r"Radno\s*vrijeme[^.]{0,400}", text, flags=re.I):
        chunk = m.group(0).strip()
        is_party = bool(re.search(
            r"stranke|stranaka|primanje\s+stranak|register\s*suda|registra\s+suda|pisarnic",
            chunk, flags=re.I,
        ))
        rng = _find_range(chunk)
        if not rng:
            continue
        if is_party and not party:
            party = rng
        elif not is_party and not overall:
            overall = rng
        notes.append(chunk[:160])
    if not overall and not party:
        return {}
    out = {}
    base = overall or party
    suffix = f" (stranke {party})" if (overall and party) else ""
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday"):
        out[day] = base + suffix
    if notes:
        out["notes"] = " | ".join(dict.fromkeys(notes))[:500]
    return out


def extract_departments(osu_html: str) -> list[dict]:
    items = re.findall(r"<a[^>]*>\s*([^<]{4,160})\s*</a>", osu_html, flags=re.I)
    out, seen = [], set()
    for raw in items:
        text = html_lib.unescape(re.sub(r"\s+", " ", raw)).strip()
        key = text.lower()
        if key in seen or text.lower() == "odjel":
            continue
        if not any(p in key for p in ("odjel", "pisarn", "ured predsj", "tajništ",
                                     "glasnogovor", "kabinet")):
            continue
        seen.add(key)
        t = ("registry" if "pisarn" in key
             else "president" if "predsj" in key
             else "secretary" if "tajništ" in key
             else "spokesperson" if "glasnogovor" in key
             else "other")
        out.append({"name": text, "type": t})
    return out


def main() -> None:
    slugs = sorted(p.name for p in CACHE.iterdir() if p.is_dir() and not p.name.startswith("_"))
    records = []
    for s in slugs:
        sdir = CACHE / s
        idx = (sdir / "index.html").read_text(encoding="utf-8") if (sdir / "index.html").exists() else ""
        osu = (sdir / "o-sudu.html").read_text(encoding="utf-8") if (sdir / "o-sudu.html").exists() else ""
        if not idx:
            continue
        name = extract_name(idx)
        if not name:
            continue
        records.append({
            "slug": s,
            "name": name,
            "time_availability": extract_working_hours(idx),
            "departments": extract_departments(osu),
        })
    with OUT.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    hrs = sum(1 for r in records if r["time_availability"])
    deps = sum(1 for r in records if r["departments"])
    print(f"wrote {len(records)} → {OUT}")
    print(f"  with hours:        {hrs}/{len(records)}")
    print(f"  with departments:  {deps}/{len(records)}")


if __name__ == "__main__":
    main()
