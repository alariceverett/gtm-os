# Monday Go/No-Go Checklist (AdZeta Command Center)

Use this before Monday launch decisions. Every gate is **PASS/FAIL**.

## Decision Rule

- **GO** = all P0 gates PASS.
- **NO-GO** = any P0 gate FAIL.
- P1/P2 can be tracked as follow-up actions, but do not override a P0 FAIL.

## P0 Gates (must pass)

| Gate ID | Gate | Pass condition | Fail condition | Signal source |
|---|---|---|---|---|
| `GATE-01` | Runtime connected | Command center runtime mode is `pg` or `supabase` | Runtime mode is `none` | `/api/readiness/monday` |
| `GATE-02` | Service logs present | Both `.run/service.out.log` and `.run/service.err.log` exist | Either log file missing | filesystem |
| `GATE-03` | Work queue not blocked | Blocked item count `< 3` | Blocked item count `>= 3` | `org/WORK_QUEUE.md` parser |
| `GATE-04` | Waiting-on-user bounded | Waiting-on-user count `< 3` | Waiting-on-user count `>= 3` | `org/WORK_QUEUE.md` parser |
| `GATE-05` | Backup artifact available | `.run/backups/latest/manifest.json` exists | Missing latest backup manifest | filesystem |
| `GATE-06` | Nightly summary generated | `.run/reports/nightly-summary-latest.md` exists | Missing nightly summary artifact | filesystem |
| `GATE-07` | Checklist artifact present | This file exists and is readable | Missing/unreadable checklist file | filesystem |

## P1 Advisory Gates (recommended)

| Gate ID | Gate | Pass condition |
|---|---|---|
| `ADV-01` | Alert rules loaded | `lib/alert-rules.json` exists and parses |
| `ADV-02` | Operator view live | `/operator-status` route renders without server error |

## Operator Sign-off

- Operator: ____________________
- Date/time: ____________________
- Decision: **GO / NO-GO**
- Notes: __________________________________________
