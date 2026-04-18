#!/bin/sh
set -e
echo "[entrypoint] Running Payload migrations..."
PAYLOAD_CONFIG_PATH=/app/dist/payload.config.js node node_modules/.bin/payload migrate 2>&1 || echo "[entrypoint] migrate warning (may already be up to date)"
echo "[entrypoint] Starting CMS server..."
exec node dist/server.js
