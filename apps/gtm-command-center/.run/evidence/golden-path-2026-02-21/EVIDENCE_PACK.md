# Golden Path Evidence Pack (Operator-Ready)

Date: 2026-02-21/22 (EST)
Service: `http://localhost:1981`
Evidence dir: `.run/evidence/golden-path-2026-02-21/`

## Flow covered
`target prompt -> launch -> actions -> relationships -> pilot`

---

## 0) Launch / preflight (service + UI shell)

### Command
```bash
curl -s -i http://localhost:1981/health | head -n 10
```

### Sample response proof
`00-health.http` shows `HTTP/1.1 200 OK` and:
- `"local_service_status":"listening on :1981 (launchd-compatible)"`
- `"overall":"connected"`

### HTML marker proof
- Home HTML captured: `00-home.html`
- Ops HTML captured: `00-ops.html`
- Extracted marker files:
  - `markers-home.txt`
  - `markers-ops.txt`

Notable present markers:
- Home: `home-start-here-targeting-cta-v1 home-primary-cta-only-v1`, `home-ops-breadcrumbs-v2`, `v2-shell-nav`
- Ops: `reply-routing-panel-v1`, `acquisition-metrics-panel-v1`, `sequence-enrollment-ux-v1`, `workflow-completeness-v1`

---

## 1) Target prompt (reply signal)

### Command
```bash
curl -s -X POST http://localhost:1981/api/replies/classify \
  -H 'content-type: application/json' \
  -d '{
    "lead_key":"lead:acme:001",
    "reply_text":"Interested, can we review pilot scope this week?",
    "funnel_id":"founder-outreach-q1",
    "entry_point":"cold_email"
  }'
```

### Sample response proof (`03-reply-classify.json`)
- `"marker":"reply-routing-hook-v1"`
- `"classification":"positive"`
- `"next_action":"book_call"`
- `"routing":{"routed":true,"action":"enrolled", ...}`

---

## 2) Launch (qualified account intake + enrollment)

### 2a. Create qualified account
```bash
curl -s -X POST http://localhost:1981/api/qualified-accounts \
  -H 'content-type: application/json' \
  -d '{
    "brand":"Acme Beauty",
    "website":"https://acme.example",
    "est_spend_tier":"500k-2m",
    "channels":["meta","google"],
    "contact_role":"VP Marketing",
    "qualification_confidence":82,
    "pipeline_stage":"qualified",
    "spearman_score":0.72,
    "quintile_gap":14,
    "order_history_sufficiency":"sufficient"
  }'
```

Proof (`01-qualified-account-create.json`):
- `"marker":"qualified-account-intake-v1"`
- created `id`: `027f4e1f-e3f5-4686-bb4c-1216ebe18d27`

### 2b. Enroll into sequence
```bash
curl -s -X POST http://localhost:1981/api/qualified-accounts/027f4e1f-e3f5-4686-bb4c-1216ebe18d27/enroll \
  -H 'content-type: application/json' \
  -d '{"sequence_template_id":"a3973fac-094a-41ca-b8ba-4b97ef8d852c"}'
```

Proof (`02-enroll.json`):
- `"marker":"qualified-account-enroll-action-v1"`
- enrollment created with `status:"queued"`
- sequence slug/name from response: `tof-direct-offer-v1` / `TOF Direct Offer v1`

---

## 3) Actions (handoff + operator execution readiness)

### Handoff queue snapshot
```bash
curl -s http://localhost:1981/api/handoff-queue
```

Proof: `04-handoff-queue.json` (queue payload captured for operator actioning).

---

## 4) Relationships (account-linked competitive intel)

### Command
```bash
curl -s -X POST http://localhost:1981/api/competitive-intel \
  -H 'content-type: application/json' \
  -d '{
    "brand":"Acme Beauty",
    "signal":"offer_shift",
    "source":"https://example.com/press",
    "confidence":78,
    "strategic_note":"Mirror angle in outreach",
    "qualified_account_id":"027f4e1f-e3f5-4686-bb4c-1216ebe18d27"
  }'
```

### Sample response proof (`05-competitive-intel.json`)
- `"marker":"competitive-intel-ingest-v1"`
- `"linked_qualified_account_id":"027f4e1f-e3f5-4686-bb4c-1216ebe18d27"`

This confirms relationship linkage back to the qualified account.

---

## 5) Pilot (stage progression to pilot_candidate)

### Commands
```bash
curl -s -X POST http://localhost:1981/api/qualified-accounts/027f4e1f-e3f5-4686-bb4c-1216ebe18d27/promote \
  -H 'content-type: application/json' \
  -d '{"pipeline_stage":"discovery"}'

curl -s -X POST http://localhost:1981/api/qualified-accounts/027f4e1f-e3f5-4686-bb4c-1216ebe18d27/promote \
  -H 'content-type: application/json' \
  -d '{"pipeline_stage":"pilot_candidate"}'
```

### Sample response proof
- `06-promote-discovery.json`: `"marker":"pilot-handoff-promote-action-v1"` + `pipeline_stage:"discovery"`
- `07-promote-pilot-candidate.json`: `"marker":"pilot-handoff-promote-action-v1"` + `pipeline_stage:"pilot_candidate"`

---

## Additional artifacts captured
- `01-sequence-templates.json` (template inventory used for enroll)
- `08-acquisition-metrics.json` (post-flow metrics snapshot)
- `qualified_account_id.txt`
- `sequence_template_id.txt`

---

## Notes / gotchas observed
- `spearman_score` is required (0..1) for qualified-account intake in current build.
- `competitive-intel.signal` must be one of enum values (e.g., `offer_shift`).
- Browser screenshot capture via OpenClaw browser tool was blocked by local pairing requirement; HTML + `data-verify` marker capture is included as deterministic UI proof.