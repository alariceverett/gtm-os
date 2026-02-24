# /ops Review Bursts

> **How to use these cards (fast mode)**
> - Read each card in under 20 seconds.
> - Inline context is always visible: **current value**, **proposed change**, **expected impact**.
> - Use one click: **Approve (recommended)** or **Revise**.
> - If you revise, include exactly what change is needed.

- Updated: 2026-02-22T15:46:00-05:00
- Scope: current high-leverage review decisions
- Status: rewritten in plain language

## Live visibility behavior (no manual reload)
- **Dev mode (`DEV_HMR=1`)**: `/ops` listens for `GET /__dev/version` changes and refreshes `#review-bursts` in place before using any full-page fallback.
- **Service mode (`npm start`)**: `/ops` polls `GET /api/ops/review-bursts/live` (default 5s) and swaps only the Review Bursts section when signature changes.
- Poll interval override: `REVIEW_BURSTS_REFRESH_MS=<ms>`.

## Pinned (do first)

### RB-ARCH-001 — Approve frontend stack migration target (P0)
- URL: `http://127.0.0.1:1981/ops#frontend-stack-migration-target`
- What decision am I making? **Do we approve the migration target to Next.js App Router + TypeScript strict mode + shared design system as the single frontend stack for this reset cycle?**
- Why it matters: One approved target prevents split implementation and rework across teams.
- Recommended default: **Approve default — lock this as the migration target now.**
- If approve, what happens next: Architecture docs and implementation tickets align to one stack path.
- If revise, what to provide: Name the replacement stack target and why it beats the default.
- Marker: `/ops:review-burst:rb-arch-001:decision`

### RB-ARCH-002 — Approve Home IA v2 component map (P0)
- URL: `http://127.0.0.1:1981/ops#home-ia-v2-component-map`
- What decision am I making? **Do we approve the Home IA v2 component map as the source of truth for Home layout and content blocks?**
- Why it matters: Locking the map avoids duplicate or conflicting Home modules.
- Recommended default: **Approve default — use Home IA v2 component map as canonical.**
- If approve, what happens next: Home build proceeds against one component map and acceptance checklist.
- If revise, what to provide: Specify exact component changes (add/remove/move) before build freeze.
- Marker: `/ops:review-burst:rb-arch-002:decision`

### RB-ARCH-003 — Approve enterprise nav pattern (top + side) (P0)
- URL: `http://127.0.0.1:1981/ops#enterprise-nav-pattern`
- What decision am I making? **Do we approve a persistent top nav + contextual side nav pattern for enterprise UX across core routes?**
- Why it matters: A single nav pattern reduces cognitive load and onboarding time for operators.
- Recommended default: **Approve default — standardize on top + side nav now.**
- If approve, what happens next: Navigation implementation and QA follow one enterprise pattern.
- If revise, what to provide: Define the alternate nav pattern and which routes are exceptions.
- Marker: `/ops:review-burst:rb-arch-003:decision`

### RB-UI-001 — Keep split Comms views as the default (P0)
- URL: `http://127.0.0.1:1981/comms?view=account&tab=inbox` and `http://127.0.0.1:1981/comms?view=individual&tab=inbox`
- What decision am I making? **Do we keep Account Workspace + Individual Workspace split as the default this cycle?**
- Why it matters: This is the main workflow pattern; changing it now can reintroduce confusion.
- Recommended default: **Approve default — keep split views as standard.**
- If approve, what happens next: Split views stay live and release copy remains controlled.
- If revise, what to provide: State the exact layout change and where it should apply.
- Marker: `/ops:review-burst:rb-ui-001:decision`

### RB-UI-002 — Require checklist before closing review (P0)
- URL: `http://127.0.0.1:1981/ops/reviewer-checklist`
- What decision am I making? **Must every review close pass the full checklist route?**
- Why it matters: It prevents incomplete sign-off from summary-only views.
- Recommended default: **Approve default — checklist pass required before close.**
- If approve, what happens next: Reviews cannot close without checklist completion.
- If revise, what to provide: Specify which checklist step can be optional and why.
- Marker: `/ops:review-burst:rb-ui-002:decision`

## Next

### RB-UI-003 — Hold expansion until one more full replay passes (P1)
- URL: `http://127.0.0.1:1981/ops#reviews`
- What decision am I making? **Do we wait for one more full end-to-end pass before expanding?**
- Why it matters: One clean replay reduces rollback risk.
- Recommended default: **Approve default — wait for one more all-pass replay.**
- If approve, what happens next: Current scope stays in place until replay is posted.
- If revise, what to provide: Name what can expand now and what risk you accept.
- Marker: `/ops:review-burst:rb-ui-003:decision`

### RB-UI-004 — Use Zephyr +10 health move as proof example (P1)
- URL: `http://127.0.0.1:1981/pilot`
- What decision am I making? **Should Zephyr’s 47→57 (+10) result be the reference proof for this cycle?**
- Why it matters: It ties UI changes to a concrete business outcome.
- Recommended default: **Approve default — use Zephyr delta as reference proof.**
- If approve, what happens next: Cycle summary and training use this example.
- If revise, what to provide: Name the replacement example and link supporting proof.
- Marker: `/ops:review-burst:rb-ui-004:decision`

## Live values (cycle sync)
- Pending bursts: **7**
- Completion applier pending applies: **0**
- Completion applier recent failures: **0**
- Primary blockers:
  - **AUTONOMY_GAP mapping loop** — Owner: Ops orchestration lead — ETA: same-day triage/fix
  - **Gateway pairing required** — Owner: platform/device owner — ETA: next operator pairing window

## /ops Markers
- `/ops:review-bursts:sync:2026-02-22T15:46:00-05:00`
- `/ops:review-bursts:source:architecture-home-reset-cycle`
- `/ops:review-bursts:lifecycle-states:pending|approved|revise|implemented|closed`
- `/ops:review-bursts:linkage:review-link:{burst_id}`
- `/ops:review-bursts:pending-count:7`
- `/ops:review-bursts:pinned:rb-arch-001,rb-arch-002,rb-arch-003`
- `/ops:review-burst:actions:approve-recommended|revise`
- `/ops:review-burst:ux:plain-language-template-v2`
- `/ops:review-bursts:top-placement:first-block`
- `/ops:review-burst:inline-context:always-visible`
- `/ops:review-center:auto-upsert:on-decision`
- `/ops:review-center:auto-implemented:on-proof-attach`
- `/ops:review-center:auto-archive:on-close`
- `/ops:review-burst:rb-arch-001:decision`
- `/ops:review-burst:rb-arch-002:decision`
- `/ops:review-burst:rb-arch-003:decision`
