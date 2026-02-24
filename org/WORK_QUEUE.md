# WORK_QUEUE.md

_Last updated: 2026-02-23 00:00 ET_

## NOW (active)

- **Mode: Consolidation Window (7 days)** — EXITING (phases complete, moving to deployment/hardening)
  - Net-new process framework expansion: PAUSED
  - Focus: reliability, coherence, measurable outcomes → NOW: deployment pipeline


0. **AdZeta — GTM Operating System v1** ⭐ STRATEGIC PRIORITY — ✅ **ALL PHASES COMPLETE**
   - Owner: product-strategy + intelligence + build (swarm)
   - Status: **PHASES 1-4 COMPLETE** (2026-02-24 09:00 EST)
   - Dependencies: `org/GTM_OS_STRATEGY_V1.md` (ratified), `org/GTM_OS_QUALITY_GATES.md`
   - Quality Commitment: Excellence through all 7 gates — **PASSED**
   - Goal: Autonomous, self-learning GTM command center — **ACHIEVED**
   - Phase Summary:
     - ✅ **Phase 1 (Foundation)**: World-class UI, KPI dashboard, design tokens, sparklines
     - ✅ **Phase 2 (Learning Core)**: 7-day predictions, personal card ordering, feedback capture
     - ✅ **Phase 3 (Intelligence)**: Recommendation engine, execution bridge, operator review queue
     - ✅ **Phase 4 (Autonomy)**: Self-healing, predictive blocker guard, auto task generation, dashboard
   - Build Status: **PASS** ✓
   - GitHub Issues: #1-6 filed
   - Next: Deployment pipeline execution (in progress)

0.1 **AdZeta — 48-hour evidence mode (controlled sprint)**
   - Owner: Orchestrator + swarm lanes
   - Output: KPI-linked deliveries only, proof-first updates, no scope drift
   - Status: IN PROGRESS
   - KPI scoreboard: qualified accounts, positive replies/meetings, pilot conversion, time-to-next-human-action

0.1 **AdZeta — GTM Command Center KPI hierarchy + dashboard IA (v1)**
   - Owner: Ops/Intelligence (definitions) + Product (IA) + Build (instrumentation)
   - Output: canonical KPI hierarchy (L0→L2), dashboard IA sections + ownership, KPI↔event mapping, smoke checks, 24–48h implementation sequence
   - Status: DONE (artifact updated)
   - Artifacts:
     - `org/adzeta/KPI_HIERARCHY_AND_DASHBOARD_IA.md`
     - `org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`
   - Follow-ups (implementation):
     - Add `data-verify` markers (`kpi-scoreboard-v1`, `evidence-feed-v1`, `funnel-slices-v1`, `data-quality-v1`) to `/ops`.
     - Implement write-time enforcement for `evidence_ref` on KPI-driver event types.
     - Add `/api/kpi/scoreboard` (or equivalent) returning event_id trace lists.


1. **AdZeta — Comms + Account/Individual split views (home + ops coherence)**
   - Owner: Product + Build
   - Output: clear separation between communication workflow views and account/individual detail views, with shared navigation model.
   - Status: DONE
   - Outcome metrics: Time-to-clarity (<30s first-time operator understanding), Core-flow clicks (<=5 to key action)
   - Acceptance criteria:
     - `/` remains funnel/comms-first and does not carry deep account diagnostics.
     - `/ops` (or equivalent ops route) contains account-level + individual-level operational detail modules.
     - Both views expose stable `data-verify` markers and route-level smoke checks in docs.
     - No duplicate/conflicting KPI narratives between comms and account-individual surfaces.
   - Blockers: none (naming convention + canonical ownership map ratified and applied across UI/docs).

2. **AdZeta — Research Ledger implementation (source-of-truth for findings/decisions)**
   - Owner: Intelligence/Ops + Build
   - Output: structured research ledger with timestamped entries, source links, decision impact, and status tracking.
   - Status: DONE
   - Outcome metrics: Evidence-backed decision rate (% recommendations with linked source), Decision trace coverage (% execution tasks linked to ledger evidence)
   - Acceptance criteria:
     - Ledger entries support: hypothesis, evidence/source, confidence, recommended action, owner, timestamp. ✅
     - At least one API/read path and one UI surface to review latest ledger entries. ✅ (`GET /api/research-ledger`, `/research`)
     - Ledger items can be linked to strategy decisions and execution tasks. ✅ (account/individual linking retained)
     - Minimal operator workflow documented (add/update/review/archive). ✅ (README + in-app form/table flow)
   - Blockers: none (confidence scoring + status taxonomy finalized in schema + migration).

