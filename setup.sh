#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║     AI Org Template — Setup Script       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# --- 1. Get database connection ---
if [ -n "${DATABASE_URL:-}" ]; then
  echo "✅ DATABASE_URL already set in environment."
  DB_URL="$DATABASE_URL"
else
  echo "Enter your Supabase (or PostgreSQL) connection string:"
  echo "  Format: postgresql://user:pass@host:port/dbname"
  read -r DB_URL
  echo ""
fi

# --- 2. Generate SQL file ---
cat > setup-tables.sql <<'SQL'
-- Decisions
CREATE TABLE IF NOT EXISTS cc_decisions (
  decision_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  signal TEXT,
  thesis TEXT,
  decision TEXT NOT NULL,
  alternatives JSONB DEFAULT '[]',
  authority_level TEXT DEFAULT 'ceo_autonomous',
  reversibility TEXT DEFAULT 'moderate',
  success_metrics JSONB DEFAULT '[]',
  triggered_by TEXT,
  category TEXT,
  department TEXT,
  decision_level TEXT DEFAULT 'ceo',
  parent_decision_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Decision steps (reasoning chain)
CREATE TABLE IF NOT EXISTS cc_decision_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL REFERENCES cc_decisions(decision_id),
  step_type TEXT NOT NULL,
  step_order INTEGER DEFAULT 0,
  title TEXT,
  content TEXT NOT NULL,
  actor TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delegations
CREATE TABLE IF NOT EXISTS cc_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  delegated_to TEXT NOT NULL,
  brief TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  department TEXT,
  agent_pose TEXT DEFAULT 'building',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Priorities
CREATE TABLE IF NOT EXISTS cc_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  owner TEXT,
  phase TEXT,
  status TEXT DEFAULT 'queued',
  why_this_rank TEXT,
  decision_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Process registry
CREATE TABLE IF NOT EXISTS cc_processes (
  process_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Process runs
CREATE TABLE IF NOT EXISTS cc_process_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id TEXT NOT NULL REFERENCES cc_processes(process_id),
  decision_id TEXT,
  delegation_id UUID,
  actor TEXT,
  status TEXT DEFAULT 'running',
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  quality_notes TEXT,
  outcome_notes TEXT,
  review_requested BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Prompt versions
CREATE TABLE IF NOT EXISTS cc_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_reason TEXT,
  triggered_by_decision TEXT,
  quality_before NUMERIC,
  quality_after NUMERIC,
  rolled_back BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(target_type, target_id, version)
);

-- Comments
CREATE TABLE IF NOT EXISTS cc_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT,
  process_run_id UUID,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS cc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT,
  channel TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email subscribers
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  source TEXT,
  tags JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decision_steps_decision ON cc_decision_steps(decision_id);
CREATE INDEX IF NOT EXISTS idx_delegations_decision ON cc_delegations(decision_id);
CREATE INDEX IF NOT EXISTS idx_process_runs_process ON cc_process_runs(process_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_target ON cc_prompt_versions(target_type, target_id);
SQL

echo "📄 SQL saved to setup-tables.sql"

# --- 3. Run SQL ---
if command -v psql &>/dev/null; then
  echo "📦 Creating database tables..."
  PGSSL=""
  if echo "$DB_URL" | grep -q "supabase"; then
    PGSSL="?sslmode=require"
  fi
  psql "${DB_URL}${PGSSL}" < setup-tables.sql
  echo "✅ Tables created."
else
  echo ""
  echo "⚠️  psql not found. Paste the contents of setup-tables.sql into your"
  echo "   Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)."
  echo "   Then continue with the steps below."
fi

# --- 3b. Model provider selection ---
echo ""
echo "🤖 Model Provider Selection"
echo "   Forge uses a 4-tier model system. Pick your AI provider:"
echo "   1) anthropic (default) — Claude models"
echo "   2) openai — GPT/o-series models"
echo ""
read -r -p "  Provider (anthropic/openai) [anthropic]: " MODEL_PROVIDER
MODEL_PROVIDER="${MODEL_PROVIDER:-anthropic}"

if [[ "$MODEL_PROVIDER" != "anthropic" && "$MODEL_PROVIDER" != "openai" ]]; then
  echo "⚠️  Unknown provider '$MODEL_PROVIDER', defaulting to anthropic."
  MODEL_PROVIDER="anthropic"
fi

# Update models.json with selected provider and tier models
if [ -f org/models.json ] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('org/models.json','utf8'));
    cfg.provider = '$MODEL_PROVIDER';
    cfg.tiers = { ...cfg.presets['$MODEL_PROVIDER'] };
    fs.writeFileSync('org/models.json', JSON.stringify(cfg, null, 2) + '\n');
  "
  echo "✅ Model provider set to: $MODEL_PROVIDER (see org/models.json)"
  echo "   Edit org/models.json to customize individual tier models."
  echo "   See org/MODEL_CONFIG.md for tier details."
else
  echo "⚠️  Could not update models.json automatically. Edit org/models.json manually."
fi
echo ""

# --- 4. Configure db.js ---
echo "📝 Configuring org/engine/db.js..."
cat > org/engine/db.js <<DBJS
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || '${DB_URL}';

function getClient() {
  return new Client({
    connectionString: DB_URL,
    ssl: DB_URL.includes('supabase') ? { rejectUnauthorized: false } : false
  });
}

async function query(sql, params) {
  const client = getClient();
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    await client.end();
  }
}

