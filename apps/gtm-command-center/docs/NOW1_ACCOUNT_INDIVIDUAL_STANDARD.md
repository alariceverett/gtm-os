# NOW Item 1 — Account/Individual Naming + Module Ownership Standard

Status: **Accepted** (2026-02-22)

## 1) Canonical UI naming

Use these labels in operator-facing UI:
- **Account Workspace**
- **Individual Workspace**

Do not mix alternate split labels (for this route split) such as `account/individual switch`, `contact/person`, or ad-hoc variants in primary UI copy.

## 2) Canonical module ownership (overlap resolution)

- **`/comms`** owns message workflow context:
  - inbox/outbox navigation
  - account/individual thread context
  - attribution + next touch execution cues
- **`/ops`** owns operational diagnostics and source-of-truth KPI gate posture:
  - KPI hierarchy/gates
  - readiness/health/escalation posture
  - follow-up + client-update operational queues
- **`/actions`** owns execution queue transitions and completion behavior.
- **`/relationships`** owns stage progression and handoff intent.

## 3) Verification markers

- `account-individual-naming-standard-v1`
- `canonical-module-ownership-v1`
- `kpi-narrative-source-of-truth-v1`

## 4) Route-level verification quick checks

```bash
# /comms renders canonical workspace labels
curl -s http://127.0.0.1:1981/comms?view=account&tab=inbox | grep -E 'Account Workspace|Individual Workspace'

# /ops exposes ownership + KPI source-of-truth markers
curl -s http://127.0.0.1:1981/ops \
  | grep -o 'data-verify="[^"]*"' \
  | sort -u \
  | grep -E 'account-individual-naming-standard-v1|canonical-module-ownership-v1|kpi-narrative-source-of-truth-v1'
```
