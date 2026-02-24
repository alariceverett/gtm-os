# AdZeta Home/Ops Reviewer Checklist (Full)

Use these exact local URLs while `apps/gtm-command-center` is running on port `1981`.

## In-app checklist entry point (from `/ops`)

- Route: `http://127.0.0.1:1981/ops`
- Location marker: `data-verify="ops-start-here-panel-v1"`
- Entry expectation: checklist link is available from the **Start here** area on `/ops`.

## 1) Route separation

- Home (top-of-funnel focus): http://127.0.0.1:1981/
- Ops (operations detail): http://127.0.0.1:1981/ops
- Legacy setup redirect check: http://127.0.0.1:1981/setup (should 303 to `/ops`)

## 2) Validation markers (copy/paste greps)

- Home marker present:
  - `data-verify="adzeta-home-funnel-first-v3"`
- Home outreach queue marker present:
  - `data-verify="adzeta-home-funnel-queue-v2"`
- Ops marker present:
  - `data-verify="adzeta-ops-separation-v1"`
- Ops shell start marker present:
  - `data-verify="ops-start-here-panel-v1"`

## 3) Minimum-components-per-view enforcement

Standard: `docs/MIN_COMPONENTS_PER_VIEW_RULE.md` (marker `min-components-per-view-rule-v1`)

For business-facing pages (`/`, `/strategy`, `/targeting`, `/actions`, `/relationships`, `/pilot`, `/comms`), confirm:
- Header includes `Page purpose:` sentence.
- Header includes exactly one dominant CTA (`.dominant-cta`).
- Primary block cap is respected:
  - Home/Strategy/Actions/Relationships/Pilot/Comms: max 4
  - Targeting: max 3
- Route has min-components marker (e.g., `home-min-components-v1`, `actions-min-components-v1`).

## 4) Top-of-funnel clarity checks

At `/` confirm:
- Header message: **"Funnel-first home for daily execution. Extended diagnostics live in Ops."**
- Primary actions card group is visible (Outreach follow-up, Nurture enrollment, Client update send)
- Sections emphasize top-of-funnel:
  - Core KPI pulse
  - Acquisition by funnel entry
  - Active funnels
  - Immediate outreach queue (**top-of-funnel only**)

At `/ops` confirm:
- Operational detail modules are grouped there (execution board, task actions, outreach+client updates, readiness/health/alerts/lifecycle)
- Home-only fast path is not duplicated as the primary ops narrative

## 4) Naming convention + canonical ownership checks

Accepted standard:
- UI split labels are **Account Workspace** and **Individual Workspace** (canonical naming).
- `/comms` owns messaging workflow context; `/ops` owns KPI diagnostics and operational queue visibility.
- Overlap resolution: `/actions` owns transition execution, `/relationships` owns stage/handoff intent, `/comms` owns thread context, `/ops` owns KPI/escalation decisions.

Verification:
- On `/comms`, confirm the workspace switch labels render exactly `Account Workspace` and `Individual Workspace`.
- On `/ops`, confirm NOW coherence panel includes marker `canonical-module-ownership-v1`.
- Confirm source-of-truth copy marker `kpi-narrative-source-of-truth-v1` is present and references Ops diagnostics as canonical.

## 5) Command-level smoke check

Run this from workspace root while the app is live:

```bash
curl -s http://127.0.0.1:1981/ops | grep -q "ops-review-checklist-card-v1" && echo "PASS: checklist embedded in /ops"
```

Optional one-click route check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:1981/ops/reviewer-checklist
```

Expected: `200` and `/ops` contains marker `ops-review-checklist-card-v1`.

