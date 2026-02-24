# Frontend Architecture Reset Plan (Phase 0 → Phase 3)

## Goal
Migrate GTM Command Center from a server-rendered Node monolith (`server.mjs` HTML + route handlers) to a modern app-shell frontend without breaking existing operations.

---

## 1) Current-state audit

## Runtime + architecture observed
- **UI rendering**: Server-side string-template HTML from `server.mjs` (`pageHtml(...)`) with inline CSS and route-specific markup.
- **Server**: Node `http` server handling both UI pages and API endpoints.
- **Data access**: Direct Postgres via `pg` and Supabase via `@supabase/supabase-js` runtime toggle.
- **Auth**: Basic Auth + role guard in server code (`operator` / `admin`) for write routes.
- **Frontend assets**: No bundler-based frontend app; no React component model; no dedicated client routing layer.
- **Styling**: Centralized inline CSS in server template; no design-system package or utility framework.

## Strengths
- Single executable server, minimal moving parts.
- Strong operational route coverage (Ops, Comms, Targeting, Research, Pilot, Strategy).
- Existing APIs already substantial and can be reused by a new frontend.

## Risks / friction points
- `server.mjs` is very large and tightly coupled (rendering + business logic + API + orchestration).
- UI changes require editing monolithic template strings.
- Limited component reuse and testability for UI.
- High cognitive load for adding new interactions and frontend state management.

## Existing route surface (UI)
Primary page routes currently rendered by server:
- `/`
- `/ops`
- `/targeting`
- `/actions`
- `/relationships`
- `/pilot`
- `/comms`
- `/strategy`
- `/research`
- `/health` (JSON/diagnostic)
- plus legacy aliases and workflow-specific routes.

## Existing API surface (selected)
- `/api/command-center/kpis`
- `/api/metrics/snapshot`
- `/api/navigation/url-map`
- `/api/workflows/completeness`
- `/api/readiness/monday`
- `/api/qualified-accounts`
- `/api/sequence-templates`
- `/api/sequence-enrollments`
- `/api/research-ledger`
- `/api/competitive-intel`
- `/api/handoff-queue`
- `/api/ops/review-bursts/live`
- `/api/ops/review-bursts/events`

These APIs make an app-shell migration feasible without immediate backend rewrite.

---

## 2) Target stack proposal

## Recommended frontend stack
- **Framework**: Next.js (App Router)
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS (with design tokens layered over time)
- **State / data fetching**: TanStack Query + typed API client
- **Validation**: Zod for payload contracts
- **Testing**: Playwright (e2e smoke) + Vitest/RTL (component and hooks)

## Why this target
- App Router supports incremental route migration and shared layout/app-shell.
- TypeScript + component model sharply reduces risk in future iteration.
- Tailwind accelerates UI parity and tokenization cleanup from inline CSS.
- Query caching and optimistic updates improve operator workflows (queue/status transitions).

## Backend strategy (recommended)
- Keep current `server.mjs` API endpoints as **source of truth** in early phases.
- New Next app consumes existing APIs (BFF proxy optional).
- Move backend route-by-route later only after frontend parity is verified.

---

## 3) Route-by-route migration plan

## Migration mode
Use **strangler pattern** with side-by-side frontend app:
1. Existing Node-rendered app remains default.
2. Next.js app runs separately (phase 1).
3. Migrate routes in descending business value.
4. Flip traffic route-by-route behind explicit flags.

## Route priority matrix

### Wave A (high leverage / high traffic)
1. `/` (Home command center shell)
2. `/ops`
3. `/targeting`
4. `/actions`
5. `/relationships`

### Wave B (critical supporting flows)
6. `/comms`
7. `/pilot`
8. `/research`
9. `/strategy`

### Wave C (long tail + hardening)
10. legacy aliases (`/setup`, `/home/command`, etc.)
11. utility/diagnostic pages and deep links

## Per-route execution recipe
For each route:
1. Build Next page shell + loading/error states.
2. Consume existing API payloads unchanged.
3. Validate marker parity (existing `data-verify` strategy where applicable).
4. Add smoke tests for route truth + key mutations.
5. Enable route flag for controlled exposure.

---

## 4) Phase-1 bootstrap scaffold (implemented)

A non-breaking starter app is added under:
- `apps/gtm-command-center/frontend-shell`

This scaffold includes:
- Next.js + TypeScript + Tailwind base
- Shared app shell layout + navigation
- Route placeholders for key GTM pages
- API utility layer targeting existing backend (`NEXT_PUBLIC_BACKEND_URL`, default `http://127.0.0.1:1981`)
- Example live data panel (`/ops` pulls `/api/metrics/snapshot`)

Important:
- No existing server behavior changed.
- Existing `apps/gtm-command-center/server.mjs` remains primary runtime.

---

## 5) Verification steps

## Phase-1 verification checklist
1. Current app still runs:
   - `cd apps/gtm-command-center && npm start`
   - Verify `http://127.0.0.1:1981/ops` loads.
2. New frontend installs and runs independently:
   - `cd apps/gtm-command-center/frontend-shell`
   - `npm install`
   - `npm run dev`
   - Open `http://127.0.0.1:3001`
3. API bridge check from new shell:
   - Visit `http://127.0.0.1:3001/ops`
   - Confirm KPI panel resolves from `/api/metrics/snapshot` (or shows safe fallback error state).
4. Route scaffold presence:
   - `/`, `/ops`, `/targeting`, `/actions`, `/relationships`, `/comms`, `/pilot`, `/research`, `/strategy`.

## Migration readiness gates
- [ ] No regression in legacy server-rendered routes.
- [ ] Next shell route parity for Wave A complete.
- [ ] Basic auth/session strategy defined for frontend writes.
- [ ] E2E smoke tests green for both legacy and new shell.

---

## Migration checklist (operator-facing)

- [ ] Stand up `frontend-shell` in CI as separate job.
- [ ] Add typed API contracts for top 10 endpoints.
- [ ] Implement Wave A pages with data parity.
- [ ] Add route truth tests for migrated pages.
- [ ] Add mutation tests for actions/followup/status transitions.
- [ ] Introduce feature flags (`FRONTEND_ROUTE_*`).
- [ ] Cut over `/` and `/ops` first.
- [ ] Decommission legacy render code only after route-level acceptance.
