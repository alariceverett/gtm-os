# GTM KPI Hierarchy + Dashboard IA (Command Center)

## 1) Finalized KPI tree

- **North Star:** `weekly_qualified_pipeline_velocity`
  - Definition: speed at which qualified accounts are moved into active execution and completed work.

### L1 → L2

- **L1: execution_throughput**
  - `delegations_24h`
  - `completed_24h`
- **L1: queue_health**
  - `open_priorities`
  - `active_runs`

## 2) Dashboard IA mapped to KPI ownership

- **Home (`/`)**
  - Executive pulse and immediate human-action timing.
  - Shows outcome summaries and action timing, not canonical gate decisions.
- **Ops (`/ops`)**
  - Canonical KPI diagnostics, gate logic, metric dictionary, readiness, workflow completeness.
  - Source of truth for KPI go/no-go posture.
- **Relationships (`/relationships`)**
  - Pipeline progression and handoff intent (supporting KPI context).
- **Actions (`/actions`)**
  - Queue transitions and execution movement (supporting KPI context).
- **Comms (`/comms`)**
  - Thread-level workflow signals only (non-canonical KPI gate decisions).

## 3) Metric definitions (formula / grain / owner / cadence)

| KPI | Formula | Grain | Owner | Cadence |
|---|---|---|---|---|
| `delegations_24h` | `COUNT(cc_delegations.id) WHERE created_at >= now() - 24h` | Rolling 24h, global operator queue | Ops · execution owner | Hourly + daily review |
| `completed_24h` | `COUNT(cc_delegations.id) WHERE completed_at >= now() - 24h` | Rolling 24h, global operator queue | Ops · execution owner | Hourly + daily review |
| `open_priorities` | `COUNT(cc_priorities.id) WHERE status NOT IN ('done','completed','cancelled')` | Point-in-time snapshot, global priority board | Ops · queue manager | Continuous + standup review |
| `active_runs` | `COUNT(cc_process_runs.id) WHERE status IN ('running','in_progress','started')` | Point-in-time snapshot, orchestration layer | Ops automation owner | Real-time + hourly reliability check |

## 4) Live UI application

- Added **KPI hierarchy + dashboard IA map** panel in Ops:
  - URL anchor: `/ops#kpi-hierarchy-ia-panel`
  - Verify markers:
    - `kpi-tree-northstar-v1`
    - `dashboard-ia-kpi-map-v1`
- Upgraded metric dictionary schema in Ops:
  - includes formula, grain, owner, cadence fields
  - marker: `metric-definitions-formula-grain-owner-cadence-v1`
