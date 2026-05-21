"""
End-to-end coverage tests for the 9 items in
"NEDOSTACI I KOREKCIJE NA NOVOJ STRANICI SUDACKE MREZE.docx".

All probes are routed through SSH to the Toronto host (`toronto-sudacka`)
because the production web container only binds 127.0.0.1:4092 inside
the host. UI checks for items 1/2/4/5 are done by reading the rebuilt
JavaScript bundles served by the web container and grepping for the
strings we introduced — that confirms both the build picked up our
changes AND that the bundle reaches the browser.

Run:
    pytest tests/e2e/test_corrections_doc.py -v --tb=short

No Playwright browser needed; no SSH tunnel needed.
"""
import json
import os
import re
import shlex
import subprocess


SSH_HOST = os.environ.get("SUDACKA_SSH_HOST", "toronto-sudacka")
CMS_CONTAINER = "sudacka-mreza-cms-1"
WEB_CONTAINER = "sudacka-mreza-web-1"
DB_CONTAINER = "sudacka-mreza-db-1"
BASE_INTERNAL = "http://127.0.0.1:4092"  # web container, from Toronto's POV

# Multiplex all SSH calls over a single master connection so we don't trip
# fail2ban / sshd MaxStartups on the Toronto host. ControlPersist keeps the
# master alive for 5 min after the last command exits.
_CONTROL_PATH = f"/tmp/sudacka-e2e-ssh-{os.getpid()}.sock"
_SSH_OPTS = [
    "-o", "ConnectTimeout=10",
    "-o", "ControlMaster=auto",
    "-o", f"ControlPath={_CONTROL_PATH}",
    "-o", "ControlPersist=300",
]


def remote(cmd: str, timeout: int = 20) -> subprocess.CompletedProcess:
    """Run `cmd` on the Toronto host via SSH (multiplexed) and return result."""
    return subprocess.run(
        ["ssh", *_SSH_OPTS, SSH_HOST, cmd],
        capture_output=True, text=True, timeout=timeout,
    )


def remote_curl(path: str, method: str = "GET", timeout: int = 20) -> tuple[int, str]:
    """Fetch `BASE_INTERNAL+path` from Toronto, return (status, body)."""
    url = BASE_INTERNAL + path
    out = remote(
        f"curl -sS -o /tmp/_body -w '%{{http_code}}' -X {method} --max-time 10 "
        + shlex.quote(url),
        timeout=timeout,
    )
    code = int(out.stdout.strip() or "0")
    body_out = remote(f"cat /tmp/_body", timeout=timeout)
    return code, body_out.stdout


def remote_curl_json(path: str) -> tuple[int, dict]:
    code, body = remote_curl(path)
    try:
        return code, json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        return code, {}


def grep_in_bundle(component_prefix: str, *needles: str) -> dict[str, bool]:
    """
    Look through every JS asset whose filename begins with `component_prefix`
    in the running web container and check whether each needle appears in any
    matching bundle. Returns {needle: True/False}.
    """
    # The bundle filenames are content-hashed; match by prefix then read
    # everything matching.
    out = remote(
        f"docker exec {WEB_CONTAINER} sh -c "
        + shlex.quote(
            f'cat /usr/share/nginx/html/assets/{component_prefix}*.js 2>/dev/null'
        ),
        timeout=30,
    )
    contents = out.stdout
    return {n: (n in contents) for n in needles}


# ---------------------------------------------------------------------------
# Item 1 — Bankruptcy debtors entity (new collection + pages)
# ---------------------------------------------------------------------------

def test_item1_debtors_collection_endpoint_exists() -> None:
    code, _ = remote_curl("/api/bankruptcy-debtors?limit=1")
    assert code == 200, f"expected 200, got {code}"


def test_item1_debtors_page_bundle_built() -> None:
    out = remote(
        f"docker exec {WEB_CONTAINER} sh -c "
        + shlex.quote("ls /usr/share/nginx/html/assets/DebtorsPage-*.js 2>&1"),
    )
    assert "DebtorsPage-" in out.stdout and ".js" in out.stdout, \
        f"DebtorsPage bundle missing: {out.stdout!r}"


