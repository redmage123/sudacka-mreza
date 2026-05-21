# Legacy Data Audit — Judge Performance Dashboard (Phase 0)

**Date:** 2026-05-21
**Goal:** determine what data the legacy Postgres tables already carry that can populate the per-judge analytics dashboard mockup, so Phase 1 schema work targets gaps rather than duplicates.

**Method:** direct inspection of the Toronto production database `sudacka_mreza` (76 tables — 20 legacy + 56 Payload/CMS). Row counts and field coverage queried live.

---

## TL;DR

| Mockup block | Legacy data available? | Verdict |
|---|---|---|
| Judge header (photo, name, court, dept) | Partial — photos in `suci.slika` (0 rows populated) + `judges.photo_id` (2073/4832) | Manual upload still needed for ~57% |
| Years of experience | Derivable from `sudac_suda.datum_od` (1994–2010 only) | Stale — only useful for pre-2010 judges |
| Total decisions count | ✅ `court_decisions` has 12,830 rows with court+date | Works as-is once judges are linked |
| Appeal outcome (Potvrđena/Preinačena/Ukinuta) | ❌ **No appeal-outcome table or column anywhere** | Must be extracted from text OR cite-chased |
| Winning party (tužitelj vs tuženik) | ❌ Not stored | LLM extraction from `full_text_plain` |
| Expert witnesses per case | ❌ No `court_decisions ↔ expert_witnesses` link | LLM extraction (initials only in newer cases) |
| Attorneys per case | ❌ No Attorneys collection in CMS yet (but `odvjetnici` legacy has 1350 rows) | Migrate + LLM extraction |
| Appeal filed? Žalba %, average duration | ❌ Not stored | Cite-chase + filing-date extraction |
| Dispute type + value | ❌ Not stored | LLM extraction (~25% have monetary value matchable by regex) |
| Predictive (Derivative %) | n/a — model output | Built on top of populated data |

**Bottom line:** the legacy DB is a **directory database** (judges, courts, attorneys, geography). It has **no per-case outcome data** — no `predmet`, `presuda`, `spor`, `postupak`, `ishod`, `odluka` tables. Every analytics field on the mockup must be **extracted from the 12,750 decision full-text rows** via NLP/LLM, or accepted as N/A until manually populated.

---

## Legacy table inventory (20 non-CMS tables)

| Table | Rows | What it has | Relevance |
|---|---:|---|---|
| `suci` | 16,155 | id, name aliases (ime0..9, prezime0..9), `slika` (photo URL), `email`, `cv0..9`, `aktivan`, `status` | Old judge directory — superseded by `judges` (4832 rows) but **photo URLs (slika) not migrated** |
| `sudac_suda` | 18,984 | `sudacid` → suci, `sudid` → sudovi, **`datum_od` (appointment date)**, `odjel0..9` (departments), `aktivan` | Source of appointment date + department; **stops at 2010** |
| `sudovi` | 1,695 | Court directory (legacy); 54 columns including jurisdiction, address | Superseded by `courts` (597 rows). Mismatch: legacy has 3× more court records (subdivisions / historical) |
| `sudovi_nadleznosti` | — | Court jurisdiction matrix | Not relevant to dashboard |
| `sudovi_vrste_def` | — | Court-type lookup | Used by Courts |
| `odvjetnici` | 1,350 | Attorney directory: name aliases, `slika`, `email`, `cv0..9`, `aktivan` | **Source for new Attorneys collection** (no CMS table yet) |
| `odvjetnistva` | 255 | Law-firm directory | Optional — could become parent of Attorneys |
| `odvjetnistva_nadleznost` | — | Firm jurisdiction | Not on mockup |
| `odvjetnistva_vrste_def` | — | Firm-type lookup | Not on mockup |
| `odvjetnici_odvjetnistva` | — | Attorney ↔ firm link | Useful for "Odvjetništvo" if we surface it |
| `odvjetnik_odvjetnistva` | — | Same, alt spelling | Likely duplicate — investigate |
| `geo_*` (4 tables) | — | Countries, cities, counties, municipalities | Not on mockup |
| `jezici` | — | Language lookup | Used by Interpreters |
| `korisnici` | — | Legacy users | Not on mockup |
| `cms_dokumenti`, `cms_galerije_sadrzaj`, `cms_kategorije` | — | Legacy CMS content | Not on mockup |

---

