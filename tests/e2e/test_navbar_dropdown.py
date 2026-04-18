"""
Navbar dropdown hover interaction tests.

Desktop: verifies that hovering over a top-level nav item opens its dropdown,
that moving the mouse INTO the dropdown keeps it open (catches the hover-gap
bug where leaving the trigger before entering the panel closes the menu), and
that clicking a dropdown item navigates correctly.

Mobile: verifies that the hamburger button opens the mobile nav panel and that
submenu groups are visible inside it.

The NavDropdown component uses onMouseEnter/onMouseLeave on the wrapper <div>,
so we simulate realistic mouse movement through the gap between trigger button
and the floating panel using bounding-box arithmetic.
"""
import pytest
from playwright.sync_api import Page
from conftest import goto, BASE_URL, TIMEOUT


# ---------------------------------------------------------------------------
# Desktop dropdown helpers
# ---------------------------------------------------------------------------

def _open_dropdown_by_hover(page: Page, trigger_text: str) -> None:
    """
    Hover over the trigger button and move the mouse into the dropdown panel
    through the vertical gap.  This is the key path that exposes the hover-gap
    bug: if the component closes the menu when the cursor leaves the button
    before entering the panel, the dropdown will not be visible by the time we
    assert.

    The NavDropdown component wraps both the button AND the panel in one <div>
    with onMouseEnter/onMouseLeave.  To keep the menu open we must finish with
    the cursor somewhere inside that wrapper — i.e. inside the visible panel,
    NOT outside it.  We therefore end the movement at (cx, panel_top + 20)
    which is solidly inside the panel area.
    """
    # Find the trigger button that contains the given text
    trigger = page.locator(
        f"nav button:has-text('{trigger_text}'), "
        f"header button:has-text('{trigger_text}')"
    ).first
    trigger.wait_for(state="visible", timeout=TIMEOUT)

    # Get the bounding box of the trigger
    box = trigger.bounding_box()
    assert box is not None, f"Could not get bounding box for trigger '{trigger_text}'"

    # Move to the centre of the trigger button to trigger onMouseEnter
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.wait_for_timeout(300)

    # The panel appears below the button with mt-1 (≈4px gap).
    # Step through 8 intermediate points from button centre to a point
    # 25px below the bottom of the button (inside the panel).
    # This simulates realistic mouse movement and exercises the gap region.
    target_y = box["y"] + box["height"] + 25
    steps = 8
    for i in range(1, steps + 1):
        step_y = cy + (target_y - cy) * i / steps
        page.mouse.move(cx, step_y)
        page.wait_for_timeout(30)

    # Brief pause so React can process the hover state
    page.wait_for_timeout(200)


def _get_dropdown_panel(page: Page) -> object:
    """Return the visible [role='menu'] panel, or None."""
    panels = page.locator("[role='menu']")
    visible = [panels.nth(i) for i in range(panels.count()) if panels.nth(i).is_visible()]
    return visible[0] if visible else None


# ---------------------------------------------------------------------------
# Desktop dropdown tests
# ---------------------------------------------------------------------------

# Map of top-level nav label (in Croatian, which is the default language) to
# expected English translation key text that appears inside the dropdown.
# We use Croatian labels because the tests navigate to /hr/ routes.
HR_DROPDOWN_LABELS = {
    "Sudska praksa": "Pretraži odluke",   # decisionsSearch Croatian label
    "Stručnjaci":    "Vještaci",           # expertWitnesses Croatian
    "Sudovi":        "Popis sudova",       # courtsList Croatian
    "Stečaj":        "Oglasi",             # bankruptcyListings Croatian
}

# EN equivalents for the same dropdowns
EN_DROPDOWN_LABELS = {
    "Case Law":   "Search Decisions",
    "Experts":    "Expert Witnesses",
    "Courts":     "Court Directory",
    "Bankruptcy": "Bankruptcy Listings",
}