module.exports = { getClient, query };
DBJS
echo "✅ db.js configured."

# --- 4b. Security: Remove hardcoded DB fallback ---
# Ensure db.js doesn't have a hardcoded fallback (security best practice)
# The line above writes a fallback for convenience; patch it to env-only
sed -i "s|const DB_URL = process.env.DATABASE_URL || '.*';|const DB_URL = process.env.DATABASE_URL;|" org/engine/db.js
echo "🔒 db.js patched to env-only (no hardcoded fallback)."

# --- 5. Install pg dependency ---
echo "📦 Installing pg module..."
if [ ! -f package.json ]; then
  npm init -y --silent > /dev/null 2>&1
fi
npm install --save pg --silent 2>/dev/null
echo "✅ pg installed."

# --- 6. Create directories and starter files ---
mkdir -p memory
TODAY=$(date -u +%Y-%m-%d)
if [ ! -f "memory/${TODAY}.md" ]; then
  cat > "memory/${TODAY}.md" <<EOF
# ${TODAY} — Day 1

## Setup
- AI Org Template initialized
- Database configured
- Ready for bootstrap conversation

## Notes
- 
EOF
  echo "✅ Created memory/${TODAY}.md"
fi

# Create empty work files if they don't exist
[ -f org/WORK_QUEUE.md ] || cat > org/WORK_QUEUE.md <<'WQ'
# Work Queue

_Items ranked by priority. CEO delegates from top._

| Rank | Task | Owner | Status |
|------|------|-------|--------|
| — | (empty — populate during bootstrap) | — | — |
WQ

[ -f org/TASK_BACKLOG.md ] || cat > org/TASK_BACKLOG.md <<'TB'
# Task Backlog

_Future work. Move to Work Queue when ready to execute._

## Critical Priority

## High Priority

## Medium Priority

## Low Priority
TB

touch org/skill-gaps.jsonl
echo "✅ Work queue, backlog, and skill gaps initialized."

# --- 7. Security setup ---
echo ""
echo "🔒 Running security setup..."

# Create .gitignore
cat > .gitignore <<'GITIGNORE'
# Environment files (NEVER commit credentials)
.env*
*.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Generated
setup-tables.sql

# OS
.DS_Store
Thumbs.db
GITIGNORE
echo "✅ .gitignore created (blocks .env* files)"

