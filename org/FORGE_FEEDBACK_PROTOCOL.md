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

## Quality bar
- No vague feedback. Include concrete reproduction and acceptance test.
- If local patch is applied, upstream communication is still mandatory.

## Reusable template
- Title: `[Field Gap] <short problem statement>`
- Sections: Problem / Expected / Impact / Proposed Fix / Acceptance Criteria
