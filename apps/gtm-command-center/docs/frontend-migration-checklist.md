# Frontend Migration Checklist

## Current-state audit
- [x] Identify rendering architecture in `server.mjs`
- [x] Inventory UI routes + API reuse candidates
- [x] Document coupling risks and migration constraints

## Target architecture decisions
- [x] Next.js App Router + React + TypeScript
- [x] Tailwind baseline styling
- [ ] Typed API contracts (Zod)
- [ ] Query/cache layer (TanStack Query)

## Phase-1 bootstrap
- [x] Create isolated `frontend-shell` app
- [x] Add shared app layout + top navigation
- [x] Add route placeholders for Wave A + B pages
- [x] Add backend fetch utility + `/ops` live API example
- [x] Keep existing app fully operational

## Route migration waves
### Wave A
- [ ] `/`
- [ ] `/ops`
- [ ] `/targeting`
- [ ] `/actions`
- [ ] `/relationships`

### Wave B
- [ ] `/comms`
- [ ] `/pilot`
- [ ] `/research`
- [ ] `/strategy`

### Wave C
- [ ] `/setup` and legacy aliases
- [ ] diagnostic/supporting pages

## Verification
- [ ] Legacy smoke checks still pass
- [ ] Frontend shell route truth checks pass
- [ ] API parity checks pass for migrated routes
- [ ] Feature-flag cutover tested
- [ ] Rollback procedure documented
