# GTM OS Operator Quickstart

**Your first 5 minutes → Hourly workflow → End-of-shift handoff**

---

## ⚡ First 5 Minutes: Your Checklist

### Step 1: Check System Status (30 seconds)

```bash
# Quick health check
openclaw agents list | grep -E "(running|failed|idle)"

# Or view dashboard
# Look for: [STATUS: GREEN] 
```

| Status | Meaning | Your Action |
|--------|---------|-------------|
| 🟢 **GREEN** | System healthy | Proceed to queue review |
| 🟡 **YELLOW** | Warning conditions | Note for monitoring |
| 🔴 **RED** | Paused or failing | See Emergency Procedures |

### Step 2: Review Override Queue (2 minutes)

**Where:** Dashboard → Override Review Queue

**Check for:**
- [ ] Pending Reviews: Should be 0-5
- [ ] Needs Attention: Should be 0-2
- [ ] High Stakes: Must be 0 (or review immediately)

**If items waiting:**
- High Stakes → Review NOW
- Others → Review at next break

### Step 3: Check Override Rate (30 seconds)

```bash
# 24-hour override rate
cat ops/review_bursts.json | jq '.override_rate_24h'
```

| Rate | Meaning | Target |
|------|---------|--------|
| <5% | System learning well | ✅ |
| 5-10% | Monitor for patterns | ⚠️ |
| >10% | Needs attention | 🔴 |

### Step 4: Scan Active Workstreams (1 minute)

```bash
# Active workstreams
ls -la org/ | grep -E "WORK_QUEUE|TASK_BACKLOG"
```

**Ask yourself:**
- Does the list match expected priorities?
- Any unexpected blocks or pauses?
- Work queue populated with actionable items?

### Step 5: Set Your Mode (1 minute)

| Mode | When to Use | Override Threshold |
|------|-------------|-------------------|
| **Trusted** | System stable, override rate <5% | Only High Stakes |
| **Attentive** | System learning, override rate 5-10% | Medium + High Stakes |
| **Active** | Confidence low, override rate >10% | Review everything |

Set your mode in the dashboard or document in `memory/YYYY-MM-DD.md`.

---

## 📋 Daily Workflow

### Morning Review (Start of Shift)

```
□ 5-min startup check (see above)
□ Review overnight activity: memory/YYYY-MM-DD.md
□ Note any agent failures or errors
□ Check preference profile for new learning
□ Set today's override mode

Time Target: 10 minutes
```

### Hourly Pulse (Every ~60 Minutes)

```
□ 30-sec: Dashboard status
□ 1-min: Override queue count
□ 30-sec: Active agent health
□ 1-min: Quick approval of green-light items
□ 30-sec: Queue pressure check

Time Target: 4 minutes
```

**Quick Queue Pressure Check:**
If you see >6 pending items, increase monitoring.
If you see >10 pending items, pause and review.

### Decision Sessions (Throughout Day)

**Quick Decision Flow:**

```
Item arrives in queue
         │
         ▼
Is it marked HIGH STAKES?
         │
    Yes ─┴─► REVIEW IMMEDIATELY (max 5 min)
         ▲
         └── Approve → Note why
             Modify → Document change
             Reject → Tag for learning
         │
    No ────► Confidence >85%?
              │
         Yes ─┴─► Quick Accept (30 sec)
         No  ───► Quick Preview → Decide (2 min)
```

### End-of-Shift Handoff

```
□ Complete pending reviews (or escalate)
□ Document open items with context
□ Note system issues for next operator
□ Update memory log with shift summary
□ Set queue to monitored/transfer mode

Time Target: 10 minutes
```

**Handoff Template:**

```markdown
## Shift Handoff [2026-02-24 18:00 EST]

**Status:** GREEN / YELLOW / RED

**Override Rate Today:** X% (target: <5%)

**Open Items Requiring Follow-up:**
- Item 1: [description] next action [action] by [when]

**System Notes:**
- Any failures, stuck agents, or issues
- Pattern of overrides worth noting
- Preference learning observations

**Queue State:**
- Pending reviews: X
- Active workstreams: X/Y
- Next operator priorities: [list]
```

---

## 📊 Reading the Dashboard

### The 5 Panels (Always Visible)

