# GTM Command Center (Local-first Operator Dashboard)

Local-first command center for operator workflows on `:1981`.

## Environment setup

Copy `.env.example` to `.env` and set **one** of these:

### Option A: Direct Postgres (fallback)

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Option B: Supabase-first

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

> Never commit real keys. Keep only placeholders in git.

## Local auth + RBAC baseline (operator/admin)

This service now includes a **local-first write guard**. All write actions (`POST`, `PATCH`, `DELETE`) are protected by HTTP Basic auth and a minimal role model.

### Roles

- `operator`: can run normal operator write actions (advance tasks/followups, create/update funnels, assets, sequences, ingest notes)
- `admin`: includes all operator permissions and required for destructive routes (currently `DELETE /api/funnels/:id`)

### Required env config

```bash
CC_AUTH_ENABLED=true
CC_OPERATOR_USERNAME=operator
CC_OPERATOR_PASSWORD=<strong-unique-password>
CC_ADMIN_USERNAME=admin
CC_ADMIN_PASSWORD=<strong-unique-password>
```

Use different strong passwords for operator vs admin.

### Calling write APIs

```bash
# operator-level write
curl -u operator:YOUR_OPERATOR_PASSWORD -X POST http://localhost:1981/api/sequence-templates \
  -H 'content-type: application/json' \
  -d '{"name":"Lifecycle Followup"}'

# admin-only destructive write
curl -u admin:YOUR_ADMIN_PASSWORD -X DELETE http://localhost:1981/api/funnels/<id>
```

### Secure defaults and limitations

- **Default is secure**: `CC_AUTH_ENABLED` defaults to `true` when unset.
- If creds are missing or invalid, write actions return `401` with a Basic auth challenge.
- This is intentionally a **local placeholder**, not full identity management:
  - no SSO/OAuth/OIDC
  - no MFA
  - no per-user audit trail beyond shared role credentials
  - static credentials from env only (no rotation workflow)

### Upgrade path

Keep route-level guard calls (`guardWriteAccess(req, res, { minRole })`) and replace only the credential source/authn implementation later (e.g., OIDC/JWT/session provider). This preserves current authorization boundaries while upgrading identity.

## Runtime selection (Supabase vs direct PG)

At startup, runtime mode is resolved in `lib/supabase-env.mjs`:

- `supabase` when Supabase env is valid (URL + anon key; service role preferred server-side)
- `pg` when Supabase env is incomplete but `DATABASE_URL` exists
- `none` when neither is configured

`server.mjs` will read/write `public.cc_operator_tasks` using:

- `@supabase/supabase-js` in `supabase` mode
- `pg` in `pg` mode

## Supabase reporting view bridge (local-model compatibility)

Daily summary + weekly scorecard now include a mapping bridge layer (`lib/supabase-reporting-bridge.mjs`) that maps Supabase reporting-view rows into the existing local JSON model.

### Optional env keys (override defaults)

```bash
CC_SUPABASE_DAILY_KPI_VIEW=cc_reporting_daily_kpis_v1
CC_SUPABASE_DAILY_SEQUENCE_ACTIVITY_VIEW=cc_reporting_sequence_activity_v1
CC_SUPABASE_WEEKLY_DELIVERY_VIEW=cc_reporting_weekly_delivery_v1
CC_SUPABASE_WEEKLY_CAC_VIEW=cc_reporting_weekly_cac_v1
CC_SUPABASE_WEEKLY_ROAS_VIEW=cc_reporting_weekly_roas_v1
CC_SUPABASE_WEEKLY_CONTROL_TEST_VIEW=cc_reporting_weekly_control_vs_test_v1
```

If these views do not exist yet, the app stays local-first and returns existing placeholder values instead of failing.

### Suggested migration steps

1. Create the reporting views in Supabase with columns expected by the bridge mapper:
   - daily KPI: `delegations_24h`, `completed_delegations_24h`, `open_priorities`, `active_process_runs`
   - daily sequence activity rows: `status`, `count`, optional recent event columns (`recent_event_id`, `recent_event_type`, `recent_event_lead_key`, `recent_event_created_at`)
   - weekly delivery: `delivery_events_7d`, `lead_magnets_live`, `teaser_products_live`, `delivery_score`
   - weekly CAC: `spend_7d`, `conversions_7d`, `cac_7d`
   - weekly ROAS: `proxy_7d_roas`, `actual_d60_roas`, `actual_field`
   - weekly control/test: `control_roas_7d`, `test_roas_7d`, `d60_lift_pct_vs_control`, `split_field`
