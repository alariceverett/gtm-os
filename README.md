# AI Org Template — Org-in-a-Box

An opinionated, self-bootstrapping template for running an AI organization on [OpenClaw](https://openclaw.com). Point it at any problem domain and it builds itself: decision tracking, delegation chains, quality systems, learning loops, and auto-discovered skills.

## What You Get

```
┌─────────────────────────────────────────────────────┐
│                    {USER_NAME}                       │
│                  (Board / Owner)                     │
│        Sets strategy, approves big decisions         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   {AI_NAME}                          │
│                   (CEO Agent)                        │
│    Delegates, decides, monitors — never executes     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Head of │  │  Head of │  │  Head of │  ...      │
│  │  Product │  │  Growth  │  │   Ops    │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │              │                │
│  ┌────▼────┐   ┌────▼────┐   ┌────▼────┐           │
│  │ Builder │   │  Writer  │   │Deployer │           │
│  │Designer │   │   SEO    │   │  QA     │           │
│  │  QA     │   │  Social  │   │ Infra   │           │
│  └─────────┘   └─────────┘   └─────────┘           │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Decision Engine (Supabase)               │
│  decisions → steps → delegations → process runs      │
│  priorities → prompt versions → learnings            │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│            Skill Discovery (Auto)                    │
│  Agents log gaps → Cron builds skills → Org learns  │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- **OpenClaw** installed and configured ([docs](https://openclaw.com))
- **Supabase** project (free tier works) — or any PostgreSQL database
- **Anthropic API key** (or other LLM provider configured in OpenClaw)
- **Node.js** 18+ (for engine scripts)
- **psql** CLI (for setup script)

## Quick Start

```bash
# 1. Copy template to your OpenClaw workspace
cp -r . ~/.openclaw/workspace/

# 2. Run setup (creates DB tables, configures connection)
cd ~/.openclaw/workspace
chmod +x setup.sh
./setup.sh

# 3. Start OpenClaw
openclaw gateway start

# 4. Chat with your AI — BOOTSTRAP.md runs automatically
#    It'll ask your name, goals, and domain
#    Then seed skill gaps for auto-discovery
```

## File Structure

```
workspace/
├── AGENTS.md              # Boot sequence, memory system, safety rules
├── SOUL.md                # AI personality and philosophy
├── USER.md                # Your info (filled during bootstrap)
├── IDENTITY.md            # AI identity (filled during bootstrap)
├── BOOTSTRAP.md           # First-run conversation (auto-deletes)
├── HEARTBEAT.md           # 30-min operating loop
├── MEMORY.md              # Long-term curated memory (created by AI)
├── TOOLS.md               # Local environment notes
├── memory/                # Daily logs (YYYY-MM-DD.md)
├── org/
│   ├── DECISION_FRAMEWORK.md      # Decision authority matrix
│   ├── EXCELLENCE_PREAMBLE.md     # Quality standard for all agents
│   ├── DELEGATION_SYSTEM.md       # How work flows through the org
│   ├── PRIORITY_SYSTEM.md         # Two-level priority queue
│   ├── CEO_OPERATING_RHYTHM.md    # Never execute, always delegate
│   ├── PRODUCT_PROCESS.md         # Brief → UX → Design → Build → QA
│   ├── SKILL_DISCOVERY.md         # Auto-skill detection and building
│   ├── WORK_QUEUE.md              # Active work items
│   ├── TASK_BACKLOG.md            # Future work items
│   ├── skill-gaps.jsonl           # Detected skill gaps (auto-populated)
│   ├── engine/                    # Decision engine scripts (Node.js)
│   │   ├── db.js                  # DB connection (configured by setup.sh)
│   │   ├── record_decision.js     # Log decisions
│   │   ├── record_delegation.js   # Log delegations
│   │   ├── record_step.js         # Log reasoning steps
│   │   ├── run_process.js         # Start/complete/rate process runs
│   │   ├── sync_priorities.js     # Sync priority queue to DB
│   │   ├── lookback.js            # Pre-action historical context
│   │   ├── evolve_prompt.js       # Prompt improvement analysis
│   │   ├── version_prompt.js      # Prompt version control
│   │   └── process_report.js      # Process tracking report
│   ├── templates/
│   │   └── TASK_TEMPLATE.md       # Standard task structure
│   ├── learning/
│   │   ├── ORGANIZATIONAL_LEARNING.md  # Learning philosophy
│   │   ├── IMPROVEMENT_ENGINE.md       # Operational mechanics
│   │   ├── SKILL_TREES.md             # Role skill definitions
│   │   ├── AFTER_ACTION_TEMPLATE.md   # Post-task review format
│   │   └── WEEKLY_REVIEW_TEMPLATE.md  # Weekly review format
│   └── training/
│       ├── SKILL_PACK_TEMPLATE.md     # Book → skill pack conversion
│       └── AGENT_CURRICULUM.md        # Reading list by role
└── skills/
    ├── claude-code/               # Code generation skill
    ├── decision-engine/           # Decision tracking skill
    └── deploy-and-verify/         # Deployment verification skill
```

## How the Decision Engine Works

Every significant action flows through a traceable chain:

```
1. CEO identifies work needed
2. Records decision: node org/engine/record_decision.js '{"decision_id":"DEC-001",...}'
3. Delegates to lead: node org/engine/record_delegation.js '{"decision_id":"DEC-001",...}'
4. Logs reasoning: node org/engine/record_step.js '{"decision_id":"DEC-001","step_type":"thought",...}'
5. Starts process: node org/engine/run_process.js start '{"process_id":"...",...}'
6. On completion: node org/engine/run_process.js complete '{"run_id":"...",...}'
7. Rates quality: node org/engine/run_process.js rate '{"run_id":"...","rating":4,...}'
```

Before acting, agents check history:
```
node org/engine/lookback.js '{"type":"process","id":"product-pipeline"}'
```

Over time, prompt evolution identifies what works:
```
node org/engine/evolve_prompt.js "product-pipeline"
```

## How to Customize

### Add a Division

1. Create `org/agents/{division-lead}/AGENT_PROMPT.md` with the lead's role and authority
2. Add task agents under the lead in the same directory
3. Update `org/DELEGATION_SYSTEM.md` with the new division
4. Register the division's processes: `node org/engine/register_process.js '{"process_id":"your-process",...}'`

### Create an Agent

1. Write an `AGENT_PROMPT.md` defining the role, responsibilities, and quality bar
2. The Excellence Preamble is prepended automatically — don't duplicate its instructions
3. Include the skill check snippet from `org/SKILL_DISCOVERY.md`
4. Place in `org/agents/{role}/AGENT_PROMPT.md`

### Add a Skill

```
skills/{skill-name}/
├── SKILL.md              # When to use, how to use, what it produces
├── references/           # Supporting docs, examples, patterns
└── scripts/              # Automation scripts (optional)
```

Or let the Skill Discovery system build it automatically by logging gaps.

### Define Cron Jobs

Common cron jobs for the org:

```yaml
# Daily standup — each division reports async
name: daily-standup
schedule: "0 7 * * *"
model: anthropic/claude-sonnet-4-20250514
prompt: "Read org/WORK_QUEUE.md. For each active item, report: status, blockers, next steps. Write to org/team/meetings/standups/YYYY-MM-DD.md"

# Skill builder — auto-discovers and builds needed skills
name: skill-builder
schedule: "0 6,18 * * *"
model: anthropic/claude-sonnet-4-20250514
prompt: |
  You are the Skill Builder. Read org/SKILL_DISCOVERY.md for your full process.
  Read org/skill-gaps.jsonl for unresolved gaps.
  Build the highest-priority missing skill.
  If no gaps exist, reply HEARTBEAT_OK.

# Weekly review — learning system aggregation
name: weekly-review
schedule: "0 9 * * 1"
model: anthropic/claude-sonnet-4-20250514
prompt: "Run the weekly review using org/learning/WEEKLY_REVIEW_TEMPLATE.md. Aggregate after-actions, extract patterns, update skill trees."

# Prompt evolution — analyze and improve agent prompts
name: prompt-evolution
schedule: "0 3 * * *"
model: anthropic/claude-sonnet-4-20250514
prompt: "Run org/engine/evolve_prompt.js for each registered process. Identify improvement opportunities. Propose changes (don't apply without CEO approval)."
```

## How Skill Discovery Works

```
Agent starts task
  → Checks skills/ for relevant skill
  → If missing: logs to org/skill-gaps.jsonl
  → Skill Builder cron (2x daily) reads gaps
  → Groups similar, builds top unaddressed skill
  → New skill appears in skills/
  → Next agent to need it finds it ready
```

During bootstrap, the system analyzes your domain and pre-seeds likely skill gaps. Within 24-48 hours of first boot, you'll have purpose-built skills for your problem space.

See `org/SKILL_DISCOVERY.md` for full details.

## Philosophy

This template encodes several principles:

1. **Never execute, always delegate** — The CEO agent plans and monitors. Task agents do the work.
2. **Document everything** — Decisions, reasoning, outcomes. Future-you needs context.
3. **Quality is non-negotiable** — The Excellence Preamble sets the bar for every agent.
4. **Compound learning** — Every task makes the next one better through after-actions and skill development.
5. **Self-bootstrapping** — The system discovers what it needs and builds it.

## Security

Forge includes a comprehensive security layer. **Read this before deploying.**

- 📖 **Full guide:** [`org/SECURITY.md`](org/SECURITY.md) — credential management, database security, agent permissions, infrastructure hardening, incident response
- ✅ **Deployment checklist:** [`org/security/SECURITY_CHECKLIST.md`](org/security/SECURITY_CHECKLIST.md) — every box must be checked before going live
- 🔍 **Credential audit:** [`org/security/CREDENTIAL_AUDIT.sh`](org/security/CREDENTIAL_AUDIT.sh) — automated scanner for leaked secrets (run during heartbeats)
- 🔒 **RLS policies:** [`org/security/RLS_POLICIES.sql`](org/security/RLS_POLICIES.sql) — row-level security for all database tables

**Key rules:**
1. **Never store credentials in workspace files** — they leak to session context, group chats, and subagents
2. **All secrets go in `/home/node/.openclaw/.env.*` files** — `.env.supabase`, `.env.email`, `.env.api-keys`, etc.
3. **RLS is enabled on all tables** by `setup.sh` — each org sees only its own data
4. **The credential audit runs automatically** during setup and should run during heartbeats

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Set by setup.sh |
| `ANTHROPIC_API_KEY` | For LLM calls | Set in OpenClaw config |

## License

Use this however you want. Build something great.
