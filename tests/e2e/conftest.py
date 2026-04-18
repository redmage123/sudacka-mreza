"""
Shared fixtures for sudacka-mreza E2E tests.

BASE_URL defaults to http://78.47.104.139:4092 but can be overridden:
    BASE_URL=http://localhost:4092 pytest tests/e2e/
"""
import os
import pytest
from playwright.sync_api import sync_playwright, Browser, Page

BASE_URL = os.environ.get("BASE_URL", "http://78.47.104.139:4092")
TIMEOUT = int(os.environ.get("E2E_TIMEOUT", "15000"))


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: marks tests as slow-running")


@pytest.fixture(scope="session")
def browser_instance():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser_instance: Browser):
    """Fresh page for each test, desktop viewport."""
    ctx = browser_instance.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.set_default_timeout(TIMEOUT)
    yield pg
    ctx.close()


@pytest.fixture
def mobile_page(browser_instance: Browser):
    """Fresh page for each test, mobile viewport."""
    ctx = browser_instance.new_context(viewport={"width": 375, "height": 812})
    pg = ctx.new_page()
    pg.set_default_timeout(TIMEOUT)
    yield pg
    ctx.close()


def goto(page: Page, path: str) -> None:
    """Navigate and wait for network idle."""
    page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=TIMEOUT)


def assert_no_error_banner(page: Page) -> None:
    """Assert no Croatian/English error banners are visible."""
    body = page.inner_text("body")
    # Allow "Greška" only if it's inside a <title> or hidden — check visible text
    error_indicators = ["Greška pri učitavanju", "Nije moguće učitati", "Error loading"]
    for indicator in error_indicators:
        assert indicator not in body, (
            f"Error banner found on page {page.url!r}: {indicator!r}"
        )


def assert_not_placeholder(page: Page) -> None:
    """Assert page is not showing a placeholder/under construction message."""
    body = page.inner_text("body")
    placeholders = ["u izradi", "under construction", "coming soon", "placeholder"]
    for p_text in placeholders:
        assert p_text.lower() not in body.lower(), (
            f"Placeholder text found on page {page.url!r}: {p_text!r}"
        )