# Enable RLS on all tables
if command -v psql &>/dev/null && [ -n "${DB_URL:-}" ]; then
  echo "🔒 Enabling Row Level Security on all tables..."
  psql "${DB_URL}${PGSSL:-}" < org/security/RLS_POLICIES.sql 2>/dev/null && \
    echo "✅ RLS enabled on all tables." || \
    echo "⚠️  RLS setup had issues — run org/security/RLS_POLICIES.sql manually."
else
  echo "⚠️  Run org/security/RLS_POLICIES.sql in your Supabase SQL Editor to enable RLS."
fi

# Check for hardcoded DATABASE_URL
if grep -rq 'postgresql://.*@' org/engine/db.js 2>/dev/null; then
  echo "⚠️  WARNING: DATABASE_URL appears hardcoded in db.js — remove it!"
fi

# Run credential audit
chmod +x org/security/CREDENTIAL_AUDIT.sh
echo ""
echo "🔍 Running credential audit..."
./org/security/CREDENTIAL_AUDIT.sh . || echo "⚠️  Credential findings detected — review above."

# --- 8. Community Feedback (recommended) ---
echo ""
echo "  🔧 One more thing — want to help make Forge better?"
echo ""
echo "  Community feedback is recommended. Once a week, the Feedback"
echo "  Agent sends anonymous usage patterns back to the Forge repo."
echo "  Think of it like joining a pit crew: your data (scrubbed clean"
echo "  of anything personal) helps us tune the engine for everyone."
echo ""
echo "  What gets sent (anonymized):"
echo "    • Which processes run, succeed, or fail — and how often"
echo "    • Common skill gaps (categories only, not details)"
echo "    • Decision engine health (counts and ratios, not content)"
echo "    • Which parts of the template get used vs ignored"
echo "    • Error patterns so we can fix what's broken"
echo ""
echo "  What NEVER gets sent:"
echo "    • Business names, people, decisions, tasks, credentials"
echo "    • Nothing proprietary. Ever. The code is open — audit it."
echo ""
echo "  What you get back:"
echo "    • Community benchmarks — see how your org compares"
echo "    • Priority skill packs — common gaps get fixed, you get them first"
echo "    • Early access to new Forge features"
echo "    • Listed as a Forge Contributor (if you want)"
echo ""
echo "  You can review exactly what gets sent before anything leaves,"
echo "  and turn it off anytime."
echo ""
read -r -p "  Enable community feedback? (recommended) (y/N) " FEEDBACK_CHOICE
if [[ "${FEEDBACK_CHOICE,,}" == "y" ]]; then
  mkdir -p /home/node/.openclaw
  cat > /home/node/.openclaw/.env.feedback <<'ENVFB'
FORGE_FEEDBACK=true
# Add your GitHub token below (needs 'public_repo' scope):
# FORGE_FEEDBACK_TOKEN=ghp_your_token_here
ENVFB
  echo "✅ Feedback enabled. Config: /home/node/.openclaw/.env.feedback"
  echo "   Add your GitHub token to that file to start posting."
  echo "   First run is always dry-run: node org/feedback/feedback_agent.js"
  echo ""
  echo "   📖 Full details: org/feedback/FEEDBACK_AGENT.md"
  echo "   🔒 Privacy policy: org/feedback/PRIVACY_POLICY.md"
else
  echo "✅ Feedback not enabled. You can enable anytime — see org/feedback/FEEDBACK_AGENT.md"
fi

# --- 9. Summary ---
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              Setup Complete!             ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                         ║"
echo "║  Next steps:                            ║"
echo "║  1. Run: openclaw gateway start         ║"
echo "║  2. Chat with your AI — it will run     ║"
echo "║     BOOTSTRAP.md automatically          ║"
echo "║  3. Set up cron jobs (see README.md)    ║"
echo "║  4. Review org/SECURITY.md              ║"
echo "║  5. Complete security checklist:        ║"
echo "║     org/security/SECURITY_CHECKLIST.md  ║"
echo "║                                         ║"
echo "╚══════════════════════════════════════════╝"
