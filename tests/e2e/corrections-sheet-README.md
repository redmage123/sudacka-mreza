# Corrections-sheet audit

This is the structured replacement for ad-hoc Playwright sweeps. It encodes
every corrections-sheet item as a machine-checkable spec and asserts the
deployed site behaves the way the spec says it should — at the level the
spec actually talks about (DOM text, API response shape, bundle marker,
response header, multi-step interaction), not at the catch-all "HTTP 200"
level the previous sweep used.

## Why this exists

Earlier sweeps reported 59/59 routes green while every Drazen-visible
corrections item was missing or broken. The audit was wrong because:

- HTTP 200 + no SPA-404 markers tells you the *route* works. It does not
  tell you whether the *feature* on that route is built.
- Conditional-render code like `{departments.length > 0 && <Section/>}`
  makes "feature not built" indistinguishable from "feature built but no
  data" in a static body scan.
- `t('key', 'English default')` returns the second arg if the i18n key
  is missing, so the page renders successfully in English on `/hr/` and
  no 4xx is raised.
- The API returning `200 OK` with `{name, address, type}` looks the same
  as the API returning the *expected* `{name, address, type, departments,
  timeAvailability, jurisdictionScope}`.
- Front-end `expert.speciality_areas` reading API `specialityAreas` is
  a runtime undefined that the route-sweep never noticed because both
  ends returned 200.

This audit asserts at the right layer for each failure mode.

## Files

- `tests/e2e/corrections-sheet.yaml` — the catalog. One entry per
  corrections-sheet item.
- `tests/e2e/test_corrections_sheet.py` — pytest runner that consumes
  the YAML and emits one test per (item, assertion).

## Running

```bash
# Default target: http://23.164.48.64 (Toronto prod), set in YAML env.
BASE_URL=http://23.164.48.64 \
    python3 -m pytest tests/e2e/test_corrections_sheet.py -v
```

Failures name the corrections-sheet id directly:

```
FAILED [qa-08-bankruptcy-listings-croatian/v0] - route '/hr/stecaj/oglasi'
       contains forbidden text 'Bankruptcy Listings'
```

## Adding a new item

1. Pick a stable kebab-case id, prefixed by the area
   (`courts-…`, `bankruptcy-…`, `experts-…`, `i18n-…`).
2. Set `status` honestly:
   - `implemented`  — code AND data shipped, every assertion must pass.
   - `data-pending` — code shipped but data not yet populated; mark the
     data-dependent assertions with `requires_data: true` so they xfail
     with a reason instead of breaking CI.
   - `not-started` — every assertion xfails. When one passes it XPASSes
     and the report tells you the work landed.
3. Add `verify:` blocks. Pick the right kind per failure mode:

| Failure mode | Right `kind` |
|---|---|
| English fallback on /hr/ route | `dom-marker` with `must_not_contain` |
| API not exposing a new field | `api-shape` with `first_doc_must_have_fields` |
| New code shipped but feature gated on data | `bundle-marker` (markers visible in main-*.js) |
| Multi-step flow (click then field appears) | `interactive` |
| Service-worker / cache / security headers | `response-hdr` |
| Coverage target (e.g. 60% of rows populated) | `aggregate` |

## Fixtures

`env.fixtures` in the YAML holds known-populated record ids/names used
in `{populated_court_id}`-style interpolation. Update when seed data
moves.

## What this catches that the route sweep didn't

- Course detail page rendering nothing when `departments` is empty.
- `/hr/stecaj/oglasi` showing English `'Bankruptcy Listings'`.
- `/hr/sudovi` showing the literal placeholder `{{n}} odjela`.
- `expert.speciality_areas` undefined because API uses camelCase.
- sw.js shipping with `Cache-Control: max-age=31536000, immutable`.
- 60%-coverage targets explicitly visible as xfail until the data
  ingest catches up.