2. Grant select permissions (or expose through RLS-safe policies) for the service role path used by server exports.
3. Keep defaults or point env keys to your exact view names.
4. Run:
   - `npm run daily:summary`
   - `npm run weekly:scorecard`
5. Confirm report JSON outputs no longer show `supabase mode (placeholder)` source labels.

## Client factories

- Server factory: `lib/supabase-clients.mjs#createServerSupabaseClient()`
  - Uses service role key when present, otherwise anon key.
- Browser-safe factory pattern: `lib/supabase-clients.mjs#createBrowserSupabaseClient()`
  - Accepts only `url` + `anonKey` and never requires/uses service role key.

## Apply + verify schema migrations locally (P0)

Migrations are now versioned and ordered in:

- `apps/gtm-command-center/scripts/migrations/0001_*.sql`
- `apps/gtm-command-center/scripts/migrations/0002_*.sql`
- `apps/gtm-command-center/scripts/migrations/0003_*.sql`
- `apps/gtm-command-center/scripts/migrations/0004_*.sql`

The runner tracks applied versions in `public.schema_migrations` with checksums.

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run schema:migrate
```

Verify migration state without applying new SQL:

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run schema:verify
```

Verify migration files still match current source schema scripts (`org/sql/*.sql`) and check for destructive patterns:

```bash
cd apps/gtm-command-center
npm run schema:verify:sources
```

`schema:integrate` remains available and now delegates to the same versioned migration runner.

## P0 backup + safe restore drill (local-first)

These scripts are **non-destructive by default**:
- backup exports from `public.*` core GTM tables
- restore writes into `gtm_restore_test` schema with `_restore_test` table suffix

### 1) Create timestamped backup artifacts

```bash
cd apps/gtm-command-center
set -a && source .env && set +a
npm run backup:gtm
```

Artifacts are created under:
- `.run/backups/gtm-core-<UTC_TIMESTAMP>/manifest.json`
- `.run/backups/gtm-core-<UTC_TIMESTAMP>/<table>.ndjson`
- `.run/backups/gtm-core-<UTC_TIMESTAMP>/<table>.columns.json`
- `.run/backups/latest` (symlink to latest backup)

### 2) Restore safely into test namespace/suffix mode

```bash
cd apps/gtm-command-center
set -a && source .env && set +a
npm run restore:gtm:safe -- .run/backups/latest
```

Optional target overrides:

```bash
TARGET_SCHEMA=gtm_restore_test TABLE_SUFFIX=_drill npm run restore:gtm:safe -- .run/backups/latest
```

### 3) Verify drill results

```bash
# backup manifest exists
ls -lh .run/backups/latest/manifest.json

# restored test tables exist (example)
psql "$DATABASE_URL" -c "select count(*) from gtm_restore_test.cc_funnels_restore_test;"
```

Safety notes:
- No DROP/DELETE against production GTM tables
- Restore path only touches `${TARGET_SCHEMA:-gtm_restore_test}.*${TABLE_SUFFIX:-_restore_test}`
- Keep `.env` local; never commit secrets

## CI checks (baseline)

GitHub Actions runs these checks for this app on every push/PR:

- `npm run ci:lint` (design-token drift blocker for key UI files)
- `npm run ci:smoke` (Node syntax smoke checks)

Run locally:

```bash
cd apps/gtm-command-center
npm run design-token:check
npm run design-token:sample
npm run ci:smoke
```

Design-token fail/override behavior:

- Fails when raw color/spacing/typography literals are detected in tracked UI targets (currently `server.mjs` plus configured UI roots).
- Report source of truth: `.run/design-token-drift-report.md` (sample: `.run/design-token-drift-report.sample.md`).
- Temporary one-line override: append `design-token-lint: ignore` on a specific line.
- Temporary run override: `ALLOW_DESIGN_TOKEN_DRIFT=1 npm run design-token:check` (keeps exit code green but still writes full violation report).
- Any override must include owner + expiry + tokenization follow-up task.

## Run local dashboard

### Development mode (auto-restart + browser live-reload)

```bash
cd apps/gtm-command-center
PORT=1981 npm run dev
# open http://localhost:1981/
```

What this does:
- runs `node --watch server.mjs` (server auto-restarts on backend file changes)
- enables lightweight live-reload in the browser (`DEV_HMR=1`)
- browser polls `GET /__dev/version`; when `/ops` is open it updates **Review Bursts** in place (no full-page reload), otherwise falls back to full reload
- `/ops` also polls `GET /api/ops/review-bursts/live` and swaps only the `#review-bursts` panel when the signature changes

