#!/usr/bin/env bash
# Build + deploy the web bundle on Toronto. Runs the Vite build inside
# node:22-alpine so the host doesn't need pnpm, syncs dist/ -> web-dist/,
# and — critically — relaxes file perms so the in-container nginx user can
# read the assets. (Default umask 027 on this host produces 0640 files,
# which nginx serves as 403 even though the file exists; the audit caught
# 86 of those before this script was added.)
set -euo pipefail
cd "$(dirname "$0")/.."
log(){ echo "[$(date +%H:%M:%S)] $*"; }

log "STEP1 build web bundle (vite via node:22-alpine)"
cd web
docker run --rm -v "$PWD":/work -w /work -e CI=1 node:22-alpine sh -lc '
  npm install -g pnpm@9 >/dev/null 2>&1 || true
  pnpm install --prefer-offline 2>&1 | tail -3
  pnpm build
' 2>&1 | tail -8
cd ..

log "STEP2 sync web/dist -> web-dist (atomic --delete)"
rsync -a --delete web/dist/ web-dist/

log "STEP3 make every served file world-readable (nginx in container = different uid)"
find web-dist -type f -exec chmod a+r {} +
find web-dist -type d -exec chmod a+rx {} +

log "STEP4 verify"
curl -s -o /dev/null -w "  web HTTP:        %{http_code}\n" http://127.0.0.1:4092/
curl -s -o /dev/null -w "  asset HTTP:      %{http_code}\n" http://127.0.0.1:4092/assets/sudacka-mreza-logo.gif || true
log "DEPLOY_WEB_DONE"
