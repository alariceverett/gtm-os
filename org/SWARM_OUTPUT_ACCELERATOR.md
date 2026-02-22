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

## Additional Required Practices (v2)

9. **No-merge unless demoable**
   - Every merged change must have a 2-minute demo path proving business value.

10. **Top-3 operator questions panel per page**
   - Every major page must answer:
     1) What is this?
     2) What should I do now?
     3) What happens if I do it?

11. **Interaction debt tracking**
   - Track click count + context switches for golden path.
   - Treat increases as regressions unless justified.

12. **Confidence budget policy**
   - Low-confidence recommendations must route to review queue (not auto-execute).

13. **Fresh-eyes teardown cadence**
   - Weekly first-time-user critique lane with no prior context.

14. **KPI action linkage**
   - Every KPI must include “why it matters” and “what to do next” guidance.

## 48-Hour Controlled Sprint Mode
- Freeze net-new scope.
- Ship only KPI-linked work.
- Require before/after evidence on each cycle.

## Canonical KPI Scorecard
1) Qualified accounts/week
2) Positive replies + meetings booked
3) Pilot candidate conversion rate
4) Time-to-next-human-action

## Completion Rule
No cycle is complete unless:
- route truth table is clean,
- golden path replay passes,
- KPI mapping is explicit,
- material proof pack is published in /ops,
- 2-minute demo script exists for merged changes.