Optional dev variants:

```bash
# watch-only restart (no browser auto-refresh script)
npm run dev:watch

# tune browser reload polling interval (ms)
DEV_HMR_POLL_MS=800 npm run dev
```

### Production/local service mode (unchanged launchd behavior)

```bash
cd apps/gtm-command-center
PORT=1981 npm start
# open http://localhost:1981/
```

Both `/` and `/setup` render the full command center.

Review Bursts refresh behavior in service mode:
- `/ops` first attempts realtime updates over SSE (`GET /api/ops/review-bursts/events`)
- when bursts are updated (approve/revise/implement/close or preference updates), server emits `review_bursts` events and the UI swaps only `#review-bursts`
- if realtime is unavailable (EventSource unsupported, stream/network failure), UI falls back automatically to lightweight polling (`GET /api/ops/review-bursts/live`, default `REVIEW_BURSTS_REFRESH_MS=5000` ms)
- no full page reload is required; only the Review Bursts panel is replaced when signature changes
- live transport status is visible in `/ops` via marker `ops-review-bursts-live-status-v1` (`realtime · SSE`, `fallback · realtime unavailable`, or `polling · every Ns`)

Expected UX:
- operator can stay on `/ops` while bursts are created/updated/closed and see queue cards update in place
- on transient realtime failure, panel continues updating via polling without user intervention
- if realtime reconnects, polling is suppressed and status returns to `realtime · SSE`

Quick verification (service mode):

```bash
# snapshot payload + polling fallback metadata
curl -s http://127.0.0.1:1981/api/ops/review-bursts/live | jq '{mode,poll_ms,signature}'

# SSE endpoint should stream review_bursts events
curl -N http://127.0.0.1:1981/api/ops/review-bursts/events

# in another shell, mutate one burst state through existing action route
curl -s -X POST http://127.0.0.1:1981/ops/review-bursts/burst-2026-02-22-1/approve -o /dev/null -w '%{http_code}\n'

# expect streamed event + new signature without manual reload
curl -s http://127.0.0.1:1981/api/ops/review-bursts/live | jq '{signature}'
```

## Operator review checklist placement (`/ops`)

Pattern decision: **embedded card in `/ops` Start here** (no drawer/modal).

- Route: `http://127.0.0.1:1981/ops`
- Location in app: **Start here** panel
- Placement markers: `ops-start-here-panel-v1`, `ops-review-checklist-card-v1`, `ops-review-checklist-embedded-v2`
- One-click discoverability marker: `ops-review-checklist-one-click-v1`
- Full doc link marker: `ops-review-checklist-full-doc-link-v1`
- Quick checklist source: `docs/reviewer-home-ops-checklist.md` (8 bullets max)
- Full checklist source: `docs/reviewer-home-ops-checklist-full.md`
- UI composition guardrail: `docs/MIN_COMPONENTS_PER_VIEW_RULE.md` (`min-components-per-view-rule-v1`)

Command-level smoke check:

```bash
curl -s http://127.0.0.1:1981/ops \
  | grep -o 'data-verify="[^"]*"' \
  | sort -u \
  | grep -E 'ops-start-here-panel-v1|ops-review-checklist-card-v1|ops-review-checklist-embedded-v2|ops-review-checklist-one-click-v1|ops-review-checklist-full-doc-link-v1'
```


## Comms + Account/Individual split coherence (NOW item 1)

Accepted standard doc: `docs/NOW1_ACCOUNT_INDIVIDUAL_STANDARD.md`

Accepted naming + route ownership standard:

- Naming convention: **Account Workspace** and **Individual Workspace** are the canonical operator-facing labels (no mixed “contact/person” UI labels for this split).
- `/comms`: communication workflow execution (inbox/outbox, Account Workspace/Individual Workspace switch, attribution, next touch).
- `/ops`: KPI diagnostics, operational queues, readiness/health gates, and follow-up/client-update operations.
- Canonical module ownership when overlap exists:
  - `/actions`: execution queue transitions and completion behavior.
  - `/relationships`: stage progression + handoff intent.
  - `/comms`: thread-level messaging context and next-touch workflow.
  - `/ops`: KPI gate decisions, diagnostics, and escalation posture.

Route-marker smoke checks:

