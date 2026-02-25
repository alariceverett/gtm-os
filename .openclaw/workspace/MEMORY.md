# MEMORY.md - Curated Project Context

## Identity
- **Name:** Alaric Everett
- **Role:** AI assistant to Jim Kernan (CRO at AdZeta)
- **Mode:** High autonomy, minimal interruptions
- **Vibe:** Direct, capable, opinionated

## Project: GTM Operating System (gtm-os)

### Current Status (2026-02-25)
**Live URL:** https://gtm-os.vercel.app  
**GitHub:** github.com/alariceverett/gtm-os  
**Tests:** 78 passing

### Architecture
- **Stack:** Next.js 16 + TypeScript + Tailwind + Supabase + Vercel
- **App:** Restaurant dashboard (production) + Outreach system (in development)
- **CI:** GitHub Actions → Vercel auto-deploy

### Completed

#### Phase 1: Core Infrastructure ✅
- 6 database migrations (prospects, campaigns, sequences, etc.)
- Apollo MCP integration (prospect research)
- Quality scoring engine (A-F grades)
- Research job queue with real-time progress
- 78 unit/integration tests

#### UI Layer ✅
- Command bar (natural language primary)
- Prospect cards (swipeable)
- Research progress cards (live)
- Sequence A/B visualizer
- Conversation thread panel
- Suggestion carousel
- Collapsible navigation sidebar
- Apollo MCP client
- Intent parser

### In Progress

#### Phase 2: Building
- Sequence builder + A/B testing engine
- Queue workers (research, sequences, analytics)
- Webhook handlers (email, LinkedIn, calendar)

### Design Principles

1. **Agentic first** - Command bar primary, no forms
2. **Beautiful visuals** - Cards, sparklines, animations
3. **Natural language** - "Find CMOs at fintechs Series B+"
4. **Extensible theme** - Design tokens (pending)

### Verification Protocol
- Check files exist before reporting success
- Run builds (`npm run build`) before claiming complete
- Show verification output

### Failures Logged
- 2026-02-25 04:52: Agent hallucinated 602 tests (0 actual)
- Fix: Created verification checklist, strict validation

### Outstanding Blockers
- Supabase credentials for production data
- SendGrid/Resend for email sending
- LinkedIn automation (proxy considerations)

### Commands
- `npm run test` - 78 tests
- `npm run build` - Production build
- `npm run dev` - Local development

### Work Patterns
- Spawn subagents for parallel builds
- Verify before reporting
- Fix TypeScript issues manually when agents create them
- Commit often, push to main

### Files to Load at Session Start
1. `memory/YYYY-MM-DD.md` (today's log)
2. `org/WORK_QUEUE.md` (active priorities)
3. `org/design/AGENTIC_OUTREACH_UI.md` (design spec)
4. `org/OUTREACH_PHASE2_3_PLAN.md` (roadmap)
