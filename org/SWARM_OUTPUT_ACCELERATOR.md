# SWARM_OUTPUT_ACCELERATOR.md

## Objective
Maximize output quality and business impact by operating in evidence mode, not activity mode.

## 8 Required Practices

1. **Two-pass build model**
   - Pass 1: implementation lane ships candidate.
   - Pass 2: critic lane performs teardown before merge.

2. **Reference benchmarking**
   - Benchmark pages against enterprise references: Linear, Notion, HubSpot, Stripe Dashboard, Asana.
   - Score each page on: clarity, hierarchy, density, CTA focus, context continuity.

3. **Task sizing discipline**
   - Default slice size: 2–4 hours.
   - Every slice must produce visible, testable output.

4. **Merge-quality budget**
   - Limit concurrent UI-changing lanes.
   - Keep high parallelism for analysis/data, controlled parallelism for UI.

5. **Golden dataset + replay tests**
   - Use repeatable demo dataset.
   - Replay critical scenarios each cycle.

6. **Decision log with reversibility**
   - Each non-trivial decision logs: rationale, expected impact, rollback trigger.

7. **Outcome-first kill switch**
   - Deprioritize tasks that do not move core KPIs in 1–2 cycles.

8. **Human taste checkpoints (review bursts)**
   - 5–10 minute operator checkpoints at high-leverage milestones only.

## 48-Hour Controlled Sprint Mode
- Freeze net-new scope.
- Ship only KPI-linked work.
- Require before/after evidence on each cycle.

## Canonical KPI Scorecard
1) Qualified accounts added/week
2) Positive replies + meetings booked
3) Pilot candidate conversion rate
4) Time-to-next-human-action

## Completion Rule
No cycle is complete unless:
- route truth table is clean,
- golden path replay passes,
- KPI mapping is explicit,
- material proof pack is published in /ops.
