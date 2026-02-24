# GTM OS Operator Guide

**Version:** 1.0  
**Last Updated:** 2026-02-24  
**Target Audience:** Human Operators overseeing autonomous GTM operations

---

## Introduction

Welcome to the GTM OS Operator Guide. This document explains how to monitor, evaluate, and override AI-driven recommendations within the GTM (Go-To-Market) Operating System.

As an operator, your role is **not** to micromanage the system. Instead, you provide guardrails, handle edge cases, and teach the system your preferences through feedback.

---

## Dashboard Overview

### Primary Dashboard Sections

```
┌─────────────────────────────────────────────────────────────────┐
│  GTM OS OPERATOR DASHBOARD                    [STATUS: GREEN]   │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  QUEUE HEALTH   │  AGENT ACTIVITY │  SYSTEM METRICS             │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                                                                  │
│  [OVERRIDE REVIEW QUEUE]          [PREFERENCES LEARNED]         │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │ ⏳ Pending Reviews: 3    │    │ Copy Tone: Concise      │    │
│  │ 🟡 Needs Attention: 1  │    │ Hierarchy: Summary-1st  │    │
│  │ 🔴 High Stakes: 0      │    │ CTA Style: Single-Dom   │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│                                                                  │
│  [ACTIVE WORKSTREAMS]                                            │
│  ● Homepage MVP (Gate 2)    ● Feedback Pipeline (Gate 0)        │
│  ● Preference Model (Gate 1) ● Swarm Burst (Active)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Section-by-Section Breakdown

#### 1. Queue Health

| Metric | Normal Range | Action Required When |
|--------|--------------|---------------------|
| Pending Reviews | 0-5 | >10 indicates review backlog |
| Needs Attention | 0-2 | >5 requires intervention |
| High Stakes | 0 | Any non-zero needs immediate review |
| Override Rate (24h) | <5% | >10% signals confidence drift |

**What to check:**
- Are reviews piling up? → Increase monitoring frequency
- High Stakes items waiting → Review within 30 minutes max
- Override rate climbing → Check for pattern in AI failures

#### 2. Agent Activity

Shows current subagent workers and their status:

| State | Meaning | Operator Action |
|-------|---------|-----------------|
| 🟢 Active | Processing normally | None |
| 🟡 Pending | Queued, waiting for slot | Monitor if >10 queued |
| 🔴 Failed | Error/needs intervention | Review error log, decide retry/abort |
| ⚪ Idle | No assigned work | Ensure work queue populated |

**Concurrency Limits:**
- Maximum 6 active chains (target)
- Maximum 12 total subagents
- Never exceed 18 configured agents

#### 3. System Metrics

**Key Performance Indicators:**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Task Completion Rate | >90% | <85% triggers review |
| Average Decision Latency | <2 min | >5 min check agents |
| False Positive Rate | <20% | >25% requires tuning |
| User Acceptance Rate | >80% | <70% confidence issue |

---

## When to Accept AI Recommendations

### ✅ Auto-Accept Criteria (No Review Needed)

| Situation | Confidence Level | Example |
|-----------|------------------|---------|
| Low-impact decision | >85% confidence | Style tweaks in existing component |
| Repeated pattern | >80% confidence | Same CTA style, 3+ approvals |
| Pre-approved category | Any | Documentation formatting |
| No-stakes changes | Any | Internal comments, whitespace |

**Auto-accept conditions:**
- Confidence > threshold (see table)
- Matches learned preference profile
- No financial/legal/compliance impact
- Previously approved pattern (last 7 days)

### 🟡 Review First Accept Criteria

| Situation | Review Within | Typical Action |
|-----------|---------------|----------------|
| Medium-impact UX change | 2 hours | Quick sanity check |
| Novel pattern (not in preferences) | 1 hour | Evaluate if fits brand |
| Confidence 70-85% | 30 min | Spot-check logic |
| Multi-component change | Immediately | Verify integration |

### 🔴 Requires Human Decision

| Situation | Never Auto-Approve | Why |
|-----------|-------------------|-----|
| Financial impact >$1,000 | Yes | Requires explicit authority |
| Customer-facing message | Yes | Reputation risk |
| Legal/compliance touch | Yes | Regulatory requirement |
| "Override" requested | Yes | Explicit operator demand |
| Failed healing event | Yes | System couldn't self-correct |

---

## When to Reject/Override AI Recommendations

### Override Decision Framework

```
DECISION FLOW:

