# RB-003 Result Extraction — Data Contract + GitHub Baseline + Vercel Baseline

Date: 2026-02-22 (ET)
Scope: Extract/publish the completed artifacts for the NEXT queue items:
1) Data contract + event schema pass
2) GitHub setup baseline (run a7b5694e)
3) Vercel setup baseline (run a318df60)

## Canonical artifacts (exact paths)

### 1) Data contract + event schema pass
- `org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`

### 2) GitHub setup baseline (run a7b5694e)
- `org/adzeta/GITHUB_SETUP_BASELINE.md`

### 3) Vercel setup baseline (run a318df60)
- `org/adzeta/VERCEL_SETUP_BASELINE.md`
- (Referenced by runbook) `org/adzeta/DEPLOYMENT_VERIFICATION_CHECKLIST.md`

---

## Key findings / decisions captured

### Data contract + event schema (v1)
- Minimal **entity set** defined for the first dashboard loop: `accounts`, `people`, `touchpoints`, `pilots`, `research_ledger_entries`.
- A single reporting-friendly **event stream** contract defined as `events` with:
  - required linkage fields (`account_id`, optional `person_id`/`touchpoint_id`/`pilot_id`/`ledger_id`)
  - required `evidence_ref` on every KPI-moving event
  - `metadata` JSON for extensibility
- **Event taxonomy** enumerated for the sprint’s KPIs:
  - qualification: `account_researched`, `account_qualified`
  - outreach: `outreach_sent`, `outreach_bounced`, `reply_received`, `reply_positive`, `meeting_scheduled`, `meeting_held`
  - pilot: `pilot_proposed`, `pilot_started`, `pilot_won`, `pilot_lost`
  - TTNHA instrumentation: `signal_created`, `human_action_taken`
- KPI computation guidance included (dedupe notes + TTNHA median/p90 framing).

### GitHub setup baseline
- Checklists for:
  - repo wiring (default branch, remote reachability; SSH preferred)
  - branch protection recommendations (PR required, status checks, approval, stale approval dismissal, force-push restriction)
  - CI readiness (Actions enabled, install→lint→test→build, cache, Node version pinning)
  - evidence-mode guardrails (PR template includes KPI mapping + acceptance + verification)
- Explicit “outputs to capture” field list for ops logging.

### Vercel setup baseline
- Checklists for:
  - project link + build configuration verification
  - env var mapping separation (client-safe `VITE_*` vs server-only `SUPABASE_SERVICE_ROLE_KEY`)
  - first deploy runbook (no-op PR → preview → prod → run deploy verification checklist)
- Evidence capture requirements listed (URLs, `/ops` screenshot, timestamps, smoke checks).

---

## Risks / gaps (current)

1) **These baselines are contracts + checklists, not yet validated against a specific repo/Vercel project**.
   - Missing proof fields: actual default branch name, workflow names, branch protection state, Vercel project URLs.
2) **Supabase env keys remain a global blocker** for end-to-end wiring (not stored here; needs secure env setup).
3) **KPI/event semantics risk drift** unless we lock naming in code migrations and add a verifier script.

---

## Immediate follow-up actions (to convert checklist → executed proof)

### A) Data contract
- Implement `events` table + minimal entity tables in the chosen DB (Supabase) using a migration.
- Add a lightweight verifier:
  - asserts required fields present
  - asserts `evidence_ref` non-null for KPI-moving event types

### B) GitHub baseline (execute against actual repo)
- Capture and paste into ops log:
  - default branch
  - workflow list
  - branch protection settings summary
- If missing, add:
  - PR template with KPI mapping + verification steps
  - minimal Actions workflow (lint/test/build) and Node pin

### C) Vercel baseline (execute against actual project)
- Link repo ↔ Vercel project, enable preview deployments.
- Configure env vars with correct client/server separation.
- Run first deploy runbook and complete `org/adzeta/DEPLOYMENT_VERIFICATION_CHECKLIST.md` with timestamps + URLs.
