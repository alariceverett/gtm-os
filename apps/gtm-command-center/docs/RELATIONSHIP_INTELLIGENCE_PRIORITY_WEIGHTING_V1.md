# Relationship Intelligence Priority Weighting v1

**Verification marker:** `relationship-intelligence-priority-weighting-v1`

This v1 model blends system signal strength with explicit operator override state to determine recommendation priority and escalation path.

## Weighting formula

- `signal_score` (0-100) = `0.45 * relationship_health + 0.35 * pilot_readiness + 0.20 * momentum_risk`
- `operator_override_score` (0-100)
  - 85 if override task is completed
  - 55 if override task is in todo/in_progress
  - 20 otherwise
  - +10 if account has assigned owner (capped at 100)
- `weighted_priority_score` = `0.75 * signal_score + 0.25 * operator_override_score`

## Threshold table (v1, ratified)

| Escalation path | Weighted priority threshold | Signal threshold | Operator override threshold | Outcome |
|---|---:|---:|---:|---|
| `auto_escalate` | `>= 74` | `>= 70` | `>= 50` | Auto-route to top execution lane now |
| `manual_review` | `>= 58` | `>= 52` | n/a | Keep in review queue for operator confirmation |
| `monitor` | `< 58` (or signal `< 52`) | `< 52` | n/a | Monitor and re-score next cycle |

## Output fields added to recommendation payload

- `weighted_priority_score`
- `signal_score`
- `operator_override_score`
- `escalation_path` (`auto_escalate` \| `manual_review` \| `monitor`)
- `escalation_reason`
- `thresholds_applied`
- `owner`
- `next_action`
- `handoff_path`:
  - `queue` (`execution_queue`)
  - `route` (`/actions?source=relationship-intelligence`)
  - `note` (human-readable execution handoff guidance)

## Ratified implementation source of truth

- App constant: `RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1` in `server.mjs`
- Model id: `relationship-intelligence-priority-weighting-v1`
- Ratified date: `2026-02-22`
- Policy: `signal-primary-with-human-override-guardrail`

## UI changes

Recommendations table and cards now include:

- Confidence + weighted score label
- Score breakdown column (`W`, `S`, `O`)
- Escalation path column
- Reason text for escalation decision (threshold-aware)
- Owner column
- Next action column
- Handoff path column (direct link to execution queue)
- Card-level required fields: rationale, owner, next action, confidence

## Verification markers

- `relationship-intelligence-priority-weighting-v1`
- `relationship-intelligence-handoff-path-v1`
- `relationship-recommendation-required-fields-v1`
- `relationship-intelligence-handoff-verify-v1` (verification script output)
