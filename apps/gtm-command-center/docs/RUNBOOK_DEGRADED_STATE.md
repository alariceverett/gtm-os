# Runbook: Diagnose Degraded State (GTM Command Center)

Use this when `/health` returns `503` or dashboard health shows `degraded`.

## 1) Quick triage

```bash
cd apps/gtm-command-center
curl -s -i http://localhost:1981/health
curl -s http://localhost:1981/api/metrics/snapshot | jq
```

Look at:
- `checks.database.ok`
- `checks.service_logs.ok`
- `checks.work_queue_file.ok`
- `checks.alert_rules_file.ok`
- `freshness.kpi_age_seconds`
- `worker.target` vs `worker.current`

## 2) Common failure patterns

### A) Database unhealthy
Symptoms:
- `/health` includes `checks.database.ok = false`
- API routes may return 500 with datastore errors

Actions:
1. Verify env is loaded:
   ```bash
   cat .env
   ```
2. Confirm runtime mode from health payload (`runtime_mode`).
3. If `pg` mode, test DB:
   ```bash
   psql "$DATABASE_URL" -c "select 1;"
   ```
4. If `supabase` mode, verify `SUPABASE_URL` and key values are set and non-empty.
5. Restart service after env fixes.

### B) Service logs missing
Symptoms:
- `checks.service_logs.ok = false`

Actions:
1. Ensure `.run/` exists and process can write logs.
2. Restart launchd service:
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.adzeta.gtm-command-center
   ```
3. Re-check:
   ```bash
   ls -l .run/service.out.log .run/service.err.log
   ```

### C) Work queue file unreadable
Symptoms:
- `checks.work_queue_file.ok = false`

Actions:
1. Confirm path in env (`WORK_QUEUE_FILE`) or default `../../org/WORK_QUEUE.md`.
2. Verify file permissions and existence.

### D) Metrics stale
Symptoms:
- `freshness.status = "stale"`
- High `freshness.kpi_age_seconds`

Actions:
1. Request fresh snapshot:
   ```bash
   curl -s "http://localhost:1981/metrics?log=1" | jq
   ```
2. Check service output log for `[metrics]` line.
3. If still stale, inspect DB latency/errors and app logs.

### E) Worker mismatch (target vs current)
Symptoms:
- `worker.current` consistently below `worker.target`

Actions:
1. Confirm task backlog in `task_counts` (`todo` and `blocked`).
2. Set env if needed:
   - `OPERATOR_WORKER_TARGET` (or `WORKER_TARGET`)
   - `OPERATOR_WORKER_CURRENT` (or `WORKER_CURRENT`) if externally managed
3. Restart service.

## 3) Manual metrics logging

Generate a one-shot metrics line in logs:

```bash
curl -X POST http://localhost:1981/api/metrics/log
```

Expected marker in `.run/service.out.log`:

```text
[metrics] { ...json snapshot... }
```

## 4) Recovery verification

After remediation:

```bash
curl -s -i http://localhost:1981/health
curl -s http://localhost:1981/api/metrics/snapshot | jq
```

Healthy target state:
- HTTP 200 from `/health`
- `overall = connected`
- `checks.*.ok = true`
- Freshness no longer stale for active operation windows
