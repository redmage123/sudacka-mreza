"""
Data page tests — courts, judges, state attorneys, expert witnesses,
interpreters, court decisions search, statistics.

Each test verifies:
  1. Page loads (HTTP 200)
  2. No error banner visible
  3. The page renders actual content (not placeholder)
  4. If data is expected, at least one item is shown
"""
import pytest
from conftest import goto, assert_no_error_banner, assert_not_placeholder, BASE_URL


# ---------------------------------------------------------------------------
# Courts  (/hr/sudovi)
# ---------------------------------------------------------------------------

class TestCourtsPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/sudovi", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/sudovi")
        assert_no_error_banner(page)

    def test_tabs_rendered(self, page):
        """Page should show court type tabs (Općinski, Županijski, etc.)."""
        goto(page, "/hr/sudovi")
        body = page.inner_text("body")
        tab_terms = ["Općinski", "Županijski", "Trgovački", "Prekršajni", "Vrhovni"]
        found = [t for t in tab_terms if t in body]
        assert len(found) >= 2, (
            f"Expected court type tabs, only found {found}. Body: {body[:600]!r}"
        )

    def test_court_items_listed(self, page):
        """At least one court name should be visible."""
        goto(page, "/hr/sudovi")
        body = page.inner_text("body")
        # The API has 346 courts; any Croatian city/court name is a good signal
        court_signals = ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Općinski sud"]
        found = [s for s in court_signals if s in body]
        assert len(found) >= 1, (
            f"Expected court listings. Body excerpt: {body[:800]!r}"
        )

    def test_english_courts_page(self, page):
        """English courts page must show English labels."""
        goto(page, "/en/sudovi")
        body = page.inner_text("body")
        assert "Courts" in body or "Municipal" in body or "County" in body, (
            f"Expected English labels on /en/sudovi. Body: {body[:500]!r}"
        )
        assert "Greška" not in body


# ---------------------------------------------------------------------------
# Judges  (/hr/sudovi/suci)
# ---------------------------------------------------------------------------

class TestJudgesPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/sudovi/suci", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/sudovi/suci")
        assert_no_error_banner(page)

    def test_judges_listed(self, page):
        """At least one judge name or the heading 'Suci' should appear."""
        goto(page, "/hr/sudovi/suci")
        body = page.inner_text("body")
        assert any(kw in body for kw in ["Suci", "Sudac", "sudac", "Judge", "Judges"]), (
            f"Expected judges content. Body: {body[:600]!r}"
        )

    def test_english_judges_page(self, page):
        goto(page, "/en/sudovi/suci")
        body = page.inner_text("body")
        assert "Greška" not in body
        assert any(kw in body for kw in ["Judge", "Judges", "Suci"]), (
            f"Expected judges page content. Body: {body[:500]!r}"
        )


# ---------------------------------------------------------------------------
# State Attorneys  (/hr/sudovi/dorh)
# ---------------------------------------------------------------------------

class TestStateAttorneysPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/sudovi/dorh", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/sudovi/dorh")
        assert_no_error_banner(page)

    def test_not_placeholder(self, page):
        goto(page, "/hr/sudovi/dorh")
        assert_not_placeholder(page)

    def test_content_renders(self, page):
        goto(page, "/hr/sudovi/dorh")
        body = page.inner_text("body")
        assert any(kw in body for kw in [
            "Državno odvjetništvo", "DORH", "odvjetni", "Attorney", "State"
        ]), f"Expected state attorneys content. Body: {body[:600]!r}"


# ---------------------------------------------------------------------------
# Expert Witnesses  (/hr/strucnjaci/vjestaci)
# ---------------------------------------------------------------------------

class TestExpertsPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/strucnjaci/vjestaci", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/strucnjaci/vjestaci")
        assert_no_error_banner(page)

    def test_experts_listed(self, page):
        goto(page, "/hr/strucnjaci/vjestaci")
        body = page.inner_text("body")
        assert any(kw in body for kw in [
            "Vještak", "vještak", "Vještaci", "Expert", "Stručnjak", "Stručnjaci", "strucnjak"
        ]), f"Expected expert witnesses content. Body: {body[:600]!r}"

    def test_expert_detail_page(self, page):
        """Expert detail page (ID 1) must load without error."""
        goto(page, "/hr/strucnjaci/vjestaci/1")
        assert_no_error_banner(page)
        body = page.inner_text("body")
        # Should show a detail view (name, specialization, etc.)
        assert any(kw in body for kw in [
            "Vještak", "VJEŠTAK", "Specijalizacija", "Specialization", "Expert"
        ]), f"Expected expert detail. Body: {body[:600]!r}"


