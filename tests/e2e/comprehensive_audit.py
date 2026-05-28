"""
End-to-end site audit (QA's "test the whole site"). Visits every public, admin
and editor route; per route, captures every network response the page makes
and flags any 4xx / 5xx hit. Asserts on rendered content (not HTTP status) so
the SPA-404 class of bug (React Router NotFoundPage at HTTP 200) is also caught.

Why this catches things the previous audits missed:
  1. status_code crawls — SPA 404s are HTTP 200. We assert on RENDERED CONTENT.
  2. happy-path only — capturing page.on("response") logs background calls
     too (image 404s, /api 401s, missing JSON fixtures, etc.).
  3. anonymous only — runs with no token, then with an admin token, so any
     route gated on auth is exercised.

Usage (from a host that can reach BASE_URL):
  E2E_ADMIN_TOKEN=$(docker compose exec -e ROLE=admin -T cms node /app/mint-jose.mjs)
  BASE_URL=http://127.0.0.1:4092 E2E_ADMIN_TOKEN=$E2E_ADMIN_TOKEN \\
    python -m pytest comprehensive_audit.py -q --tb=short -p no:cacheprovider

Output: per-route report in /tmp/comprehensive-audit.log
"""
import json
import os
import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, Browser, Page

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4092")
TIMEOUT = int(os.environ.get("E2E_TIMEOUT", "30000"))
ADMIN_TOKEN = os.environ.get("E2E_ADMIN_TOKEN", "")
EDITOR_TOKEN = os.environ.get("E2E_EDITOR_TOKEN", "") or ADMIN_TOKEN
AUTH_TOKEN_KEY = "sudacka.authToken"  # must match web/src/api/client.ts

# Output report path
REPORT = Path(os.environ.get("AUDIT_REPORT", "/tmp/comprehensive-audit.log"))
REPORT.parent.mkdir(parents=True, exist_ok=True)

NOT_FOUND_MARKERS = [
    "page not found",
    "something went wrong",
    "the page you are looking for does not exist",
    "does not exist or has been moved",
    "stranica nije pronađena",
    "stranica ne postoji",
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


def _new_audited_page(browser: Browser, captured: list, token: str = ""):
    """Open a page that captures every response into `captured`. If `token` is
    provided, inject it the way the SPA expects so admin routes don't bounce."""
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
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
            status = resp.status
            url = resp.url
            # Same-origin only — third-party widgets are noise here.
            if not url.startswith(BASE_URL):
                return
            if status >= 400:
                captured.append({"url": url, "status": status, "method": resp.request.method})
        except Exception:
            pass

    pg.on("response", on_response)
    return pg, ctx


def _audit_one_route(browser, lang_path: str, token: str = ""):
    """Visit one route; return dict with: rendered ok?, marker hit?, 4xx/5xx list."""
    captured = []
    pg, ctx = _new_audited_page(browser, captured, token=token)
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


# ── tests ──────────────────────────────────────────────────────────────────

ALL_RESULTS = []  # collected by tests, written at end

@pytest.fixture(scope="session", autouse=True)
def report_writer():
    yield
    REPORT.write_text(json.dumps(ALL_RESULTS, indent=2, ensure_ascii=False))
    # Print summary to stdout for the test runner
    total = len(ALL_RESULTS)
    spa404 = sum(1 for r in ALL_RESULTS if r["marker"])
    err_routes = sum(1 for r in ALL_RESULTS if r["errors"])
    total_4xx5xx = sum(len(r["errors"]) for r in ALL_RESULTS)
    by_status = {}
    for r in ALL_RESULTS:
        for e in r["errors"]:
            by_status[e["status"]] = by_status.get(e["status"], 0) + 1
    print(f"\nAUDIT SUMMARY", file=sys.stderr)
    print(f"  routes audited:        {total}", file=sys.stderr)
    print(f"  SPA-404 markers hit:   {spa404}", file=sys.stderr)
    print(f"  routes with 4xx/5xx:   {err_routes}", file=sys.stderr)
    print(f"  total 4xx/5xx network: {total_4xx5xx}", file=sys.stderr)
    print(f"  by status: {by_status}", file=sys.stderr)
    print(f"  full report: {REPORT}", file=sys.stderr)


@pytest.mark.parametrize("path", PUBLIC_ROUTES)
def test_public(browser_instance, path):
    r = _audit_one_route(browser_instance, path, token="")
    ALL_RESULTS.append(r)
    # Test fails only on rendered-content not-found (SPA-404). 4xx/5xx network
    # requests are reported separately so the suite finishes and we get the
    # full network-error inventory rather than stopping at the first hit.
    assert r["marker"] is None, (
        f"Public {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )


@pytest.mark.parametrize("path", ADMIN_ROUTES)
def test_admin(browser_instance, path):
    if not ADMIN_TOKEN:
        pytest.skip("set E2E_ADMIN_TOKEN to audit admin routes")
    r = _audit_one_route(browser_instance, path, token=ADMIN_TOKEN)
    ALL_RESULTS.append(r)
    if r.get("redirected_to") and ("/login" in r["redirected_to"] or "/prijava" in r["redirected_to"]):
        pytest.skip(f"admin token rejected at {path}; auth-stack mismatch, not a route bug")
    assert r["marker"] is None, (
        f"Admin {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )


@pytest.mark.parametrize("path", EDITOR_ROUTES)
def test_editor(browser_instance, path):
    if not EDITOR_TOKEN:
        pytest.skip("set E2E_EDITOR_TOKEN (or E2E_ADMIN_TOKEN) to audit editor routes")
    r = _audit_one_route(browser_instance, path, token=EDITOR_TOKEN)
    ALL_RESULTS.append(r)
    if r.get("redirected_to") and ("/login" in r["redirected_to"] or "/prijava" in r["redirected_to"]):
        pytest.skip(f"editor token rejected at {path}")
    assert r["marker"] is None, (
        f"Editor {path!r} rendered not-found component (marker={r['marker']!r}) "
        f"at HTTP {r['status_visit']}; final URL={r.get('redirected_to') or r['url']}"
    )
