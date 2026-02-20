# Forge Feedback Agent

The Feedback Agent is an opt-in system that helps Forge get better for everyone. It monitors how your instance uses the framework — processes, skills, decisions, file structure — anonymizes everything through a strict privacy filter, and reports structural observations back to the Forge project.

**Nothing proprietary ever leaves your instance.** Not your business name, not your decisions, not your people, not your data. Just anonymized structural patterns.

---

## Granularity Levels

During setup, you choose how much anonymized data to share. You can change this anytime.

### Level 1 — Minimal

The lightest touch. Just tells us you exist and which version you're running.

| Data Point | Description |
|---|---|
| Forge version | Template version hash |
| Heartbeat | Alive/dead signal (timestamp only) |
| Instance ID | Random UUID generated at setup (not tied to identity) |

**What you get:** Listed as a Forge community member.

---

### Level 2 — Standard *(default)*

Everything in Level 1, plus rich operational signals that help us understand how Forge is actually used. **Process compliance is the centerpiece.**

| Data Point | What's Collected | What's NOT Collected |
|---|---|---|
| **Model tier distribution** | % of calls per tier (routine/complex/strategic/premium) — are the 80/15/4/1% targets holding? | Prompt content, model responses, token counts |
| **Agent spawn counts** | Count of spawns per role category (builder, writer, ops, etc.) | Agent names, task details, delegation content |
| **Process completion rates** | Per registered process: started / completed / abandoned counts | Process content, actor names, outcomes |
| **Process compliance gaps** | Which defined processes are NEVER triggered; which steps get skipped most; lowest completion-rate processes; tasks started without triggering any process | Which tasks, who skipped, business context |
| **Completion checklist adherence** | Per-step completion rate across all 5 checklist steps; overall compliance % | Task details, deliverable content |
| **Decision engine usage** | Decisions/day, avg approval time, distribution across authority levels | Decision content, titles, actors, reasoning |
| **Skill gaps** | Category names and counts (e.g., "deployment: 4", "testing: 2") | Descriptions, context, who logged them |
| **Skill demands (missing skills)** | Anonymized domain of skills agents needed but didn't exist, frequency of demand, whether a workaround was found | Skill names, task context, agent identity |
| **Task failure rates** | Failure count by category (build, deploy, research, etc.) | Error messages, task details, business context |

#### Process Compliance Detail (Level 2)

Process compliance is the #1 signal. At Level 2, you share:

```
compliance_summary:
  registered_processes: 7
  processes_never_triggered: ["process-id-hash-1", "process-id-hash-2"]
  processes_by_completion_rate:
    - process_hash: "abc123"
      started: 14
      completed: 12
      abandoned: 2
      completion_rate: 0.857
  steps_most_skipped:
    - step_name: "quality_rating"    # generic step names only
      skip_rate: 0.43
    - step_name: "skill_gap_check"
      skip_rate: 0.31
  tasks_without_process: 8          # tasks that started with no process triggered
  checklist_compliance:
    step_1_decision_engine: 0.91
    step_2_skill_gaps: 0.67
    step_3_universal_check: 0.54
    step_4_forge_sync: 0.48
    step_5_verify_complete: 0.82
  overall_process_health: 72        # 0-100 score
```

**What you get:**
- Access to **anonymized community benchmarks** — how does your org's process health compare?
- Priority skill packs when common gaps are identified
- See `org/feedback/BENCHMARKS.md` for your latest comparison

---

### Level 3 — Detailed

Everything in Level 2, plus deeper patterns that help us understand *how* Forge is used, not just *whether* it's used.

| Data Point | What's Collected | What's NOT Collected |
|---|---|---|
| **Decision patterns** | Which tier decisions happen most, escalation frequency, decision-to-delegation ratio by tier | Decision content, actors, reasoning |
| **Task cycle times** | Median/p90 duration by category (build, deploy, etc.) in bucketed ranges | Individual task durations, task details |
| **Template modification order** | Which template files get modified first after setup (signals confusion or poor fit) | File contents, custom file names |
| **Failure/error categories** | Anonymized error type classification and frequency | Error messages, stack traces, context |
| **Agent delegation depth** | How deep do delegation chains go? (max, avg, distribution) | Who delegated to whom, task details |
| **File modification heatmap** | Which `org/` template files change most frequently (signals instability) | File contents, custom files, diff content |

**What you get:**
- Everything in Level 2
- **Priority skill packs** — delivered before general release
- **Contributor listing** in Forge CONTRIBUTORS.md (optional, your chosen name)
- **Early access** to new Forge features and template updates

---

## What NEVER Leaves (Any Level)

- Business names, people names, agent names
- Decision content, task details, reasoning steps
- Revenue, metrics, KPIs, or any numbers tied to business performance
- Client/customer information of any kind
- URLs, IPs, email addresses, credentials
- Anything in quotes (treated as potentially proprietary)
- File contents or custom file names
- Prompt content or model responses
- Any PII whatsoever

The privacy filter (`privacy_filter.js`) is conservative: anything not on the allowlist gets stripped. All output passes two validation checks before leaving. The code is open — audit it anytime.