# ---------------------------------------------------------------------------
# Interpreters  (/hr/strucnjaci/tumaci)
# ---------------------------------------------------------------------------

class TestInterpretersPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/strucnjaci/tumaci", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/strucnjaci/tumaci")
        assert_no_error_banner(page)

    def test_interpreters_listed(self, page):
        goto(page, "/hr/strucnjaci/tumaci")
        body = page.inner_text("body")
        assert any(kw in body for kw in [
            "Tumač", "tumač", "Interpreter", "Sudski tumač"
        ]), f"Expected interpreters content. Body: {body[:600]!r}"

    def test_interpreter_detail_hr(self, page):
        """Interpreter detail page in Croatian."""
        goto(page, "/hr/strucnjaci/tumaci/5")
        assert_no_error_banner(page)
        body = page.inner_text("body")
        assert "SUDSKI TUMAČ" in body or "Tumač" in body or "Petra Novák" in body, (
            f"Expected interpreter detail (HR). Body: {body[:600]!r}"
        )

    def test_interpreter_detail_en_labels(self, page):
        """Interpreter detail page in English must use English labels."""
        goto(page, "/en/strucnjaci/tumaci/5")
        assert_no_error_banner(page)
        body = page.inner_text("body")
        # The heading should be INTERPRETER (not SUDSKI TUMAČ)
        assert "INTERPRETER" in body or "Interpreter" in body, (
            f"Expected English label 'INTERPRETER'. Body: {body[:600]!r}"
        )
        assert "SUDSKI TUMAČ" not in body, (
            "Croatian label 'SUDSKI TUMAČ' still showing on /en/ page"
        )

    def test_interpreter_detail_en_language_pairs_label(self, page):
        """'LANGUAGE PAIRS' label must appear in English, not 'JEZIČNI PAROVI'."""
        goto(page, "/en/strucnjaci/tumaci/5")
        body = page.inner_text("body")
        assert "LANGUAGE PAIRS" in body or "Language Pairs" in body, (
            f"Expected 'LANGUAGE PAIRS' label in English. Body: {body[:800]!r}"
        )
        assert "JEZIČNI PAROVI" not in body, (
            "Croatian label 'JEZIČNI PAROVI' still showing on /en/ page"
        )


# ---------------------------------------------------------------------------
# Court Decisions Search  (/hr/sudska-praksa/pretraga)
# ---------------------------------------------------------------------------

class TestDecisionsPage:
    def test_loads_200(self, page):
        response = page.goto(
            f"{BASE_URL}/hr/sudska-praksa/pretraga", wait_until="networkidle"
        )
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/sudska-praksa/pretraga")
        assert_no_error_banner(page)

    def test_search_ui_present(self, page):
        """Search input or filter controls should be visible."""
        goto(page, "/hr/sudska-praksa/pretraga")
        body = page.inner_text("body")
        # Search page must have a search input or relevant heading
        has_search_ui = (
            page.locator("input[type='search'], input[type='text'], input[placeholder]").count() > 0
            or any(kw in body for kw in ["Pretraži", "Search", "Pretraga", "sudska praksa"])
        )
        assert has_search_ui, f"Expected search UI. Body: {body[:600]!r}"

    def test_english_decisions_page(self, page):
        goto(page, "/en/sudska-praksa/pretraga")
        body = page.inner_text("body")
        assert "Greška" not in body
        assert any(kw in body for kw in ["Search", "Case Law", "Decision"]), (
            f"Expected English decisions page. Body: {body[:500]!r}"
        )


# ---------------------------------------------------------------------------
# Statistics  (/hr/statistika)
# ---------------------------------------------------------------------------

class TestStatisticsPage:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr/statistika", wait_until="networkidle")
        assert response.status == 200

    def test_no_error_banner(self, page):
        goto(page, "/hr/statistika")
        assert_no_error_banner(page)

    def test_statistics_content_renders(self, page):
        goto(page, "/hr/statistika")
        body = page.inner_text("body")
        assert any(kw in body for kw in [
            "Statistika", "statistika", "Statistics", "Sudovi", "Suci", "podatak"
        ]), f"Expected statistics content. Body: {body[:600]!r}"

    def test_english_statistics_page(self, page):
        goto(page, "/en/statistika")
        body = page.inner_text("body")
        assert "Greška" not in body
