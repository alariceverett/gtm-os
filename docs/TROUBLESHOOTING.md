# GTM OS Troubleshooting Guide

**When things go wrong — diagnosis and recovery**

---

## Quick Diagnostics

### System Health at a Glance

```bash
# One-command health check
openclaw ops health-summary

# Or check manually:
echo "=== System Status ===" && \
  openclaw gateway status && \
echo "=== Agent Status ===" && \
  openclaw agents list && \
echo "=== Recent Errors ===" && \
  tail -20 ops/error.log && \
echo "=== Queue State ===" && \
  cat ops/review_bursts.json | jq '{pending: .pending_count, failed: .failed_count}'
```

### Normal vs. Abnormal Patterns

| Pattern | Normal State | Abnormal (Needs Attention) |
|---------|--------------|----------------------------|
| Agents | 4-6 active, 0-2 idle | 0 active, or >6 active |
| Queue | 0-5 pending | >10 pending, or queue growing |
| Override Rate | 2-5% daily | >10% daily, or rapidly climbing |
| Failures | 1-2 per day | >5 per day, or burst pattern |
| Latency | <2 min avg decision | >5 min avg, or timeouts |

---

## High Override Rate

### Diagnosis Flow

```
Override Rate >10%
       │
       ▼
Is it climbing or stable?
       │
Climbing ──► [URGENT] Check last 10 overrides
Stable ────► [MONITOR] Pattern analysis
       │
       ▼
What type of work is being overridden?
       │
Consistent type ──► Category-specific fix needed
Multiple types ───► System confidence issue
New workstream ───► Learning phase (expected, monitor)
       │
       ▼
Override reason consistent?
       │
Same reason ──► Preference gap, easy fix
Mixed reasons ─► Model drift, needs tuning
```

### Common Causes & Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Copy tone consistently wrong | Preference not learned | Tag 3+ examples explicitly |
| Layout density off | Component density preference missing | Log: `component-density:light` |
| CTA confusion | AI proposing multiple actions | Tag: `cta-style:single-dominant` |
| Hierarchy issues | Information architecture mismatch | Tag: `hierarchy:summary-first` |
| Different person operating | Shift change, preferences not shared | Sync preference profiles |
| New workstream type | Novel patterns not in training | Manual mode for 1-2 days |
| Model update | Regression from new weights | Rollback to previous config |

### Recovery Steps

```
STEP 1: Log the Pattern (2 min)
──────────────────────────────
□ Document last 10 override reasons
□ Identify common themes
□ Tag preference category

STEP 2: Update Preferences (3 min)
────────────────────────────────────
□ Create or update preference tags
□ Add 3+ examples of correct vs. incorrect
□ Verify profile updated in ops/sample_operator_preference_profile.json

STEP 3: Observe Impact (monitor 1 hour)
────────────────────────────────────────
□ Watch next 10 recommendations
□ Expect improvement if preference gap found
□ If no improvement → Escalate

STEP 4: Decision
────────────────
If improved: Monitor normally
If not improved: 
  → Short-term: Set Active mode (review everything)
  → Long-term: Escalate to Product/Engineering
```

### When to Escalate

Escalate immediately if:
- Override rate >25% and climbing
- Same preference logged 5+ times with no learning
- Pattern affects all workstreams (system-wide issue)
- Recent deployment coincides with increase

---

## Failed Healing Events

### What is a Healing Event?

When the AI detects an issue with its output, it attempts to self-correct. If correction fails 3 times, that's a **failed healing event**—requiring operator intervention.

### Detection

```bash
# Check for failed healing
cat ops/review_bursts.json | jq '.bursts[] | select(.healing_failed == true)'

# Or in dashboard: 🟡 Yellow warning badge
```

### Immediate Actions

| Priority | Action | Rationale |
|----------|--------|-----------|
| 1 | Pause affected workstream | Stop cascade failures |
| 2 | Review failure logs | Root cause analysis |
| 3 | Identify original input | What triggered healing? |
| 4 | Manually correct | Set new baseline |
| 5 | Document in memory/ | Feed learning system |

### Escalation Path

```
┌────────────────────────────────────────────────────────────┐
│                    ESCALATION PATH                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Operator (You)                                         │
│     └─► Handles: Individual healing failures               │
│         └─► Route: Document → Fix → Monitor                │
│                                                            │
│  2. Ops Lead (if >3 failures/hour)                        │
│     └─► Handles: Pattern of healing failures               │
│         └─► Route: Pattern analysis → Config adjustment    │
│                                                            │
│  3. Engineering Lead (if >10 failures/day)                │
│     └─► Handles: System-wide healing issues                │
│         └─► Route: Model rollbacks → Code fixes          │
│                                                            │
│  4. Product Owner (if customer impact)                    │
│     └─► Handles: Business impact scenarios               │
│         └─► Route: Communication → Recovery              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Documentation Template

```markdown
## Failed Healing Event [timestamp]