```bash
# comms markers
curl -s http://127.0.0.1:1981/comms \
  | grep -o 'data-verify="[^"]*"' \
  | sort -u \
  | grep -E 'comms-route-v1|comms-account-individual-crosslink-v1|comms-ops-detail-handoff-v1|kpi-narrative-source-of-truth-v1'

# ops markers
curl -s http://127.0.0.1:1981/ops \
  | grep -o 'data-verify="[^"]*"' \
  | sort -u \
  | grep -E 'adzeta-ops-separation-v1|kpi-hierarchy-v2|ops-section-process-v1|ops-reviews-panel-v1'
```

## Monday demo quickstart (operator runbook)

Use this when you need a fast pre-demo verification pass.

## Demo mode dataset (repeatable Monday top-of-funnel demos)

Use these scripts to quickly seed and safely reset demo-only top-of-funnel data (qualified accounts, sequence enrollments, and reply-classification activity).

```bash
cd apps/gtm-command-center
set -a && source .env && set +a

# Seed demo data (idempotent for templates/funnel; replaces demo-qualified-account rows)
npm run demo:seed

# Preview reset impact (dry-run only; no deletes)
npm run demo:reset

# Execute reset (deletes only demo-tagged/demo-keyed rows)
npm run demo:reset -- --apply
```

Safety scope for `demo:reset`:
- `cc_activity_log` rows with `details.demo_tag = monday-demo-top-of-funnel-v1` or `lead_key` like `lead:demo:%`
- `cc_sequence_enrollments` rows for demo lead keys / demo template IDs
- `cc_qualified_accounts` rows for known demo websites
- demo funnel slug: `demo-founder-outreach-monday`
- demo sequence template slugs: `demo-tof-direct-offer-v1`, `demo-tof-proof-first-v1`, `demo-tof-pain-point-v1`

```bash
# 1) service + health
curl -s -i http://localhost:1981/health | head -n 8

# 2) KPI + readiness snapshots
curl -s http://localhost:1981/api/command-center/kpis | jq '.generated_at, .verification_markers'
curl -s http://localhost:1981/api/readiness/monday | jq '.readiness_state, .gates'

# 3) workflow completeness + markers
curl -s http://localhost:1981/api/workflows/completeness | jq '.score, .verification_markers'

# 4) confirm UI marker hooks are rendered
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u
```

Expected marker highlights for Monday demo:

- `workflow-completeness-v1`
- `monday-polish-v1` (API marker)
- `funnel-ops-polish-v1`
- `kpi-hierarchy-v2`
- `kpi-gate-alignment-v2`

## Integrated outputs: top-of-funnel operator flow (v1 set)

For human-to-human team execution onboarding, see:
- `docs/TEAM_ONBOARDING_IN_APP_GUIDE.md`

This flow merges the latest completed top-of-funnel outputs into one repeatable operator path:

- qualified account intake v1
- reply routing / qualification v1
- sequence enrollment UX v1
- pilot handoff lane v1
- team handoff queue v1 (AI prep → human outreach)
- competitive intel ingest v1
- home copy clarity pass

### 0) Preflight: service + marker shell

```bash
curl -s -i http://localhost:1981/health | head -n 10
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u | grep -E 'adzeta-home-funnel-first-v3|adzeta-home-funnel-queue-v2|tof-primary-cta-v1'
```

### 1) Qualified account intake + enrollment

```bash
# requires operator auth
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/qualified-accounts \
  -H 'content-type: application/json' \
  -d '{"brand":"Acme Beauty","website":"https://acme.example","est_spend_tier":"500k-2m","channels":["meta","google"],"contact_role":"VP Marketing","qualification_confidence":82,"pipeline_stage":"qualified"}'

# list active TOF templates to pick sequence_template_id
curl -s http://localhost:1981/api/sequence-templates | jq '.data[] | {id,slug,name,status}'

# enroll the qualified account into outreach
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/qualified-accounts/<qualified_account_id>/enroll \
  -H 'content-type: application/json' \
  -d '{"sequence_template_id":"<template-id>"}'
```

### 2) Reply routing / qualification

```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/replies/classify \
  -H 'content-type: application/json' \
  -d '{"lead_key":"lead:acme:001","reply_text":"Interested, can we review pilot scope this week?","funnel_id":"founder-outreach-q1","entry_point":"cold_email"}'

# operator audit view is visible in Ops UI panel
curl -s http://localhost:1981/ops | grep -o 'data-verify="[^"]*"' | sort -u | grep 'reply-routing-panel-v1'
```

### 3) Pilot handoff lane progression

