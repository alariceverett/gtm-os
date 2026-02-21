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
   - Status: IN PROGRESS (run 4d47395e)

## NEXT (queued)

3. **AdZeta — data contract + event schema pass**
   - Output: minimal schema list for first dashboard/reporting loop
   - Status: DONE (awaiting result extraction)

4. **Restaurant app — first production candidate slice**
   - Output: one user-visible flow with test checklist
   - Status: QUEUED

## BLOCKED

- _None currently documented._

## Guardrails

- If this file is missing/empty, recreate it immediately from current goals before any non-urgent maintenance work.
- Empty queue is only valid if all objectives are complete or all items are explicitly blocked with owner + ETA.
- Completion-triggered pull: when any NOW item is marked DONE, immediately pull and delegate the next highest-priority unblocked item (heartbeat remains fallback/safety check).
