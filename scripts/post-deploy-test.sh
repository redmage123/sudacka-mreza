#!/usr/bin/env bash
# post-deploy-test.sh
# Run after every `docker compose up -d --build` to verify the deployment.
#
# Usage:
#   ./scripts/post-deploy-test.sh [BASE_URL]
#
# Defaults to http://78.47.104.139:4092 if BASE_URL not set.
# Exit code 0 = PASS, 1 = FAIL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_DIR/tests/e2e"

BASE_URL="${BASE_URL:-http://78.47.104.139:4092}"
WAIT_TIMEOUT=120   # seconds to wait for services to become healthy
POLL_INTERVAL=5

# ── Colour helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${YELLOW}[post-deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[post-deploy] ✓${NC} $*"; }
fail()  { echo -e "${RED}[post-deploy] ✗${NC} $*"; }

# ── Wait for the web service to be ready ────────────────────────────────────
info "Waiting for $BASE_URL to respond (up to ${WAIT_TIMEOUT}s)…"
elapsed=0
until curl -sf -o /dev/null "$BASE_URL" 2>/dev/null; do
  if (( elapsed >= WAIT_TIMEOUT )); then
    fail "Service did not respond within ${WAIT_TIMEOUT}s. Aborting."
    exit 1
  fi
  sleep "$POLL_INTERVAL"
  (( elapsed += POLL_INTERVAL ))
done
ok "Service is up after ${elapsed}s"

# Also wait for the CMS API (required for data pages)
CMS_URL="${CMS_URL:-$(echo "$BASE_URL" | sed 's/:4092/:4093/')}"
info "Waiting for CMS API at $CMS_URL…"
elapsed=0
until curl -sf -o /dev/null "$CMS_URL/api/health" 2>/dev/null || \
      curl -sf -o /dev/null "$CMS_URL/api/courts?limit=1" 2>/dev/null; do
  if (( elapsed >= WAIT_TIMEOUT )); then
    info "CMS API not ready — continuing anyway (some data tests may fail)"
    break
  fi
  sleep "$POLL_INTERVAL"
  (( elapsed += POLL_INTERVAL ))
done

# ── Run the FULL E2E test suite ─────────────────────────────────────────────
# IMPORTANT: this runs ALL test files, not just a smoke subset.
# Suite breakdown (as of 2026-03-28):
#   test_homepage.py              — homepage hr+en+mobile (13 tests)
#   test_data_pages.py            — courts, judges, state attorneys, experts,
#                                   interpreters, decisions, statistics (27 tests)
#   test_language_switching.py    — language switcher on list + detail pages (17 tests)
#   test_language_all_routes.py   — English switching on EVERY route including
#                                   bankruptcy, statistics, detail pages (72 tests)
#   test_navbar_dropdown.py       — dropdown hover, gap, mobile nav (12 tests)
#   test_navigation.py            — SPA nav, back button, no 404s (6 tests)
#
# Do NOT replace this with a subset/smoke runner — full coverage is required.
# Smoke tests alone DO NOT catch i18n regressions or dropdown bugs.
info "Running FULL E2E suite from $TEST_DIR …"
info "Suite: test_homepage, test_data_pages, test_language_switching,"
info "       test_language_all_routes, test_navbar_dropdown, test_navigation"
echo ""

export BASE_URL

cd "$TEST_DIR"
if python3 -m pytest . -v --tb=short 2>&1; then
  echo ""
  ok "══════════════════════════════════════════"
  ok "  DEPLOYMENT VERIFIED — ALL TESTS PASSED"
  ok "══════════════════════════════════════════"
  exit 0
else
  echo ""
  fail "══════════════════════════════════════════"
  fail "  DEPLOYMENT FAILED — TESTS DID NOT PASS"
  fail "══════════════════════════════════════════"
  fail "Fix the issues above before marking this deployment complete."
  exit 1
fi
