# User Flows — Group Dinner Booker (NYC) v1

## Flow 1: Create Event and Shortlist Restaurants

1. User clicks **New Group Dinner**
2. Enters event requirements (date, time window, party size, neighborhoods, budget, constraints)
3. System creates event in `draft` state
4. User adds restaurant candidates manually
5. Candidate default status = `shortlisted`

**Exit condition:** Event has at least 3 candidates

---

## Flow 2: Reservation Platform Path

1. From candidate card, user selects **Check reservation platforms**
2. User saves platform link(s) and checks availability externally
3. User logs outcome:
   - available (with slot)
   - unavailable
   - waitlist
4. If booked externally, user marks candidate `platform_booked`
5. User enters confirmation number + key booking notes
6. Optional: set as final `confirmed`

**Important:** v1 does not perform booking in-app; it tracks workflow and outcomes.

---

## Flow 3: Large-Party Outreach Path

1. From candidate card, user selects **Send large-party inquiry**
2. System pre-fills message template using event + candidate data
3. User edits message and sends via preferred channel (email/contact form/manual copy)
4. System logs outbound communication:
   - channel
   - recipient/contact endpoint
   - sent timestamp
   - message body snapshot
5. Candidate moves to `outreach_sent` then `awaiting_response`
6. System schedules follow-up due date (e.g., +48h)
7. User logs inbound response details
8. Candidate moves to one of:
   - `negotiating`
   - `declined`
   - `confirmed`

---

## Flow 4: Follow-up + Status Management

1. User opens **Needs Attention** view
2. Sees candidates where:
   - follow-up due date < now and still awaiting response
   - no updates in N days
3. User sends follow-up and logs message
4. Timeline appends all actions (no destructive overwrite)

---

## Flow 5: Final Confirmation

1. User picks a candidate and clicks **Confirm this restaurant**
2. System checks no other candidate is already confirmed for this event
3. System records final snapshot:
   - restaurant
   - final headcount
   - confirmed date/time
   - cost constraints
   - contact person
4. Event status becomes `confirmed`
5. Other active candidates auto-marked `closed_lost` or archived for reference

---

## State Model (Candidate)

Allowed statuses:
- `shortlisted`
- `platform_checking`
- `platform_booked`
- `outreach_pending`
- `outreach_sent`
- `awaiting_response`
- `negotiating`
- `declined`
- `confirmed`
- `closed_lost`

### Key Transition Rules

- `shortlisted` → `platform_checking` or `outreach_pending`
- `platform_checking` → `platform_booked` or `outreach_pending` or `declined`
- `outreach_pending` → `outreach_sent`
- `outreach_sent` → `awaiting_response`
- `awaiting_response` → `negotiating` or `declined` or `confirmed`
- `negotiating` → `confirmed` or `declined`
- Any non-final state → `closed_lost` if another candidate is confirmed