```bash
# promote the same qualified account through discovery -> pilot candidate
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/qualified-accounts/<qualified_account_id>/promote \
  -H 'content-type: application/json' \
  -d '{"pipeline_stage":"discovery"}'

curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/qualified-accounts/<qualified_account_id>/promote \
  -H 'content-type: application/json' \
  -d '{"pipeline_stage":"pilot_candidate"}'
```

### 4) Team handoff queue (human-to-human outreach)

```bash
# prioritized handoff queue with AI-prepared brief + human execution split
curl -s http://localhost:1981/api/handoff-queue | jq '{marker,count:(.data|length),top:(.data[0] // null)}'

# UI marker on Home
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u | grep 'team-handoff-queue-v1'
```

### 4b) Relationship intelligence → Actions handoff verification

```bash
# verifies recommendation required fields + handoff route to /actions queue
npm run verify:relationship-handoff

# writes evidence JSON marker locally
cat .run/evidence/now3-relationship-intel-handoff-2026-02-22/verification.json
```

### 5) Competitive intel ingest + funnel-entry analytics

```bash
curl -u operator:$CC_OPERATOR_PASSWORD -X POST http://localhost:1981/api/competitive-intel \
  -H 'content-type: application/json' \
  -d '{"brand":"Competitor X","signal":"New promo bundle launch","source":"https://example.com/press","confidence":78,"strategic_note":"Mirror angle in outreach","qualified_account_id":"<qualified_account_id>"}'

curl -s http://localhost:1981/api/acquisition/metrics | jq '{marker,by_funnel:(.data.by_funnel|length),by_entry_point:(.data.by_entry_point|length),positive_reply_count:.data.positive_reply_count}'
```

### Verification markers (UI/API)

- `data-verify="adzeta-home-funnel-first-v3"` (home shell + copy clarity pass)
- `data-verify="tof-primary-cta-v1"` (prioritized home CTAs)
- `data-verify="funnel-ops-polish-v1"` (launch outreach card)
- `data-verify="qualified-account-intake-v1"`
- `data-verify="qualified-account-table-v2"`
- `data-verify="reply-routing-panel-v1"` (Ops)
- `data-verify="pilot-handoff-stage-metrics-v1"`
- `data-verify="pilot-handoff-lane-v1"`
- `data-verify="team-handoff-queue-v1"`
- `data-verify="competitive-intel-panel-v1"`
- `data-verify="acquisition-metrics-panel-v1"`
- `data-verify="sequence-enrollment-ux-v1"`
- `relationship-intelligence-priority-weighting-v1`
- `relationship-intelligence-handoff-path-v1`
- `relationship-recommendation-required-fields-v1`
- `relationship-intelligence-handoff-verify-v1` (script output marker)
- `data-verify="home-ops-nav-polish-v1"`
- API markers: `qualified-account-intake-v1`, `qualified-account-enroll-action-v1`, `reply-routing-hook-v1`, `pilot-handoff-promote-action-v1`, `competitive-intel-ingest-v1`, `research-ledger-api-v1`, `research-ledger-entry-v1`, `acquisition-metrics-panel-v1`, `sequence-enrollment-ux-v1`, `team-handoff-queue-v1`

## What's operational now

- **Home IA is funnel-first**: `/` is intentionally scoped to top-of-funnel operator workflow (primary actions, KPI pulse, active funnels, immediate outreach queue).
- **Competitive intelligence ingest v1**: Home now includes a lightweight panel to log competitor/prospect signals (`brand`, `signal`, `source`, `confidence`, `strategic_note`) and view recent entries, with optional/automatic linking to qualified target accounts.
- **Research Ledger taxonomy v2**: `/research` + `GET /api/research-ledger` now provide a canonical ledger shape across UI/API (`hypothesis`, `evidence_source`, `confidence` + derived band, `recommended_action`, `owner`, `timestamp`) with explicit status taxonomy (`new_signal`, `triaged`, `validated`, `actioned`, `parked`, `discarded`).
- **Ops IA is process/system-heavy**: `/ops` hosts execution board, task actions, full outreach + client updates, sequence template management, trigger mapping, readiness, workflow completeness, health, alerts, lifecycle, and asset pipeline.
- **Setup route remains functional**: `/setup` now redirects to `/ops` for legacy links.
- **Funnels + sequences**: active funnels and queued/active sequence enrollments render in dedicated panels; APIs are live under `/api/funnels`, `/api/funnels/:id/steps`, `/api/sequence-templates`, and `/api/sequence-enrollments`.
- **Lead magnets + teaser products**: asset pipeline panel renders draft/live/paused/archived counts from DB; APIs are live under `/api/assets/status` and `/api/assets/:type` (POST/PATCH).
- **Lifecycle + reporting**: KPI and lifecycle panels render from DB-backed aggregates; combined payload available at `/api/command-center/kpis`.
- **Meetings + client updates**: ingestion endpoints (`/api/meeting-notes/ingest`, `/api/meeting-transcripts/ingest`) write records that appear in Ops; follow-up advancement remains wired via `/followups/:id/advance` and `/api/followups/:id/advance`.

