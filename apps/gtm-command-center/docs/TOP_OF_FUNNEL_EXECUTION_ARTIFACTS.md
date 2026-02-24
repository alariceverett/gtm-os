# Top-of-Funnel Execution Artifacts (Build Plan Delivery)

This document captures the execution artifacts wired into Command Center for top-of-funnel operations.

## 1) Target-account schema + rubric

- API: `GET /api/target-accounts/schema`
- UI: Ops → **Target-account rubric** panel
- Source constant: `TARGET_ACCOUNT_RUBRIC` in `server.mjs`

Schema includes:
- Account firmographics: segment, employee/revenue band
- Channel + intent signal
- Decision-maker role
- Urgency + fit score

Rubric scoring axes:
- ICP fit (40)
- Intent strength (35)
- Reachability (25)

Routing thresholds:
- Enroll now: `>= 75`
- Nurture: `>= 55`
- Disqualify: `< 55`

## 2) Sequence variants (3) with CTA + cadence

- Seeded variants (script):
  - `tof-direct-offer-v1`
  - `tof-proof-first-v1`
  - `tof-pain-point-v1`
- UI: Ops → **Sequence templates** now surfaces variant, cadence, and CTA per template/step
- API data: `GET /api/sequence-templates`

## 3) Reply classification + next-action routing hooks

- API: `POST /api/replies/classify`
- Hook behavior:
  - classifies inbound text (`positive`, `objection`, `neutral`, `not_now`, `unsubscribe`)
  - maps to `next_action`
  - attempts sequence enrollment for routable classes
  - logs `reply_classified` activity in `cc_activity_log`

Example payload:

```json
{
  "lead_key": "lead:acme:001",
  "reply_text": "Interested, can we chat this week?",
  "funnel_id": "founder-outreach-q1",
  "entry_point": "cold_email"
}
```

## 4) Acquisition metrics panel tied to funnel entry

- API: `GET /api/acquisition/metrics`
- UI: Home + Ops → **Acquisition by funnel entry** panel
- Aggregates:
  - enrollments by `metadata.funnel_id` / `metadata.entry_point`
  - reply classifications by same keys (from `cc_activity_log.details`)
  - positive reply count

This gives a direct view from funnel entry → enrollment volume → reply quality.
