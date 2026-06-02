#!/bin/bash
# Headless admin screenshot flow.
#   1. POST /api/users/auth/login -> get challenge
#   2. ssh: UPDATE users SET email_otp_hash = sha256("000000"), expires = +10min
#   3. POST /api/users/auth/verify-mfa with code "000000" -> get cookie
#   4. Run Playwright with the cookie as storageState
#   5. ssh: clear email_otp_hash on the test user
set -euo pipefail

BASE="${BASE_URL:-http://23.164.48.64}"
EMAIL="${ADMIN_EMAIL:-admin@sudacka-mreza.hr}"
PASSWORD="${ADMIN_PASSWORD:-sudacka2026}"
STATE_FILE="/home/bbrelin/sudacka-mreza/tests/e2e/.admin-state.json"

echo "1/5 login..."
RESP=$(curl -s -X POST "$BASE/api/users/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "  resp: ${RESP:0:200}..."
CHALLENGE=$(echo "$RESP" | python3 -c "import json, sys; print(json.load(sys.stdin).get('challenge', ''))")
if [ -z "$CHALLENGE" ]; then
  echo "  no challenge returned — check email/password" >&2
  exit 1
fi
echo "  challenge: ${CHALLENGE:0:30}..."

echo "2/5 inject known OTP hash..."
SHA=$(echo -n "000000" | sha256sum | awk '{print $1}')
ssh toronto-sudacka "cd ~/sudacka-mreza && docker compose exec -T cms node -e \"
import('pg').then(async (m) => {
  const c = new m.default.Client({connectionString: process.env.DATABASE_URI})
  await c.connect()
  await c.query(\\\"UPDATE users SET email_otp_hash = \\\$1, email_otp_expires_at = NOW() + interval '10 min', email_otp_attempts = 0 WHERE email = \\\$2\\\", ['$SHA', '$EMAIL'])
  console.log('OTP override applied')
  await c.end()
})\" 2>&1 | tail -3"

echo "3/5 verify with 000000..."
VRESP=$(curl -s -c /tmp/_admin_cookies.txt -X POST "$BASE/api/users/auth/verify-mfa" \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALLENGE\",\"code\":\"000000\"}")
echo "  resp: ${VRESP:0:200}..."

if ! echo "$VRESP" | grep -q '"user"\|"token"'; then
  echo "  verify failed" >&2
  exit 1
fi

echo "4/5 convert cookies to Playwright storageState..."
python3 - <<EOF
import json
from http.cookiejar import MozillaCookieJar
cj = MozillaCookieJar('/tmp/_admin_cookies.txt')
cj.load(ignore_discard=True)
cookies = []
for c in cj:
    cookies.append({
        'name': c.name,
        'value': c.value,
        'domain': c.domain,
        'path': c.path,
        'expires': c.expires if c.expires else -1,
        'httpOnly': bool(c._rest.get('HttpOnly') or c._rest.get('httponly')),
        'secure': bool(c.secure),
        'sameSite': 'Lax',
    })
state = { 'cookies': cookies, 'origins': [] }
with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
print(f"saved {len(cookies)} cookies to $STATE_FILE")
EOF

echo "5/5 clear injected OTP on server..."
ssh toronto-sudacka "cd ~/sudacka-mreza && docker compose exec -T cms node -e \"
import('pg').then(async (m) => {
  const c = new m.default.Client({connectionString: process.env.DATABASE_URI})
  await c.connect()
  await c.query(\\\"UPDATE users SET email_otp_hash = NULL, email_otp_expires_at = NULL WHERE email = \\\$1\\\", ['$EMAIL'])
  console.log('OTP cleared')
  await c.end()
})\" 2>&1 | tail -3"

echo "done — running admin screenshot capture..."
cd /home/bbrelin/sudacka-mreza
node tests/e2e/screenshot-admin-fixes.mjs
