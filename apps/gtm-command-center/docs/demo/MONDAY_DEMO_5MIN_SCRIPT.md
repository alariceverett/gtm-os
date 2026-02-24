# Monday Demo: 5-Minute Operator Walkthrough Script

Audience: operators + stakeholders

Goal: show an end-to-end lifecycle in Command Center: **outreach → nurture → update**.

---

## 0:00–0:30 — Open + framing

**Say:**
“Today I’ll show how one lead moves through our GTM Command Center lifecycle from outreach, into nurture automation, and into client update readiness.”

**Do:**
1. Open `http://localhost:1981/setup`.
2. Point to panels: KPI/lifecycle, funnels + sequences, nurture trigger mapping, meeting analysis/client updates.

---

## 0:30–1:45 — Outreach (enroll lead in sequence)

**Say:**
“First, we put a lead into structured outreach using sequence enrollment.”

**Do (UI):**
1. In **Funnels + Sequences**, show active sequence templates and queue.
2. Call out that enrollments appear as queued/active and feed the operator board.

**Do (terminal backup/verification):**
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/sequences/enroll \
  -H 'content-type: application/json' \
  -d '{"sequence_template_id":"<template-id>","lead_key":"lead:acme:123"}'
```

**Say:**
“This creates a trackable enrollment action and logs lifecycle movement for operations.”

---

## 1:45–3:10 — Nurture (trigger evaluation + mapping)

**Say:**
“Next, nurture automation evaluates behavior-based triggers and maps them to follow-up sequences.”

**Do:**
1. In **Nurture trigger mapping**, show mapped vs unmapped rows.
2. Call out trigger examples: `no_reply_48h`, `meeting_complete`, `lead_magnet_download`.

**Do (terminal verification):**
```bash
curl -s -X POST http://localhost:1981/api/nurture/triggers/evaluate \
  -H 'content-type: application/json' \
  -d '{"trigger_key":"no_reply_48h","lead_key":"lead:acme:123","last_reply_at":"2026-02-19T15:00:00Z","apply":false}' | jq
```

(Optional apply write path):
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/nurture/triggers/evaluate \
  -H 'content-type: application/json' \
  -d '{"trigger_key":"no_reply_48h","lead_key":"lead:acme:123","last_reply_at":"2026-02-19T15:00:00Z","apply":true}' | jq
```

**Say:**
“Evaluate-only lets us preview decisions. Apply mode commits an enrollment path when operator-authenticated.”

---

## 3:10–4:35 — Update (meeting ingestion + follow-up progression)

**Say:**
“After outreach/nurture activity, we ingest meeting notes and track follow-ups to drive client updates from draft to due.”

**Do (terminal):**
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/meeting-transcripts/ingest \
  -H 'content-type: application/json' \
  -d '{"client_name":"Acme","transcript_text":"Action: Send recap by Monday"}'
```

2. Refresh Command Center; point to **Meeting analysis & client updates** panel.
3. Advance one follow-up (`pending -> in_progress -> done`) via panel action.

**Say:**
“When open actions clear, linked client updates move from draft to due, so operator handoff is visible and actionable.”

---

## 4:35–5:00 — Close + operational confidence

**Do (quick health/readiness checks):**
```bash
curl -s http://localhost:1981/api/workflows/completeness | jq '.score, .verification_markers'
curl -s http://localhost:1981/api/readiness/monday | jq '.readiness_state, .gates'
```

**Say:**
“This is the complete operator loop: enroll outreach, evaluate/apply nurture triggers, process meeting follow-ups, and surface readiness markers for Monday go/no-go.”
