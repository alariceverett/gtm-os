# Upstream Freshness Guard

Purpose: prevent long-running execution from drifting without Forge-upstream updates.

## Rule
During active execution, the latest Forge upstream touchpoint must be **younger than 60 minutes**.

## Enforcement
Run:

```bash
scripts/check_upstream_freshness.py
```

Recommended checkpoints:
- start of an active work block
- each heartbeat during active execution
- before marking major task milestones complete

The script reads:
- `org/WORK_QUEUE.md` to infer whether execution is active
- `org/feedback/UPSTREAM_CADENCE_LOG.md` for latest touchpoint timestamp

## Checklist note
- [ ] Upstream issue opened/updated/commented in this work block
- [ ] New ISO-8601 entry appended to `org/feedback/UPSTREAM_CADENCE_LOG.md`
- [ ] `scripts/check_upstream_freshness.py` returns PASS

## Remediation when stale
1. Perform an upstream touchpoint now (open/update/comment with concrete status).
2. Append log entry with timestamp, issue reference, action, and short note.
3. Re-run `scripts/check_upstream_freshness.py` until PASS.
4. If blocked by network/service outage, set local status `UPSTREAM_PENDING` + retry time.
