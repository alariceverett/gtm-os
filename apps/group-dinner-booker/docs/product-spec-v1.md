# Product Spec — Group Dinner Booker (NYC) v1

## 1) Product Summary

Group Dinner Booker helps NYC organizers coordinate and secure group restaurant bookings. The app unifies two real-world booking paths:

- **Path A: Reservation Platform** — user books through a public reservation platform and records result.
- **Path B: Large-Party Outreach** — user sends structured outreach to restaurants when platform inventory is missing or group constraints require custom handling.

The app’s key value is **workflow continuity + status clarity** from shortlist to confirmed booking.

## 2) Target Users

### Primary Persona: Group Organizer
- Plans dinners for friends, birthdays, or team events
- Handles 6–20 guests
- Wants one source of truth for options, outreach, responses, and final booking

### Secondary Persona: Co-organizer
- Can review options, comment, and help with follow-ups
- Needs clear visibility without spreadsheet chaos

## 3) NYC Launch Constraints

- Geography: Manhattan, Brooklyn, Queens focus
- Dinner-centric time windows (5:30 PM–9:30 PM)
- Common large-party issues:
  - limited online availability for 8+
  - deposit/pre-fixe/private-room constraints
  - slow response on contact forms

## 4) Problem Statement

Organizers juggle reservation apps, browser tabs, notes, and email threads. They lose track of:
- which restaurants were tried,
- who was contacted,
- what constraints were confirmed,
- and current booking status.

## 5) v1 Goals

1. Capture group event requirements once
2. Track candidate restaurants and booking path per candidate
3. Support outreach templates and logging for large-party requests
4. Centralize status tracking across all candidates
5. Mark one final restaurant as confirmed with auditable timeline

## 6) Non-Goals (v1)

- No direct API integrations with Resy/OpenTable
- No automatic scraping of restaurant inventory
- No payment/deposit processing
- No guest polling or split-bill tooling

## 7) Core Features (MVP)

### A. Event Setup
- Create dinner event with:
  - title
  - date + preferred time window
  - party size range
  - neighborhoods
  - budget band
  - dietary/accessibility constraints

### B. Restaurant Pipeline Board
- Add restaurants manually (name, neighborhood, cuisine, source URL)
- Track each restaurant in explicit states:
  - `shortlisted`
  - `platform_checking`
  - `platform_booked`
  - `outreach_pending`
  - `outreach_sent`
  - `awaiting_response`
  - `negotiating`
  - `declined`
  - `confirmed`

### C. Reservation Platform Path
- Save reservation platform link (Resy/OpenTable/direct)
- Log attempt metadata:
  - attempted at
  - available/not available
  - notes (e.g., only 5:15pm available)
- Mark booked outcome and capture confirmation details

### D. Large-Party Outreach Path
- One-click generation of outreach email/message from event + restaurant details
- Save outbound message copy + timestamp + sender
- Track follow-up due dates
- Log inbound responses with structured fields:
  - availability result
  - min spend/deposit
  - private room availability
  - menu constraints

### E. Unified Status + Activity Timeline
- Per-event timeline of all booking actions
- “Needs attention” view:
  - overdue follow-ups
  - awaiting response > N days
  - no active candidates

### F. Finalization
- Mark one candidate as final confirmed restaurant
- Lock key details snapshot:
  - date/time
  - headcount
  - financial constraints (deposit/minimum)
  - contact person

## 8) Success Metrics (v1)

- Time to first outreach < 10 minutes from event creation
- ≥80% of events have complete status history
- ≥60% of 8+ person events include at least one outreach workflow
- Organizer self-reported confidence improvement (qualitative)

## 9) Functional Requirements

1. Users can create/edit/archive events
2. Users can add/edit/remove restaurant candidates
3. Each candidate must have exactly one current status
4. Candidate can move between platform and outreach paths with history retained
5. Outreach artifacts (message body, sent timestamp, follow-up date) are persisted
6. Timeline is immutable append-only audit feed for user actions
7. Exactly one `confirmed` candidate per event

## 10) Acceptance Criteria (MVP)

- Organizer can create an NYC dinner event in under 2 minutes
- Organizer can add 5 candidate restaurants and assign statuses
- Organizer can send/log outreach for at least 3 candidates
- Organizer can filter pipeline by “awaiting response” and “follow-up overdue”
- Organizer can mark final confirmation and view complete action history

## 11) Risks & Mitigations

- **Risk:** Users expect direct platform booking integration
  - **Mitigation:** Clear UI copy: “Log booking outcome here”
- **Risk:** Outreach logs become free-form chaos
  - **Mitigation:** Structured response capture fields + templates
- **Risk:** Too many statuses create confusion
  - **Mitigation:** pre-defined transitions and helper prompts