```
╔════════════════════════════════════════════════════════════╗
║ [1] STATUS INDICATOR     [2] QUEUE STATE                  ║
║ 🟢 GREEN               Overrides: 3 pending               ║
║                                                  ┌─────┐  ║
║ [3] AGENT ACTIVITY       [4] PREFERENCES         │ [5] │  ║
║ Running: 4/6             Learned: 4 patterns     │OPS  │  ║
║ Queued: 2                New today: 1 pattern    │BTNS │  ║
║                                              └─────┘  ║
╚════════════════════════════════════════════════════════════╝
```

| Panel | What It Tells You | Normal Range |
|-------|-------------------|--------------|
| **Status** | Overall health | Always GREEN |
| **Queue** | Work awaiting review | 0-5 pending |
| **Agents** | Active/inactive workers | 3-6 active |
| **Prefs** | System learning status | Growing daily |
| **Ops** | Emergency controls | Buttons only |

### Color Meanings

| Color | Dashboard | Queue Items | Button States |
|-------|-----------|-------------|---------------|
| 🟢 Green | System healthy | Standard priority | Active |
| 🟡 Yellow | Warning state | Needs attention | Active |
| 🔴 Red | Critical/failed | High stakes | Paused/Inactive |
| ⚪ Gray | Idle/standby | Review complete | Disabled |

### The Queue Counter

```
Pending Reviews:   ████.... (4/10 - Good)
Needs Attention:   ██...... (2 - Monitor)
High Stakes:       ........ (0 - Excellent)
```

**Counter Rules:**
- If High Stakes > 0 → Stop everything else
- If Pending > 10 → Pause new work
- If any counter stuck > 30 min → Check system

---

## ⌨️ Common Commands

### Quick Checks

```bash
# Agent status
openclaw agents list

# Gateway health
openclaw gateway status

# Today's memory
cat memory/$(date +%Y-%m-%d).md | tail -20

# Override history
cat ops/review_bursts.json | jq '.bursts | last(5)'

# Preference profile
cat ops/sample_operator_preference_profile.json
```

### Emergency Actions

```bash
# View active workstreams
openclaw agents list --running

# Pause specific workstream
openclaw agents pause <workstream-id>

# Emergency stop (all agents)
openclaw gateway stop

# Resume after fix
openclaw gateway start
openclaw agents resume

# Save system state
openclaw agents save-state --label "pre-fix-backup"
```

### Review Actions

```bash
# View pending overrides
cat ops/review_bursts.json | jq '.pending'

# Approve with feedback
openclaw review approve <burst-id> --feedback "Tag: copy-tone:concise"

# Reject with teaching
openclaw review reject <burst-id> --reason "Preference: component-density:light"

# Modify and submit
openclaw review modify <burst-id> --edit "path/to/edit" --note "Reason"
```

---

## 🎯 Decision Matrix (Print This)

| Situation | Confidence | Action | Time |
|-----------|------------|--------|------|
| Standard work | >85% | Accept | 10 sec |
| Novel pattern | 70-85% | Review → Likely accept | 2 min |
| Unclear fit | 50-70% | Review → May modify | 3 min |
| Poor fit | <50% | Review → Likely reject | 3 min |
| High stakes | Any | Full review required | 5 min |
| Emergency | N/A | Pause system first | Immediate |

---

## 🚨 Emergency Quick Reference

| Situation | First Action | Second Action |
|-----------|--------------|---------------|
| Override rate spike | Check patterns | Tune or pause |
| System failure | `gateway stop` | Document incident |
| Bad output published | Isolate cause | Rollback if possible |
| Agent stuck | `agents kill <id>` | Retry with fix |
| Queue overload | Pause new work | Process existing |
| Lost confidence | Set Active mode | Review everything |

**Emergency Contacts:**
- Engineering escalation: #gtm-ops-emergency
- On-call rotation: See `org/ON_CALL.md`
- Documentation: You're reading it!

---

## ✅ Daily Success Metrics

You had a successful operator day if:

- [ ] Override rate stayed <10% (preferably <5%)
- [ ] No High Stakes items waited >30 minutes
- [ ] System stayed GREEN all day
- [ ] All handoffs documented
- [ ] At least 1 preference learned
- [ ] Zero emergency pauses

---

## 📚 Next Steps

**After this quickstart:**
1. Read full `OPERATOR_GUIDE.md` for depth
2. Review `TROUBLESHOOTING.md` for edge cases
3. Explore `org/GTM_OS_QUALITY_GATES.md` for process
4. Introduce yourself in #gtm-ops-help

**Questions?**
- Dashboard help: Hover over any element
- Command help: `openclaw --help`
- Human help: #gtm-ops-help

---

*Version 1.0 | New operator onboarding time target: <30 minutes*
