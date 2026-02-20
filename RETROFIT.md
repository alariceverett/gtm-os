# RETROFIT.md — Adding Forge to an Existing OpenClaw Instance

_You already exist. You have a name, memories, a human. This guide adds the Forge organizational framework without touching any of that._

---

## Overview

Forge assumes a clean start via `BOOTSTRAP.md`. But if you're already running — with a `SOUL.md`, daily logs, established conventions — you don't need a birth certificate. You need an org chart.

This guide adds:
- **Decision engine** — track decisions, delegations, and process quality in a database
- **Delegation system** — CEO delegates to leads, leads delegate to task agents
- **Quality systems** — Excellence Preamble, after-action reviews, self-review checklists
- **Learning loops** — skill discovery, prompt evolution, organizational learning
- **14 registered processes** — from product pipeline to recursive self-improvement

Without touching:
- Who you are
- Who your human is
- What you remember
- How you've been working

---

## Step 0: Back Up

```bash
cd ~/.openclaw/workspace
tar czf ~/workspace-backup-$(date +%Y%m%d).tar.gz .
```

If anything goes wrong, you can restore from this.

---

## Step 1: Copy the Org Framework

These directories are entirely new — no conflicts possible.

```bash
# Copy from wherever you have the Forge template
# (adjust SOURCE to your template location)
SOURCE=/path/to/forge-template

# The org framework (decision engine, delegation, priorities, learning, security)
cp -r "$SOURCE/org/" ~/.openclaw/workspace/org/

# Skills (claude-code, decision-engine, deploy-and-verify)
cp -r "$SOURCE/skills/" ~/.openclaw/workspace/skills/

# Setup script
cp "$SOURCE/setup.sh" ~/.openclaw/workspace/setup.sh
```

---

## Step 2: Run Setup

```bash
cd ~/.openclaw/workspace
chmod +x setup.sh
./setup.sh
```

This will:
- Create all database tables (`cc_decisions`, `cc_delegations`, `cc_processes`, etc.)
- Configure `org/engine/db.js` (env-only, no hardcoded credentials)
- Install the `pg` npm module
- Enable Row Level Security on all tables
- Run a credential audit
- Create `.gitignore` for safety

**Requires:** `DATABASE_URL` environment variable set, or it will prompt you.

---

## Step 3: Merge AGENTS.md

**Do NOT replace your AGENTS.md.** Add these sections to it:

### Add: Security Section

Add this to your existing AGENTS.md (near the Safety section or at the end):

```markdown
## 🔒 Security

Read `org/SECURITY.md` for the full security guide. These are the non-negotiable rules:

- **NEVER store credentials in workspace files** — not in AGENTS.md, TOOLS.md, MEMORY.md, SOUL.md, or any file that gets injected into session context. Secrets go in `/home/node/.openclaw/.env.*` files only.
- **External actions need approval** — sending emails, posting to social media, making purchases, or any action that leaves the machine requires human approval or pre-approved authority in the decision framework.
- **Destructive operations need confirmation** — `trash` > `rm`, always. `DROP TABLE`, `DELETE FROM` without WHERE, `rm -rf` — ask first.
- **Run credential audit during heartbeats** — execute `org/security/CREDENTIAL_AUDIT.sh` periodically to catch leaked secrets.
- **Agent self-audit** — before completing any task, verify no secrets appear in your output, created files, or logs.
- **Parameterized queries only** — never interpolate user input into SQL strings.
```

### Add: Heartbeat Improvements

If your heartbeat section doesn't mention these, add:

```markdown
### Heartbeat vs Cron: When to Use Each

**Use heartbeat when:**
- Multiple checks can batch together
- You need conversational context from recent messages
- Timing can drift slightly

**Use cron when:**
- Exact timing matters
- Task needs isolation from main session history
- One-shot reminders
```

---

## Step 4: Merge HEARTBEAT.md

**Do NOT replace your HEARTBEAT.md.** Add these rules at the top:

```markdown
## RULE ZERO: NEVER EXECUTE. ALWAYS DELEGATE.
If you're about to touch a browser, write code, or do anything a task agent could do — STOP. Write a brief. Spawn a lead.

## RULE ONE: ALWAYS HAVE AGENTS RUNNING.
If no subagents are active and the work queue has items — that's a failure. Delegate now.
```

And add this to your heartbeat loop:

```markdown
## Delegation from Work Queue
- Read `org/TASK_BACKLOG.md` and `org/WORK_QUEUE.md`
- Take the top 1-2 unblocked items
- **PRE-TASK PROCESS CHECK:** What process applies? Log it:
  `node org/engine/run_process.js start '{"process_id":"...","decision_id":"...","actor":"..."}'`
- Write a brief (WHAT/WHY/CONSTRAINTS/AUTHORITY/REPORT BACK)
- Spawn the appropriate division lead
- When complete, rate the process:
  `node org/engine/run_process.js rate '{"run_id":"...","rating":1-5,"quality_notes":"..."}'`
```

---

## Step 5: Merge TOOLS.md

Add any new tool notes from the template to your existing TOOLS.md. Keep everything you already have. The template TOOLS.md is mostly a skeleton — your local notes are more valuable.

---

## Step 6: Register Standard Processes

These are the 14 standard Forge processes. Register them all:

