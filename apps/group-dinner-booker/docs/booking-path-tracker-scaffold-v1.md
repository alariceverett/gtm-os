# Booking Path Tracker Scaffold — Migration Notes & Acceptance Checks

## Scope
Adds scaffolding for per-candidate booking-path tracking across:
- `resy`
- `opentable`
- `manual_outreach`

Each path has independent status, timestamps, and notes.

---

## Schema Changes
Updated `db/schema.sql` with:

1. New enums:
   - `booking_path`
   - `booking_path_status`

2. New table:
   - `candidate_booking_paths`
     - `path`, `status`
     - `status_changed_at`
     - `first_attempted_at`, `last_attempted_at`, `completed_at`
     - `status_note`
     - unique constraint on `(event_candidate_id, path)`

3. New indexes:
   - `idx_candidate_booking_paths_candidate`
   - `idx_candidate_booking_paths_status`

---

## Migration Notes (for existing DBs)
If this is not a fresh setup, apply incremental SQL migration in this order:

1. Create enums (`booking_path`, `booking_path_status`)
2. Create `candidate_booking_paths`
3. Create indexes
4. Backfill rows for existing candidates:

```sql
insert into candidate_booking_paths (event_candidate_id, path)
select ec.id, p.path::booking_path
from event_candidates ec
cross join (values ('resy'), ('opentable'), ('manual_outreach')) as p(path)
on conflict (event_candidate_id, path) do nothing;
```

5. (Optional) Backfill `status` heuristics from historical data (`reservation_attempts`, `outreach_messages`) in a later migration.

---

## API + Service Scaffold Added

### Route stubs
- `GET /api/candidates/:candidateId/booking-paths`
- `POST /api/candidates/:candidateId/booking-paths` (initialize default rows)
- `GET /api/candidates/:candidateId/booking-paths/:path`
- `PATCH /api/candidates/:candidateId/booking-paths/:path`

### Service stubs
- `listBookingPathTrackers(candidateId)`
- `initializeBookingPathTrackers(candidateId)`
- `getBookingPathTracker(candidateId, path)`
- `upsertBookingPathStatus(input)`

### Shared interface/types
- `BookingPath`, `BookingPathStatus`
- `BookingPathTrackerRecord`
- `UpsertBookingPathStatusInput`

---

## Acceptance Checks (Scaffold-Level)

1. **Schema compiles**
   - Applying `db/schema.sql` creates `candidate_booking_paths` and both enums without errors.

2. **Path uniqueness enforced**
   - Duplicate `(event_candidate_id, path)` insert fails.

3. **Timestamp + note columns present**
   - Table contains `status_changed_at`, `first_attempted_at`, `last_attempted_at`, `completed_at`, `status_note`.

4. **Route files exist and are wired to service stubs**
   - Both route handlers compile and call booking-path service functions.

5. **Stubs return explicit TODO behavior**
   - Unimplemented service methods throw clear TODO errors.
   - API routes return `501 booking_path_tracker_not_implemented` until implementation is completed.