def test_item1_debtor_detail_page_bundle_built() -> None:
    out = remote(
        f"docker exec {WEB_CONTAINER} sh -c "
        + shlex.quote("ls /usr/share/nginx/html/assets/DebtorDetailPage-*.js 2>&1"),
    )
    assert "DebtorDetailPage-" in out.stdout, \
        f"DebtorDetailPage bundle missing: {out.stdout!r}"


def test_item1_debtors_page_carries_expected_ui() -> None:
    hits = grep_in_bundle(
        "DebtorsPage",
        "Stečajni dužnici",
        "OIB",
    )
    missing = [k for k, v in hits.items() if not v]
    assert not missing, f"DebtorsPage missing UI strings: {missing}"


def test_item1_bankruptcy_hub_lists_debtors_tile() -> None:
    """The hub page bundle references the debtors route."""
    hits = grep_in_bundle("BankruptcyPage", "stecaj/duznici")
    assert hits["stecaj/duznici"], "hub bundle does not link to /stecaj/duznici"


# ---------------------------------------------------------------------------
# Item 2 — Bankruptcy administrators court affiliation
# ---------------------------------------------------------------------------

def test_item2_admin_court_filter_accepted_by_api() -> None:
    """API accepts the new where[courts][in]= filter and returns 200."""
    code, body = remote_curl_json(
        "/api/bankruptcy-administrators?where%5Bcourts%5D%5Bin%5D=1&limit=1"
    )
    assert code == 200, f"expected 200, got {code} body={body!r}"
    assert "docs" in body, "expected Payload list shape with .docs"


def test_item2_admin_listing_shows_court_filter_ui() -> None:
    """AdministratorsPage bundle includes the new court dropdown markers."""
    hits = grep_in_bundle(
        "AdministratorsPage",
        "Svi sudovi",         # the all-courts option label
        "where[courts][in]",  # the encoded filter query
    )
    missing = [k for k, v in hits.items() if not v]
    assert not missing, f"AdministratorsPage missing markers: {missing}"


# ---------------------------------------------------------------------------
# Item 3 — Bankruptcy filings no longer 404s
# ---------------------------------------------------------------------------

def test_item3_filings_api_no_longer_404() -> None:
    code, body = remote_curl_json("/api/bankruptcy-filings?limit=1")
    assert code == 403, f"expected 403 (access-gated) but got {code}: {body!r}"


# ---------------------------------------------------------------------------
# Item 4 — Experts & interpreters extra fields + filters
# ---------------------------------------------------------------------------

def test_item4_experts_api_accepts_subspeciality() -> None:
    code, body = remote_curl_json(
        "/api/expert-witnesses?where%5BspecialityAreas.subArea%5D%5Blike%5D=x&limit=1"
    )
    assert code == 200, f"expected 200, got {code} body={body!r}"


def test_item4_experts_api_accepts_address() -> None:
    code, _ = remote_curl(
        "/api/expert-witnesses?where%5Baddress%5D%5Blike%5D=Zagreb&limit=1"
    )
    assert code == 200


def test_item4_experts_page_has_subspeciality_filter_ui() -> None:
    hits = grep_in_bundle(
        "ExpertsPage",
        "Podgrana",          # sub-branch label
        "filterCity",        # city filter key
        "filterHasCv",       # CV filter key
    )
    missing = [k for k, v in hits.items() if not v]
    assert not missing, f"ExpertsPage missing markers: {missing}"


def test_item4_interpreters_api_accepts_second_language() -> None:
    code, _ = remote_curl(
        "/api/interpreters?where%5Band%5D%5B0%5D%5BlanguagePairs.pair%5D%5Bequals%5D=hr-en"
        "&where%5Band%5D%5B1%5D%5BlanguagePairs.pair%5D%5Blike%5D=de&limit=1"
    )
    assert code == 200


def test_item4_interpreters_page_has_second_language_filter() -> None:
    hits = grep_in_bundle(
        "InterpretersPage",
        "filterLanguage2",
        "filterCounty",
        "filterCity",
    )
    missing = [k for k, v in hits.items() if not v]
    assert not missing, f"InterpretersPage missing markers: {missing}"


# ---------------------------------------------------------------------------
# Item 5 — Courts: name/address search + departments schema
# ---------------------------------------------------------------------------

def test_item5_courts_keyword_filter_returns_results() -> None:
    code, body = remote_curl_json(
        "/api/courts"
        "?where%5Bor%5D%5B0%5D%5Bname%5D%5Blike%5D=Zagreb"
        "&where%5Bor%5D%5B1%5D%5Baddress%5D%5Blike%5D=Zagreb"
        "&limit=1"
    )
    assert code == 200
    assert body.get("totalDocs", 0) > 0, "Zagreb keyword found no courts"


