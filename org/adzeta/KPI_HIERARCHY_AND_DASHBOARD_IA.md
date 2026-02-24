# AdZeta — KPI Hierarchy + Dashboard IA (GTM Command Center) (Evidence Mode v1)

_Last updated: 2026-02-23_

## Scope / intent
Define the **canonical KPI hierarchy** and a **minimal dashboard information architecture (IA)** for the GTM Command Center so every displayed number is:
- **computable from the event contract** (`org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`)
- **traceable to proof** (`evidence_ref` or linked entity id)
- **operationally owned** (who fixes it when it breaks)

This is sprint-first: optimize for **48-hour evidence velocity**, not perfect long-term analytics.

---

## (1) KPI hierarchy

### L0 — North Star (48-hour sprint)
**Evidence Velocity**
- **Definition:** rate at which we generate *verifiable* GTM outcomes that advance to the next human step.
- **Why:** prevents vanity metrics; forces proof + forward motion.
- **Primary surface:** `/ops` scoreboard + daily status note.

### L1 — Canonical Scoreboard (reported daily)
These are the only numbers that must be stable in the first reporting loop.

#### KPI-1: Qualified Accounts (QA)
- **Definition:** unique accounts that reach “qualified” state.
- **Event source:** `events.event_type = account_qualified`
- **Dedupe key:** `account_id`
- **Unit:** accounts
- **Proof requirement:** each qualifying event must include `evidence_ref` and ideally `ledger_id`.
- **Owner:** Ops/Intelligence (definition + evidence), Build (instrumentation).

#### KPI-2: Positive Replies / Meetings (PR/M)
- **Definition:** count of positive inbound replies and meetings scheduled.
- **Event source:** `reply_positive` + `meeting_scheduled`
- **Dedupe keys:**
  - replies: `touchpoint_id` or `metadata.thread_id`
  - meetings: `metadata.calendar_event_id` (or `evidence_ref` as calendar id/permalink)
- **Unit:** replies + meetings (report as two lines + combined headline)
- **Proof requirement:** message permalink/snippet ref OR calendar id/permalink.
- **Owner:** Comms/Ops (classification rules), Build (capture).

#### KPI-3: Pilot Conversion (PC)
- **Definition:** unique accounts that enter an active pilot with success criteria recorded.
- **Event source:** `pilot_started` (optionally also show `pilot_proposed` as leading)
- **Dedupe key:** `account_id` (or `pilot_id` for raw counts)
- **Unit:** pilots (accounts in pilot)
- **Proof requirement:** `pilots.evidence_ref` + non-empty `success_criteria`.
- **Owner:** Sales/Ops (criteria + lifecycle), Build (data model + UI fields).

#### KPI-4: Time-to-Next-Human-Action (TTNHA)
- **Definition:** time between a system “needs action” signal and the next recorded human action.
- **Event source:** `signal_created` → next `human_action_taken`
- **Computation:** median + p90 over trailing 24h (or trailing 7d once volume exists).
- **Unit:** minutes/hours
- **Proof requirement:** both events exist with timestamps; action should reference what happened (metadata).
- **Owner:** Ops (SLA + routing), Build (event capture), Product (UX loop).

### L2 — Leading + operational metrics (used to debug, not primary reporting)
These explain movement in L1.

**Leading indicators (weekly useful, daily visible):**
- **Qualified yield** = `account_qualified / account_researched`
- **Positive rate** = `reply_positive / reply_received`
- **Meeting rate** = `meeting_scheduled / outreach_sent`
- **Pilot start rate** = `pilot_started / meeting_held` (or `/ meeting_scheduled` early)

**Operational health:**
- **Invalid/bounce rate** = `outreach_bounced / outreach_sent`
- **Backlog size** = open “needs human action” items
- **SLA breach rate** = `% signals > SLA without human action`

---

## (2) Dashboard IA (sections + ownership)

### Route: `/` — Comms / Operator Home (comms-first)
**Goal:** move conversations forward and reduce TTNHA.

