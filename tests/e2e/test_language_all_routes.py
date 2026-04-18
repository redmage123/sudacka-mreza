"""
Language switching coverage across ALL routes.

For every route pair (/hr/… ↔ /en/…) this test suite verifies:
  1. The /en/ URL returns HTTP 200.
  2. The page body contains English text (nav labels, headings, or footer).
  3. The page does NOT show Croatian-only nav strings where English should be.
  4. The language switcher <select> is present and its current value is 'en'.

Routes covered:
  - Homepage            /hr  /en
  - Courts              /hr/sudovi  /en/sudovi
  - State attorneys     /hr/sudovi/dorh  /en/sudovi/dorh
  - Judges              /hr/sudovi/suci  /en/sudovi/suci
  - Expert witnesses    /hr/strucnjaci/vjestaci  /en/strucnjaci/vjestaci
  - Interpreters        /hr/strucnjaci/tumaci  /en/strucnjaci/tumaci
  - Bankruptcy hub      /hr/stecaj  /en/stecaj           ← newly found bug
  - Bankruptcy listings /hr/stecaj/oglasi  /en/stecaj/oglasi
  - Bankruptcy admins   /hr/stecaj/upravitelji  /en/stecaj/upravitelji
  - Case law search     /hr/sudska-praksa/pretraga  /en/sudska-praksa/pretraga
  - Statistics          /hr/statistika  /en/statistika
  - Court detail        /hr/sudovi/1  /en/sudovi/1
  - Interpreter detail  /hr/strucnjaci/tumaci/5  /en/strucnjaci/tumaci/5

English-presence check: any of the following must appear in the page body:
  "Case Law", "Courts", "Experts", "Bankruptcy", "Statistics",
  "Search", "All rights reserved", "Interpreters", "Home", "Logout"
  (these are stable English strings from nav.json / common.json)

Croatian-absence check: "Sudska praksa" must NOT appear (this is the nav item
label that is only present when the Croatian language bundle is active).
An exception is made if the page title / h1 is a proper noun that happens to
contain a Croatian word but the nav itself is English.
"""
import pytest
from playwright.sync_api import Page
from conftest import goto, BASE_URL, TIMEOUT

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Any one of these strings in the body proves the English bundle is active.
ENGLISH_MARKERS = [
    "Case Law",
    "Courts",
    "Experts",
    "Bankruptcy",
    "Statistics",
    "Search",
    "All rights reserved",
    "Interpreters",
    "Home",
    "Court Fees",
    "About Us",
    "News",
    "Contact",
    "Log In",
    "Register",
    "Jurisdiction Finder",
    "Search Decisions",
    "Administrators",
    "Legislation",
]

# This string appears in the Croatian nav label "Sudska praksa".
# It must NOT appear when the language is English.
CROATIAN_NAV_SENTINEL = "Sudska praksa"