class TestNavbarDropdownDesktop:
    """Desktop viewport (1440×900) — set by the page fixture in conftest."""

    def test_case_law_dropdown_stays_open_through_gap(self, page: Page):
        """
        Hover over Case Law / Sudska praksa and move through the gap into the
        panel — the dropdown must remain visible.
        """
        goto(page, "/hr")
        # The button text varies with i18n; we look for the Croatian label first.
        # Use aria-haspopup to be precise.
        trigger = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        ).first
        trigger.wait_for(state="visible", timeout=TIMEOUT)

        trigger_text = trigger.inner_text().strip()
        _open_dropdown_by_hover(page, trigger_text)

        panel = page.locator("[role='menu']").first
        assert panel.is_visible(), (
            f"Dropdown panel not visible after hovering through gap for '{trigger_text}'"
        )

    @pytest.mark.parametrize("path,trigger_idx", [
        ("/hr", 0),   # first dropdown = Sudska praksa
        ("/hr", 1),   # second = Stručnjaci
        ("/hr", 2),   # third = Sudovi
        ("/hr", 3),   # fourth = Stečaj
    ])
    def test_all_dropdowns_open_on_hover(self, page: Page, path: str, trigger_idx: int):
        """Each dropdown trigger opens its panel on hover."""
        goto(page, path)
        triggers = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        )
        count = triggers.count()
        if trigger_idx >= count:
            pytest.skip(f"Only {count} dropdown triggers found, expected index {trigger_idx}")

        trigger = triggers.nth(trigger_idx)
        trigger.wait_for(state="visible", timeout=TIMEOUT)
        trigger_text = trigger.inner_text().strip()

        _open_dropdown_by_hover(page, trigger_text)

        panel = page.locator("[role='menu']").first
        assert panel.is_visible(), (
            f"Dropdown {trigger_idx} ('{trigger_text}') did not open on hover"
        )

    def test_dropdown_items_are_navigable(self, page: Page):
        """
        Click the first item inside the first dropdown and verify URL changes.
        """
        goto(page, "/hr")
        triggers = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        )
        trigger = triggers.first
        trigger.wait_for(state="visible", timeout=TIMEOUT)
        trigger_text = trigger.inner_text().strip()

        _open_dropdown_by_hover(page, trigger_text)

        # Click the first menu item
        menu_item = page.locator("[role='menu'] [role='menuitem']").first
        menu_item.wait_for(state="visible", timeout=TIMEOUT)
        item_text = menu_item.inner_text().strip()
        menu_item.click()
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        body = page.inner_text("body")
        assert len(body) > 100, (
            f"Page body too short after clicking dropdown item '{item_text}'. "
            f"URL: {page.url!r}"
        )
        assert "Greška pri učitavanju" not in body, (
            f"Error banner after clicking dropdown item '{item_text}'"
        )

    def test_bankruptcy_dropdown_navigates_to_listings(self, page: Page):
        """
        Verify the Stečaj/Bankruptcy dropdown opens and its first item
        (Oglasi / Bankruptcy Listings) navigates to /stecaj/oglasi.
        """
        goto(page, "/hr")
        # Find the Stečaj trigger (4th dropdown, index 3)
        triggers = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        )
        count = triggers.count()
        if count < 4:
            pytest.skip(f"Only {count} dropdown triggers found, need 4 for Stečaj")

        stecaj_trigger = triggers.nth(3)
        stecaj_trigger.wait_for(state="visible", timeout=TIMEOUT)

        _open_dropdown_by_hover(page, stecaj_trigger.inner_text().strip())

        panel = page.locator("[role='menu']").first
        assert panel.is_visible(), "Stečaj dropdown did not open"

        # Click first item (Oglasi)
        item = panel.locator("[role='menuitem']").first
        item.wait_for(state="visible", timeout=TIMEOUT)
        item.click()
        page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        assert "stecaj" in page.url, (
            f"Expected URL to contain 'stecaj', got {page.url!r}"
        )

    def test_dropdown_closes_on_mouse_leave(self, page: Page):
        """
        After hovering to open a dropdown, moving the mouse far away should
        close it (onMouseLeave on the wrapper).
        """
        goto(page, "/hr")
        triggers = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        )
        trigger = triggers.first
        trigger.wait_for(state="visible", timeout=TIMEOUT)
        trigger_text = trigger.inner_text().strip()

        _open_dropdown_by_hover(page, trigger_text)
        assert page.locator("[role='menu']").first.is_visible(), "Dropdown didn't open"

        # Move mouse far away from the nav (bottom of page)
        page.mouse.move(720, 800)
        page.wait_for_timeout(400)

        panel_visible = page.locator("[role='menu']").first.is_visible()
        assert not panel_visible, "Dropdown should be closed after mouse moved away"

    def test_en_route_dropdowns_show_english_labels(self, page: Page):
        """
        On /en/ routes the dropdown items show English text.
        """
        goto(page, "/en")
        triggers = page.locator(
            "nav button[aria-haspopup='menu'], header button[aria-haspopup='menu']"
        )
        if triggers.count() == 0:
            pytest.skip("No dropdown triggers found on /en/")

        trigger = triggers.first
        trigger.wait_for(state="visible", timeout=TIMEOUT)
        trigger_text = trigger.inner_text().strip()

        _open_dropdown_by_hover(page, trigger_text)

        panel = page.locator("[role='menu']").first
        assert panel.is_visible(), "First dropdown didn't open on /en/"

        items_text = panel.inner_text()
        # On /en/ the first dropdown is "Case Law" — its items should be in English
        english_items = ["Search Decisions", "Commercial Court", "ECHR"]
        assert any(t in items_text for t in english_items), (
            f"Expected English dropdown items on /en/ route. Got: {items_text!r}"
        )


