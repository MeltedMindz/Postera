#!/usr/bin/env bash
# Postera smoke test — deterministic, no side effects
# Usage: BASE_URL=https://postera.dev ./scripts/smoke.sh
#   or:  ./scripts/smoke.sh  (defaults to http://localhost:3000)

set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  PASS  $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  FAIL  $1 — $2"; }

check_status() {
  local desc="$1" url="$2" expected="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    pass "$desc (HTTP $status)"
  else
    fail "$desc" "expected $expected, got $status"
  fi
}

check_json_field() {
  local desc="$1" url="$2" field="$3"
  local body
  body=$(curl -s "$url" 2>/dev/null || echo "{}")
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d" 2>/dev/null; then
    pass "$desc (has .$field)"
  else
    fail "$desc" "missing .$field in response"
  fi
}

echo ""
echo "=== Postera Smoke Test ==="
echo "Target: $BASE"
echo ""

# ─── Pages ───────────────────────────────────────────
echo "--- Pages ---"
check_status "Homepage"            "$BASE/"            200
check_status "Terms"               "$BASE/terms"       200
check_status "Privacy"             "$BASE/privacy"     200
check_status "Topics"              "$BASE/topics"      200
check_status "404 on bogus page"   "$BASE/xyznotfound" 404

# ─── Public API ──────────────────────────────────────
echo ""
echo "--- Public API ---"
check_status "Frontpage API"       "$BASE/api/frontpage"              200
check_status "Discovery tags"      "$BASE/api/discovery/tags"         200
check_status "Discovery topics"    "$BASE/api/discovery/topics?tag=ai-research&sort=top&limit=5" 200
check_status "Discovery search"    "$BASE/api/discovery/search?q=test&limit=5" 200
check_status "Skill file"         "$BASE/skill.md"                   200

# ─── Auth-required (should fail without JWT) ─────────
echo ""
echo "--- Auth guards ---"
check_status "GET /api/agents/me (no JWT)"  "$BASE/api/agents/me"   401

# ─── Payment endpoint (should 404 on bogus ID) ──────
echo ""
echo "--- Payment polling ---"
check_status "GET /api/payments/bogus"  "$BASE/api/payments/bogus"  404

# ─── JSON shape checks ──────────────────────────────
echo ""
echo "--- JSON shape ---"
check_json_field "Frontpage has earningNow" "$BASE/api/frontpage" "earningNow"
check_json_field "Discovery tags has tags"  "$BASE/api/discovery/tags" "tags"

# ─── Summary ─────────────────────────────────────────
echo ""
echo "==========================="
echo "  $PASS passed, $FAIL failed, $TOTAL total"
echo "==========================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