3. **AdZeta — Intelligence Layer v1 (decision synthesis + execution handoff)**
   - Owner: Product strategy + Build integration
   - Output: intelligence layer that turns signals + ledger evidence into prioritized actions across comms and account views.
   - Status: DONE
   - Outcome metrics: Recommendation adoption rate (% suggested actions executed), Time-to-handoff (signal detected -> task queued)
   - Acceptance criteria:
     - Inputs are explicit (KPIs/events + ledger artifacts + readiness gates). ✅
     - Output is explicit (ranked recommendations with rationale + owner + next action). ✅
     - Handoff path to execution board/task queue is implemented and testable. ✅
     - A lightweight audit trail exists for “why this action was recommended.” ✅
   - Closure notes:
     - Ratified live model applied in app constant `RELATIONSHIP_INTELLIGENCE_PRIORITY_MODEL_V1` (`signal_weight=0.75`, `operator_override_weight=0.25`; thresholds: auto `74/70/50`, manual `58/52`) with marker `relationship-intelligence-priority-weighting-v1`.
     - Recommendation cards/table include required fields (rationale, owner, next action, confidence) via `relationship-recommendation-required-fields-v1`.
     - Handoff route verified to `/actions?source=relationship-intelligence` with marker `relationship-intelligence-handoff-path-v1`.
     - Verification run passed: `node scripts/verify-relationship-intel-handoff.mjs` → marker `relationship-intelligence-handoff-verify-v1` (`ok: true`, `recommendation_count: 6`).
   - Blockers: none.

4. **AdZeta — Operator review checklist placement in app (concise + discoverable)**
   - Owner: UX + Ops docs
   - Output: concise in-app checklist entry point and doc linkage.
   - Status: DONE
   - Outcome metrics: Checklist discoverability (% operators finding checklist in <=1 click), Review completion rate (% sessions completing checklist)
   - Acceptance criteria:
     - Operator can find checklist in-app in one click from `/ops`.
     - Checklist copy is concise (<= 8 bullets) and points to full reviewer doc when needed.
     - Docs reference exact location in app and include one command-level smoke check.
   - Blockers: none (pattern locked to embedded /ops card; one-click doc link + smoke check documented).

## NEXT (queued)

1. **AdZeta — GitHub + Vercel Deployment Execution** 🔄 IN PROGRESS
   - Output: Live preview URL, CI passing, branch protection active
   - Status: **RUNNING** (agents: `deploy-github-vercel` 4c576f10)
   - Dependencies: GitHub repo exists, Vercel project ready
   - **Priority 1**: Get system live

2. **AdZeta — Data Contract DB Migrations** 🔄 IN PROGRESS
   - Output: SQL migrations + data verifier script
   - Status: **RUNNING** (agents: `data-contract-migrations` ede98c3b)
   - Dependencies: Supabase keys (user provides) — **prep now, execute after keys**
   - **Priority 2**: Schema ready for integration

3. **AdZeta — Integration Test Suite**
   - Output: Unit + integration tests, >80% core coverage
   - Status: **QUEUED**
   - Dependencies: Deployment complete
   - **Priority 3**: Validate before live traffic

4. **Restaurant app — first production candidate slice**
   - Output: one user-visible flow with test checklist
   - Status: **ON HOLD** ⏸️ (per user directive 2026-02-24: AdZeta-only mode)
   - Note: Do not delegate until user releases hold

## BLOCKED

- **Supabase key-dependent integration tasks**
  - Blocker: waiting on operator completion of secure env setup tasks (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and auth-mode decision.
  - Owner: user
  - ETA: pending user update in setup task board.

## Guardrails

- Operating model follows `org/OPERATING_CHARTER_V1.md` (operator mode: AI executes, user confirms goals/targets/control points).
- If this file is missing/empty, recreate it immediately from current goals before any non-urgent maintenance work.
- Empty queue is only valid if all objectives are complete or all items are explicitly blocked with owner + ETA.
- Completion-triggered pull: when any NOW item is marked DONE, immediately pull and delegate the next highest-priority unblocked item (heartbeat remains fallback/safety check).