Existing task action remains unchanged:

`todo -> in_progress -> done`

## Persistent local service (macOS launchd)

Configured service (production mode, unchanged by dev live-reload setup):
- Label: `com.adzeta.gtm-command-center`
- Port: `1981`
- URL: `http://localhost:1981/setup`

Useful commands:

```bash
# status
launchctl print gui/$(id -u)/com.adzeta.gtm-command-center

# restart
launchctl kickstart -k gui/$(id -u)/com.adzeta.gtm-command-center

# stop
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.adzeta.gtm-command-center.plist

# start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.adzeta.gtm-command-center.plist
```

Logs:
- `apps/gtm-command-center/.run/service.out.log`
- `apps/gtm-command-center/.run/service.err.log`

## KPI script (existing)

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run kpis
```

## KPI aggregation endpoint (new)

```bash
curl -s http://localhost:1981/api/command-center/kpis | jq
```

## Monday go/no-go readiness (new)

Checklist artifact with explicit gates:

- `org/MONDAY_GO_NO_GO_CHECKLIST.md`

Readiness API (local-first):

```bash
curl -s http://localhost:1981/api/readiness/monday | jq
```

CLI summary script:

```bash
cd apps/gtm-command-center
npm run readiness:monday
```

## GTM workflow completeness (Monday polish)

Workflow completeness API with verification markers:

```bash
curl -s http://localhost:1981/api/workflows/completeness | jq
```

Dashboard includes a dedicated **GTM workflow completeness** panel with
`data-verify="workflow-completeness-v1"` and marker payload:

- `workflow-completeness-v1`
- `monday-polish-v1`

## Observability baseline (health + metrics)

Health check:

```bash
curl -i http://localhost:1981/health
```

Metrics snapshot (JSON):

```bash
curl -s http://localhost:1981/api/metrics/snapshot | jq
# alias: /metrics
```

Force one metrics log line in service logs:

```bash
curl -X POST http://localhost:1981/api/metrics/log
# or: curl -s "http://localhost:1981/metrics?log=1"
```

Runbook:

- `docs/RUNBOOK_DEGRADED_STATE.md`
- `docs/STRATEGY_AND_DECISIONS.md`

Returns local-first aggregate payload:
- `kpis` (command center cards)
- `lifecycle` (counts by stage + movement last 7d)
- `campaigns` (7d spend/revenue/conversions/roas)

## Nightly summary scaffold (new)

```bash
cd apps/gtm-command-center
npm run nightly:summary
```

Outputs:
- `.run/reports/nightly-summary-YYYY-MM-DD.md`
- `.run/reports/nightly-summary-YYYY-MM-DD.json`
- `.run/reports/nightly-summary-latest.md`

## Daily GTM summary export (Monday operations)

Operator command:

```bash
cd apps/gtm-command-center
npm run daily:summary
```

Outputs (predictable path):
- `.run/reports/daily-gtm-summary/daily-gtm-summary-YYYY-MM-DD.md`
- `.run/reports/daily-gtm-summary/daily-gtm-summary-YYYY-MM-DD.json`
- `.run/reports/daily-gtm-summary/daily-gtm-summary-latest.md`
- `.run/reports/daily-gtm-summary/daily-gtm-summary-latest.json`

API endpoint:

```bash
curl -s http://localhost:1981/api/reports/daily-gtm-summary | jq
```

Summary includes:
- KPIs
- sequence activity
- alert rule summary
- Monday readiness state/gates

## Weekly pilot scorecard module (new)

Operator command:

```bash
cd apps/gtm-command-center
npm run weekly:scorecard
```

Outputs:
- `.run/reports/weekly-scorecard/weekly-scorecard-YYYY-MM-DD.md`
- `.run/reports/weekly-scorecard/weekly-scorecard-YYYY-MM-DD.json`
- `.run/reports/weekly-scorecard/weekly-scorecard-latest.md`
- `.run/reports/weekly-scorecard/weekly-scorecard-latest.json`

Scorecard fields:
- delivery (7d events + live asset counts + delivery score)
- CAC (7d spend/conversions/cac)
- D60 ROAS proxy + actual field (`metadata.d60_roas_actual` when available)
- signal health notes (heuristics + optional local notes file)
- go/no-go trajectory flag (`GO` / `WATCH` / `NO_GO`)

Weekly module integration checks (live app):

```bash
# strategy page should render weekly scorecard module marker
curl -s http://localhost:1981/strategy | grep -o 'data-verify="[^"]*"' | sort -u | grep 'weekly-scorecard-module-v1'

