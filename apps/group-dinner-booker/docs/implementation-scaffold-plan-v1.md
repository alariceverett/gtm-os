# Implementation Scaffold Plan — Group Dinner Booker (NYC) v1

## 1) Technical Architecture (Practical v1)

- **Frontend:** Next.js App Router + TypeScript
- **Backend:** Next.js Route Handlers / Server Actions
- **DB:** Postgres (Supabase or managed Postgres)
- **Auth:** Supabase Auth / NextAuth (email link)
- **Email sending (optional v1.1):** Resend/Postmark

## 2) Suggested Folder Scaffold

```txt
apps/group-dinner-booker/
  src/
    app/
      (dashboard)/
      events/[eventId]/
      api/
    components/
      events/
      candidates/
      outreach/
      timeline/
    lib/
      db/
      validators/
      status-machine/
    server/
      services/
        events.service.ts
        candidates.service.ts
        outreach.service.ts
        reservations.service.ts
  db/
    schema.sql
```

## 3) Domain Services (first implementation)

### events.service
- `createEvent(input)`
- `updateEvent(eventId, patch)`
- `setEventStatus(eventId, status)`
- `confirmEvent(eventId, confirmationPayload)`

### candidates.service
- `addCandidate(eventId, restaurantInput)`
- `updateCandidateStatus(candidateId, nextStatus, reason)`
- `listCandidatesByStatus(eventId)`
- `getNeedsAttention(eventId)`

### reservations.service
- `logReservationAttempt(candidateId, payload)`
- `markPlatformBooked(candidateId, confirmationCode)`

### outreach.service
- `generateOutreachDraft(candidateId)`
- `logOutbound(candidateId, message)`
- `logInbound(candidateId, message)`
- `scheduleFollowUp(candidateId, dueAt)`

## 4) API Surface (v1)

- `POST /api/events`
- `PATCH /api/events/:eventId`
- `POST /api/events/:eventId/candidates`
- `PATCH /api/candidates/:candidateId/status`
- `POST /api/candidates/:candidateId/reservation-attempts`
- `POST /api/candidates/:candidateId/outreach/outbound`
- `POST /api/candidates/:candidateId/outreach/inbound`
- `GET /api/events/:eventId/timeline`
- `POST /api/events/:eventId/confirm`

## 5) UX Screens (ship order)

1. **Event List + Create Event Modal**
2. **Event Detail with Candidate Pipeline**
3. **Candidate Detail Drawer**
   - reservation path tab
   - outreach tab
   - timeline tab
4. **Needs Attention Filter View**
5. **Final Confirmation Modal**

## 6) Status Machine Guardrails

Implement explicit transition map in `lib/status-machine/candidate.ts`:
- validate legal transitions
- write `status_history` for every accepted transition
- deny invalid transitions at service layer and API layer

## 7) Migration + Seed Plan

- Create baseline schema from `db/schema.sql`
- Seed 20 NYC restaurants across neighborhoods for local demos
- Seed one sample event with mixed candidate statuses

## 8) Milestones

### Milestone 1 (Day 1–2)
- Schema + migrations
- Event CRUD
- Candidate CRUD + status changes

### Milestone 2 (Day 3–4)
- Reservation attempt logging
- Outreach logging (outbound/inbound)
- Needs Attention filters

### Milestone 3 (Day 5)
- Timeline view
- Final confirmation workflow
- Basic QA + demo script

## 9) v1 QA Checklist

- Can create event and save all constraints
- Can add candidate, change status, and see history entry
- Can log reservation attempt and view it later
- Can log outbound outreach and set follow-up
- Overdue follow-up appears in Needs Attention
- Confirming one candidate prevents second confirmed candidate for same event

## 10) Immediate Next Build Tasks

1. Wire DB + run schema
2. Implement status machine module and tests
3. Build Event Detail page with Kanban-ish status columns
4. Add outreach draft template generator
5. Implement timeline API + UI component

## 11) Added v1 Intake + Shortlist Scaffold (this iteration)

Implemented starter modules:
- `src/lib/domain/types.ts`
- `src/lib/validators/request-intake.ts`
- `src/lib/shortlist/score.ts`
- `src/server/services/request-intake.service.ts`
- `src/server/services/request-intake.example.ts`
- `docs/request-intake-shortlist-v1.md`

Acceptance checks are documented in `docs/request-intake-shortlist-v1.md` under **Acceptance Checks (Scaffold)**.
