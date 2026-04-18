#!/usr/bin/env bash
# deploy.sh — build, deploy, and verify.
# ALWAYS use this script instead of bare `docker compose up -d --build`.
# A deployment is not complete until the E2E tests pass.
#
# Usage:
#   ./scripts/deploy.sh [BASE_URL]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[deploy] ✓${NC} $*"; }
fail()  { echo -e "${RED}[deploy] ✗${NC} $*"; }

BASE_URL="${1:-${BASE_URL:-http://78.47.104.139:4092}}"
export BASE_URL

info "Building and deploying sudacka-mreza …"
cd "$PROJECT_DIR"
docker compose up -d --build
ok "Docker services started"

info "Running post-deploy verification …"
"$SCRIPT_DIR/post-deploy-test.sh"