# api payload should include the latest markdown source path
curl -s http://localhost:1981/api/reports/weekly-scorecard | jq '{marker,has_data:(.data!=null),source}'
```

## GTM-layer review checklist (product + qualification + pilot + handoff + strategy)

Run this checklist to verify the full integrated GTM layer on `:1981`:

```bash
# 1) Product definition page
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1981/product/pltv-lift-pilot
curl -s http://localhost:1981/product/pltv-lift-pilot | grep -o 'data-verify="[^"]*"' | sort -u | grep 'pltv-lift-pilot-definition-v1'

# 2) Qualification snapshot workflow (home intake + readiness cell)
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u | grep -E 'qualified-account-intake-v1|qualification-snapshot-readiness-v1|qualification-snapshot-cell-v1'

# 3) Pilot phase tracker module
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u | grep 'pilot-phase-tracker-v1'

# 4) Team handoff queue (UI + API)
curl -s http://localhost:1981/ | grep -o 'data-verify="[^"]*"' | sort -u | grep 'team-handoff-queue-v1'
curl -s http://localhost:1981/api/handoff-queue | jq '{marker,count:(.data|length)}'

# 5) Strategy & decisions page + weekly scorecard module
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1981/strategy
curl -s http://localhost:1981/strategy | grep -o 'data-verify="[^"]*"' | sort -u | grep -E 'strategy-decisions-page-v3|weekly-scorecard-module-v1|strategy-cta-targeting-v2|strategy-cta-relationships-v2|strategy-cta-actions-v2|strategy-cta-pilot-v2|strategy-cta-ops-v2'

# 6) URL sanity shell
curl -s -i http://localhost:1981/health | head -n 5
```

## What shipped in this dashboard pass

- Root route (`/`) upgraded from sparse setup page to a multi-panel operator dashboard.
- `/setup` kept available and now points to the same full command center view.
- KPI panel includes core metrics:
  - `delegations_24h`
  - `completed_24h`
  - `open_priorities`
  - `active_runs`
  - with freshness text and generated timestamp.
- KPI aggregation endpoint added: `/api/command-center/kpis`.
- KPI hierarchy and dashboard IA module added in Ops (`/ops#kpi-hierarchy-ia-panel`) with marker `kpi-tree-northstar-v1`.
- Lifecycle marketing panel added:
  - stage counts from `lifecycle_stages`/`lifecycle_events`
  - movement count for last 7 days
  - placeholder-safe fallback when tables are not populated yet.
- Campaign summary aggregate added from `campaign_metrics` (7d spend/revenue/conversions/roas).
- Execution board added with lanes:
  - Current
  - Blocked
  - Next
  - Done
  - Waiting-on-user
- Alerts panel added from static local config file: `lib/alert-rules.json` (9 rules) with severity/owner/SLA and escalation policy.
- Deploy/health panel added with local service status + GitHub baseline + Vercel readiness placeholders.
- Operator actions panel keeps existing task-advance flow and adds quick status filters (`all`, `todo`, `in_progress`, `done`).

## Meeting analysis + client updates baseline (new)

Migration file:

- `org/sql/2026-02-21_meeting_analysis_client_updates.sql`

Creates tables:

- `meeting_notes`
- `meeting_actions`
- `client_updates`

Ingest endpoints (local text transcript ingestion):

- `POST /api/meeting-notes/ingest`
- `POST /api/meeting-transcripts/ingest` (alias for transcript payloads)
- JSON body:
  - `client_name` (string)
  - `note_text` or `transcript_text` (string, required)
  - `source_type` (`text` or `voice_transcript`, optional; normalized to allowed values)
  - `meeting_at` (ISO datetime, optional)

Command center now includes **Meeting analysis & client updates** panel with:

- recent meetings
- pending follow-up actions
- due client updates

Follow-up status transitions:

- `pending -> in_progress -> done` (button: `POST /followups/:id/advance`, API: `POST /api/followups/:id/advance`)
- When the last open action for a meeting is completed, linked `client_updates` rows auto-transition from `draft` to `due`.

