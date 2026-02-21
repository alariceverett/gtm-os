# WORK_QUEUE.md

_Last updated: 2026-02-21 07:30 ET_

## NOW (active)

1. **AdZeta — GTM Command Center MVP slice definition**
   - Owner: Product lead subagent
   - Output: locked MVP scope + acceptance criteria + first 3 build tickets
   - Status: DONE (awaiting result extraction)

2. **AdZeta — data read path + first KPI query**
   - Owner: Ops/Build
   - Output: live DB connector + runnable KPI fetch script
   - Status: DONE

3. **AdZeta — KPI hierarchy + dashboard IA pass**
   - Owner: Product strategy subagent
   - Output: KPI tree, dashboard IA, metric specs, trigger actions, first 3 tickets
   - Status: DONE (run 4d47395e, awaiting result extraction)

4. **AdZeta — Operator setup task board UI (DB-backed)**
   - Owner: Build subagent
   - Output: `/setup` page to view/update `cc_operator_tasks`
   - Status: DONE (run 00ae3d51)

5. **AdZeta — Supabase client scaffold (key-ready)**
   - Owner: Build subagent
   - Output: env validation + client factories + docs
   - Status: DONE (run e26a8355, awaiting result extraction)

6. **AdZeta — daily/weekly operator briefing template**
   - Owner: Ops lead subagent
   - Output: templates + field schema
   - Status: DONE (run ee7ed406, awaiting result extraction)

7. **AdZeta — deployment verification checklist**
   - Owner: Release/Ops subagent
   - Output: pre/post deploy checks, rollback, escalation matrix
   - Status: DONE (run 952ee7f3, awaiting result extraction)

## NEXT (queued)

3. **AdZeta — data contract + event schema pass**
   - Output: minimal schema list for first dashboard/reporting loop
   - Status: DONE (awaiting result extraction)

4. **AdZeta — GitHub setup baseline**
   - Output: repo wiring check, branch/PR guardrail recommendation, CI readiness checklist
   - Status: DONE (run a7b5694e, awaiting result extraction)

5. **AdZeta — Vercel setup baseline**
   - Output: project link plan, env mapping checklist, first-deploy runbook
   - Status: DONE (run a318df60, awaiting result extraction)

6. **Restaurant app — first production candidate slice**
   - Output: one user-visible flow with test checklist
   - Status: QUEUED

## BLOCKED

- **Supabase key-dependent integration tasks**
  - Blocker: waiting on operator completion of secure env setup tasks (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and auth-mode decision.
  - Owner: user
  - ETA: pending user update in setup task board.

## Guardrails

- Operating model follows `org/OPERATING_CHARTER_V1.md` (operator mode: AI executes, user confirms goals/targets/control points).

- If this file is missing/empty, recreate it immediately from current goals before any non-urgent maintenance work.
- Empty queue is only valid if all objectives are complete or all items are explicitly blocked with owner + ETA.
- Completion-triggered pull: when any NOW item is marked DONE, immediately pull and delegate the next highest-priority unblocked item (heartbeat remains fallback/safety check).
