# Smoke Pass — Comms → Actions → Relationships → Pilot

Date: 2026-02-22
Base URL: `http://localhost:1981`

## Result
- **Overall: PASS**
- Golden flow retest: **7/7 pass** (`npm run golden:retest`)
- Route progression checks: **5/5 pass**

## Evidence Table

| Check | Method | Evidence | Status |
|---|---|---|---|
| Preflight health | `npm run golden:retest` step | `status=200` | PASS |
| Targeting launch to Actions | `npm run golden:retest` step | `303` redirect to `/actions?...target-set-mlxsl3gh-48dx0n` | PASS |
| Actions tasks queued | `npm run golden:retest` step | `target_set_id=target-set-mlxsl3gh-48dx0n tasks=3` | PASS |
| Relationships row created | `npm run golden:retest` step | relationship row found for same target set | PASS |
| Competitive intel linked | `npm run golden:retest` step | `qaid=30412187-174d-47fb-b4cd-c00f60dc4ab2` + marker `competitive-intel-ingest-v1` | PASS |
| Promote to discovery | `npm run golden:retest` step | qualified account promoted to `discovery` | PASS |
| Promote to pilot_candidate | `npm run golden:retest` step | qualified account promoted to `pilot_candidate` | PASS |
| Comms account workspace route | `node fetch` check | `GET /comms?view=account&tab=inbox` `200`; page contains `Open /actions` | PASS |
| Comms individual workspace route | `node fetch` check | `GET /comms?view=individual&tab=inbox` `200`; page contains `Open /actions` | PASS |
| Actions handoff copy | `node fetch` check | `GET /actions` `200`; page contains `Continue to Relationships` | PASS |
| Relationships handoff copy | `node fetch` check | `GET /relationships` `200`; page contains `Continue to Pilot board` | PASS |
| Pilot route availability | `node fetch` check | `GET /pilot` `200`; page contains `Pilot` | PASS |

## Artifacts
- Golden matrix JSON: `.run/evidence/golden-flow-retest-2026-02-22/matrix.json`
- This summary: `.run/evidence/comms-actions-relationships-pilot-smoke-2026-02-22.md`

## Quick Fixes
- **None required** (no failures in this pass).
- Optional hardening improvement: extend `scripts/retest-golden-flow.mjs` with explicit comms route assertions so comms is always included in the automated matrix.