**Workstream:** [name]
**Input:** [brief description of original request]
**Healing Attempts:** [count]
**Failure Reason:** [extracted from logs]
**Root Cause:** [operator analysis]
**Resolution:** [what fixed it]
**Prevention:** [how to avoid in future]
```

---

## Blocker Predictions (False Positives)

### What Are Blocker Predictions?

The AI may flag something as "blocking" (preventing forward progress) that isn't actually a blocker. These false positives waste operator time.

### Identifying False Positives

| Indicator | Description |
|-----------|-------------|
| "Blocker" cleared without work | AI said blocked, but no fix needed |
| Repeated same "blocker" | Same issue flagged multiple times |
| Confidence <60% | Low-confidence blockage alert |
| No downstream impact | Flagged but didn't actually block |

### Handling False Positives

```
STEP 1: Verify it's False Positive
──────────────────────────────────
□ Did the task actually complete despite "blocker"?
□ Was the flagged issue actually important?
□ Would the task have failed without intervention?

If YES to any → False positive

STEP 2: Tag as False Positive
─────────────────────────────
openclaw review flag-false-positive <burst-id> \
  --reason "Not actually blocking" \
  --category "over-caution"

STEP 3: Feed Preference System
──────────────────────────────
Log: Blocker threshold too sensitive for [task type]
Adjust: Set higher confidence threshold for [task type]

STEP 4: Monitor
───────────────
Expect fewer similar flags
If continues → Escalate to tune model
```

### Prediction Categories to Review

| Category | Legitimate Blocker | Likely False Positive |
|----------|-------------------|----------------------|
| "Insufficient data" | Actually missing required data | Could infer from context |
| "Conflicting requirements" | Real contradiction | Minor styling conflict |
| "Out of scope" | Clearly out of bounds | Edge of scope |
| "Compliance risk" | Real violation | Conservative interpretation |

### Tuning Prediction Sensitivity

If false positive rate >20% on blockers:

```bash
# Check prediction accuracy
cat ops/review_bursts.json | jq '[.bursts[] | select(.type == "blocker")] | {total: length, false_positives: map(select(.false_positive == true)) | length}'

# Adjust threshold (requires Engineering)
openclaw model set-threshold --type blocker --confidence 0.75
```

---

## Agent Stuck/Not Responding

### Symptoms

- Task in "Active" state for >30 minutes
- Agent status shows "running" but no progress
- Workstream timeout warnings

### Diagnosis Commands

```bash
# Check specific agent
openclaw agents status <agent-id>

# View agent logs
tail -100 logs/agent-<agent-id>.log

# Check for errors
openclaw agents errors --since "30 minutes ago"
```

### Resolution Steps

| Scenario | Action | Command |
|----------|--------|---------|
| Agent stuck on I/O | Kill and retry | `openclaw agents kill <id> --retry` |
| Infinite loop detected | Kill, don't retry | `openclaw agents kill <id>` |
| Rate limit hit | Wait, then resume | Auto-resumes in timeout |
| Dependency missing | Fix dependency, retry | Fix → `openclaw agents resume <id>` |
| Conflicting agents | Kill one, keep other | `openclaw agents kill <id-1>` |

### Prevention

```bash
# Set agent timeouts (auto-kill)
openclaw config set agent.timeout 30m  # 30 minutes max

# Enable proactive stuck detection
openclaw config set agent.stuck-alert true
```

---

## Queue Overload

### Symptoms

- Pending reviews >10
- Queue growing faster than processing
- Operator can't keep up

### Immediate Actions

```
QUEUE OVERLOAD PROTOCOL
───────────────────────

IF queue > 20:
  1. PAUSE all new workstreams
  2. Emergency triage: reject lowest priority
  3. Escalate to additional operator or reduce scope
  4. Resume when queue <10

IF queue 10-20:
  1. Set Active mode (review everything)
  2. Fast-track auto-accept for Low Stakes>85% confidence
  3. Focus on High Stakes first
  4. Document if overwhelmed

IF queue growing:
  1. Check if rate of new items > review speed
  2. Identify source of influx
  3. Throttle at source if possible
