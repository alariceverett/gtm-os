# AdZeta — Alert Thresholds + Escalation Policy (Evidence Mode v1)

_Last updated: 2026-02-22_

## Objective
Reduce **TTNHA** by standardizing what triggers an alert and what the next human action must be.

## Severity levels
- **SEV-1 (Immediate, <15 min):** revenue/pilot-critical or hot inbound.
- **SEV-2 (Fast, <2 hours):** positive reply, meeting request, or high-intent signal.
- **SEV-3 (Daily, <24 hours):** backlog hygiene, routine follow-ups.

## Alert rules (minimum viable)

### Replies / Meetings
1) **Positive reply received** → **SEV-2**
- Trigger: `event_type=reply_positive`
- Action: draft response + propose times + route to owner
- SLA: 2 hours

2) **Meeting requested / scheduled** → **SEV-2**
- Trigger: `event_type=meeting_scheduled`
- Action: confirm agenda + attach 3-bullet account brief
- SLA: 2 hours

### Pilots
3) **Pilot proposed needs approval** → **SEV-1**
- Trigger: `event_type=pilot_proposed` AND `requires_approval=true` (or metadata flag)
- Action: approve/reject with success criteria
- SLA: 15 minutes

### Hygiene / Risk
4) **Thread stalled > 48h after positive signal** → **SEV-2**
- Trigger: `reply_positive` with no `human_action_taken` within 48h
- Action: escalate + rewrite response + assign owner

5) **TTNHA regression** → **SEV-3**
- Trigger: median TTNHA increases > 25% week-over-week OR p90 > 24h
- Action: adjust routing + briefing template adherence check

## Escalation ladder
- First owner: assigned operator (or account owner)
- Second: GTM lead
- Third: executive (if SEV-1 persists > 60 min)

## Required alert payload (proof-first)
Every alert must include:
- account/person identifiers
- why it triggered (event + timestamp)
- recommended next human action (single sentence)
- direct evidence link (`evidence_ref`)

## Compliance check
- % SEV-1 met within SLA
- % SEV-2 met within SLA
- median TTNHA and p90
