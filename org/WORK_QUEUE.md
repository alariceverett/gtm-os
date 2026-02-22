# WORK_QUEUE.md

_Last updated: 2026-02-22 09:10 ET_

## NOW (active)

0. **AdZeta — 48-hour evidence mode (controlled sprint)**
   - Owner: Orchestrator + swarm lanes
   - Output: KPI-linked deliveries only, proof-first updates, no scope drift
   - Status: IN PROGRESS
   - KPI scoreboard: qualified accounts, positive replies/meetings, pilot conversion, time-to-next-human-action


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

1. **AdZeta — data contract + event schema pass**
   - Output: minimal schema list for first dashboard/reporting loop
   - Status: DONE (awaiting result extraction)

2. **AdZeta — GitHub setup baseline**
   - Output: repo wiring check, branch/PR guardrail recommendation, CI readiness checklist
   - Status: DONE (run a7b5694e, awaiting result extraction)

3. **AdZeta — Vercel setup baseline**
   - Output: project link plan, env mapping checklist, firstt-deploy runbook
   - Status: DONE (run a318df60, awaiting result extraction)

4. **Restaurant app — first production candidate slice**
   - Output: one user-visible flow with test checklist
   - Status: QUEUED

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
