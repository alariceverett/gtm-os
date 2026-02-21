# Next Steps Plan (Checks & Balances)

## Scope lock (current)
- Product: Restaurant group-booking app (NYC)
- Core flows only:
  1) request intake
  2) shortlist generation
  3) booking path execution (platform/manual)
  4) large-party outreach + follow-up
  5) status tracking dashboard

## Checks before task start
1. Is this in scope? (restaurant app only)
2. Is there a clear acceptance test?
3. Is owner + fallback owner assigned?
4. Is sensitive/private data handling defined?

## Checks before merge/deploy
1. Build passes locally
2. Staging deploy succeeds
3. verify-deploy checks pass
4. No secrets in repo/audit clean
5. Release note added (what changed + operator impact)

## 48-hour assignments
- A) Intake + shortlist service (in progress)
- B) Booking-path tracker tables + API endpoints (in progress)
- C) Outreach template engine + follow-up scheduler (queued)

## Report format (required)
- Completed
- Blocked
- Next 3 actions
- Risks (if any)
