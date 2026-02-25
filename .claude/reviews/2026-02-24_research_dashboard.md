# Research Job Status Dashboard Design Review

**Reviewer:** Subagent Reviewer  
**Date:** 2026-02-24  
**Design Document:** `/Users/alariceverett/.openclaw/workspace/.claude/design/2026-02-24_research_dashboard.md`

---

## Review Verdict: **NEEDS CHANGES** 🔶

The design has good intent but contains several discrepancies with the actual codebase that must be addressed before implementation. Specifically, the **database schema in the design does not match the actual implementation**, which would cause runtime failures.

---

## Critical Issues (Blockers)

### 1. Database Schema Mismatch ⚠️ CRITICAL

**Problem:** The design document's schema doesn't match the actual `research_jobs` table (migration 021_create_research_jobs.sql).

| Design Document | Actual Schema | Impact |
|---------------|---------------|--------|
| `status: pending\|running\|completed\|failed` | `status: pending\|queued\|active\|paused\|completed\|failed\|cancelled` | Code using 'running' will fail |
| `progress: integer` | `progress_percent: integer` | Field not found |
| `results_count: integer` | `results_summary: jsonb` | Different structure entirely |
| `criteria: jsonb` | `search_criteria: jsonb` | Field name mismatch |
| `user_id: uuid` | `user_id: text` | Type mismatch may cause filtering issues |

**Fix Required:** Update design document to reflect actual schema, or create a migration to align schema with design.

---

### 2. Missing Realtime Configuration ⚠️ CRITICAL

**Problem:** The design assumes Supabase Realtime will "just work" but there is no migration enabling Realtime for the `research_jobs` table.

**Evidence:** No `REPLICA IDENTITY FULL` or publication setup found in migrations for the table.

**Fix Required:** Add migration to enable Realtime:
```sql
-- Enable replication for Realtime
ALTER TABLE research_jobs REPLICA IDENTITY FULL;

-- Add to supabase_realtime publication (if not already)
-- This is usually done in Supabase Dashboard or via:
-- CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete');
-- ALTER PUBLICATION supabase_realtime ADD TABLE research_jobs;
```

---

### 3. Component Already Exists ⚠️ CONFLICT

**Problem:** The design proposes creating a new component `ResearchStatusWidget`, but there's already a `ResearchJobsList` component at `/components/research/ResearchJobsList.tsx`.

**Analysis:** The existing component already implements:
- Realtime subscription pattern
- Progress bar display
- Status filtering (active/completed/all)
- Error/result summaries
- Proper error handling

**Fix Required:** Clarify if this is:
- (A) A replacement/refactor of ResearchJobsList
- (B) A new widget to coexist (different scope/UX)
- (C) Should be integrated into the existing component

---

### 4. Incorrect File Path References ⚠️ MINOR

**Problem:** The design references non-existent files as patterns to follow.

| Design Reference | Actual Location | Status |
|----------------|-----------------|--------|
| `lib/db.ts` | `lib/supabase-client.ts` | ❌ Wrong path |
| `hooks/use-data-fetch.ts` | `hooks/use-data-with-states.ts` | ❌ Wrong path |
| `types/research.ts` | `lib/research/types.ts` | ❌ Wrong path |

**Fix Required:** Update design document with correct paths.

---

## Security Review ✓

### RLS Policies
- ✅ RLS is enabled on `research_jobs` table
- ✅ Policies use proper `auth.uid()::text = user_id` pattern
- ✅ All CRUD operations have policies

### Concerns
- **Low:** The `user_id` type mismatch (text in DB vs uuid in design) could cause subtle issues if not handled consistently. The actual schema stores it as text.

---

## Performance Review ✓

### Queries
- ✅ Indexes exist: `idx_research_jobs_user_id`, `idx_research_jobs_status`, `idx_research_jobs_user_status`
- ✅ GIN indexes for JSONB columns

### Realtime Scalability
- **Concern:** The Realtime subscription uses a per-user filter: `filter: "user_id=eq.${userId}"`. This is correct for security but note that Supabase Realtime creates a separate PostgreSQL replication slot per unique filter. 

- **Recommendation:** With the default 5-second refresh interval as fallback, this is acceptable for current scale but should be monitored.

---

## Technical Approach Assessment

### ✅ Good Practices Found
1. **Supabase Client Pattern:** The existing `lib/supabase-client.ts` uses singleton pattern to prevent Navigator LockManager errors - this should be used instead of creating new clients.

2. **Error Boundary Pattern:** The existing error boundary components provide a good pattern to follow.

3. **Component Structure:** The existing KpiCard and ProgressBar components can be reused.

### ⚠️ Issues

1. **Hook Pattern Mismatch:** The existing `use-data-with-states.ts` uses `next-auth/react` session, but the app uses Supabase auth via `auth-provider.tsx`. The new hook should use the `useAuth()` hook pattern.

2. **Stats Calculation:** The design mentions calculating "average enrichment time" but doesn't specify how this should be computed from the existing schema fields (`started_at`, `completed_at`). The formula should be documented.

---

## Recommendations

### Immediate Actions (Before Implementation)

1. **Fix Schema Documentation**
   - Update the design document with the actual schema from migration 021
   - OR create a migration to add missing columns if the design's simplified schema is preferred

2. **Add Realtime Migration**
   - Create migration to enable Realtime on research_jobs table

3. **Clarify Component Scope**
   - Decide if ResearchStatusWidget replaces ResearchJobsList or is a separate feature

4. **Update File References**
   - Fix all file path references in design document

### Code Review Notes

The existing `ResearchJobsList.tsx` already implements most of the requirements:
- ✅ Realtime subscription with proper cleanup
- ✅ Status filtering (active/completed/all)
- ✅ Progress display
- ✅ Error message display
- ✅ Results summary display

**Missing from existing component:**
- Stats cards (pending/running/completed/failed counts)
- Average duration calculation
- Auto-refresh fallback (currently relies only on Realtime)

### Suggested Refactor

Rather than creating a new component, consider:

1. **Option A:** Extend `ResearchJobsList` to add:
   - Stats cards at the top
   - Auto-refresh interval (5s) as Realtime fallback
   - Error boundary wrapper

2. **Option B:** Create `ResearchDashboardWidget` that:
   - Uses `ResearchJobsList` internally
   - Adds stats visualization
   - Is used as a higher-level dashboard component

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Technical Approach | ⚠️ Needs Fix | Schema mismatch, path errors |
| Supabase Realtime | ⚠️ Needs Migration | Realtime not enabled in DB |
| RLS Policies | ✅ Good | Properly configured |
| Performance | ✅ Good | Indexes exist, queries efficient |
| Error Handling | ✅ Good | Pattern exists to follow |
| Security | ✅ Good | RLS enabled, auth proper |

---

## Conclusion

**Do not proceed with implementation until:**
1. Schema is reconciled between design and actual database
2. Realtime is enabled for research_jobs table
3. Component scope is clarified (new vs extend existing)
4. File paths are corrected in design

The design is well-intentioned but requires alignment with the actual codebase state before development can safely proceed.
