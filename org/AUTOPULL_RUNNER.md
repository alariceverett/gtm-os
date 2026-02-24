# AUTOPULL_RUNNER.md

Always-on local runner to prevent zero-active-agent idle gaps.

## What it does

- Reads `org/WORK_QUEUE.md`
- Counts active subagent sessions (`openclaw sessions --active <minutes> --json`)
- Watches session-store updates for completion events and triggers immediate refill when active count drops
- Debounces completion-triggered refill (`event_refill_debounce_seconds`) to avoid thrash during bursty updates
- Falls back to heartbeat polling (`poll_seconds`) if event stream/watch is unavailable
- Computes effective target as `min(target_workers, session_cap)` (session cap inferred from config/env/workspace policy)
- If active workers are below effective target, picks the highest-priority unblocked task
- Attempts to spawn through Gateway method `sessions_spawn`
- Uses lock + cooldown idempotency to avoid double-spawn
- If spawn path is unavailable (e.g., pairing required), safely defers the spawn intent to `memory/autopull/deferred_spawns.json`
- Logs each decision to:
  - `memory/YYYY-MM-DD.md`
  - `memory/autopull/status.json`
- Detects reliability incident condition `active==0 && unblocked_work>0`
- Auto-opens incident as `AUTONOMY_GAP` (if outcome-metric gate failures exist) or `QCHAIN_GAP`
- Stores incident lifecycle + SLA (`time-to-refill`) under `memory/autopull/incidents.jsonl`
  - `memory/autopull/events.jsonl` (structured `refill_action` / `refill_miss` events)
- Status output includes: `current_active`, `target_workers`, `last_refill`, `last_miss`

## Files

- Runner: `scripts/autopull_runner.py`
- Config: `org/autopull.config.json`
- Runtime state: `memory/autopull/`
- Incident stream: `memory/autopull/incidents.jsonl`
- Current open incident (if any): `memory/autopull/open_incident.json`

## Start (foreground)

```bash
python3 scripts/autopull_runner.py
```

## One-cycle check

```bash
python3 scripts/autopull_runner.py --once
```

## Status

```bash
python3 scripts/autopull_runner.py --status
cat memory/autopull/status.json
```

## Always-on service (launchd, recommended)

Use the helper runbook wrapper:

```bash
scripts/autopull_service.sh install
scripts/autopull_service.sh start
scripts/autopull_service.sh status
scripts/autopull_service.sh restart
scripts/autopull_service.sh stop
```

What this gives you:
- automatic restart (`KeepAlive`)
- idempotent plist install/update
- one-command service lifecycle control
- visible logs + status output

Launchd assets:
- Template: `org/launchd/local.openclaw.autopull.plist`
- Installed: `~/Library/LaunchAgents/local.openclaw.autopull.plist`
- Logs: `memory/autopull/launchd.out.log`, `memory/autopull/launchd.err.log`

## Configure workers

Default floor is 4, and the runner enforces a hard minimum of 4 even if config/env sets lower. Change in `org/autopull.config.json`:

```json
{ "target_workers": 4 }
```

or set env override:

```bash
AUTOPULL_TARGET_WORKERS=4 python3 scripts/autopull_runner.py
```

## Monitor / restart runbook snippet

```bash
# quick health
scripts/autopull_service.sh status

# inspect recent decision loop output
python3 scripts/autopull_runner.py --status

tail -n 80 memory/autopull/launchd.out.log
tail -n 80 memory/autopull/launchd.err.log

# recover stuck/offline runner
scripts/autopull_service.sh restart
scripts/autopull_service.sh status
```
