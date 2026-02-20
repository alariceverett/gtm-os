# Process Compliance Tracker

> **Process compliance is the #1 signal.** Where do orgs NOT follow their defined processes? This tracker answers that question.

---

## Overview

The Process Compliance Tracker monitors every registered process in the org and produces a **compliance score (0-100)** per process and an aggregate **org-wide process health score**. This is the single most valuable data point for understanding Forge effectiveness.

---

## What It Monitors

### 1. Process Triggering Compliance

Every task should trigger its corresponding registered process before work begins.

| Metric | How It's Measured |
|---|---|
| **Tasks with process** | Count of delegations that have a matching `cc_process_runs` entry |
| **Tasks without process** | Delegations with no corresponding process run started |
| **Untriggered processes** | Registered processes in `cc_processes` that have zero runs in the measurement period |
| **Trigger rate** | `tasks_with_process / total_tasks × 100` |

**Query:**
```sql
-- Tasks without any process run
SELECT d.id, d.delegated_to, d.brief
FROM cc_delegations d
LEFT JOIN cc_process_runs pr ON pr.delegation_id = d.id
WHERE pr.id IS NULL AND d.status = 'complete';

-- Registered processes never triggered
SELECT p.process_id, p.name
FROM cc_processes p
LEFT JOIN cc_process_runs pr ON pr.process_id = p.process_id
  AND pr.started_at > now() - interval '7 days'
WHERE pr.id IS NULL;
```

### 2. Process Step Execution

Which steps in each process get executed vs skipped?

| Metric | How It's Measured |
|---|---|
| **Steps completed** | `cc_decision_steps` entries per process run |
| **Steps skipped** | Expected steps (from process definition) minus recorded steps |
| **Skip rate per step** | `skipped / (skipped + completed)` per step type |
| **Most-skipped steps** | Ranked list of step types by skip rate |

### 3. Completion Checklist Compliance

The 5-step completion checklist from `COMPLETION_CHECKLIST.md`:

| Step | How Compliance Is Detected |
|---|---|
| **1. Record in Decision Engine** | `cc_delegations` entry with `status='complete'` exists |
| **2. Log Skill Gaps** | Entry in `org/skill-gaps.jsonl` with matching date (or explicit "none needed") |
| **3. Universal Pattern Check** | Entry in `org/rd/UNIVERSAL_SYSTEMS_TRACKER.md` or "domain-specific" noted |
| **4. Forge Sync** | Commit touching `org/template-export/` or "FORGE_SYNC_NEEDED" noted |
| **5. Verify Complete** | All sub-checks (credentials, DB, scheduling, commits) addressed |

**Per-step compliance rate:** `completions / total_tasks × 100`

### 4. Decision Engine Logging Compliance

| Metric | How It's Measured |
|---|---|
| **Decisions logged** | Count of `cc_decisions` entries per period |
| **Decisions with steps** | Decisions that have at least one `cc_decision_steps` entry |
| **Delegations with decision** | `cc_delegations` entries that reference a `decision_id` |
| **Orphan delegations** | Delegations with no decision reference |
| **Logging compliance** | `decisions_with_steps / total_decisions × 100` |

### 5. Skill Gap Reporting Compliance

| Metric | How It's Measured |
|---|---|
| **Gaps logged** | Count of entries in `org/skill-gaps.jsonl` per period |
| **Gaps per task** | `gaps_logged / total_tasks` (should be > 0 — if zero, agents aren't checking) |
| **Resolved gaps** | Entries with `"resolved": true` |
| **Resolution rate** | `resolved / total_logged × 100` |

### 6. Forge Sync Compliance

| Metric | How It's Measured |
|---|---|
| **Sync-eligible tasks** | Tasks that improve a process/template existing in `org/template-export/` |
| **Tasks synced** | Commits touching template-export or "FORGE_SYNC_NEEDED" notes |
| **Sync rate** | `tasks_synced / sync_eligible × 100` |

---

## Scoring

### Per-Process Score (0-100)

Each registered process gets a weighted score:

| Component | Weight | Calculation |
|---|---|---|
| Trigger rate | 30% | `tasks_triggering_this_process / tasks_that_should × 100` |
| Step completion | 25% | `avg_steps_completed / expected_steps × 100` |
| Quality rating | 15% | `avg_quality_rating / 5 × 100` |
| Completion rate | 20% | `completed_runs / started_runs × 100` |
| Checklist adherence | 10% | `avg_checklist_steps_done / 5 × 100` |

**Score = Σ(component × weight)**

### Org-Wide Process Health Score (0-100)

Aggregated from all process scores plus cross-cutting metrics:

| Component | Weight | Calculation |
|---|---|---|
| Avg process score | 40% | Mean of all per-process scores |
| Decision engine compliance | 15% | `decisions_with_steps / total_decisions × 100` |
| Checklist compliance | 15% | Overall 5-step compliance rate |
| Skill gap reporting | 10% | `1 if gaps_per_task > 0 else 0` (binary — are agents checking?) |
| Forge sync compliance | 10% | Sync rate |
| Process coverage | 10% | `processes_triggered_at_least_once / registered_processes × 100` |

**Health Score = Σ(component × weight)**

### Score Interpretation

| Range | Rating | Meaning |
|---|---|---|
| 90-100 | 🟢 Excellent | Processes are followed consistently |
| 70-89 | 🟡 Good | Most processes followed, some gaps |
| 50-69 | 🟠 Needs attention | Significant compliance gaps |
| 0-49 | 🔴 Critical | Processes exist but aren't being followed |

---

## Output

The tracker produces a periodic report (weekly by default):

```
═══════════════════════════════════════════
  PROCESS COMPLIANCE REPORT — 2026-02-20
═══════════════════════════════════════════

  Org-Wide Process Health: 74/100 🟡

  Per-Process Scores:
    product-pipeline ........... 88 🟢
    decision-framework ......... 81 🟡
    delegation-system .......... 76 🟡
    skill-discovery ............ 71 🟡
    weekly-review .............. 62 🟠
    prompt-evolution ........... 45 🔴  ← NEVER TRIGGERED
    security-audit ............. 0  🔴  ← NEVER TRIGGERED

  Compliance Gaps (Action Required):
    ⚠ 2 processes never triggered in 30 days
    ⚠ "quality_rating" step skipped 43% of the time
    ⚠ Forge sync compliance at 48%
    ⚠ 8 tasks completed without any process triggered

  Checklist Compliance:
    1. Decision engine ......... 91%
    2. Skill gaps .............. 67%
    3. Universal check ......... 54%
    4. Forge sync .............. 48%  ← lowest
    5. Verify complete ......... 82%

═══════════════════════════════════════════
```

### Automation

```yaml
name: process-compliance
schedule: "0 8 * * 1"  # Mondays at 08:00 UTC
model: tier:routine
prompt: |
  Run the process compliance tracker.
  Query cc_processes, cc_process_runs, cc_delegations, cc_decisions, cc_decision_steps.
  Calculate per-process scores and org-wide health using the methodology in
  org/feedback/PROCESS_COMPLIANCE_TRACKER.md.
  Write report to org/feedback/compliance_report.md.
  If health score < 70, flag in daily standup.
```

---

## Telemetry Integration

At **Level 2+**, the process health score and compliance gaps are included in anonymized telemetry (see `telemetry_schema.json`). This lets the Forge team understand which processes are hardest to follow across the community — and fix the framework, not blame the users.

Process IDs are hashed before sending. No task content, actor names, or business context ever leaves.