**Sections**
1) **Action Queue (Needs human action)**
   - Inputs: `signal_created` + routing metadata
   - Sort: urgency + SLA (age)
   - Ownership: Ops (rules), Product (UX), Build (data + sorting)

2) **Today’s Outcomes (PR/M + pilots started)**
   - Show: positive replies, meetings scheduled, pilots started (today)
   - Ownership: Ops (definitions), Build (queries)

3) **Next-best follow-ups**
   - Derived from: outstanding threads + account priority model
   - Ownership: Intelligence/Product (ranking), Build (render)

**Non-goals for `/`:** deep funnel analytics and account diagnostics (belongs in `/ops`).

### Route: `/ops` — GTM Command Center (evidence + audit)
**Goal:** prove KPI movement and link numbers → events → evidence.

**Section A — KPI Scoreboard (L1, canonical)**
- QA (total, 24h delta)
- PR (today), Meetings (today), combined PR/M (today)
- Pilots started (7d rolling) + Pilots proposed (leading)
- TTNHA (median, p90)

Ownership:
- Definitions: Ops/Intelligence
- Computation + correctness: Build
- Review cadence: Operator daily

**Section B — Evidence Feed (audit trail)**
A reverse-chron log of the exact events contributing to scoreboard changes.
- Latest `account_qualified` (with ledger links)
- Latest `reply_positive`, `meeting_scheduled`
- Latest `pilot_started`
- Latest `human_action_taken` (to validate TTNHA)

Ownership:
- Proof hygiene: Ops
- Rendering + deep-links: Build

**Section C — Funnel Slices (L2 diagnostics)**
- researched → qualified → contacted → reply_received → reply_positive → meeting_scheduled → pilot_started

Ownership:
- Ops (interpretation)
- Build (derive counts)

**Section D — Data Quality / Instrumentation health (must-have)**
- % events missing `evidence_ref` (should be 0 for KPI drivers)
- last event timestamp per event_type
- “unknown event_type” count

Ownership: Build (detect), Ops (enforce).

---

## (3) KPI ↔ event/data mapping (to populate each KPI)

All KPIs must be computable from `events` (plus joins to entities for display). Taxonomy is in `org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`.

### Mapping table (minimum viable)

| KPI / Widget | Primary event types | Required fields | Join/display fields | Notes / computation |
|---|---|---|---|---|
| QA (Qualified Accounts) | `account_qualified` | `occurred_at`, `account_id`, `actor_type`, `evidence_ref`, (`ledger_id` strongly preferred) | from `accounts`: `name`, `domain`, `segment`, scores | Count distinct `account_id` in window; total = all-time distinct |
| PR (Positive replies) | `reply_positive` | `occurred_at`, `account_id`, (`touchpoint_id`), `evidence_ref`, `metadata.thread_id` | from `touchpoints`: channel, message_ref | Dedupe by `touchpoint_id` or `metadata.thread_id` |
| Meetings scheduled | `meeting_scheduled` | `occurred_at`, `account_id`, `evidence_ref` or `metadata.calendar_event_id` | optional: meeting time, invitees | Often created after `reply_positive` but not required |
| Pilots started | `pilot_started` | `occurred_at`, `account_id`, `pilot_id`, `evidence_ref` | from `pilots`: `success_criteria`, `next_review_at`, `owner` | Enforce `success_criteria` non-empty at pilot start |
| TTNHA median/p90 | `signal_created` + `human_action_taken` | `occurred_at`, `account_id` (or `metadata.thread_id`), `actor_type`, `metadata.action_type` | optional: queue label, operator | Pair each signal to next human action; compute deltas; summarize |
| Evidence Feed | all KPI driver events | `event_type`, `occurred_at`, `evidence_ref` | display: account/person labels, snippets | Every row must open the evidence link/ref |
| Data quality | all | `evidence_ref` presence, known taxonomy | n/a | Track missing evidence, unknown types, stale ingest |

### Minimal “proof invariants” (must hold)
- **Invariant A:** every `account_qualified`, `reply_positive`, `meeting_scheduled`, `pilot_started` event has a non-empty `evidence_ref`.
- **Invariant B:** every scoreboard number in `/ops` can be traced to a list of `event_id`s (click-through).
- **Invariant C:** TTNHA is computed from real pairs; if no pairs exist, the widget must show “insufficient data” rather than 0.

