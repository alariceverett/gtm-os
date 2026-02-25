# Morning Proof Pack — Ops Review Center

Date: 2026-02-22 (EST morning)
Service base: `http://127.0.0.1:1981`
Review center entry: `/ops#reviews` (newest card)

## Canonical artifact source

Use existing captured run artifacts from:

- `.run/evidence/tradeshow-e2e-2026-02-22-v3/`

Key files:
- `08-ops.html`
- `09-ops-reviewer-checklist.html`
- `06-comms-account.html`
- `VERIFICATION.json`

## Exact URL checklist (operator copy/paste)

1. `http://127.0.0.1:1981/ops#reviews`
2. `http://127.0.0.1:1981/ops/reviewer-checklist`
3. `http://127.0.0.1:1981/comms?view=account&tab=inbox`
4. `http://127.0.0.1:1981/comms?view=individual&tab=inbox`
5. `http://127.0.0.1:1981/research`
6. `http://127.0.0.1:1981/health`
7. `http://127.0.0.1:1981/api/navigation/url-map`

## Pass criteria

- `/ops#reviews` shows newest morning proof-pack card pinned first.
- `/ops/reviewer-checklist` renders full checklist page.
- Comms account/individual views both load with split-workspace continuity.
- `/research` loads ledger surface without route error.
- `/health` returns HTTP 200 and JSON payload.
- `/api/navigation/url-map` returns URL map JSON for operator routing reference.
