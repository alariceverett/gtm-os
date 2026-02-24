#!/usr/bin/env bash
set -euo pipefail

# Standardized reliability incident logger.
# Appends JSONL records to org/logs/system-failures.jsonl by default.

LOG_FILE="org/logs/system-failures.jsonl"
TIMESTAMP=""
FAILURE_CLASS=""
DETECTED_CONDITION=""
REMEDIATION_ACTION=""
STATUS=""

print_usage() {
  cat <<'EOF'
Usage:
  scripts/log_failure_event.sh \
    --failure-class "<class>" \
    --detected-condition "<what was observed>" \
    --remediation-action "<what was done>" \
    --status "<status>" \
    [--timestamp "<ISO8601 timestamp>"] \
    [--log-file "org/logs/system-failures.jsonl"]

Required fields:
  --failure-class
  --detected-condition
  --remediation-action
  --status

Optional:
  --timestamp  Explicit timestamp; defaults to current UTC timestamp.
  --log-file   Custom destination file (append-only write behavior).
  -h, --help   Show this help.

Examples:
  scripts/log_failure_event.sh \
    --failure-class "network" \
    --detected-condition "gateway health check timeout (3/3 failures)" \
    --remediation-action "restarted openclaw gateway service" \
    --status "resolved"

  scripts/log_failure_event.sh \
    --failure-class "filesystem" \
    --detected-condition "disk usage exceeded 95%" \
    --remediation-action "rotated and compressed old logs" \
    --status "mitigated" \
    --log-file "memory/system-failures.jsonl"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --failure-class)
      FAILURE_CLASS="${2:-}"
      shift 2
      ;;
    --detected-condition)
      DETECTED_CONDITION="${2:-}"
      shift 2
      ;;
    --remediation-action)
      REMEDIATION_ACTION="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --timestamp)
      TIMESTAMP="${2:-}"
      shift 2
      ;;
    --log-file)
      LOG_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage
      exit 1
      ;;
  esac
done

if [[ -z "$FAILURE_CLASS" || -z "$DETECTED_CONDITION" || -z "$REMEDIATION_ACTION" || -z "$STATUS" ]]; then
  echo "Error: missing required fields." >&2
  print_usage
  exit 1
fi

if [[ -z "$TIMESTAMP" ]]; then
  TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi

mkdir -p "$(dirname "$LOG_FILE")"

# Use Python for reliable JSON escaping.
RECORD="$(TIMESTAMP="$TIMESTAMP" \
FAILURE_CLASS="$FAILURE_CLASS" \
DETECTED_CONDITION="$DETECTED_CONDITION" \
REMEDIATION_ACTION="$REMEDIATION_ACTION" \
STATUS="$STATUS" \
python3 - <<'PY'
import json
import os

record = {
    "timestamp": os.environ["TIMESTAMP"],
    "failure_class": os.environ["FAILURE_CLASS"],
    "detected_condition": os.environ["DETECTED_CONDITION"],
    "remediation_action": os.environ["REMEDIATION_ACTION"],
    "status": os.environ["STATUS"],
}
print(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
PY
)"

printf '%s\n' "$RECORD" >> "$LOG_FILE"

echo "Logged failure event to $LOG_FILE"
