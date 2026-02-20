#!/usr/bin/env bash
# CREDENTIAL_AUDIT.sh — Scan workspace for leaked secrets
# Run periodically (heartbeats, post-deploy, pre-commit)
# Exit code: 0 = clean, 1 = findings detected

set -euo pipefail

WORKSPACE="${1:-.}"
DIRTY=0
FINDINGS=""

# Colors (if terminal supports them)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔══════════════════════════════════════════╗"
echo "║       Credential Audit — Project Forge   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Scanning: $WORKSPACE"
echo ""

# --- Patterns to detect ---
# Each pattern: "label|regex"
PATTERNS=(
  "PostgreSQL URL|postgresql://[^ \"'\`]+"
  "MySQL URL|mysql://[^ \"'\`]+"
  "MongoDB URL|mongodb(\+srv)?://[^ \"'\`]+"
  "Generic Password|['\"]?password['\"]?\s*[:=]\s*['\"][^'\"]{4,}['\"]"
  "API Key (generic)|['\"]?api[_-]?key['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]"
  "Secret Key|['\"]?secret[_-]?key['\"]?\s*[:=]\s*['\"][^'\"]{8,}['\"]"
  "AWS Access Key|AKIA[0-9A-Z]{16}"
  "AWS Secret Key|['\"]?aws[_-]?secret['\"]?\s*[:=]\s*['\"][^'\"]{20,}['\"]"
  "Stripe Key|sk_live_[0-9a-zA-Z]{24,}"
  "Stripe Test Key|sk_test_[0-9a-zA-Z]{24,}"
  "OpenAI Key|sk-[a-zA-Z0-9]{32,}"
  "Anthropic Key|sk-ant-[a-zA-Z0-9_-]{32,}"
  "Bearer Token|[Bb]earer\s+[a-zA-Z0-9._-]{20,}"
  "Private Key Block|-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
  "Supabase Key|eyJ[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]{50,}"
  "GitHub Token|gh[pousr]_[A-Za-z0-9_]{36,}"
  "Slack Token|xox[bpras]-[0-9a-zA-Z-]+"
  "SendGrid Key|SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}"
  "Hardcoded DB in JS|connectionString:\s*['\"][^'\"]*://[^'\"]*['\"]"
)

# --- File extensions to scan ---
EXTENSIONS=( "md" "js" "json" "ts" "yml" "yaml" "sh" "txt" "env.example" "cfg" "conf" "toml" )

# Build find expression for extensions
FIND_EXPR=""
for i in "${!EXTENSIONS[@]}"; do
  if [ "$i" -eq 0 ]; then
    FIND_EXPR="-name '*.${EXTENSIONS[$i]}'"
  else
    FIND_EXPR="$FIND_EXPR -o -name '*.${EXTENSIONS[$i]}'"
  fi
done

# --- Exclusions ---
# Don't scan these dirs
EXCLUDE_DIRS="node_modules|\.git|org/security"

# Suppress obvious placeholders/examples to reduce noise
# (real secrets should still be caught)
SUPPRESS_MATCHES='YOUR_PASSWORD|YOUR_PROJECT_REF|user:pass@host:port/dbname|CLAUDE_AI_SESSION_KEY|ANTHROPIC_API_KEY="\$CLAUDE_AI_SESSION_KEY"'

# --- Scan ---

for pattern_entry in "${PATTERNS[@]}"; do
  IFS='|' read -r label regex <<< "$pattern_entry"
  
  # Use find + grep
  MATCHES=$(eval "find '$WORKSPACE' \( $FIND_EXPR \) -type f" 2>/dev/null \
    | grep -Ev "($EXCLUDE_DIRS)" \
    | xargs grep -rnEi "$regex" 2>/dev/null \
    | grep -Ev "($EXCLUDE_DIRS)" \
    | grep -Ev '^\s*(#|//|/\*|\*)' \
    | grep -Ev "($SUPPRESS_MATCHES)" \
    || true)
  
  if [ -n "$MATCHES" ]; then
    DIRTY=1
    FINDINGS="${FINDINGS}\n${YELLOW}⚠  ${label}${NC}\n${MATCHES}\n"
  fi
done

# --- Check for DATABASE_URL hardcoded in JS files ---
DB_HARDCODED=$(eval "find '$WORKSPACE' -name '*.js' -type f" 2>/dev/null \
  | grep -Ev "($EXCLUDE_DIRS)" \
  | xargs grep -rn "process\.env\.DATABASE_URL\s*||" 2>/dev/null \
  || true)

# Check db.js specifically for fallback pattern
DB_JS_FALLBACK=$(find "$WORKSPACE" -name "db.js" -type f 2>/dev/null \
  | grep -Ev "($EXCLUDE_DIRS)" \
  | xargs grep -n "||.*postgresql://" 2>/dev/null \
  || true)

if [ -n "$DB_JS_FALLBACK" ]; then
  DIRTY=1
  FINDINGS="${FINDINGS}\n${YELLOW}⚠  DATABASE_URL fallback to hardcoded string${NC}\n${DB_JS_FALLBACK}\n"
fi

# --- Report ---
echo ""
if [ "$DIRTY" -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║            ✅  CLEAN — No leaks found    ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
  echo -e "${RED}║         ❌  DIRTY — Findings detected    ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "$FINDINGS"
  echo ""
  echo "Action required:"
  echo "  1. Remove credentials from flagged files"
  echo "  2. Move secrets to /home/node/.openclaw/.env.* files"
  echo "  3. If credentials were committed to git, rotate them immediately"
  echo "  4. Re-run this audit to verify"
  exit 1
fi
