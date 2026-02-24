# Weekend Sprint Runbook: Safe Parallel Worker Scaling (AdZeta)

## Purpose
Quick operating guide to increase/decrease subagent workers (1-5) safely during sprint execution.

## Preconditions
- Use local telemetry first (no external dependency).
- Confirm current critical path tasks in `org/WORK_QUEUE.md`.
- Run telemetry:

```bash
python3 scripts/throughput_telemetry.py --since-days 2
```

## Standard cadence (every ~20 min)
1. Capture telemetry snapshot.
2. Compute quick health view:
   - **fail ratio** = failed_or_retry / (done + failed_or_retry)
   - queue pressure = active_or_unknown
3. Apply policy from `org/adaptive-scaling-policy.yaml`.
4. Change worker count by **max 1 step** unless hard backoff event.
5. Log the decision in memory/work queue notes.

## Scale up safely
Increase workers by +1 (up to 5) only when all are true:
- fail ratio < 0.15
- queue pressure >= 6
- no clear runtime regression
- no rate-limit/timeouts trend

Suggested progression:
- Start at 2
- Move to 3 after one clean interval
- Move to 4 only after second clean interval
- Use 5 only for short burst with active monitoring

## Scale down safely
Decrease workers when any trigger appears:
- fail ratio 0.15-0.24 -> step down by 1
- fail ratio >= 0.25 -> step down by 2 (min 1)
- explicit rate-limit signal (429/throttle/timeout spike) -> immediate -2 and hold 40 min
- queue pressure <= 2 for two intervals -> step down by 1

## Incident mode (stabilization)
If failures spike or integration starts breaking:
1. Drop to 1-2 workers.
2. Prioritize fix-forward/integration path.
3. Hold step-ups until two clean intervals.
4. Resume gradual ramp (+1 per interval).

## Minimal command set
```bash
# human-readable snapshot
python3 scripts/throughput_telemetry.py --since-days 2

# machine-readable snapshot
python3 scripts/throughput_telemetry.py --since-days 2 --json

# optional stricter placeholder assumptions
python3 scripts/throughput_telemetry.py --since-days 2 --default-runtime-min 20 --tokens-per-run 3000
```

## Exit criteria for weekend burst
- fail ratio < 0.15 for 2+ consecutive intervals
- no active rate-limit signal
- queue pressure returning toward <= 2
- integration stream stable