## Sample decision-text extraction (live test)

Sample case: `P-246/2024-3` (Općinski sud u Koprivnici, civil monetary claim).

Extractable from `full_text_plain` via regex or LLM:

| Mockup field | Found in text? | Pattern |
|---|---|---|
| Judge name ("Sutkinja Marijana Jurenec") | ✅ | `(?i)(sutkinja\|sudac)\s+[A-ZČĆŠĐŽ][a-zčćšđž]+\s+[A-ZČĆŠĐŽ][a-zčćšđž]+` |
| Judge role ("sucu pojedincu" vs "vijeću") | ✅ | "sucu pojedincu" / "predsjednica vijeća" |
| Plaintiff identity | ⚠️ | "tužitelj X" — initialized in newer cases for privacy |
| Defendant identity | ⚠️ | "tuženik X" — same |
| Plaintiff attorney | ⚠️ | "punomoćnik X, dipl./mag. iur." — initials only |
| Defendant attorney | ⚠️ | Same |
| Court | ✅ | First line: "Republika Hrvatska Općinski sud u …" |
| Dispute type | ✅ | "u pravnoj stvari … radi <type>" → "radi isplate" = monetary claim |
| Dispute value | ✅ | "iznos od 123,47 EUR" (3,130 / 12,830 = 24% by simple regex; LLM should hit ~80%) |
| Outcome (dispositive) | ✅ | "Nalaže se" (claim granted) vs "Odbija se" (claim denied) vs "Odbacuje se" (claim dismissed) |
| Procedure type | ✅ | "PRESUDA ZBOG OGLUHE" (default judgment) etc — title block |
| Date of filing | ✅ | "podnio tužbu … 4. srpnja 2024" |
| Date of judgment | ✅ | Already in `court_decisions.date` |
| Case duration | ✅ derivable | filing_date - judgment_date |
| Appeal-rights notice | ⚠️ boilerplate | Always present, doesn't tell us whether appeal was actually filed |

---

## Coverage numbers (all 12,830 decisions)

```
Total decisions:                           12,830
With full_text_plain (>200 chars):         12,750  (99.4%)
With judge-name pattern matchable:          3,806  (29.7% via simple regex)
With monetary-value pattern matchable:      3,130  (24.4% via simple regex)
```

With an LLM extraction pass (one-time, cost ~$50–$100 at current Gemma-on-pod rates), we should lift judge-name extraction to ~80% and dispute-value to ~70%. The remainder are either non-monetary (e.g. najam, razvod) or text-only formats the LLM struggles with.

---

## Critical gap: appeal-outcome chaining

The dashboard's headline metric — **Ukinute / Preinačene / Potvrđene** (overturned / modified / upheld) — requires linking a first-instance decision to its appellate review. The legacy DB does **not** store this linkage, and `court_decisions` has only one self-relation (`cited_decisions`/`cited_by`) populated by the existing `citationLinker` hook.

Two ways to recover it:

