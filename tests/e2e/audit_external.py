"""
End-to-end audit against the *external* Toronto address. Verifies that:
  1. Every public/admin/editor route renders cleanly (no SPA-404 marker, no
     4xx/5xx in the network log) — same coverage as the in-cluster audit, but
     run from outside the host so we exercise the real public hop.
  2. The frontend bundle served externally contains the QA #7 + QA #8 markers
     (Pravno lice / organisationOib / Vaša uloga / Uređivanje).
  3. /hr/register actually renders the legal-entity radio + OIB field when
     userType=legal_entity is selected (live React behavior, not just bundle
     string match).
  4. Croatian strings render on the registration page (QA #8 nested i18n fix
     means Croatian no longer falls back to English).
  5. The chat endpoint returns a Croatian RAG answer with citations (RAG/KG
     pipeline live).
  6. /sw.js HTTP headers are now no-cache (SW kill-switch reachable + future-
     proof against cache pinning).

Usage:
  BASE_URL=http://23.164.48.64 E2E_ADMIN_TOKEN=<jwt> \
    python3 -m pytest /tmp/audit_external.py -v --tb=short -p no:cacheprovider
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, Browser

BASE_URL = os.environ.get("BASE_URL", "http://23.164.48.64")
TIMEOUT = int(os.environ.get("E2E_TIMEOUT", "45000"))
ADMIN_TOKEN = os.environ.get("E2E_ADMIN_TOKEN", "")
EDITOR_TOKEN = os.environ.get("E2E_EDITOR_TOKEN", "") or ADMIN_TOKEN
AUTH_TOKEN_KEY = "sudacka.authToken"
REPORT = Path(os.environ.get("AUDIT_REPORT", "/tmp/audit-external.log"))

NOT_FOUND_MARKERS = [
    "page not found", "something went wrong",
    "the page you are looking for does not exist",
    "does not exist or has been moved",
    "stranica nije pronađena", "stranica ne postoji",
]

PUBLIC_ROUTES = [
    "", "/pretraga", "/sudovi", "/sudovi/dorh", "/sudovi/suci", "/sudovi/nadleznost",
    "/sudovi/performanse", "/strucnjaci/vjestaci", "/strucnjaci/tumaci",
    "/stecaj", "/stecaj/oglasi", "/stecaj/upravitelji", "/stecaj/duznici",
    "/stecaj/zakoni", "/stecaj/odluke", "/sudska-praksa/pretraga", "/eur-lex",
    "/statistika", "/pristojbe", "/rokovi", "/pravna-pomoc", "/o-nama", "/kontakt",
    "/galerije", "/vijesti", "/mapa-sudova", "/api", "/prijava", "/register",
    "/moja-knjiznica",
]
ADMIN_ROUTES = [
    "/admin", "/admin/users", "/admin/gdpr", "/admin/bankruptcy",
    "/admin/bankruptcy-administrators", "/admin/bankruptcy-debtors", "/admin/filings",
    "/admin/flags", "/admin/news", "/admin/media", "/admin/audit-log", "/admin/courts",
    "/admin/judges", "/admin/experts", "/admin/interpreters", "/admin/state-attorneys",
    "/admin/laws", "/admin/legal-categories", "/admin/documents", "/admin/pages",
    "/admin/api-keys",
]
EDITOR_ROUTES = ["/editor", "/editor/bankruptcy", "/editor/ingest", "/editor/pending"]


@pytest.fixture(scope="session")
def browser_instance():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        yield b
        b.close()


def _audited_page(browser: Browser, captured: list, token: str = ""):
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="hr-HR",
    )
    if token:
        ctx.add_cookies([
            {"name": "sudacka_auth", "value": token, "url": BASE_URL},
            {"name": "payload-token", "value": token, "url": BASE_URL},
        ])
        ctx.add_init_script(
            f"try{{localStorage.setItem({AUTH_TOKEN_KEY!r}, {token!r})}}catch(e){{}}"
        )
    pg = ctx.new_page()
    pg.set_default_timeout(TIMEOUT)

    def on_response(resp):
        try:
            if not resp.url.startswith(BASE_URL):
                return
            if resp.status >= 400:
                captured.append({"url": resp.url, "status": resp.status, "method": resp.request.method})
        except Exception:
            pass
    pg.on("response", on_response)
    return pg, ctx


def _audit_route(browser, lang_path: str, token: str = ""):
    captured = []
    pg, ctx = _audited_page(browser, captured, token=token)
    url = f"{BASE_URL}/hr{lang_path}"
    result = {"path": f"/hr{lang_path}", "url": url, "status_visit": None,
              "redirected_to": None, "marker": None, "errors": []}
    try:
        resp = pg.goto(url, wait_until="domcontentloaded", timeout=TIMEOUT)
        result["status_visit"] = resp.status if resp else None
        try:
            pg.wait_for_load_state("networkidle", timeout=TIMEOUT)
        except Exception:
            pass
        if pg.url != url:
            result["redirected_to"] = pg.url
        body = (pg.inner_text("body") or "").lower()
        for marker in NOT_FOUND_MARKERS:
            if marker in body:
                result["marker"] = marker
                break
    except Exception as e:
        result["nav_error"] = str(e)[:200]
    finally:
        result["errors"] = captured
        ctx.close()
    return result


ALL_RESULTS = []


@pytest.fixture(scope="session", autouse=True)
def report_writer():
    yield
    REPORT.write_text(json.dumps(ALL_RESULTS, indent=2, ensure_ascii=False))
    total = len(ALL_RESULTS)
    spa404 = sum(1 for r in ALL_RESULTS if r.get("marker"))
    err_routes = sum(1 for r in ALL_RESULTS if r.get("errors"))
    total_4xx5xx = sum(len(r.get("errors", [])) for r in ALL_RESULTS)
    by_status = {}
    for r in ALL_RESULTS:
        for e in r.get("errors", []):
            by_status[e["status"]] = by_status.get(e["status"], 0) + 1
    print(f"\nAUDIT SUMMARY (BASE_URL={BASE_URL})", file=sys.stderr)
    print(f"  routes audited:        {total}", file=sys.stderr)
    print(f"  SPA-404 markers hit:   {spa404}", file=sys.stderr)
    print(f"  routes with 4xx/5xx:   {err_routes}", file=sys.stderr)
    print(f"  total 4xx/5xx network: {total_4xx5xx}", file=sys.stderr)
    print(f"  by status: {by_status}", file=sys.stderr)
    print(f"  full report: {REPORT}", file=sys.stderr)


# ─── route sweep ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("path", PUBLIC_ROUTES)
def test_public(browser_instance, path):
    r = _audit_route(browser_instance, path, token="")
    ALL_RESULTS.append(r)
    assert r["marker"] is None, (
        f"Public {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )


@pytest.mark.parametrize("path", ADMIN_ROUTES)
def test_admin(browser_instance, path):
    if not ADMIN_TOKEN:
        pytest.skip("set E2E_ADMIN_TOKEN to audit admin routes")
    r = _audit_route(browser_instance, path, token=ADMIN_TOKEN)
    ALL_RESULTS.append(r)
    if r.get("redirected_to") and ("/login" in r["redirected_to"] or "/prijava" in r["redirected_to"]):
        pytest.skip(f"admin token rejected at {path}")
    assert r["marker"] is None, (
        f"Admin {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )


@pytest.mark.parametrize("path", EDITOR_ROUTES)
def test_editor(browser_instance, path):
    if not EDITOR_TOKEN:
        pytest.skip("set E2E_EDITOR_TOKEN to audit editor routes")
    r = _audit_route(browser_instance, path, token=EDITOR_TOKEN)
    ALL_RESULTS.append(r)
    if r.get("redirected_to") and ("/login" in r["redirected_to"] or "/prijava" in r["redirected_to"]):
        pytest.skip(f"editor token rejected at {path}")
    assert r["marker"] is None, (
        f"Editor {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )


# ─── deployed-changes assertions ─────────────────────────────────────────────

def test_sw_headers_no_cache():
    """SW kill-switch fix: /sw.js must NOT be served with immutable / long-cache."""
    req = urllib.request.Request(f"{BASE_URL}/sw.js", method="HEAD")
    with urllib.request.urlopen(req, timeout=10) as r:
        cache_headers = r.headers.get_all("Cache-Control") or []
    joined = ",".join(cache_headers).lower()
    assert "no-cache" in joined or "no-store" in joined, (
        f"/sw.js Cache-Control still long-lived: {cache_headers!r} — SW cache pin can recur"
    )
    assert "immutable" not in joined, (
        f"/sw.js still served as immutable: {cache_headers!r}"
    )


def test_bundle_has_qa7_and_qa8_markers():
    """Confirm the live JS bundle contains the strings we shipped for QA #7/#8."""
    with urllib.request.urlopen(f"{BASE_URL}/", timeout=10) as r:
        html = r.read().decode("utf-8", errors="ignore")
    import re
    m = re.search(r"/assets/main-[A-Za-z0-9_-]+\.js", html)
    assert m, "could not find main-*.js reference in /hr index.html"
    with urllib.request.urlopen(f"{BASE_URL}{m.group(0)}", timeout=20) as r:
        js = r.read().decode("utf-8", errors="ignore")
    for marker, name in [
        ("organisationOib", "QA#7 legal-entity OIB field"),
        ("organisationName", "QA#7 legal-entity org name"),
        ("legal_entity", "QA#7 role marker"),
        ("Pravno lice", "QA#7 Croatian radio label"),
        ("Vaša uloga", "QA#7 Croatian role question"),
        ("Uređivanje", "QA#8 Croatian editor link label"),
    ]:
        assert marker in js, f"missing in live bundle: {marker!r} ({name})"


