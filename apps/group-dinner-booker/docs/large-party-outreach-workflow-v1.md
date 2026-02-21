# Large-Party Outreach Workflow (v1)

This document defines the reusable outreach workflow for parties that are too large/complex for instant booking.

## Goal

Move each restaurant candidate from `outreach_pending` to either `confirmed` or `closed_lost` with:
- clear outbound messaging,
- explicit follow-up timing,
- lightweight qualification,
- and measurable tracking fields.

## Entry Criteria

Use the outreach workflow when one or more are true:
- Party size is 8+ and no instant inventory is shown
- Restaurant indicates private dining / set menu inquiry required
- Organizer needs custom timing, buyout, or budget negotiation

## Workflow Stages

1. **Prepare**
   - Confirm event requirements (date, time window, headcount range, budget, dietary/accessibility)
   - Select messaging variant (formal, concise, warm)
   - Assign owner and set first follow-up due date (T+48h)

2. **Send Initial Outreach**
   - Channel: email first, contact form fallback if no direct email
   - Record message in `outreach_messages` with template variant metadata
   - Candidate status: `outreach_sent` -> `awaiting_response`

3. **Triage Response**
   - Positive (has options) -> `negotiating`
   - Need more info -> remain `awaiting_response` and reply same day
   - No availability / policy mismatch -> `declined` or `closed_lost`

4. **Negotiate + Confirm**
   - Track quoted terms (minimum spend, deposit, pre-fixe constraints, cancellation)
   - If accepted: set `confirmed`, write `event_confirmations` record

5. **Close-Out**
   - If no response after full cadence, mark `closed_lost` with reason
   - Keep notes structured for future restaurant ranking

## Follow-Up Cadence Policy

**Business-hour logic:** send follow-ups Tue–Fri, 10:00–17:00 local restaurant time.

- **Day 0 (Initial):** Send initial outreach
- **Day 2:** Follow-up #1 (polite bump + restate date/headcount)
- **Day 5:** Follow-up #2 (decision-oriented; ask for quick yes/no)
- **Day 9:** Final follow-up (close-the-loop; mention you will release inquiry)
- **Day 12:** If still no reply, set `closed_lost` reason = `no_response`

### Escalation Rules

- If event date is <= 14 days away, compress cadence to Day 0 / Day 1 / Day 3 / Day 5.
- If restaurant replies at any point, stop automated cadence and resume manual handling.
- Max outbound attempts per candidate in v1: **4** (initial + 3 follow-ups).

## Message Quality Guidelines

- Keep request scannable: date, time window, headcount, budget, dietary/accessibility in one paragraph.
- Include two fallback time options when possible.
- Ask direct closing question: "Do you have availability and terms for this group?"
- Avoid over-negotiating in first contact; collect terms first.

## Tracking Fields (Operational)

Use these fields in app state and analytics exports.

### Existing schema fields to use now

- `event_candidates.current_status`
- `event_candidates.follow_up_due_at`
- `event_candidates.last_activity_at`
- `outreach_messages.channel`
- `outreach_messages.subject`
- `outreach_messages.sent_or_received_at`
- `outreach_messages.structured_result`

### Structured fields inside `outreach_messages.structured_result` (v1)

```json
{
  "template_id": "email_formal_v1",
  "step": "initial|followup_1|followup_2|final",
  "response_outcome": "pending|needs_info|quoted|declined|no_response",
  "quoted_min_spend": 2000,
  "deposit_required": true,
  "deposit_amount": 500,
  "prix_fixe_required": true,
  "menu_notes": "3-course family style",
  "private_room": true,
  "buyout_option": false,
  "max_capacity": 24,
  "response_sla_hours": 48,
  "close_lost_reason": "no_response|too_expensive|no_availability|policy_mismatch"
}
```

## Success Metrics

Track weekly:
- Response rate within 72h
- Confirmation rate per 10 outreaches
- Median time from first outreach to confirmation
- Top closed-lost reasons
- Restaurant-level win rate for future ranking

## Related Assets

- `templates/outreach/email-templates-v1.md`
- `templates/outreach/contact-form-copy-v1.md`
- `templates/outreach/follow-up-cadence-v1.md`
- `templates/outreach/tracking-fields-v1.csv`
