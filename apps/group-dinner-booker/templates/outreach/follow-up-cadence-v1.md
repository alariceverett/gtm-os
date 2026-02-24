# Follow-Up Cadence Policy (Large Party Outreach) — v1

## Objective

Maximize response rate without spamming restaurants.

## Standard cadence

1. **Initial outreach (Day 0)**
2. **Follow-up #1 (Day 2)**
3. **Follow-up #2 (Day 5)**
4. **Final follow-up (Day 9)**
5. **Close as no-response (Day 12)**

## Urgent-event cadence (event <= 14 days away)

1. Day 0 initial
2. Day 1 follow-up #1
3. Day 3 follow-up #2
4. Day 5 final
5. Day 6-7 close as no-response

## Send-time constraints

- Preferred window: Tue–Fri, 10:00–17:00 local restaurant time
- Avoid Monday morning backlog and weekend inbox gaps unless urgent

## Stop conditions

Stop the cadence immediately if:
- A substantive response arrives
- Candidate is marked `declined` / `closed_lost`
- Another candidate for the event is already confirmed

## State updates per step

- Initial send: `outreach_sent` -> `awaiting_response`
- Any positive response: `awaiting_response` -> `negotiating`
- Confirmed terms accepted: `negotiating` -> `confirmed`
- No response after final timeout: `awaiting_response` -> `closed_lost`

## Guardrails

- Maximum 4 outbound attempts per restaurant per event
- Keep each follow-up <= 90 words
- Always provide opt-out courtesy in final message tone
