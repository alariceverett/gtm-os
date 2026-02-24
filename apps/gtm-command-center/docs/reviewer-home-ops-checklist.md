# AdZeta Operator Review Checklist (Quick)

Use this from `/ops` as the embedded checklist card.

- Confirm latest review card is current (snapshot, quality score, blockers, next action).
- Enforce minimum-components rule (`docs/MIN_COMPONENTS_PER_VIEW_RULE.md`, marker `min-components-per-view-rule-v1`) for business-facing pages before approving UI changes.
- Run command smoke check: `curl -s http://127.0.0.1:1981/ops | grep -q "ops-review-checklist-card-v1"` then verify route health for Home, Targeting, Actions, Relationships, Pilot, and Ops.
- Check Operations board lanes for blocked work and clear owner assignment.
- Review Follow-ups/client updates and clear overdue items first.
- Validate reply routing and sequence queue diagnostics for handoff readiness.
- Scan alert rules and record escalation owner/ETA for active triggers.
- Confirm workflow completeness + Monday readiness have no failing gates.
- Log review outcome in Ops Reviews with one material change + one next action.

Full reviewer doc: `apps/gtm-command-center/docs/reviewer-home-ops-checklist-full.md`.