---

## (4) Acceptance checks + smoke-test commands

These checks are designed to be runnable without secrets. Some are “repo structure” checks (grep), others are “API surface” checks (curl to localhost).

### A. Documentation / contract checks (always runnable)
From repo root:

```bash
# KPI doc exists
test -f org/adzeta/KPI_HIERARCHY_AND_DASHBOARD_IA.md && echo "ok: kpi doc"

# Event taxonomy exists
test -f org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md && echo "ok: event schema"

# Ensure KPI driver event types are present in the schema doc
rg -n "account_qualified|reply_positive|meeting_scheduled|pilot_started|signal_created|human_action_taken" org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md
```

### B. UI marker checks (requires app source; no credentials)
Acceptance: `/ops` must contain stable `data-verify` markers for automated smoke tests.

Expected markers (minimum):
- `kpi-scoreboard-v1`
- `evidence-feed-v1`
- `funnel-slices-v1`
- `data-quality-v1`

Commands (repo root):

```bash
# Verify markers exist in UI code (paths may vary)
rg -n "kpi-scoreboard-v1|evidence-feed-v1|funnel-slices-v1|data-quality-v1" .
```

### C. Local runtime smoke checks (requires dev server)
Acceptance: an operator can load `/ops` and see non-empty states or explicit empty-state messaging.

```bash
# Start dev server (command may differ; use the project’s standard)
# npm run dev

# Then verify routes respond
curl -sS -o /dev/null -w "%{http_code} /\n" http://localhost:3000/
curl -sS -o /dev/null -w "%{http_code} /ops\n" http://localhost:3000/ops
```

### D. Data derivation sanity (once an events API exists)
Acceptance: scoreboard numbers are computed from events, not hard-coded.

```bash
# Example endpoints (adjust to actual implementation)
# curl -sS http://localhost:3000/api/events?limit=20 | jq '.events | length'
# curl -sS http://localhost:3000/api/kpi/scoreboard | jq
```

### E. TTNHA edge-case check
Acceptance: if there are no `signal_created`→`human_action_taken` pairs, widget shows `"insufficient_data": true` (or similar) and does not show `0`.

---

## (5) Immediate implementation sequence (next 24–48h)

### Next 0–6h (lock correctness + instrumentation)
1) **Adopt the KPI driver event types as constants** (single source-of-truth).
2) **Add event emission** at the moments that create KPI movement:
   - qualification: when account becomes qualified → `account_qualified`
   - comms: when reply is classified positive → `reply_positive`
   - meeting: when scheduled/recorded → `meeting_scheduled`
   - pilot: when started with criteria → `pilot_started`
   - ops loop: when queue item created → `signal_created`; when operator acts → `human_action_taken`
3) **Enforce proof invariant A** at write time (reject/flag missing `evidence_ref` for KPI-driver event types).

### Next 6–24h (build the dashboard read paths)
4) Implement **scoreboard query functions** (in code or SQL) that:
   - dedupe correctly (see mapping table)
   - support windows (today, 24h, 7d)
5) Implement `/ops` sections A–D with explicit empty states.
6) Add click-through from every KPI to the **exact event list** (event_id list) driving it.

### Next 24–48h (hardening + operator usability)
7) Add **data quality panel** metrics (missing evidence, stale ingest, unknown event_type).
8) Add **daily export** (json/csv) of scoreboard + event ids for proof bundles.
9) Run a “one-day replay” smoke test (ingest a small fixture dataset) and verify:
   - QA, PR/M, PC totals match fixture counts
   - TTNHA median/p90 matches known deltas

---

## References
- Event contract + taxonomy: `org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`
- Escalation policy (for TTNHA/SLA): `org/adzeta/ALERT_THRESHOLDS_ESCALATION_POLICY_V1.md`
- Deployment verification checklist (smoke checks): `org/adzeta/DEPLOYMENT_VERIFICATION_CHECKLIST.md`
