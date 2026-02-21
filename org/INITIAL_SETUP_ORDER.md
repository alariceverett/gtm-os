# Initial Setup Order (AdZeta-first)

## Objective
Get from zero to reliable execution with minimal rework.

## Order of operations

1. **Authority + priorities lock**
   - Set primary stream (AdZeta) and secondary stream.
   - Define escalation/approval boundaries.

2. **Queue system first (non-optional)**
   - Create `org/WORK_QUEUE.md` and `org/TASK_BACKLOG.md`.
   - Enforce queue-integrity guardrails (missing/empty queue is invalid unless COMPLETE/BLOCKED/REBUILDING).

3. **Event scheduler and autopull**
   - Completion-triggered dequeue/delegate.
   - Heartbeat remains fallback safety mechanism.

4. **Data plane setup (high priority)**
   - Confirm DB connectivity.
   - Define MVP data contract/event schema.
   - Wire first read path and KPI query.

5. **Product scaffold baseline**
   - Ensure non-empty app scaffold (package/scripts/src).
   - Add one working end-to-end slice before feature expansion.

6. **Instrumentation + quality gates**
   - Delivery metrics (completion->next-start latency, delegated/direct ratio).
   - Security checks and deployment verification checklist.

## Redundant-build callouts (should be in Forge baseline)

- Queue files/templates should be seeded automatically.
- Completion-triggered autopull should be first-class behavior.
- GTM app scaffold should include a default DB connector + KPI query starter.
- Priority profile (AdZeta-first mode) should be a configuration switch, not ad-hoc instruction.
