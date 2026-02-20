# Forge Feedback Agent

The Feedback Agent is an opt-in system that helps Forge get better for everyone. It monitors how your instance uses the framework — processes, skills, decisions, file structure — anonymizes everything through a strict privacy filter, and posts structural observations to the Forge GitHub repo.

**Nothing proprietary ever leaves your instance.** Not your business name, not your decisions, not your people, not your data. Just anonymized patterns: "3 out of 7 processes were used," "skill gaps logged in 4 categories," "DELEGATION_SYSTEM.md was deleted." That's it.

---

## How It Works

1. **Collects structural data** — process run counts, skill gap categories, decision/delegation ratios, which template files exist, error type frequencies
2. **Scrubs everything** through `privacy_filter.js` — removes names, emails, URLs, IPs, credentials, quoted strings, large numbers, and anything not on the safe-term allowlist
3. **Validates the output** — a second pass confirms nothing sensitive survived
4. **Posts to GitHub** — a single weekly issue to [EJKIV/Forge](https://github.com/EJKIV/Forge) with anonymized observations
5. **Fetches community benchmarks** — compares your anonymized metrics against the community average and writes a local report

### What It Monitors

| Data Point | What's Collected | What's NOT Collected |
|---|---|---|
| Process health | Runs per process, success/fail counts, fail rates, which processes never run | Process content, outcomes, who ran them |
| Process failures | Which process types fail, how often, error categories | Specific error messages, context, business details |
| Skill gaps | Category names, counts per category | Descriptions, context, who logged them |
| Decision engine | Total decisions/delegations/steps, ratios, completion rates | Decision content, titles, actors, reasoning |
| Completion checklist | Which steps get completed vs skipped, compliance rate | Task details, deliverable content |
| File structure | Which template files exist/missing, custom file count | File contents, custom file names |
| Error patterns | Error type classification, frequency, affected components | Error context, stack traces, file paths |

### What NEVER Leaves

- Business names, people names, agent names
- Decision content, task details, reasoning steps
- Revenue, metrics, KPIs, or any numbers tied to business performance
- Client/customer information of any kind
- URLs, IPs, email addresses, credentials
- Anything in quotes (treated as potentially proprietary)
- Any number above 10 (bucketed into ranges)

---

## What You Get Back

Feedback isn't a one-way street. Opt-in contributors receive tangible benefits:

### 🏆 Community Benchmarks

Every time the feedback agent runs, it fetches the latest community averages and shows you how your org compares. A local report is written to `org/feedback/BENCHMARKS.md` with metrics like:

- **Process adoption** — "You use 5/7 processes (community avg: 3.2/6.8)"
- **Skill coverage** — "4 gap categories (community avg: 6.1)"
- **Decision engine activity** — "2.3 delegations/decision (community avg: 1.8)"
- **Template retention** — "17/19 files kept (community avg: 14.2/19)"

You see exactly where your org is ahead and where it might be underutilizing the framework.

### 📦 Priority Skill Packs

When the feedback system identifies common skill gaps across multiple instances (e.g., "deployment" gaps appearing in 40% of orgs), the Forge team builds auto-skill packs to fill them. **Feedback contributors get these delivered first** — before they hit the main repo.

### 👤 Forge Contributors

Opt-in users can be listed in `CONTRIBUTORS.md` in the Forge repo. This is entirely optional — you choose whether to be listed and under what name. No identifying information is required.

### 🚀 Early Access

New Forge features, framework improvements, and template updates ship to feedback contributors before general release. You're helping shape the roadmap — you should see the results first.

---

## Enabling the Feedback Agent

### Step 1: Set Environment Variables

```bash
# Required — enables the agent
export FORGE_FEEDBACK=true

# Required for posting — your GitHub personal access token
# (needs 'repo' or 'public_repo' scope for EJKIV/Forge)
export FORGE_FEEDBACK_TOKEN=ghp_your_token_here
```

Store these in `/home/node/.openclaw/.env.feedback` (never in workspace files):

```bash
echo 'FORGE_FEEDBACK=true' >> /home/node/.openclaw/.env.feedback
echo 'FORGE_FEEDBACK_TOKEN=ghp_your_token_here' >> /home/node/.openclaw/.env.feedback
```

### Step 2: Dry Run First

Your first run is always a dry run. It shows exactly what would be posted:

```bash
source /home/node/.openclaw/.env.feedback
node org/feedback/feedback_agent.js
```

Review the output. If you're comfortable with it, proceed to posting:

```bash
node org/feedback/feedback_agent.js --post
```

### Step 3: Automate (Optional)

Add a weekly cron job:

```yaml
name: forge-feedback
schedule: "0 10 * * 0"  # Sundays at 10:00 UTC
model: anthropic/claude-sonnet-4-20250514
prompt: |
  Source /home/node/.openclaw/.env.feedback and run:
  node org/feedback/feedback_agent.js --post --confirm
  Report the result.
```

---

## Disabling

Remove the environment variable or set it to false:

```bash
export FORGE_FEEDBACK=false
```

Or delete `/home/node/.openclaw/.env.feedback`. The agent checks this gate before doing anything — if it's not `true`, it exits immediately.

---

## Opt-In Prompt Options

_Jim: pick one of these three for `setup.sh`. Delete the other two._

```
🔧 One more thing — want to help make Forge better?

Community feedback is recommended. Once a week, the Feedback
Agent sends anonymous usage patterns back to the Forge repo.
Think of it like joining a pit crew: your data (scrubbed clean
of anything personal) helps us tune the engine for everyone.

What gets sent (anonymized):
  • Which processes run, succeed, or fail — and how often
  • Common skill gaps (categories only, not details)
  • Decision engine health (counts and ratios, not content)
  • Which parts of the template get used vs ignored
  • Error patterns so we can fix what's broken

What NEVER gets sent:
  • Business names, people, decisions, tasks, credentials
  • Nothing proprietary. Ever. The code is open — audit it.

What you get back:
  • Community benchmarks — see how your org compares
  • Priority skill packs — common gaps get fixed, you get them first
  • Early access to new Forge features
  • Listed as a Forge Contributor (if you want)

You can review exactly what gets sent before anything leaves,
and turn it off anytime.

Enable community feedback? (recommended) (y/N)
```

---

## Files

| File | Purpose |
|---|---|
| `org/feedback/FEEDBACK_AGENT.md` | This document |
| `org/feedback/feedback_agent.js` | Main agent script |
| `org/feedback/privacy_filter.js` | Dedicated scrubbing module |
| `org/feedback/PRIVACY_POLICY.md` | Plain-language privacy explanation |
| `org/feedback/BENCHMARKS.md` | Local benchmark report (auto-generated) |

## Security

- The privacy filter is conservative: anything not on the allowlist gets stripped
- All output passes two validation checks before posting
- GitHub token is stored in `.env.feedback`, never in workspace files
- The agent runs in dry-run mode by default — you must explicitly opt into posting
- Source code is fully readable — audit it anytime