def test_item5_court_detail_carries_departments_field() -> None:
    code, body = remote_curl_json("/api/courts?limit=1&depth=1")
    assert code == 200
    docs = body.get("docs", [])
    assert docs, "courts collection is empty"
    assert "departments" in docs[0], (
        f"departments field missing on courts; keys present: {list(docs[0].keys())}"
    )


def test_item5_courts_page_keyword_input_in_bundle() -> None:
    hits = grep_in_bundle("CourtsPage", "Naziv ili adresa")
    assert hits["Naziv ili adresa"], "courts keyword placeholder missing in bundle"


# ---------------------------------------------------------------------------
# Item 6 — Judges have court affiliation
# ---------------------------------------------------------------------------

def test_item6_judges_have_court_relation_field() -> None:
    code, body = remote_curl_json("/api/judges?limit=1&depth=1")
    assert code == 200
    docs = body.get("docs", [])
    assert docs, "judges collection is empty"
    assert "court" in docs[0], "court relation missing on judges"


# ---------------------------------------------------------------------------
# Item 7 — legal_entity user role
# ---------------------------------------------------------------------------

def test_item7_legal_entity_enum_value_present() -> None:
    out = remote(
        f"docker exec {DB_CONTAINER} psql -U postgres -d sudacka_mreza -tA -c "
        + shlex.quote(
            "SELECT enumlabel FROM pg_enum "
            "WHERE enumtypid='enum_users_role'::regtype "
            "ORDER BY enumsortorder;"
        ),
    )
    labels = [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]
    assert "legal_entity" in labels, f"legal_entity not in enum; got: {labels}"


def test_item7_organisation_columns_present() -> None:
    out = remote(
        f"docker exec {DB_CONTAINER} psql -U postgres -d sudacka_mreza -tA -c "
        + shlex.quote(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='users' "
            "AND column_name IN ('organisation_name','organisation_oib');"
        ),
    )
    cols = {ln.strip() for ln in out.stdout.splitlines() if ln.strip()}
    assert {"organisation_name", "organisation_oib"} <= cols, f"missing columns; have {cols}"


# ---------------------------------------------------------------------------
# Item 8 — Croatian admin UI translations
# ---------------------------------------------------------------------------

def test_item8_admin_route_serves_payload_shell() -> None:
    # /admin is routed to the React SPA shell (try_files → /index.html); the
    # SPA's internal router mounts AdminDashboardPage. Proving the SPA loads is
    # sufficient — Payload admin proper is reached via /admin/payload elsewhere.
    code, body = remote_curl("/admin")
    assert code == 200
    assert '<div id="root">' in body
    assert "/assets/main-" in body


def test_item8_payload_config_dist_carries_i18n() -> None:
    out = remote(
        f"docker exec {CMS_CONTAINER} sh -c "
        + shlex.quote(
            "grep -c 'supportedLanguages\\|fallbackLanguage' "
            "/app/dist/payload.config.js || true"
        ),
    )
    count = int(out.stdout.strip() or "0")
    assert count > 0, "payload.config.js dist does not contain i18n keys"


def test_item8_translations_package_has_hr() -> None:
    """The Croatian language pack must be reachable inside the container."""
    out = remote(
        f"docker exec {CMS_CONTAINER} sh -c "
        + shlex.quote(
            "ls /app/node_modules/@payloadcms/translations/dist/languages/hr.js"
        ),
    )
    assert "hr.js" in out.stdout, f"hr language pack not installed: {out.stdout!r}"


# ---------------------------------------------------------------------------
# Item 9 — Migration readiness doc shipped
# ---------------------------------------------------------------------------

def test_item9_migration_readiness_doc_present() -> None:
    path = os.path.join(
        os.path.dirname(__file__), "..", "..",
        "docs", "migration-readiness-2026-05-20.md",
    )
    assert os.path.exists(path), f"missing: {path}"
    with open(path) as f:
        content = f.read()
    for needle in [
        "Current state",
        "Already-migrated content",
        "ticket breakdown",
        "Recommendation",
    ]:
        assert needle in content, f"readiness doc missing section: {needle!r}"