AI Recommendation Received
         │
         ▼
┌───────────────────┐
│ Is this HIGH      │
│ STAKES? (money,   │
│ legal, customer)  │
└────────┬──────────┘
         │
    Yes ─┴─► [ALWAYS REVIEW MANUALLY]
              Then: Approve / Modify / Reject
              ▲
              └── Log reason for learning
         │
    No ──► Is confidence >85%?
              │
         Yes ─┴─► [ACCEPT]
         No  ────► [REVIEW]
              Then: Approve / Modify / Reject
```

### Common Override Scenarios

| Scenario | Why Reject | What to Teach System |
|----------|-----------|---------------------|
| Wrong tone | Doesn't match brand voice | Tag: `copy-tone:[correct-style]` |
| Component overload | Too dense/complex | Tag: `component-density:light` |
| Confusing CTA hierarchy | Multiple competing actions | Tag: `cta-style:single-dominant` |
| Information architecture | Buried key info | Tag: `hierarchy:summary-first` |
| Visual inconsistency | Doesn't match design system | Log: specific component mismatch |

### Override Rate Targets

| Metric | Target | Acceptable Range | Action Required |
|--------|--------|------------------|-----------------|
| Daily Override Rate | <5% | <10% | Tune if >10% for 2 days |
| Weekly Override Rate | <3% | <7% | Review patterns weekly |
| Per-Task Override | N/A | <2 per task | Blocker if >5 overrides on one task |

**If override rate >10%:**
1. Check for systematic AI misunderstanding
2. Review recent preference tags for gaps
3. Verify preference model is updating
4. Consider temporary manual mode for affected task type

---

## Emergency Pause Procedures

### Emergency Pause Triggers

**IMMEDIATE PAUSE (any of the following):**

| Trigger | Severity | Visual Indicator |
|---------|----------|------------------|
| Override rate >25% | High | 🔴 Red override rate badge |
| System producing incorrect outputs | Critical | 🔴 RED status banner |
| Customer complaint about AI-generated content | Critical | 🔴 Escalation alert |
| Failed healing events >3 in 1 hour | High | 🟡 Yellow warning flag |
| Financial miscalculation detected | Critical | 🔴 Immediate freeze |
| Compliance violation risk | Critical | 🔴 Block all outputs |

### Pause Procedure

```
LEVEL 1 - PARTIAL PAUSE (Specific Area)
─────────────────────────────────────
[Applicable when: One workstream problematic]

1. Identify affected workstream
2. Click PAUSE WORKSTREAM on dashboard
3. Current tasks finish, no new ones start
4. Review queued items before unpausing
5. Root cause documented in memory/

LEVEL 2 - FULL PAUSE (All Operations)
───────────────────────────────────────
[Applicable when: System-wide issue]

1. Click EMERGENCY PAUSE on dashboard
   OR run:  openclaw gateway pause
2. All subagents suspended immediately
3. Save current state: openclaw agents save-state
4. Review all pending decisions before resume
5. Document incident in memory/YYYY-MM-DD.md

LEVEL 3 - SYSTEM SHUTDOWN (Nuclear Option)
──────────────────────────────────────────
[Applicable when: Confidence completely lost]

1. Click STOP ALL AUTONOMOUS OPERATIONS
2. Open terminal: openclaw gateway stop
3. Verify all agents stopped: openclaw agents list
4. Manually restore from last known good state
5. Escalate to engineering lead before restart
```

### Resume Procedure

```
Before Resuming:
□ Root cause identified
□ Fix verified (in staging/test)
□ Decision log reviewed
□ Preferences updated if needed
□ Rollback plan ready

