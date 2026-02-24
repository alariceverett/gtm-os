# Team Onboarding (In-App, Human-to-Human Execution)

Use this guide for new operators working inside **GTM Command Center**.

## In-app location

- **Start page:** `http://127.0.0.1:1981/`
- **Primary panel:** **Team handoff queue** (marker: `data-verify="team-handoff-queue-v1"`)
- **Supporting operations page:** `http://127.0.0.1:1981/ops`

## 1) Where to start (first 10 minutes)

1. Open **Home** (`/`).
2. Confirm the funnel-first header and top-of-funnel context are visible.
3. Go to **Team handoff queue** and pick the highest-priority item.
4. Read the AI-prepared brief attached to that queue item.
5. Execute the human outreach handoff exactly as written (human-to-human delivery).

## 2) Daily routine (operator loop)

Run this loop for each shift:

1. **Queue review (Home):**
   - Process top-priority handoff items first.
   - Mark progress in normal operator workflow.
2. **Outreach execution:**
   - Send handoff to the human owner/contact.
   - Keep notes concise and action-focused.
3. **Validation pass (Ops):**
   - Check `/ops` for system/process blockers (readiness, alerts, execution board).
4. **Return to Home:**
   - Continue queue processing until top-priority items are cleared.

## 3) Escalation path to AI-prepared queue

Escalate an item to the AI-prepared queue when:

- required context is incomplete,
- outreach copy is ambiguous,
- dependencies are blocked (missing approvals/data), or
- confidence is too low for safe human handoff.

Escalation protocol:

1. Keep the item in **Team handoff queue** scope.
2. Add concise blocker notes (what is missing + what decision is needed).
3. Route it for AI prep refinement (brief improvement), then re-queue for human execution.
4. Resume only when the AI-prepared brief is complete and actionable.

## 4) Done criteria for onboarding

A new team member is onboarded when they can:

- start from `/` without assistance,
- run the daily queue-first routine,
- execute human-to-human handoff from AI-prepared briefs, and
- escalate unclear items back into the AI-prepared queue path correctly.
