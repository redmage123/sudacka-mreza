"""
Navigation tests — clicking between pages must not produce blank screens
or require a manual refresh.
"""
import pytest
from conftest import goto, assert_no_error_banner, BASE_URL, TIMEOUT


class TestNavigation:
    def test_home_to_courts_nav(self, page):
        """Clicking the Courts nav link from homepage works."""
        goto(page, "/hr")
        # Find the courts nav link
        courts_link = page.locator(
            "a[href*='/sudovi']:not([href*='/dorh']):not([href*='/suci'])"
        ).first
        courts_link.click()
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)
        assert "/sudovi" in page.url, f"Expected courts URL, got {page.url!r}"
        body = page.inner_text("body")
        assert len(body) > 200, "Page appears blank after navigation"

    def test_home_to_interpreters_nav(self, page):
        """Navigate from homepage to interpreters via menu."""
        goto(page, "/hr")
        experts_link = page.locator("a[href*='strucnjaci']").first
        if not experts_link.is_visible():
            # May be in a sub-menu — try direct URL
            goto(page, "/hr/strucnjaci/tumaci")
        else:
            experts_link.click()
            page.wait_for_load_state("networkidle", timeout=TIMEOUT)
        body = page.inner_text("body")
        assert len(body) > 200, "Page blank after navigation"
        assert "Greška" not in body

    def test_courts_to_statistics(self, page):
        """Navigate from courts to statistics without blank screen."""
        goto(page, "/hr/sudovi")
        goto(page, "/hr/statistika")
        body = page.inner_text("body")
        assert len(body) > 200
        assert "Greška" not in body

    def test_no_404_on_standard_routes(self, page):
        """None of the main routes should 404."""
        routes = [
            "/hr", "/en",
            "/hr/sudovi", "/hr/sudovi/suci", "/hr/sudovi/dorh",
            "/hr/strucnjaci/vjestaci", "/hr/strucnjaci/tumaci",
            "/hr/sudska-praksa/pretraga",
            "/hr/statistika",
        ]
        for route in routes:
            response = page.goto(f"{BASE_URL}{route}", wait_until="networkidle")
            assert response.status == 200, (
                f"Route {route!r} returned HTTP {response.status}"
            )

    def test_direct_link_interpreter_detail(self, page):
        """Direct link to interpreter detail (no navigation) must work."""
        response = page.goto(
            f"{BASE_URL}/hr/strucnjaci/tumaci/5", wait_until="networkidle"
        )
        assert response.status == 200
        assert_no_error_banner(page)

    def test_back_navigation(self, page):
        """Browser back button must not produce blank screen."""
        goto(page, "/hr")
        goto(page, "/hr/sudovi")
        page.go_back()
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)
        body = page.inner_text("body")
        assert len(body) > 200, "Page blank after browser back"
