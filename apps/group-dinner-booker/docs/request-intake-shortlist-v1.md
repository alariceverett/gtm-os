# Request Intake + Shortlist Logic — v1 Scaffold

## Scope

This scaffold covers the **front half of Flow 1**:
1. Accept organizer event intake payload
2. Validate core constraints
3. Score and rank candidate restaurants for a first-pass shortlist

Out of scope in this scaffold:
- DB writes/migrations for intake objects
- External API integrations
- Real-time availability checks

## Implemented Files

- `src/lib/domain/types.ts`
  - Shared TypeScript domain contracts for intake, candidates, and scored shortlist output.
- `src/lib/validators/request-intake.ts`
  - Guardrails for event request payload validity.
- `src/lib/shortlist/score.ts`
  - v1 deterministic weighted scoring and top-N shortlist selection.
- `src/server/services/request-intake.service.ts`
  - Orchestrates validate → shortlist and returns normalized service result.
- `src/server/services/request-intake.example.ts`
  - Example invocation for local inspection and wiring reference.

## v1 Scoring Weights

- Neighborhood match: 30
- Budget compatibility: 20
- Party-size fit signal: 20
- Dietary fit signal: 10
- Accessibility fit signal: 10
- Platform/direct-link coverage: 10

Total possible score: 100.

## Service Contract

`intakeAndShortlist(intake, candidatePool, maxResults?)` returns:
- `intakeAccepted` (boolean)
- `validationErrors` (field/message list)
- `shortlist` (sorted descending by score)

## Acceptance Checks (Scaffold)

Use this checklist to validate baseline behavior before wiring UI/API routes:

- [ ] Invalid intake payload (missing title, bad date, invalid party range) returns `intakeAccepted=false` with non-empty `validationErrors`.
- [ ] Valid intake payload returns `intakeAccepted=true` and no validation errors.
- [ ] Shortlist output is sorted by descending `score`.
- [ ] `maxResults` is respected (default 5).
- [ ] Result items include `breakdown` and human-readable `reasons` for explainability.
- [ ] Tie-breaker is deterministic (`candidate.name` ascending when scores match).

## Next Wiring Tasks

1. Add route handler `POST /api/events/intake-shortlist` using this service.
2. Persist accepted intake as `events` row + initial activity log.
3. Convert shortlist picks into `event_candidates` records (`shortlisted`).
4. Add unit tests for validator and scorer modules.
5. Add product-UX copy for “why this restaurant ranked”.