```bash
cd ~/.openclaw/workspace

node org/engine/register_process.js '{"process_id":"decision-loop","name":"Decision Loop","description":"Signal → Thesis → Decide → Record → Delegate → Track → Result → Learn","category":"governance"}'

node org/engine/register_process.js '{"process_id":"ceo-decision","name":"CEO Decision Framework","description":"Structured decision-making framework with authority levels, reversibility assessment, and alternatives analysis","category":"governance"}'

node org/engine/register_process.js '{"process_id":"priority-cascade","name":"Priority Cascade","description":"Org queue changes → CEO updates queue → leads get steered → agents re-rank","category":"governance"}'

node org/engine/register_process.js '{"process_id":"delegation","name":"Delegation System","description":"System for delegating tasks with clear ownership, consulting stakeholders, and tracking execution","category":"operations"}'

node org/engine/register_process.js '{"process_id":"heartbeat-loop","name":"Heartbeat Operating Loop","description":"Check human → Check subagents → Delegate from queue → Plan ahead → Log","category":"operations"}'

node org/engine/register_process.js '{"process_id":"ceo-heartbeat","name":"CEO Operating Rhythm","description":"Continuous self-scheduling and operating rhythm for CEO-level priorities","category":"operations"}'

node org/engine/register_process.js '{"process_id":"priority-ranking","name":"Priority System","description":"Priority queue management for agents and company-wide priority ranking","category":"operations"}'

node org/engine/register_process.js '{"process_id":"product-pipeline","name":"Product Pipeline","description":"End-to-end product development from ideation through shipping","category":"product"}'

node org/engine/register_process.js '{"process_id":"phased-execution","name":"Phased Execution","description":"Break complex work into phases. Ship Phase 1. Evaluate. Next phase enters queue.","category":"execution"}'

node org/engine/register_process.js '{"process_id":"excellence-check","name":"Excellence Preamble","description":"Quality standard check ensuring all work meets professional standards","category":"quality"}'

node org/engine/register_process.js '{"process_id":"excellence-review","name":"Excellence Self-Review","description":"Pre-submission quality check: substance, communication, craft","category":"quality"}'

node org/engine/register_process.js '{"process_id":"after-action-review","name":"After-Action Review","description":"Post-task review for capturing lessons learned","category":"learning"}'

node org/engine/register_process.js '{"process_id":"improvement-cycle","name":"Improvement Engine","description":"Day-to-day operational mechanics for the learning and improvement system","category":"learning"}'

node org/engine/register_process.js '{"process_id":"recursive-improvement","name":"Recursive Self-Improvement Loop","description":"Lookback → Act → Observe → Measure → Learn → Evolve prompts → Act better","category":"meta"}'
```

---

## Step 7: Seed Existing Decisions (Optional)

If you've already made significant decisions worth tracking, record them:

```bash
node org/engine/record_decision.js '{
  "decision_id": "DEC-001",
  "title": "Adopt Forge organizational framework",
  "decision": "Adding Forge decision engine, delegation system, and quality processes to existing instance",
  "status": "active",
  "authority_level": "ceo_autonomous",
  "category": "infrastructure",
  "department": "operations"
}'
```

Adjust the fields for each decision. The key fields:
- `decision_id` — unique ID (e.g., `DEC-001`, `DEC-002`)
- `title` — short summary
- `decision` — what was decided
- `status` — `active`, `completed`, `superseded`
- `category` — whatever makes sense for your domain

---

## Step 8: Run Credential Audit

```bash
chmod +x org/security/CREDENTIAL_AUDIT.sh
./org/security/CREDENTIAL_AUDIT.sh .
```

Fix any findings before proceeding. Common issues:
- API keys in TOOLS.md or MEMORY.md (move to `/home/node/.openclaw/.env.*`)
- Database URLs in committed files

---

## Step 9: Verify

```bash
# Check processes are registered
node org/engine/process_report.js

# Should show all 14 processes
```

You should see all 14 processes listed with 0 runs each (since you just registered them).

---

## Post-Migration Checklist

- [ ] Workspace backed up
- [ ] `org/` directory in workspace
- [ ] `skills/` directory in workspace
- [ ] Database tables created (`setup.sh` completed)
- [ ] AGENTS.md updated with security rules
- [ ] HEARTBEAT.md updated with Rule Zero, Rule One, and delegation loop
- [ ] TOOLS.md reviewed and merged
- [ ] 14 standard processes registered
- [ ] Credential audit passes clean
- [ ] `node org/engine/process_report.js` shows all processes
- [ ] First decision recorded successfully (optional but recommended)
- [ ] Completion checklist (`org/COMPLETION_CHECKLIST.md`) referenced in agent briefs

---

## What NOT to Copy

These files are **yours**. The template has its own versions, but they'd overwrite your identity:

| File | Why Skip |
|------|----------|
| `SOUL.md` | You already know who you are |
| `IDENTITY.md` | You already have a name and personality |
| `USER.md` | You already know your human |
| `MEMORY.md` | Your memories are yours |
| `BOOTSTRAP.md` | You're already bootstrapped |
| `memory/` | Don't overwrite your daily logs |

---

## Reading the Org Docs

Once installed, read these in order to understand the framework:

1. `org/CEO_OPERATING_RHYTHM.md` — You delegate, never execute
2. `org/DECISION_FRAMEWORK.md` — How you make and record decisions
3. `org/DELEGATION_SYSTEM.md` — How work flows through the org
4. `org/PRIORITY_SYSTEM.md` — How you rank and manage work
5. `org/EXCELLENCE_PREAMBLE.md` — Quality standard for all agents
6. `org/PRODUCT_PROCESS.md` — How products get built
7. `org/learning/ORGANIZATIONAL_LEARNING.md` — How the org learns
8. `org/SECURITY.md` — Security guide

---

_You were already alive. Now you have an organization._
