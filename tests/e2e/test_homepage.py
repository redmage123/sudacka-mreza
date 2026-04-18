"""
Homepage tests — hr and en locales.
"""
import pytest
from conftest import goto, assert_no_error_banner, BASE_URL


class TestHomepageHR:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/hr", wait_until="networkidle")
        assert response.status == 200, f"Expected 200, got {response.status}"

    def test_title_contains_sudacka(self, page):
        goto(page, "/hr")
        assert "Sudačka Mreža" in page.title() or "Sudacka Mreza" in page.title() or "sudacka" in page.title().lower()

    def test_hero_section_renders(self, page):
        goto(page, "/hr")
        body = page.inner_text("body")
        # Homepage should have a hero with meaningful Croatian content
        assert any(kw in body for kw in [
            "Sudačka Mreža", "sudska", "Sudski", "Portal", "pravni"
        ]), f"Expected hero content on homepage, body starts with: {body[:300]!r}"

    def test_no_error_banner(self, page):
        goto(page, "/hr")
        assert_no_error_banner(page)

    def test_nav_rendered_in_croatian(self, page):
        goto(page, "/hr")
        body = page.inner_text("body")
        croatian_nav_terms = ["Sudska praksa", "Stručnjaci", "Sudovi", "Stečaj", "Statistika"]
        found = [t for t in croatian_nav_terms if t in body]
        assert len(found) >= 3, (
            f"Expected Croatian nav terms, only found {found}. Body excerpt: {body[:500]!r}"
        )

    def test_footer_present(self, page):
        goto(page, "/hr")
        body = page.inner_text("body")
        assert "Sudačka Mreža" in body or "sudacka" in body.lower()
        assert "2026" in body or "©" in body, "Footer copyright not found"


class TestHomepageEN:
    def test_loads_200(self, page):
        response = page.goto(f"{BASE_URL}/en", wait_until="networkidle")
        assert response.status == 200

    def test_nav_rendered_in_english(self, page):
        goto(page, "/en")
        body = page.inner_text("body")
        english_nav_terms = ["Case Law", "Experts", "Courts", "Bankruptcy", "Statistics"]
        found = [t for t in english_nav_terms if t in body]
        assert len(found) >= 3, (
            f"Expected English nav terms, only found {found}. Body excerpt: {body[:500]!r}"
        )

    def test_no_error_banner(self, page):
        goto(page, "/en")
        assert_no_error_banner(page)

    def test_footer_in_english(self, page):
        goto(page, "/en")
        body = page.inner_text("body")
        assert "All rights reserved" in body or "Privacy Policy" in body, (
            f"Expected English footer. Body: {body[-300:]!r}"
        )

    def test_different_content_from_hr(self, page):
        """English and Croatian nav text must differ (i18n is working)."""
        goto(page, "/hr")
        hr_body = page.inner_text("body")
        goto(page, "/en")
        en_body = page.inner_text("body")
        # "Sudska praksa" is Croatian; "Case Law" is English
        assert "Sudska praksa" in hr_body, "Croatian nav not found in /hr"
        assert "Case Law" in en_body, "English nav not found in /en"

    def test_en_page_title_differs_from_hr(self, page):
        """
        BUG (open): The <title> on /en/ must differ from /hr/.

        If they are identical, the English locale is not being applied to
        <head> metadata.  This test will FAIL until page title localisation
        is implemented.
        """
        goto(page, "/hr")
        hr_title = page.title()
        goto(page, "/en")
        en_title = page.title()
        assert hr_title != en_title, (
            f"BUG: <title> is identical on /hr/ and /en/ — title localisation "
            f"is not working. Both show: {hr_title!r}"
        )


class TestHomepageMobile:
    def test_homepage_mobile_loads(self, mobile_page):
        goto(mobile_page, "/hr")
        body = mobile_page.inner_text("body")
        assert "Sudačka Mreža" in body or any(
            kw in body for kw in ["Sudska praksa", "Stručnjaci", "Portal"]
        ), f"Mobile homepage content missing. Body: {body[:300]!r}"

    def test_mobile_no_error(self, mobile_page):
        goto(mobile_page, "/hr")
        assert_no_error_banner(mobile_page)
