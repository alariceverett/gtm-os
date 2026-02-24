# Forge Feedback Protocol (Always-On)

## Purpose
Ensure field learnings, drift, and missing scaffolding are consistently pushed upstream to Forge so improvements propagate across projects.

## Trigger conditions (any one triggers feedback)
1. A blocker repeats more than once.
2. A workaround exists that should be baseline behavior.
3. A process rule is ambiguous and required interpretation.
4. A bootstrap gap causes avoidable setup/rework.
5. A task required manual intervention that should be automated.

## Required action (same session)
1. **Classify**: bug / process gap / bootstrap gap / missing scaffold.
2. **Open or update Forge issue** with:
   - observed behavior
   - expected behavior
   - impact
   - proposed fix
   - acceptance criteria
3. **Link the issue** in local queue/log notes.
4. **Mark status**: `UPSTREAM_LOGGED` or `UPSTREAM_PENDING`.

## SLA
- Critical reliability/security gaps: immediately
- Workflow/process gaps: within the same working block (no later than next heartbeat)

## Freshness guard (active execution)
- **Rule:** while execution is active, a Forge upstream touchpoint must be refreshed at least every **<60 minutes**.
- **Enforcement:** run `scripts/check_upstream_freshness.py` (default threshold: 60m).
- **Evidence log:** append each touchpoint to `org/feedback/UPSTREAM_CADENCE_LOG.md` using ISO-8601 timestamps.

### Remediation when stale
If freshness check fails:
1. Open/update/comment on the active Forge upstream issue immediately.
2. Append a new entry in `org/feedback/UPSTREAM_CADENCE_LOG.md` with timestamp + issue reference.
3. Re-run `scripts/check_upstream_freshness.py` and proceed only after PASS.
4. If upstream is unavailable, mark local status `UPSTREAM_PENDING` with reason and retry target time in queue notes.

## Quality bar
- No vague feedback. Include concrete reproduction and acceptance test.
- If local patch is applied, upstream communication is still mandatory.

## Reusable template
- Title: `[Field Gap] <short problem statement>`
- Sections: Problem / Expected / Impact / Proposed Fix / Acceptance Criteria
