"""
Role-aware route-health audit — the regression gate for the bug class QA caught
(admin "Bankruptcy filings" rendered a 404).

Why earlier audits missed it:
  1. SPA "404"s are HTTP 200 — React Router renders a not-found COMPONENT while
     nginx returns 200 + index.html. Status-code crawls see 200 and pass. This
     audit asserts on RENDERED CONTENT instead.
  2. The broken page was an authenticated ADMIN route. This audit logs in (via an
     injected JWT, since UI login uses 2FA) and visits every admin/editor nav route.
  3. The audited build != the deployed build. Run this against BASE_URL = the LIVE
     deployed site.

Run:
  BASE_URL=http://127.0.0.1:4092 \
  E2E_ADMIN_TOKEN=<jwt> E2E_EDITOR_TOKEN=<jwt> \
  pytest tests/e2e/test_route_health.py
(Without a token, the admin/editor cases skip; public routes are still audited.)
Mint a token server-side: scripts/mint-user-token.mjs (Payload local API, bypasses 2FA).
"""
import os
import pytest
from conftest import BASE_URL, TIMEOUT  # reuse session config

AUTH_TOKEN_KEY = "sudacka.authToken"  # must match web/src/api/client.ts
ADMIN_TOKEN = os.environ.get("E2E_ADMIN_TOKEN", "")
EDITOR_TOKEN = os.environ.get("E2E_EDITOR_TOKEN", "")

# A route is BROKEN if the rendered page shows any of these (the SPA not-found /
# router-error components), regardless of HTTP status.
NOT_FOUND_MARKERS = [
    "page not found",
    "something went wrong",
    "the page you are looking for does not exist",
    "does not exist or has been moved",
    "stranica nije pronađena",
    "stranica ne postoji",
]

# Static public routes (no :id params).
PUBLIC_ROUTES = [
    "", "/pretraga", "/sudovi", "/sudovi/dorh", "/sudovi/suci", "/sudovi/nadleznost",
    "/sudovi/performanse", "/strucnjaci/vjestaci", "/strucnjaci/tumaci",
    "/stecaj", "/stecaj/oglasi", "/stecaj/upravitelji", "/stecaj/duznici",
    "/stecaj/zakoni", "/stecaj/odluke", "/sudska-praksa/pretraga", "/eur-lex",
    "/statistika", "/pristojbe", "/rokovi", "/pravna-pomoc", "/o-nama", "/kontakt",
    "/galerije", "/vijesti", "/mapa-sudova", "/api",
]

ADMIN_ROUTES = [
    "/admin/users", "/admin/gdpr", "/admin/bankruptcy", "/admin/bankruptcy-administrators",
    "/admin/bankruptcy-debtors", "/admin/filings", "/admin/flags", "/admin/news",
    "/admin/media", "/admin/audit-log", "/admin/courts", "/admin/judges", "/admin/experts",
    "/admin/interpreters", "/admin/state-attorneys", "/admin/laws", "/admin/legal-categories",
    "/admin/documents", "/admin/pages", "/admin/api-keys",
]
EDITOR_ROUTES = ["/editor/bankruptcy", "/editor/ingest", "/editor/pending"]


def _inject_token(page, token):
    """Authenticate the SPA the way it expects: token in localStorage (the app
    sends it as `Authorization: JWT`) + the client `sudacka_auth` cookie + Payload's
    `payload-token` cookie. Set before any app code runs."""
    page.context.add_cookies([
        {"name": "sudacka_auth", "value": token, "url": BASE_URL},
        {"name": "payload-token", "value": token, "url": BASE_URL},
    ])
    page.add_init_script(
        f"try{{localStorage.setItem({AUTH_TOKEN_KEY!r}, {token!r})}}catch(e){{}}"
    )


def _assert_renders(page, path):
    """Fail if the page shows a not-found/error component (content, not status)."""
    body = (page.inner_text("body") or "").lower()
    for marker in NOT_FOUND_MARKERS:
        assert marker not in body, (
            f"Route {path!r} rendered the not-found/error component "
            f"(marker: {marker!r}) at HTTP-200. URL={page.url}"
        )
    assert len(body.strip()) > 0, f"Route {path!r} rendered an empty body"


@pytest.mark.parametrize("path", PUBLIC_ROUTES)
def test_public_route_renders(page, path):
    page.goto(f"{BASE_URL}/hr{path}", wait_until="networkidle", timeout=TIMEOUT)
    _assert_renders(page, f"/hr{path}")


@pytest.mark.parametrize("path", ADMIN_ROUTES)
def test_admin_route_renders(page, path):
    if not ADMIN_TOKEN:
        pytest.skip("set E2E_ADMIN_TOKEN to audit authenticated admin routes")
    _inject_token(page, ADMIN_TOKEN)
    page.goto(f"{BASE_URL}/hr{path}", wait_until="networkidle", timeout=TIMEOUT)
    # An admin route bouncing to /login means the token wasn't accepted — that's a
    # test-setup problem, not a route bug; surface it clearly.
    assert "/login" not in page.url and "/prijava" not in page.url, (
        f"Admin route {path!r} redirected to login — token rejected/expired."
    )
    _assert_renders(page, f"/hr{path}")


@pytest.mark.parametrize("path", EDITOR_ROUTES)
def test_editor_route_renders(page, path):
    token = EDITOR_TOKEN or ADMIN_TOKEN
    if not token:
        pytest.skip("set E2E_EDITOR_TOKEN (or E2E_ADMIN_TOKEN) to audit editor routes")
    _inject_token(page, token)
    page.goto(f"{BASE_URL}/hr{path}", wait_until="networkidle", timeout=TIMEOUT)
    _assert_renders(page, f"/hr{path}")
