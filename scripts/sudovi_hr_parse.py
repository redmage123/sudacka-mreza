"""Re-do the parse pass with the actually-correct selectors for sudovi.hr's
Drupal templates: name lives in <title>, working hours appear in an <h3>
on the landing page, departments are sidebar <a> entries on o-sudu."""
import html as html_lib
import json
import re
import sys
from pathlib import Path

CACHE = Path("/tmp/sudovi-scrape")
OUT = Path("/tmp/sudovi-courts.jsonl")


def strip_tags(s: str) -> str:
    s = re.sub(r"<script[\s\S]*?</script>", " ", s, flags=re.I)
    s = re.sub(r"<style[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html_lib.unescape(re.sub(r"\s+", " ", s)).strip()


def extract_name(idx_html: str) -> str:
    """<title>Županijski sud u Bjelovaru | Sudovi Republike Hrvatske</title>"""
    m = re.search(r"<title[^>]*>([^<]+)</title>", idx_html, flags=re.I)
    if not m:
        return ""
    title = html_lib.unescape(m.group(1)).strip()
    # Strip the site-name tail.
    title = re.split(r"\s*\|\s*Sudovi\b", title, maxsplit=1)[0].strip()
    return title


def extract_contact_line(idx_html: str) -> dict:
    """The h3 block bundles address+phone+fax for the court."""
    out = {}
    for raw in re.findall(r"<h3[^>]*>([\s\S]*?)</h3>", idx_html, flags=re.I):
        text = strip_tags(raw)
        if not text or "Radno vrijeme" in text:
            continue
        m_phone = re.search(r"tel\.?\s*([+()\d\s/.-]{7,30})", text, flags=re.I)
        m_fax = re.search(r"fax\.?\s*([+()\d\s/.-]{7,30})", text, flags=re.I)
        m_zip = re.search(r"\b(\d{5})\s+([A-ZŠĐČĆŽ][\w\sčćžšđČĆŽŠĐ.,'-]+?)(?:\s*tel|\s*$|\s*fax)", text)
        if m_phone:
            out["phone"] = re.sub(r"\s+", " ", m_phone.group(1)).strip(" .-")
        if m_fax:
            out["fax"] = re.sub(r"\s+", " ", m_fax.group(1)).strip(" .-")
        if m_zip:
            out["postal"] = m_zip.group(1)
            out["city"] = m_zip.group(2).strip(" .,")
        if out:
            return out
    return out


def extract_working_hours(idx_html: str) -> dict:
    """Look for <h3>Radno vrijeme suda od 7,00-15,00 sati</h3>
       and <h3>Radno vrijeme za prijem stranaka ...</h3>"""
    overall = None
    party = None
    notes = []
    for raw in re.findall(r"<h3[^>]*>([\s\S]*?)</h3>", idx_html, flags=re.I):
        text = strip_tags(raw)
        if "Radno vrijeme" not in text:
            continue
        # Match HH,MM-HH,MM or HH:MM-HH:MM
        m = re.search(r"(\d{1,2}[,:.]\d{2})\s*[-–]\s*(\d{1,2}[,:.]\d{2})", text)
        if not m:
            continue
        rng = f"{m.group(1)}-{m.group(2)}".replace(",", ":").replace(".", ":")
        # Normalise leading zero
        rng = re.sub(r"\b(\d):(\d{2})\b", r"0\1:\2", rng)
        if re.search(r"prijem\s+stranaka|stranke|stranaka", text, flags=re.I):
            party = rng
        else:
            overall = rng
        notes.append(text)
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
        if key in seen:
            continue
        if not any(p in key for p in ("odjel", "pisarn", "ured predsj", "tajništ",
                                     "glasnogovor", "kabinet")):
            continue
        # Filter out plain "Odjel" / "Unutarnje ustrojstvo" / nav crumbs.
        if text.lower() == "odjel":
            continue
        seen.add(key)
        if "pisarn" in key:
            t = "registry"
        elif "predsj" in key:
            t = "president"
        elif "tajništ" in key:
            t = "secretary"
        elif "glasnogovor" in key:
            t = "spokesperson"
        else:
            t = "other"
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
        rec = {
            "slug": s,
            "name": name,
            "contact": extract_contact_line(idx),
            "time_availability": extract_working_hours(idx),
            "departments": extract_departments(osu),
        }
        records.append(rec)
    with OUT.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(records)} records → {OUT}")
    # Stats
    hrs = sum(1 for r in records if r["time_availability"])
    deps = sum(1 for r in records if r["departments"])
    print(f"  with working hours: {hrs}/{len(records)}")
    print(f"  with departments:   {deps}/{len(records)}")


if __name__ == "__main__":
    main()