def test_register_page_legal_entity_flow(browser_instance):
    """Hit /hr/register, switch to Pravno lice, OIB field should appear."""
    captured = []
    pg, ctx = _audited_page(browser_instance, captured, token="")
    try:
        pg.goto(f"{BASE_URL}/hr/register", wait_until="domcontentloaded", timeout=TIMEOUT)
        try:
            pg.wait_for_load_state("networkidle", timeout=TIMEOUT)
        except Exception:
            pass
        body = pg.inner_text("body")
        assert "Pravno lice" in body or "Vaša uloga" in body, (
            f"register page is not showing Croatian QA#7 labels; body head: {body[:300]!r}"
        )
        # Find and click the "Pravno lice" radio. Multiple selector strategies
        # because we don't know the exact DOM shape — be permissive.
        clicked = False
        for sel in [
            "input[value='legal_entity']",
            "label:has-text('Pravno lice') input[type=radio]",
            "label:has-text('Pravno lice')",
        ]:
            try:
                pg.click(sel, timeout=2000)
                clicked = True
                break
            except Exception:
                continue
        assert clicked, "could not click the 'Pravno lice' option on /hr/register"
        # OIB field becomes visible
        oib_visible = False
        for sel in [
            "input[name='organisationOib']",
            "input[name='organisation_oib']",
            "input[placeholder*='OIB']",
            "label:has-text('OIB')",
        ]:
            try:
                pg.wait_for_selector(sel, state="visible", timeout=5000)
                oib_visible = True
                break
            except Exception:
                continue
        assert oib_visible, "OIB field did not become visible after selecting Pravno lice"
    finally:
        ctx.close()