---

## Incentives

| Level | What You Get |
|---|---|
| **Level 1** | Listed as a Forge community member |
| **Level 2** | Access to anonymized benchmarks — see how your org compares across process health, model usage, skill coverage, and more |
| **Level 3** | Priority skill packs, contributor listing in Forge repo, early access to improvements and new features |

Benchmarks are written to `org/feedback/BENCHMARKS.md` after each feedback cycle.

---

## Enabling the Feedback Agent

### During Setup

`setup.sh` asks you to pick a granularity level (1/2/3). Default is Level 2.

### Manual Setup

```bash
# Set level and enable
cat > /home/node/.openclaw/.env.feedback <<'EOF'
FORGE_FEEDBACK=true
FORGE_FEEDBACK_LEVEL=2
EOF
```

### Changing Level

Edit `/home/node/.openclaw/.env.feedback` and change `FORGE_FEEDBACK_LEVEL` to 1, 2, or 3. Takes effect on next run.

### Dry Run

Your first run is always a dry run showing exactly what would be sent:

```bash
source /home/node/.openclaw/.env.feedback
node org/feedback/feedback_agent.js
```

Review the output. To post:

```bash
node org/feedback/feedback_agent.js --post
```

---

## Feedback Delivery Methods

### Primary: GitHub Issues *(default — works out of the box)*

The default delivery method is creating a **GitHub Issue** on the Forge repo. No API keys, no environment variables, no webhook configuration needed — just a network connection to GitHub.

**How it works:**

1. The feedback agent generates the telemetry JSON
2. On `--post`, it creates a GitHub Issue on [`github.com/EJKIV/Forge`](https://github.com/EJKIV/Forge)

**Issue format:**

| Field | Value |
|---|---|
| **Title** | `[Telemetry] Instance {instance_id_short} — Level {level} — {date}` |
| **Label** | `telemetry` |
| **Body** | The full telemetry JSON wrapped in a code block |

Example title: `[Telemetry] Instance a3f8c2d1 — Level 2 — 2026-02-20`

The repo must be accessible from your instance. That's it. No tokens required for public issue creation via the `gh` CLI or GitHub API with no auth (if the repo allows it). If the repo requires authentication, set a GitHub token:

```bash
# Optional — only needed if unauthenticated issue creation is blocked
echo 'FORGE_FEEDBACK_TOKEN=ghp_your_token_here' >> /home/node/.openclaw/.env.feedback
```

### Secondary: Webhook (optional)

If you prefer to route telemetry to your own endpoint:

```bash
echo 'FORGE_FEEDBACK_WEBHOOK=https://your-endpoint.example.com/telemetry' >> /home/node/.openclaw/.env.feedback
```

### Secondary: Email (optional)

```bash
echo 'FORGE_FEEDBACK_EMAIL=telemetry@example.com' >> /home/node/.openclaw/.env.feedback
```

Webhook and email are optional overrides. If neither is set, GitHub Issues is used.

### Automate (Optional)

```yaml
name: forge-feedback
schedule: "0 10 * * 0"  # Sundays at 10:00 UTC
model: tier:routine
prompt: |
  Source /home/node/.openclaw/.env.feedback and run:
  node org/feedback/feedback_agent.js --post --confirm
  Report the result.
```

---

## Disabling

```bash
export FORGE_FEEDBACK=false
```

Or delete `/home/node/.openclaw/.env.feedback`. The agent checks this gate before doing anything.

---

## Process Compliance Tracker

For detailed process compliance monitoring, see **[PROCESS_COMPLIANCE_TRACKER.md](PROCESS_COMPLIANCE_TRACKER.md)**.

This dedicated system scores every registered process on a 0-100 scale and aggregates into an org-wide "process health" score — the single most important metric for Forge effectiveness.

---

## Telemetry Schema

For the exact JSON schema of what each level sends, see **[telemetry_schema.json](telemetry_schema.json)**. This is the contract — nothing outside this schema ever leaves.

---

## Files

| File | Purpose |
|---|---|
| `org/feedback/FEEDBACK_AGENT.md` | This document |
| `org/feedback/PROCESS_COMPLIANCE_TRACKER.md` | Process compliance monitoring system |
| `org/feedback/telemetry_schema.json` | Exact schema for each granularity level |
| `org/feedback/feedback_agent.js` | Main agent script |
| `org/feedback/privacy_filter.js` | Dedicated scrubbing module |
| `org/feedback/PRIVACY_POLICY.md` | Plain-language privacy explanation |
| `org/feedback/BENCHMARKS.md` | Local benchmark report (auto-generated) |

## Security

- The privacy filter is conservative: anything not on the allowlist gets stripped
- All output passes two validation checks before posting
- GitHub token is stored in `.env.feedback`, never in workspace files
- The agent runs in dry-run mode by default — you must explicitly opt into posting
- Telemetry schema is auditable — `telemetry_schema.json` defines exactly what can be sent
- Source code is fully readable — audit it anytime
