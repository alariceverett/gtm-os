# System Failure Event Logging

Reliability incidents are recorded as **append-only JSON Lines** entries in:

- Default: `org/logs/system-failures.jsonl`
- Optional override: `--log-file memory/system-failures.jsonl`

Each entry includes the required fields:

- `timestamp`
- `failure_class`
- `detected_condition`
- `remediation_action`
- `status`

## Helper Script

Use `scripts/log_failure_event.sh` to write standardized entries.

### Example

```bash
scripts/log_failure_event.sh \
  --failure-class "service-outage" \
  --detected-condition "openclaw gateway health endpoint returned 503 for 2 minutes" \
  --remediation-action "restarted gateway and validated healthy response" \
  --status "resolved"
```

### Example with custom timestamp/log file

```bash
scripts/log_failure_event.sh \
  --timestamp "2026-02-21T13:45:00Z" \
  --failure-class "resource-exhaustion" \
  --detected-condition "memory usage exceeded 98%" \
  --remediation-action "restarted worker pool and reduced concurrency" \
  --status "mitigated" \
  --log-file "memory/system-failures.jsonl"
```

### Read recent incidents

```bash
tail -n 20 org/logs/system-failures.jsonl
```
