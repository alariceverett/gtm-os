# Quality Improvement Chain (Required)

## Goal
Ensure every completed build task flows through all quality-improvement steps before considered truly complete.

## Required chain for each completed run
1. **Result intake** — capture completion/failure and key outputs.
2. **Queue update** — set DONE/FAILED state and next action.
3. **Quality check** — run verification checklist (tests/smoke/health markers).
4. **Upstream feedback check** — if systemic gap discovered, log to Forge same session.
5. **Operator update** — push status batch: Done / Failed / Active / Next.
6. **Autopull refill** — ensure active workers are restored to target floor.

## Compliance tags
- `QCHAIN_OK`: all 6 steps completed
- `QCHAIN_GAP`: one or more steps missed (must open corrective task immediately)

## SLA
- Complete chain within 10 minutes of run completion.

## Failure handling
If chain not completed in SLA:
- create blocker task in queue
- mark `QCHAIN_GAP`
- notify operator with exact missing step(s)
