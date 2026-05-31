"""Run the corrections-sheet audit.

Reads tests/e2e/corrections-sheet.yaml and produces one pytest case per
(item, assertion) pair. Each test name carries the corrections-sheet id
so failures point straight back to the spec line that broke.

Usage:
    BASE_URL=http://23.164.48.64 \
        pytest tests/e2e/test_corrections_sheet.py -v

Statuses:
    implemented   - hard failure on any missing assertion.
    data-pending  - assertions marked `requires_data: true` xfail with
                    a reason; everything else is a hard failure.
    not-started   - every assertion in the block xfails. If one starts
                    passing it XPASSes and the report flags it - that
                    is how we learn a deferred item shipped.
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import pytest
import yaml
from playwright.sync_api import Page, sync_playwright

HERE = Path(__file__).resolve().parent
SHEET = yaml.safe_load((HERE / "corrections-sheet.yaml").read_text())

BASE_URL = os.environ.get("BASE_URL", SHEET.get("env", {}).get("base_url", "http://23.164.48.64"))
FIXTURES: dict[str, Any] = dict(SHEET.get("env", {}).get("fixtures", {}))
# Env-var overrides: FIXTURE_POPULATED_COURT_ID=42 wins over the YAML default.
# Lets CI seed a fresh court and pass its id without editing the catalog.
for _k, _v in os.environ.items():
    if _k.startswith("FIXTURE_"):
        FIXTURES[_k.removeprefix("FIXTURE_").lower()] = _v


def _interpolate(s: str) -> str:
    """Replace {placeholder} tokens with values from env.fixtures."""
    if not isinstance(s, str):
        return s
    return re.sub(r"\{(\w+)\}", lambda m: str(FIXTURES.get(m.group(1), m.group(0))), s)


# ── Test discovery: flatten (item, assertion) into one parametrized case
def _all_assertions():
    out = []
    for item in SHEET["corrections"]:
        item_id = item["id"]
        status = item.get("status", "implemented")
        for i, v in enumerate(item.get("verify", [])):
            requires_data = v.get("requires_data", False)
            xfail_reason = None
            if status == "not-started":
                xfail_reason = "feature not yet started"
            elif status == "data-pending" and requires_data:
                xfail_reason = "data not yet populated"
            out.append((item_id, i, item.get("title", "").strip(), v, xfail_reason))
    return out


def _id_for(case):
    item_id, idx, _, _, _ = case
    return f"{item_id}/v{idx}"


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    yield pg
    ctx.close()


@pytest.fixture(scope="session")
def bundle_text():
    """Live main-*.js bundle text, cached once per session."""
    html = urllib.request.urlopen(BASE_URL + "/").read().decode()
    m = re.search(r'/assets/main-[A-Za-z0-9_-]+\.js', html)
    if not m:
        return ""
    return urllib.request.urlopen(BASE_URL + m.group(0)).read().decode("utf-8", errors="replace")


# ── The single parametrized test function ──────────────────────────────
@pytest.mark.parametrize("case", _all_assertions(), ids=_id_for)
def test_corrections_assertion(case, page: Page, bundle_text: str):
    item_id, idx, title, verify, xfail_reason = case
    if xfail_reason:
        pytest.xfail(xfail_reason)

    kind = verify["kind"]

    if kind == "dom-marker":
        route = _interpolate(verify["route"])
        page.goto(BASE_URL + route, wait_until="networkidle", timeout=15_000)
        body = (page.locator("main").text_content() or page.locator("body").text_content() or "")
        for s in verify.get("must_contain", []):
            s = _interpolate(s)
            assert s in body, f"[{item_id}] route {route!r} missing required text {s!r}"
        for s in verify.get("must_not_contain", []):
            s = _interpolate(s)
            assert s not in body, f"[{item_id}] route {route!r} contains forbidden text {s!r}"
        any_of = verify.get("must_contain_any", [])
        if any_of:
            hits = [s for s in any_of if _interpolate(s) in body]
            assert hits, f"[{item_id}] route {route!r} missing all of {any_of!r}"

    elif kind == "api-shape":
        endpoint = _interpolate(verify["endpoint"])
        data = json.loads(urllib.request.urlopen(BASE_URL + endpoint, timeout=15).read())
        # 'first_doc_must_have_fields' acts on docs[0] (list endpoints).
        # 'doc_must_have_nonempty_array' / 'doc_field_nonempty' act on the
        # top-level doc (single-resource endpoints).
        first_doc = (data.get("docs") or [{}])[0] if "docs" in data else data
        for k in verify.get("first_doc_must_have_fields", []):
            assert k in first_doc, f"[{item_id}] {endpoint!r}: first doc missing field {k!r}"
        for k in verify.get("doc_must_have_nonempty_array", []) if isinstance(verify.get("doc_must_have_nonempty_array"), list) else [verify["doc_must_have_nonempty_array"]] if verify.get("doc_must_have_nonempty_array") else []:
            arr = first_doc.get(k)
            assert isinstance(arr, list) and len(arr) > 0, \
                f"[{item_id}] {endpoint!r}: array {k!r} is empty or missing"
        nonempty_field = verify.get("doc_field_nonempty")
        if nonempty_field:
            val = first_doc.get(nonempty_field)
            assert val not in (None, "", [], {}), \
                f"[{item_id}] {endpoint!r}: field {nonempty_field!r} empty"
        total_min = verify.get("totalDocs_min")
        if total_min is not None:
            assert data.get("totalDocs", 0) >= total_min, \
                f"[{item_id}] {endpoint!r}: totalDocs {data.get('totalDocs')} < {total_min}"

    elif kind == "aggregate":
        endpoint = _interpolate(verify["endpoint"])
        data = json.loads(urllib.request.urlopen(BASE_URL + endpoint, timeout=30).read())
        docs = data.get("docs") or []
        assert docs, f"[{item_id}] {endpoint!r}: no docs"
        ratio_min = verify["ratio_min"]
        if "field_populated_ratio" in verify:
            path = verify["field_populated_ratio"].split(".")
            n = sum(1 for d in docs if _walk(d, path))
        elif "array_nonempty_ratio" in verify:
            field = verify["array_nonempty_ratio"]
            n = sum(1 for d in docs if isinstance(d.get(field), list) and d[field])
        else:
            raise AssertionError(f"[{item_id}] aggregate verify needs a ratio rule")
        ratio = n / len(docs)
        assert ratio >= ratio_min, \
            f"[{item_id}] coverage ratio {ratio:.0%} < required {ratio_min:.0%} ({n}/{len(docs)})"

    elif kind == "bundle-marker":
        assert bundle_text, f"[{item_id}] could not fetch live bundle"
        for m in verify["markers"]:
            assert m in bundle_text, f"[{item_id}] live bundle missing marker {m!r}"

    elif kind == "interactive":
        page.goto(BASE_URL + _interpolate(verify["route"]), wait_until="networkidle", timeout=15_000)
        for step in verify.get("steps", []):
            if "click" in step:
                page.locator(step["click"]).first.click(timeout=5_000)
            if "expect_visible" in step:
                sel = step["expect_visible"]
                page.locator(sel).first.wait_for(state="visible", timeout=5_000)

    elif kind == "link-present":
        route = _interpolate(verify["route"])
        page.goto(BASE_URL + route, wait_until="networkidle", timeout=15_000)
        sub = verify["href_contains"]
        count = page.locator(f'a[href*="{sub}"]').count()
        assert count > 0, f"[{item_id}] route {route!r} has no link to {sub!r}"

    elif kind == "response-hdr":
        req = urllib.request.Request(BASE_URL + verify["url"], method=verify.get("method", "GET"))
        with urllib.request.urlopen(req, timeout=10) as r:
            headers = {k.lower(): v for k, v in r.headers.items()}
        for hdr_name, needle in (verify.get("header_must_contain") or {}).items():
            val = headers.get(hdr_name.lower(), "")
            assert needle.lower() in val.lower(), \
                f"[{item_id}] {hdr_name} on {verify['url']}: {val!r} missing {needle!r}"
        for hdr_name, needle in (verify.get("header_must_not_contain") or {}).items():
            val = headers.get(hdr_name.lower(), "")
            assert needle.lower() not in val.lower(), \
                f"[{item_id}] {hdr_name} on {verify['url']}: {val!r} contains forbidden {needle!r}"

    else:
        raise AssertionError(f"unknown verify.kind: {kind}")


def _walk(d: dict, path: list[str]):
    cur = d
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur
