# Current-Cycle Material Proof Pack (Operator)

Timestamp: 2026-02-22 (EST)
Environment base: `http://127.0.0.1:1981` (also validated on `http://localhost:1981`)

## 1) Exact URLs (operator copy/paste)

1. `http://127.0.0.1:1981/ops#reviews`
2. `http://127.0.0.1:1981/ops/reviewer-checklist`
3. `http://127.0.0.1:1981/comms?view=account&tab=inbox`
4. `http://127.0.0.1:1981/comms?view=individual&tab=inbox`
5. `http://127.0.0.1:1981/research`
6. `http://127.0.0.1:1981/pilot`
7. `http://127.0.0.1:1981/health`
8. `http://127.0.0.1:1981/api/navigation/url-map`
9. `http://127.0.0.1:1981/api/comms/trade-show/captures`

Reference key URLs from latest proof marker (`trade-show-flow-proof-v3`):
- `http://localhost:1981/comms#trade-show-voice-memo-v1`
- `http://localhost:1981/api/comms/trade-show/captures`
- `http://localhost:1981/pilot`
- `http://localhost:1981/ops`
- `http://localhost:1981/ops/reviewer-checklist`

## 2) Visible changes (what operator should explicitly see)

### A. Comms split views + checklist copy surfaced
- Account and Individual inbox routes both render.
- Updated comms form labels + preview/save CTAs render (v2 clarity).
- Updated guardrail checklist copy is visible.
- Evidence: `apps/gtm-command-center/.run/evidence/tradeshow-e2e-2026-02-22-v3/VERIFICATION.json` (steps: `comms form v2 labels present`, `comms updated checklist copy present`).

### B. Ops review surface and full reviewer checklist route
- `/ops#reviews` shows current review card flow.
- `/ops/reviewer-checklist` renders full source-doc checklist page.
- Evidence: same verification file (steps: `ops review checklist card marker`, `ops reviewer checklist route renders`).

### C. Pilot progression coherence markers visible
- Pilot stage coherence marker present.
- Per-card progression recommendation marker present.
- Evidence: same verification file (steps: `pilot stage coherence marker`, `pilot progression recommendation marker`).

### D. Relationship quality movement changed for Zephyr account (material delta)
- Account: `Zephyr Botanics Expo V2` (`d1b9840a-bf93-4e24-863e-2372da08a728`)
- Before: health **47**, trend **flat** (`→ +0`), no events.
- After: health **57**, trend **upward** (`▲ +10`), rationale: `meeting_booked` human follow-through.
- Evidence:
  - Before: `apps/gtm-command-center/.run/evidence/tradeshow-e2e-2026-02-22-v2/02-intelligence-before.json`
  - After: `apps/gtm-command-center/.run/evidence/tradeshow-e2e-2026-02-22-v2/05-intelligence-after.json`

## 3) Quality trend state (current-cycle posture)

From `/ops/review_bursts.md`:
- Global quality trend state: **DOWN (guarded)**
- Active control: freeze net-new expansion, fix route-truth regression, require proof-pass before expansion.

Consolidation checks in same file:
- Golden-path replay: **GREEN** (`pass_count=15`, `fail_count=0`)
- Interaction debt check: **GREEN** (clicks `5`, context switches `3`, both budget-pass)
- KPI snapshot: **YELLOW** (delegations_24h=`0` ATTN; open_priorities and active_process_runs in GO bands)

Interpretation for operator:
- Quality posture remains guarded due trend control governance,
- while current cycle execution proofs for route flow and interaction budgets are passing.

## 4) 2-minute validation script (operator runbook)

### Step 0 (optional terminal precheck, ~15s)
```bash
cd apps/gtm-command-center
curl -sS http://127.0.0.1:1981/health | jq .
```
Expect: HTTP 200 and valid JSON.

### Step 1 (UI sweep, ~75s)
Open and visually confirm in order:
1. `/ops#reviews` → newest review card visible.
2. `/ops/reviewer-checklist` → full checklist page loads.
3. `/comms?view=account&tab=inbox` and `/comms?view=individual&tab=inbox` → both render and switch cleanly.
4. `/pilot` → recommendation markers visible on cards.

### Step 2 (API/material proof checks, ~30s)
```bash
curl -sS http://127.0.0.1:1981/api/comms/trade-show/captures | jq '.rows | length'
curl -sS http://127.0.0.1:1981/api/navigation/url-map | jq 'keys | length'
```
Expect: non-zero counts; no route errors.

### Step 3 (quality-state confirmation, ~15s)
- Confirm `/ops` references guarded quality posture and review bursts.
- Confirm latest proof marker is all-pass: `trade-show-flow-proof-v3` (`pass_count=10`, `fail_count=0`).

Pass/Fail decision:
- **PASS** if all routes render, checklist loads, API checks return non-error JSON, and proof marker remains all-pass.
- **FAIL** if any route error, checklist missing, or proof marker contains failures.
