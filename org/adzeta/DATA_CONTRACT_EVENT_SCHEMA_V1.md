# AdZeta — Minimal Data Contract + Event Schema (Evidence Mode v1)

_Last updated: 2026-02-22_

## Goal
Enable the first reporting loop for the 48-hour evidence sprint without credentials. This is a **schema contract** (names + required fields) that can be implemented in Supabase later.

## Core entities

### `accounts`
Required:
- `account_id` (string/uuid)
- `name` (string)
- `domain` (string)
- `segment` (string; e.g., smb/mid/ent)
- `icp_fit_score` (0–100)
- `intent_score` (0–100)
- `qualified_at` (timestamp, nullable)
- `qualified_by` (enum: ai|human)
- `qualification_evidence_ref` (string; ledger_id or URL)
- `created_at`, `updated_at`

### `people`
Required:
- `person_id`
- `account_id`
- `full_name`
- `title`
- `email` (nullable)
- `linkedin_url` (nullable)
- `reachable` (boolean)
- `created_at`, `updated_at`

### `touchpoints` (outbound + inbound)
Required:
- `touchpoint_id`
- `account_id`
- `person_id` (nullable)
- `channel` (email|linkedin|call|sms|other)
- `direction` (outbound|inbound)
- `touchpoint_type` (sent|reply|bounce|meeting_scheduled|meeting_held|pilot_proposed|pilot_started)
- `occurred_at` (timestamp)
- `actor_type` (ai|human|system)
- `message_ref` (string; provider id or permalink, nullable)
- `evidence_ref` (string; snippet/URL/ledger_id/calendar_id)

### `pilots`
Required:
- `pilot_id`
- `account_id`
- `status` (proposed|active|won|lost)
- `started_at` (nullable)
- `success_criteria` (text)
- `next_review_at` (nullable)
- `owner` (string)
- `evidence_ref` (string)

### `research_ledger_entries`
Required:
- `ledger_id`
- `account_id` (nullable)
- `person_id` (nullable)
- `hypothesis` (text)
- `evidence` (text)
- `source_url` (text, nullable)
- `confidence` (0–1)
- `recommended_action` (text)
- `status` (open|in_progress|done|archived)
- `created_at`

## Event stream (single table for reporting)

### `events`
All reporting can be derived from this table.

Required:
- `event_id`
- `event_type` (see taxonomy below)
- `occurred_at`
- `actor_type` (ai|human|system)
- `account_id` (nullable but preferred)
- `person_id` (nullable)
- `touchpoint_id` (nullable)
- `pilot_id` (nullable)
- `ledger_id` (nullable)
- `evidence_ref` (string; URL/id)
- `metadata` (json)

#### Event taxonomy (minimum viable)
Qualification:
- `account_researched`
- `account_qualified`

Outreach:
- `outreach_sent`
- `outreach_bounced`
- `reply_received`
- `reply_positive`
- `meeting_scheduled`
- `meeting_held`

Pilot:
- `pilot_proposed`
- `pilot_started`
- `pilot_won`
- `pilot_lost`

Operator actions (for TTNHA):
- `signal_created`
- `human_action_taken`

## KPI computation notes
- **Qualified accounts:** count of `event_type=account_qualified` (dedupe by `account_id`).
- **Positive replies/meetings:** count of `reply_positive` + `meeting_scheduled` events (dedupe by thread/message_ref if needed).
- **Pilot conversion:** count of `pilot_started` (or `pilot_won` depending on definition).
- **TTNHA:** compute delta from `signal_created` → next `human_action_taken` per thread/account; summarize median + p90.

## Proof-first requirements (must-haves)
- Every KPI increment event must include `evidence_ref`.
- For any derived number shown in `/ops`, we must be able to link to at least one row in `events`.