1. **Cite-chase via case_number.** Županijski-sud decisions reference the lower-court `case_number`. Run a one-pass scan over all 12,830 decisions: for each second-instance decision, parse the referenced lower-court case and dispositive ("**Potvrđuje se**", "**Preinačuje se**", "**Ukida se**" appear in appellate decisions). Estimated coverage: ~40% (most decisions in the DB are first-instance from općinski sudovi; we'd need to ingest more županijski-sud and Vrhovni-sud decisions).
2. **Manual editorial workflow.** Add `appealOutcome` + `appealedDecisionId` to the Payload admin and let staff fill it. Realistic for new decisions only; backfill of 12K would be uneconomic.

Recommendation: do option 1 as a one-off enrichment pipeline (new script `scripts/extract-appeal-outcomes.mjs`); flag the resulting fields in the dashboard so the period selector can hide blocks when sample size is too small.

---

## Critical gap: judge appointment dates after 2010

`sudac_suda.datum_od` is the only appointment-date source and stops in 2010. Years-of-experience for any judge appointed after 2010 will be wrong. Options:

- **Accept the limitation** — show "Godine iskustva: ~X" with a tooltip "izračunato iz dostupnih podataka".
- **Manual backfill** — editors enter `appointmentDate` on the Judges admin form when they discover gaps. Less labor than the appeal-outcome backfill because there are 4,832 judges, not 12,830 decisions.
- **Scrape the official Pravosudna akademija / DSV (Državno sudbeno vijeće) website** — they publish nomination dates. Outside the scope of this work; would need its own ingest pipeline.

Recommendation: derive `yearsOfExperience` automatically from `appointmentDate` when present; leave the field nullable; surface a small "data nedostaje" hint in the UI when it's missing.

---

## Implications for Phase 1 (schema work)

Now that we know the legacy DB has zero per-case outcome data, the Phase 1 plan adjusts as follows:

1. **Schema changes from the plan remain correct** — the new fields on `CourtDecisions` (`judges`, `winningParty`, `appealOutcome`, `expertWitnesses`, `plaintiff/defendantAttorneys`, `appealFiled`, `appealType`, `caseDurationDays`, `disputeType`, `disputeValue`) are still all needed.
2. **Backfill strategy must accompany the schema PR** — without backfill, the dashboard renders empty. Add to Phase 1:
   - `scripts/legacy-migrate-photos.mjs` — copy `suci.slika` URLs into Payload `media` + set `judges.photo_id`. (1-time, small.)
   - `scripts/legacy-migrate-appointments.mjs` — backfill `judges.appointmentDate` + `judges.department` from `sudac_suda.datum_od`/`odjel0..9` for the 4,832 known judges.
   - `scripts/legacy-migrate-attorneys.mjs` — create new `Attorneys` collection rows from `odvjetnici` (deduplicate ime0..9/prezime0..9 aliases into one canonical name).
   - `scripts/extract-decision-analytics.mjs` — LLM pass over all 12,750 decisions to fill `judges`, `winningParty`, `expertWitnesses`, attorney rels, `disputeType`, `disputeValue`. Idempotent (skip rows already populated). Run as a background job; gate the UI dashboard on `analytics_extracted_at IS NOT NULL` per decision.
   - `scripts/extract-appeal-outcomes.mjs` — cite-chase pass for the appellate linkage (option 1 above).
3. **`Attorneys` collection should be added in the same migration as the per-decision attorney rels** so the legacy migration can run end-to-end.
4. **`court_decisions_rels` already exists** — adding hasMany fields (`judges`, `expertWitnesses`, etc.) only requires `ALTER TABLE court_decisions_rels ADD COLUMN <target>_id` plus updates to Payload's relationship-resolution metadata.

---

## Effort revision

Phase 0 (this audit) is complete. The Phase 1 estimate now includes the backfill scripts:

| Step | Estimate | Notes |
|---|---:|---|
| Schema additions to `Judges`, `CourtDecisions` + new `Attorneys` | 2 days | As in the original plan |
| Migration writing + rels-table updates | 1 day | Payload's rels-table conventions are fiddly |
| `legacy-migrate-photos.mjs` | 0.5 day | Direct SQL copy |
| `legacy-migrate-appointments.mjs` | 0.5 day | Direct SQL copy + enum mapping |
| `legacy-migrate-attorneys.mjs` | 1 day | Alias deduplication is the tricky part |
| `extract-decision-analytics.mjs` (LLM pass, 12.7K decisions) | 2 days dev + ~1 day runtime | Pod-Gemma is free; OpenAI fallback ~$80 |
| `extract-appeal-outcomes.mjs` (cite-chase) | 1 day | Lower priority — dashboard ships without it |
| **Phase 1 revised total** | **~7 days dev + 1 day runtime** | Up from "2 days" in the original plan |

The original Phase 2 (aggregation API) and Phase 3 (UI) estimates stand.

---

## Risks surfaced by the audit

- **Privacy** — newer decisions initialize parties and attorneys (e.g. "A. P.", "Z. K."). LLM extraction will yield placeholders, not real names. The "Odvjetnici u sporu" mockup block will be partly empty for any decision after 2018 unless we cross-reference filing records (not in our DB).
- **Sample-size honesty** — until backfill completes, the dashboard for a given judge will say "1345" but most fields will be NULL. The UI needs a per-block "data nije dovršena" indicator, and the period range should default to a window with high coverage.
- **Authoritative source vs derived data** — staff need to understand that `winningParty` and `appealOutcome` are LLM-extracted, not editorially curated. A small "auto" badge per field + an override workflow in the admin is recommended.
- **Cost of LLM pass** — pod-Gemma is free at the moment, but if we re-run quarterly to refresh, that's labor. Wire the script to run incrementally (only process `WHERE analytics_extracted_at IS NULL`).
