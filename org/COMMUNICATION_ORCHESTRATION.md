# COMMUNICATION_ORCHESTRATION.md

## Purpose
Make communication loops explicit, predictable, and low-friction.

## Channels
1) **/ops Review Bursts** (primary human review surface)
2) **/ops Review Center** (history + material proof)
3) **Chat updates** (material-only summaries)

## Review Burst format (required)
- Decision needed (plain language)
- Why it matters (1 sentence)
- Recommended default action
- Exact URL
- Expected review time (5-10 min)
- Status (pending/approved/revise)

## Feedback loop
1) Operator approves/revises in /ops.
2) Feedback is converted to tracked tasks.
3) Applied changes publish proof back to /ops.
4) Burst closes only after evidence is attached.

## Anti-noise rules
- No abstract status spam.
- No internal jargon in decision text.
- No progress claim without route truth + visible change.

## SLA
- Material review updates at least hourly while active cycles run.
- Critical regressions reported immediately with owner and ETA.