```

### Root Causes

| Cause | Detection | Prevention |
|-------|-----------|------------|
| Burst of new tasks | Sudden spike | Rate limiting in queue config |
| Operator absence | Queue >0 for hours | Coverage scheduling |
| Complex task type | Tasks taking >5 min | Break into smaller tasks |
| System generating duplicates | Duplicate IDs | Deduplication check |
| Threshold too low | Many Low Stakes items | Tune auto-accept threshold |

---

## Preference Not Learning

### Symptoms

- You override same thing 5+ times
- Preference profile not updating
- No change in AI recommendations

### Diagnosis

```bash
# Check preference file
ls -la ops/sample_operator_preference_profile.json

# Verify updates
cat ops/sample_operator_preference_profile.json | jq '.updated_at'

# Check tag counts
cat ops/sample_operator_preference_profile.json | jq '.summary'
```

| Issue | Check | Fix |
|-------|-------|-----|
| File not updating | Timestamp old | Restart preference sync |
| Tag count low | <3 samples | Provide more examples |
| Override not feeding | Wrong format | Use correct tag format |
| Cache stale | File updated but AI not using | Clear cache, restart |

### Quick Fix

```bash
# Force preference sync
openclaw prefs sync --force

# Clear recommendation cache
openclaw cache clear --type recommendations

# Restart affected agents
openclaw agents restart --filter preference-aware
```

---

## Quality Gate Failures

### Gate Failure Escalation

| Gate | Failure Impact | Escalation |
|------|----------------|------------|
| Gate 0: Strategy | Wrong direction | Product Strategy Lead |
| Gate 1: Design | Poor UX | UX Design Lead |
| Gate 2: Backend | Integration failure | Backend Lead |
| Gate 3: Feedback | No learning signal | Intelligence Lead |
| Gate 4: Autonomy | Safety violation | Engineering Lead |
| Gate 5: User Testing | User rejection | Product + User Research |
| Gate 6: Deployment | Launch failure | Operations Lead |

### Recovery Template

```
GATE FAILURE RECOVERY
─────────────────────
Gate: [N]
Workstream: [name]
Failure: [what failed]
Impact: [what's at risk]

Immediate Fix:
- [ ] Rollback to last good state
- [ ] Fix root cause
- [ ] Re-run gate validation

Prevention:
- [ ] Update gate criteria
- [ ] Add new checkpoint
- [ ] Document lesson learned
```

---

## External Integration Failures

### Symptoms

- External API errors in logs
- Sync failures
- Missing data from external sources

### Common Failures

| Integration | Common Failure | Quick Fix |
|-------------|----------------|-----------|
| GitHub | Rate limit/API change | Use SSH, check token |
| Cloud deployment | Deploy failure | Rollback, retry |
| Database sync | Schema mismatch | Verify migrations |
| External tools | Timeout/unavailable | Check status page |

---

## Emergency Contact Reference

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| System failure | #gtm-ops-emergency | Immediate |
| Security incident | security@company | Immediate |
| Agent stuck | #gtm-ops-help | 15 minutes |
| Model issues | #ai-ml-team | 30 minutes |
| Product questions | Product channel | 1 hour |
| Documentation | #gtm-ops-docs | 2 hours |

---

## Recovery Command Quick Reference

```bash
# EMERGENCY: Stop everything
openclaw gateway stop

# Resume after fix
openclaw gateway start

# View logs
tail -f logs/system.log

# Reset workstream
openclaw workstream reset <id> --preserve-data

# Export state for report
openclaw ops export --format json > incident-$(date +%s).json

# Restart single agent
openclaw agents restart <agent-id>

# Force preference update
openclaw prefs sync --force
```

---

## Post-Incident Review Template

```markdown
## Incident Review [date]

**Summary:** [one sentence]
**Severity:** Low/Medium/High/Critical
**Duration:** [time from detection to resolution]

**Root Cause:**
[What happened and why]

**Impact:**
- Affected workstreams: [list]
- Customer impact: [Y/N, description]
- Override rate spike: [Y/N, %]

**Detection:**
- How did we notice?: [dashboard alert, operator report, etc.]
- Time to detect: [duration]

**Resolution:**
- Steps taken: [list]
- Time to resolve: [duration]

**Prevention:**
- What could have prevented this?: [ideas]
- Changes made: [what was fixed]

**Action Items:**
- [ ] [task] @owner [due date]
```

---

*Got an issue not covered here? Add it to the Troubleshooting Guide and share in #gtm-ops-docs*
