# Monday Demo Checklist (Outreach → Nurture → Update)

Use this as a live run sheet during the operator demo.

## A) Pre-demo setup (2–3 min)

- [ ] Service is up: `http://localhost:1981/setup` loads
- [ ] Operator credentials available in shell env
- [ ] One valid `sequence_template_id` ready
- [ ] `jq` available for pretty JSON output

Quick checks:
```bash
curl -i http://localhost:1981/health
curl -s http://localhost:1981/api/command-center/kpis | jq '.generated_at'
```

---

## B) Outreach demo steps

### Click path
- [ ] Open **Funnels + Sequences** panel
- [ ] Show active templates and queue/active enrollments

### Command path (recommended)
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/sequences/enroll \
  -H 'content-type: application/json' \
  -d '{"sequence_template_id":"<template-id>","lead_key":"lead:acme:123"}' | jq
```

### Verify
- [ ] API returns enrollment action payload
- [ ] Queue/active counts reflect update in panel
- [ ] Mention marker: `sequence_enrollment_action_v1`

---

## C) Nurture demo steps

### Click path
- [ ] Open **Nurture trigger mapping** panel
- [ ] Highlight trigger rows (`no_reply_48h`, `meeting_complete`, `lead_magnet_download`)

### Command path (evaluate only)
```bash
curl -s -X POST http://localhost:1981/api/nurture/triggers/evaluate \
  -H 'content-type: application/json' \
  -d '{"trigger_key":"no_reply_48h","lead_key":"lead:acme:123","last_reply_at":"2026-02-19T15:00:00Z","apply":false}' | jq
```

### Optional apply path (authenticated write)
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/nurture/triggers/evaluate \
  -H 'content-type: application/json' \
  -d '{"trigger_key":"no_reply_48h","lead_key":"lead:acme:123","last_reply_at":"2026-02-19T15:00:00Z","apply":true}' | jq
```

### Verify
- [ ] Evaluation result returns mapped/unmapped decision
- [ ] If `apply:true`, enrollment/upsert confirms in response

---

## D) Update demo steps

### Command path (meeting ingestion)
```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/meeting-transcripts/ingest \
  -H 'content-type: application/json' \
  -d '{"client_name":"Acme","transcript_text":"Action: Send recap by Monday"}' | jq
```

### Click path
- [ ] Refresh UI
- [ ] Open **Meeting analysis & client updates** panel
- [ ] Advance one follow-up action (`pending -> in_progress -> done`)

### Verify
- [ ] New meeting entry visible
- [ ] Follow-up status transition succeeds
- [ ] Client update row progresses toward/into `due`

---

## E) Final confidence checks (30 sec)

```bash
curl -s http://localhost:1981/api/workflows/completeness | jq '.score, .verification_markers'
curl -s http://localhost:1981/api/readiness/monday | jq '.readiness_state'
```

- [ ] Call out verification markers in output:
  - `workflow-completeness-v1`
  - `monday-polish-v1`
  - `funnel-ops-polish-v1`
  - `funnel-enroll-feedback-v1`
  - `kpi-hierarchy-v2`

- [ ] Confirm Monday readiness state shown
