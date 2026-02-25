# Design: Research Job Status Dashboard Widget

## Overview
Create a real-time dashboard widget displaying research job status with progress tracking.

## Context
Building on Phase 1 work: research_jobs table exists, data enrichment pipeline in place.

## Requirements

### Functional
- [ ] List active research jobs (pending, running, completed, failed)
- [ ] Show progress bar for running jobs
- [ ] Display success/failure count cards
- [ ] Calculate and show average enrichment time
- [ ] Auto-refresh every 5 seconds

### Technical
- Use existing Supabase Realtime subscription pattern
- Leverage existing UI component styles
- Follow existing auth patterns (RLS)
- Add to existing dashboard page

## Database Schema (Existing)
```sql
table: research_jobs
- id (uuid)
- user_id (uuid)
- status (text: pending|running|completed|failed)
- progress (integer, 0-100)
- criteria (jsonb)
- results_count (integer)
- error_message (text)
- created_at (timestamp)
- started_at (timestamp)
- completed_at (timestamp)
```

## Component Architecture (REVISED - Extending Existing)

### Component: ResearchJobsList (EXTEND EXISTING)
Location: `app/components/ResearchJobsList.tsx`

**Current:** Basic list with status badges
**Additions:**
1. **StatsDashboard** - Row of 4 stat cards above list:
   - Active Jobs (running)
   - Completed Today
   - Failed Jobs
   - Avg. Enrichment Time
   
2. **EnhancedProgress** - Progress bars for running jobs:
   - Visual bar showing % complete
   - Estimated time remaining
   - Live status indicator
   
3. **QuickActions** - Buttons per job:
   - Cancel running job
   - Retry failed job
   - View results (if completed)

### Sub-components (NEW)
1. **JobStatsCards** - 4 stat cards with icons
2. **ProgressBar** - Reusable progress component
3. **JobActions** - Action buttons per job row

**DO NOT CREATE:** New widget component - extend existing one

## Implementation Notes

### Using Existing Patterns
- Follow lib/db.ts for Supabase client
- Use app/components/ui patterns for cards/buttons
- Reference hooks/use-data-fetch.ts for data fetching
- Match existing error boundary patterns

### New Code Required
- **EXTEND:** app/components/ResearchJobsList.tsx (add stats + progress + actions)
- **CREATE:** app/components/JobStatsCards.tsx (4 stat cards)
- **CREATE:** app/components/JobProgressBar.tsx (progress visualization)
- **CREATE:** app/components/JobActions.tsx (action buttons)
- **TESTS:** __tests__/ResearchJobsList.test.tsx (extend existing tests)

## Testing Strategy
- Unit tests for hook
- Component rendering tests
- Realtime subscription tests
- Error handling tests

## Quality Gates
- [ ] Test coverage >80%
- [ ] TypeScript strict mode passes
- [ ] No console errors
- [ ] Responsive design
- [ ] Accessibility (aria labels)

## Deployment
- Staging: automatic via Vercel preview
- Production: merge to main triggers deploy
