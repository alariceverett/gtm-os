# Data Model — Group Dinner Booker (NYC) v1

## Overview

The model separates:
1. **Event planning context**
2. **Restaurant candidates**
3. **Booking attempts + outreach communications**
4. **Status timeline/audit trail**

## Core Entities

### 1) users
Represents organizer/co-organizers.

Key fields:
- `id` (uuid, pk)
- `email` (unique)
- `name`
- `created_at`

### 2) events
A group dinner planning object.

Key fields:
- `id` (uuid, pk)
- `owner_user_id` (fk users)
- `title`
- `event_date`
- `time_window_start`, `time_window_end`
- `min_party_size`, `max_party_size`
- `budget_band` (enum: `$, $$, $$$, $$$$`)
- `neighborhoods` (text[])
- `dietary_notes`
- `accessibility_notes`
- `status` (enum: `draft`, `active`, `confirmed`, `archived`)
- `created_at`, `updated_at`

### 3) restaurants
Canonical place record; can be reused across events.

Key fields:
- `id` (uuid, pk)
- `name`
- `neighborhood`
- `borough`
- `cuisine`
- `website_url`
- `resy_url`
- `opentable_url`
- `group_dining_email`
- `phone`
- `created_at`, `updated_at`

### 4) event_candidates
Join table for event-specific restaurant pursuit.

Key fields:
- `id` (uuid, pk)
- `event_id` (fk events)
- `restaurant_id` (fk restaurants)
- `current_status` (enum candidate_status)
- `priority_rank` (int)
- `source` (enum: `manual`, `referral`, `web`)
- `notes`
- `follow_up_due_at`
- `last_activity_at`
- `created_at`, `updated_at`

Constraint:
- Unique (`event_id`, `restaurant_id`)

### 5) reservation_attempts
Tracks platform booking checks and outcomes.

Key fields:
- `id` (uuid, pk)
- `event_candidate_id` (fk event_candidates)
- `platform` (enum: `resy`, `opentable`, `direct`, `other`)
- `attempted_at`
- `availability_result` (enum: `available`, `unavailable`, `waitlist`)
- `slot_time`
- `party_size`
- `confirmation_code`
- `notes`
- `created_by_user_id` (fk users)

### 6) outreach_messages
Outbound and inbound communications for large-party workflow.

Key fields:
- `id` (uuid, pk)
- `event_candidate_id` (fk event_candidates)
- `direction` (enum: `outbound`, `inbound`)
- `channel` (enum: `email`, `contact_form`, `phone`, `other`)
- `subject`
- `body`
- `sender_name`
- `recipient`
- `sent_or_received_at`
- `structured_result` (jsonb)
- `created_by_user_id` (fk users)

Example `structured_result` JSON:
```json
{
  "availability": "yes",
  "min_spend": 1200,
  "deposit_required": true,
  "private_room": false,
  "prix_fixe": true
}
```

### 7) status_history
Immutable timeline of candidate status changes.

Key fields:
- `id` (uuid, pk)
- `event_candidate_id` (fk event_candidates)
- `from_status` (enum candidate_status, nullable for initial)
- `to_status` (enum candidate_status)
- `changed_by_user_id` (fk users)
- `reason`
- `created_at`

### 8) event_confirmations
Final confirmed booking snapshot.

Key fields:
- `id` (uuid, pk)
- `event_id` (fk events, unique)
- `event_candidate_id` (fk event_candidates, unique)
- `confirmed_at`
- `final_headcount`
- `confirmed_time`
- `financial_terms` (jsonb)
- `contact_name`
- `contact_email`
- `contact_phone`
- `notes`

## Indexing Recommendations

- `event_candidates(event_id, current_status)`
- `event_candidates(follow_up_due_at)`
- `outreach_messages(event_candidate_id, sent_or_received_at desc)`
- `status_history(event_candidate_id, created_at desc)`
- `events(owner_user_id, event_date)`

## Integrity Rules

1. One confirmation per event (`event_confirmations.event_id` unique)
2. Candidate status must be in enum domain
3. `last_activity_at` auto-updates on attempts/messages/status changes
4. When event is confirmed, non-winning active candidates can be set to `closed_lost`