Resume Steps:
1. Restart gateway: openclaw gateway start
2. Verify agents: openclaw agents list
3. Resume one workstream first
4. Monitor for 10 minutes
5. Gradually resume others
```

---

## Preference Teaching Workflow

When you override, the system learns from your feedback.

### How to Log Effective Feedback

```
BAD:  "This is wrong."
GOOD: "Copy tone should be concise, not promotional. Preference: copy-tone:concise"

BAD:  "Fix this."
GOOD: "Component is too dense. Preference: component-density:light"

BAD:  "I don't like it."
GOOD: "CTA hierarchy unclear with multiple buttons. Preference: cta-style:single-dominant"
```

### Feedback Tags to Use

| Category | Tag Options | When to Use |
|----------|-------------|---------------|
| Copy Tone | `concise`, `friendly`, `professional`, `energetic` | When brand voice mismatched |
| Component Density | `light`, `balanced`, `dense` | When too much/too little content |
| CTA Style | `single-dominant`, `dual-balanced`, `multi-subtle` | When action hierarchy wrong |
| Hierarchy | `summary-first`, `details-first`, `scannable` | When info architecture off |

### Learning Verification

Check `ops/sample_operator_preference_profile.json` periodically:

```bash
# View your current learned preferences
cat ops/sample_operator_preference_profile.json

# Check for gaps (preferences with <3 data points)
python3 scripts/check_preference_coverage.py
```

---

## Quality Gates Reference

Each workstream progresses through 7 gates. You may need to intervene at specific gates.

| Gate | Where You Might Intervene | Typical Override |
|------|---------------------------|------------------|
| Gate 0: Strategy | Changing priorities mid-stream | Scope decisions |
| Gate 1: Design | UX pattern approval | Visual direction |
| Gate 2: Backend | API contract sign-off | Integration approach |
| Gate 3: Feedback | Learning pipeline approval | What to capture |
| Gate 4: Autonomy | Safety threshold adjustments | Confidence levels |
| Gate 5: User Testing | Test plan approval | Participant criteria |
| Gate 6: Deployment | Go/no-go decision | Launch timing |

**Current Workstream Status:** Review in `org/GTM_OS_QUALITY_GATES.md`

---

## Communication & Escalation

### When to Escalate

| Situation | To Whom | Timeframe |
|-----------|---------|-----------|
| System failure | Engineering lead | Immediately |
| Override rate >15% sustained | Product owner | Within 4 hours |
| Customer impact | Business lead + Engineering | Within 1 hour |
| Preference learning not working | Data team | Daily standup |
| Agent stuck >30 min | Operations team | Within 15 minutes |

### Status Reporting

Daily operator report (auto-generated):
```
Ops Report 2026-02-24:
- Override rate: 3% (target: <5%) ✅
- Active workstreams: 4/6
- Queue health: GREEN
- Pending reviews: 2
- New preferences learned: 1
- Actions required: None
```

---

## Quick Reference: Decision Speed

| Decision Type | Max Time to Decide | Tool to Use |
|---------------|-------------------|-------------|
| High-stakes | 5 minutes | Full review panel |
| Medium-stakes | 2 minutes | Quick preview + approve/reject |
| Low-stakes | 30 seconds | Inline approve/reject |
| Emergency pause | Immediate | Dashboard red button |

---

## Related Documents

- `QUICKSTART.md` — First 5 minutes as an operator
- `TROUBLESHOOTING.md` — When things go wrong
- `org/GTM_OS_QUALITY_GATES.md` — Quality gate definitions
- `org/PERMANENT_SUBAGENT_ROSTER.md` — Agent responsibilities
- `ops/sample_operator_preference_profile.json` — Your learned preferences

---

*Document maintained by GTM OS Operations Team. Questions? Check #gtm-ops-help*
