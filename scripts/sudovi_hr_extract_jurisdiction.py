"""Re-parse the cached sudovi.hr HTML to extract Nadležnost text per
court and write it as Lexical richText fragments suitable for the
Payload jurisdictionScope column."""
import html as html_lib
import json
import re
from pathlib import Path

CACHE = Path("/tmp/sudovi-scrape")
OUT = Path("/tmp/sudovi-jurisdiction.jsonl")


def strip_tags(s: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", s, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html_lib.unescape(re.sub(r"\s+", " ", s)).strip()


def extract_name(html: str) -> str:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, flags=re.I)
    if not m:
        return ""
    return re.split(r"\s*\|\s*Sudovi\b", html_lib.unescape(m.group(1)).strip(), 1)[0].strip()


def extract_nadleznost(html: str) -> str | None:
    """Pull the Nadležnost paragraph from the o-sudu page main block."""
    text = strip_tags(html)
    idx = text.find("Nadležnost")
    if idx < 0:
        return None
    chunk = text[idx:idx + 5000]
    # Trim at footer / next-section markers.
    for stop in ("Footer", "IMPRESUM", "MAPA WEBA", "Unutarnje ustrojstvo",
                 "Godišnji raspored", "Kodeks", "Glasnogovornik",
                 "© 2025", "{\"path\":"):
        i = chunk.find(stop)
        if i > 100:
            chunk = chunk[:i]
            break
    chunk = chunk.replace("Nadležnost", "", 1).lstrip(": -–  \t\n").strip()
    return chunk[:2500] if chunk else None


def main() -> None:
    slugs = sorted(p.name for p in CACHE.iterdir() if p.is_dir() and not p.name.startswith("_"))
    n = 0
    with OUT.open("w", encoding="utf-8") as f:
        for s in slugs:
            sdir = CACHE / s
            idx_html = (sdir / "index.html").read_text(encoding="utf-8") if (sdir / "index.html").exists() else ""
            osu_html = (sdir / "o-sudu.html").read_text(encoding="utf-8") if (sdir / "o-sudu.html").exists() else ""
            if not idx_html or not osu_html:
                continue
            name = extract_name(idx_html)
            text = extract_nadleznost(osu_html)
            if not name or not text:
                continue
            f.write(json.dumps({"name": name, "text": text}, ensure_ascii=False) + "\n")
            n += 1
    print(f"wrote {n} records -> {OUT}")


if __name__ == "__main__":
    main()