# Pairs: (hr_path, en_path, description)
ROUTE_PAIRS = [
    ("/hr",                          "/en",                           "homepage"),
    ("/hr/sudovi",                   "/en/sudovi",                    "courts list"),
    ("/hr/sudovi/dorh",              "/en/sudovi/dorh",               "state attorneys"),
    ("/hr/sudovi/suci",              "/en/sudovi/suci",               "judges"),
    ("/hr/strucnjaci/vjestaci",      "/en/strucnjaci/vjestaci",       "expert witnesses"),
    ("/hr/strucnjaci/tumaci",        "/en/strucnjaci/tumaci",         "interpreters"),
    ("/hr/stecaj",                   "/en/stecaj",                    "bankruptcy hub"),
    ("/hr/stecaj/oglasi",            "/en/stecaj/oglasi",             "bankruptcy listings"),
    ("/hr/stecaj/upravitelji",       "/en/stecaj/upravitelji",        "bankruptcy administrators"),
    ("/hr/sudska-praksa/pretraga",   "/en/sudska-praksa/pretraga",    "case law search"),
    ("/hr/statistika",               "/en/statistika",                "statistics"),
    ("/hr/sudovi/1",                 "/en/sudovi/1",                  "court detail id=1"),
    ("/hr/strucnjaci/tumaci/5",      "/en/strucnjaci/tumaci/5",       "interpreter detail id=5"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _has_english(body: str) -> bool:
    return any(m in body for m in ENGLISH_MARKERS)


def _has_croatian_nav(body: str) -> bool:
    return CROATIAN_NAV_SENTINEL in body


def _language_switcher_value(page: Page) -> str | None:
    """Return the current value of the language <select>, or None if absent."""
    sel = page.locator("select[aria-label='Language']")
    if sel.count() == 0:
        return None
    return sel.first.input_value()


# ---------------------------------------------------------------------------
# Test classes
# ---------------------------------------------------------------------------

class TestEnglishRouteHttpStatus:
    """Every /en/… route must return HTTP 200."""

    @pytest.mark.parametrize("hr_path,en_path,desc", ROUTE_PAIRS)
    def test_en_route_returns_200(self, page: Page, hr_path: str, en_path: str, desc: str):
        response = page.goto(
            f"{BASE_URL}{en_path}", wait_until="networkidle", timeout=TIMEOUT
        )
        assert response is not None, f"No response for {en_path}"
        assert response.status == 200, (
            f"[{desc}] {en_path} returned HTTP {response.status}, expected 200"
        )


class TestEnglishRouteContent:
    """Every /en/… page must contain English UI text."""

    @pytest.mark.parametrize("hr_path,en_path,desc", ROUTE_PAIRS)
    def test_en_page_has_english_text(self, page: Page, hr_path: str, en_path: str, desc: str):
        goto(page, en_path)
        body = page.inner_text("body")
        assert _has_english(body), (
            f"[{desc}] No English marker found on {en_path}. "
            f"Body excerpt: {body[:600]!r}"
        )


class TestCroatianNavAbsentOnEnglishRoutes:
    """
    The Croatian nav label 'Sudska praksa' must not appear on /en/… pages.
    Its presence indicates the Croatian language bundle is being rendered
    instead of the English one.
    """

    @pytest.mark.parametrize("hr_path,en_path,desc", ROUTE_PAIRS)
    def test_no_croatian_nav_on_en_page(
        self, page: Page, hr_path: str, en_path: str, desc: str
    ):
        goto(page, en_path)
        body = page.inner_text("body")
        assert not _has_croatian_nav(body), (
            f"[{desc}] Croatian nav string 'Sudska praksa' found on {en_path}. "
            f"The English language bundle is not being applied. "
            f"Body excerpt: {body[:600]!r}"
        )


class TestLanguageSwitcherActiveStateOnAllRoutes:
    """
    The language switcher <select> must be present on every route, and when
    navigating to /en/… its value must be 'en'.
    """

    @pytest.mark.parametrize("hr_path,en_path,desc", ROUTE_PAIRS)
    def test_language_switcher_present_and_active(
        self, page: Page, hr_path: str, en_path: str, desc: str
    ):
        # Check /hr/ page — switcher should read 'hr'
        goto(page, hr_path)
        hr_value = _language_switcher_value(page)
        # If a <select> is found, its value must be 'hr'
        if hr_value is not None:
            assert hr_value == "hr", (
                f"[{desc}] Language switcher value on {hr_path} expected 'hr', got {hr_value!r}"
            )

        # Check /en/ page — switcher should read 'en'
        goto(page, en_path)
        en_value = _language_switcher_value(page)
        assert en_value is not None, (
            f"[{desc}] Language switcher <select> not found on {en_path}"
        )
        assert en_value == "en", (
            f"[{desc}] Language switcher value on {en_path} expected 'en', got {en_value!r}"
        )


class TestBankruptcyRoutesSpecifically:
    """
    Dedicated regression tests for the bankruptcy (/stecaj) route family,
    which was identified as a coverage gap — previously untested for language
    switching.
    """

    def test_bankruptcy_hub_en_has_english_content(self, page: Page):
        goto(page, "/en/stecaj")
        body = page.inner_text("body")
        assert _has_english(body), (
            f"Bankruptcy hub /en/stecaj has no English content. Body: {body[:600]!r}"
        )
        assert not _has_croatian_nav(body), (
            "Croatian nav 'Sudska praksa' found on /en/stecaj — language not switching"
        )

    def test_bankruptcy_listings_en_has_english_content(self, page: Page):
        goto(page, "/en/stecaj/oglasi")
        body = page.inner_text("body")
        assert _has_english(body), (
            f"/en/stecaj/oglasi has no English content. Body: {body[:600]!r}"
        )
        assert not _has_croatian_nav(body), (
            "Croatian nav found on /en/stecaj/oglasi"
        )

    def test_bankruptcy_administrators_en_has_english_content(self, page: Page):
        goto(page, "/en/stecaj/upravitelji")
        body = page.inner_text("body")
        assert _has_english(body), (
            f"/en/stecaj/upravitelji has no English content. Body: {body[:600]!r}"
        )
        assert not _has_croatian_nav(body), (
            "Croatian nav found on /en/stecaj/upravitelji"
        )

    def test_bankruptcy_switcher_navigates_hr_to_en(self, page: Page):
        """
        Start on /hr/stecaj, change the language switcher to English and verify
        the URL changes to /en/stecaj and English content loads.
        """
        goto(page, "/hr/stecaj")
        switcher = page.locator("select[aria-label='Language']").first
        switcher.wait_for(state="visible", timeout=TIMEOUT)

        # Select English
        switcher.select_option("en")
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        assert "/en/" in page.url, (
            f"URL did not switch to /en/ after language change. URL: {page.url!r}"
        )
        body = page.inner_text("body")
        assert _has_english(body), (
            f"No English content after switching from /hr/stecaj to EN. Body: {body[:600]!r}"
        )


class TestDetailPageLanguageSwitching:
    """Language switching must work on detail pages, not just list pages."""

    def test_court_detail_en_has_english_content(self, page: Page):
        goto(page, "/en/sudovi/1")
        body = page.inner_text("body")
        assert _has_english(body), (
            f"Court detail /en/sudovi/1 has no English content. Body: {body[:600]!r}"
        )
        assert not _has_croatian_nav(body), (
            "Croatian nav found on /en/sudovi/1"
        )

    def test_interpreter_detail_en_switcher_active(self, page: Page):
        goto(page, "/en/strucnjaci/tumaci/5")
        en_value = _language_switcher_value(page)
        assert en_value == "en", (
            f"Language switcher on /en/strucnjaci/tumaci/5 expected 'en', got {en_value!r}"
        )

    def test_interpreter_detail_switcher_navigates_back_to_hr(self, page: Page):
        """
        From /en/strucnjaci/tumaci/5, switching to Croatian must redirect to
        /hr/strucnjaci/tumaci/5 and show Croatian content.
        """
        goto(page, "/en/strucnjaci/tumaci/5")
        switcher = page.locator("select[aria-label='Language']").first
        switcher.wait_for(state="visible", timeout=TIMEOUT)
        switcher.select_option("hr")
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        assert "/hr/" in page.url, (
            f"URL did not switch to /hr/ after language change. URL: {page.url!r}"
        )
        body = page.inner_text("body")
        # Croatian page should show Croatian nav
        assert "Sudska praksa" in body or "Sudovi" in body or "Stručnjaci" in body, (
            f"Croatian nav not found after switching back to HR. Body: {body[:600]!r}"
        )
