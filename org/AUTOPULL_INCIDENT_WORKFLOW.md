# Autopull Incident Closure Workflow

## Trigger
Incident opens when:
- `active == 0`
- `unblocked_work > 0`

Incident type:
- `AUTONOMY_GAP` if outcome-metric gate found active NOW items without outcome metrics.
- Otherwise `QCHAIN_GAP`.

## Lifecycle states
1. `open` — incident created and logged.
2. `refilled` — runner spawned work and estimated active workers moved above zero.
3. `closed` — next cycle confirms active workers are non-zero and incident is closed.

## Storage
- Stream log (append-only): `memory/autopull/incidents.jsonl`
- Current open incident: `memory/autopull/open_incident.json`

## SLA metric
- `sla_time_to_refill_seconds`
- Computed as `refilled_at - opened_at`
- Emitted in `memory/autopull/status.json`

## Operational checks
```bash
python3 scripts/autopull_runner.py --status
cat memory/autopull/open_incident.json
tail -n 20 memory/autopull/incidents.jsonl
```