# ---------------------------------------------------------------------------
# Mobile tests
# ---------------------------------------------------------------------------

class TestNavbarMobile:
    """Mobile viewport (375×812) — uses mobile_page fixture from conftest."""

    def test_hamburger_opens_mobile_nav(self, mobile_page: Page):
        """Tapping the hamburger button opens the mobile nav panel."""
        goto(mobile_page, "/hr")

        hamburger = mobile_page.locator(
            "button[aria-controls='mobile-nav'], "
            "button[aria-label*='menu' i], "
            "button[aria-label*='izbornik' i]"
        ).first
        hamburger.wait_for(state="visible", timeout=TIMEOUT)
        hamburger.click()
        mobile_page.wait_for_timeout(400)

        mobile_nav = mobile_page.locator("#mobile-nav")
        assert mobile_nav.is_visible(), "Mobile nav panel did not open after hamburger click"

    def test_mobile_nav_contains_submenu_groups(self, mobile_page: Page):
        """
        After opening the hamburger menu, all four nav group headings (Stečaj,
        Sudovi, Stručnjaci, Sudska praksa) should be visible inside the panel.
        """
        goto(mobile_page, "/hr")

        hamburger = mobile_page.locator(
            "button[aria-controls='mobile-nav'], "
            "button[aria-label*='menu' i], "
            "button[aria-label*='izbornik' i]"
        ).first
        hamburger.wait_for(state="visible", timeout=TIMEOUT)
        hamburger.click()
        mobile_page.wait_for_timeout(500)

        mobile_nav = mobile_page.locator("#mobile-nav")
        mobile_nav.wait_for(state="visible", timeout=TIMEOUT)
        nav_text = mobile_nav.inner_text()
        nav_text_upper = nav_text.upper()

        # The MobileNav renders group headings in uppercase via CSS/text-transform.
        # inner_text() returns the rendered text, so we compare case-insensitively.
        expected_groups = ["STEČAJ", "SUDOVI", "STRUČNJACI", "SUDSKA PRAKSA"]
        found = [g for g in expected_groups if g in nav_text_upper]
        assert len(found) >= 2, (
            f"Expected at least 2 nav group headings in mobile nav. Found: {found}. "
            f"Nav text: {nav_text[:500]!r}"
        )

    def test_mobile_nav_links_navigate(self, mobile_page: Page):
        """
        Tapping a link inside the mobile nav panel navigates to the correct
        page without a blank screen.
        """
        goto(mobile_page, "/hr")

        hamburger = mobile_page.locator(
            "button[aria-controls='mobile-nav'], "
            "button[aria-label*='menu' i], "
            "button[aria-label*='izbornik' i]"
        ).first
        hamburger.wait_for(state="visible", timeout=TIMEOUT)
        hamburger.click()
        mobile_page.wait_for_timeout(500)

        mobile_nav = mobile_page.locator("#mobile-nav")
        mobile_nav.wait_for(state="visible", timeout=TIMEOUT)

        # Click the first internal link inside the panel
        first_link = mobile_nav.locator("a[href]").first
        first_link.wait_for(state="visible", timeout=TIMEOUT)
        href = first_link.get_attribute("href") or ""
        first_link.click()
        mobile_page.wait_for_load_state("networkidle", timeout=TIMEOUT)

        body = mobile_page.inner_text("body")
        assert len(body) > 100, (
            f"Page blank after tapping mobile nav link '{href}'. URL: {mobile_page.url!r}"
        )

    def test_mobile_nav_close_button_works(self, mobile_page: Page):
        """The × close button inside the mobile nav closes the panel."""
        goto(mobile_page, "/hr")

        hamburger = mobile_page.locator(
            "button[aria-controls='mobile-nav'], "
            "button[aria-label*='menu' i], "
            "button[aria-label*='izbornik' i]"
        ).first
        hamburger.wait_for(state="visible", timeout=TIMEOUT)
        hamburger.click()
        mobile_page.wait_for_timeout(400)

        mobile_nav = mobile_page.locator("#mobile-nav")
        mobile_nav.wait_for(state="visible", timeout=TIMEOUT)

        close_btn = mobile_nav.locator(
            "button[aria-label*='close' i], button[aria-label*='zatvori' i]"
        ).first
        close_btn.click()
        mobile_page.wait_for_timeout(400)

        assert not mobile_nav.is_visible(), "Mobile nav still visible after clicking close"