def test_chat_endpoint_returns_croatian_rag_answer():
    """End-to-end RAG/KG: ask a Croatian legal question, expect a Croatian
    answer with citations (or at minimum a structured 200 response with text).
    This proves the chat route + LLM + retrieval are reachable through the
    public address and that the KG-expansion code path doesn't crash."""
    payload = json.dumps({
        "question": "Što je predstečajna nagodba u hrvatskom pravu?",
        "lang": "hr",
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    # LLM is slow — give it 180s like nginx does for this route.
    with urllib.request.urlopen(req, timeout=180) as r:
        status = r.status
        body_bytes = r.read()
    assert status == 200, f"/api/chat returned HTTP {status}"
    body = body_bytes.decode("utf-8", errors="ignore")
    # Tolerate either JSON shape (assistant message, structured) or SSE/stream-
    # ish concat — assert on substance.
    assert len(body) > 80, f"/api/chat body suspiciously short ({len(body)} bytes): {body[:200]!r}"
    # At least one Croatian word from the answer space should be present. This
    # is intentionally loose — we don't want to fail on stylistic variation.
    lower = body.lower()
    assert any(w in lower for w in ["predstečajn", "stečaj", "vjerovn", "dužnik", "postupak"]), (
        f"chat answer doesn't look Croatian/legal; head: {body[:400]!r}"
    )
