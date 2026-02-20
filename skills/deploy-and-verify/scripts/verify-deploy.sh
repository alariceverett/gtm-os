#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://{YOUR_DOMAIN}}"
NEW_ENDPOINT="${2:-}"
BASE_URL="${BASE_URL%/}"

PASS=0
FAIL=0
FAILURES=""

check_endpoint() {
  local path="$1"
  local expect_status="${2:-200}"
  local expect_pattern="${3:-}"
  local url="${BASE_URL}${path}"

  local http_code body
  body=$(curl -sS -o /dev/fd/3 -w '%{http_code}' --max-time 10 "$url" 3>&1) && http_code="${body##*$'\n'}" || http_code="000"
  # Re-fetch cleanly
  http_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
  body=$(curl -sS --max-time 10 "$url" 2>/dev/null || echo "")

  if [[ "$http_code" != "$expect_status" ]]; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  FAIL ${path} — expected ${expect_status}, got ${http_code}"
    return
  fi

  if [[ -n "$expect_pattern" ]] && ! echo "$body" | grep -q "$expect_pattern"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  FAIL ${path} — missing pattern: ${expect_pattern}"
    return
  fi

  PASS=$((PASS + 1))
  echo "  ✓ ${path} (${http_code})"
}

echo "========================================"
echo " Deploy Verification: ${BASE_URL}"
echo "========================================"
echo ""

# Wait for deployment to be ready (poll homepage, max 3 min)
echo "⏳ Waiting for deployment..."
MAX_WAIT=180
INTERVAL=10
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL" 2>/dev/null || echo "000")
  if [[ "$status" == "200" ]]; then
    echo "  ✓ Site responding (${WAITED}s)"
    break
  fi
  sleep $INTERVAL
  WAITED=$((WAITED + INTERVAL))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  echo "  ✗ Deployment timeout after ${MAX_WAIT}s"
  echo ""
  echo "RESULT: FAIL (timeout)"
  exit 1
fi

echo ""
echo "🔍 Checking critical endpoints..."

check_endpoint "/" "200" "<title>"
check_endpoint "/command-center" "200" ""
check_endpoint "/api/cc-data?section=overview" "200" '"data"'
check_endpoint "/api/cc-data?section=skills" "200" '"data"'

if [[ -n "$NEW_ENDPOINT" ]]; then
  echo ""
  echo "🆕 Checking new endpoint..."
  check_endpoint "$NEW_ENDPOINT" "200" ""
fi

echo ""
echo "========================================"
if [[ $FAIL -eq 0 ]]; then
  echo "RESULT: PASS (${PASS}/${PASS} endpoints OK)"
else
  echo "RESULT: FAIL (${FAIL} failures, ${PASS} passed)"
  echo -e "$FAILURES"
fi
echo "========================================"

exit $FAIL