### Voice-note ingestion path (text transcript placeholder)

Endpoint:

- `POST /api/voice-notes/ingest`
- Body: `transcript_text` (required), optional `meeting_at`, optional `source`

Behavior:

- Parses transcript text with lightweight field extraction (`name`, `email`, `phone`, `company`, `notes`, `follow up`)
- Creates a `meeting_notes` record (`source_type=voice_transcript`)
- Creates a **pending** follow-up action in `meeting_actions`
- Persists extraction payload in `voice_note_ingestions`

Companion listing endpoint:

- `GET /api/voice-notes/ingestions` (latest rows)

Dashboard:

- Command Center panel **Meeting analysis & client updates** now includes a **Recent voice-note ingestions** table section.

## Funnels + sequences foundations

Migration SQL: `org/sql/2026-02-21_cc_funnels_sequences.sql`

Seed sample funnel + sequence:

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run seed:funnels
```

Minimal APIs added:

- `GET/POST /api/funnels`
- `PATCH/DELETE /api/funnels/:id`
- `GET/POST /api/funnels/:id/steps`
- `GET/POST /api/sequence-templates`
- `GET/POST /api/sequence-enrollments`
- `POST /api/sequences/enroll` (contact enrollment action endpoint)

Dashboard now includes panel sections for:

- Active funnels
- Sequence templates (steps + cadence + status)
- Sequence queue (queued + active enrollments)

Activity logging:

- Migration `scripts/migrations/0006_cc_activity_log.sql`
- Enrollment calls write `sequence_enrollment_created` into `cc_activity_log`

## Lead magnets + teaser products baseline (new)

Migration SQL: `org/sql/2026-02-21_lead_magnets_teasers.sql`

Creates:

- `lead_magnets`
- `teaser_products`
- `delivery_events`

Seeds 2 entries each for lead magnets + teaser products.

New APIs:

- `GET /api/assets/status`
- `POST /api/assets/lead_magnet`
- `POST /api/assets/teaser_product`
- `PATCH /api/assets/lead_magnet/:id`
- `PATCH /api/assets/teaser_product/:id`

Dashboard section now includes **Asset pipeline status** with:

- draft/live/paused/archived counts
- total by asset type
- performance placeholder column

## Nurture automation v1 triggers (new)

Local trigger rules config:

- `apps/gtm-command-center/lib/nurture-trigger-rules.json`

Default examples included:

- `no_reply_48h`
- `meeting_complete`
- `lead_magnet_download`

Command center now includes **Nurture trigger mapping** panel showing:

- trigger rule id + trigger key
- configured sequence slug/name
- resolved sequence template (if mapped)
- mapping state (`mapped` / `unmapped`)
- last trigger run time + actions produced (from local run snapshot)

New APIs:

- `GET /api/nurture/triggers` (read current trigger config)
- `GET /api/nurture/triggers/last-run` (latest trigger evaluator run summary)
- `POST /api/nurture/triggers/evaluate` (evaluate + optionally apply)

`POST /api/nurture/triggers/evaluate` body:

- `lead_key` (required when `apply: true`)
- `trigger_key` (optional explicit trigger event key)
- `last_reply_at` (ISO datetime, used by no-reply rules)
- `meeting_completed` (boolean)
- `lead_magnet_downloaded` (boolean)
- `apply` (boolean, default `false`; when true requires operator auth and upserts sequence enrollment)

Local evaluation helper script:

```bash
cd apps/gtm-command-center
npm run nurture:triggers:eval:local
```

Optional env vars for script:

- `TRIGGER_KEY`
- `LEAD_KEY`
- `LAST_REPLY_AT`
- `MEETING_COMPLETED=true|false`
- `LEAD_MAGNET_DOWNLOADED=true|false`
- `APPLY=true|false`

## Tuning alert thresholds + escalation policy

Primary local config file:

- `apps/gtm-command-center/lib/alert-rules.json`

Tune here:

- per-rule trigger expressions (`threshold`)
- per-rule ownership (`owner`)
- per-rule SLA target (`sla_minutes`)
- escalation behavior (`escalation_policy.info|warning|critical`)

No secrets are required for alert tuning. Changes are local-first and picked up on next page render/service restart.

## What remains

- Supabase mode KPI SQL parity (currently placeholder values in `supabase` runtime mode).
- Wire alert state engine (currently displays rule config + placeholder current state).
- Replace deploy baseline placeholders with live GitHub/Vercel checks when desired.
