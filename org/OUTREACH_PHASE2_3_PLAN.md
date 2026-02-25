# Outreach System: Phase 2 + 3 Plan

## Current State
- Phase 1: ✅ Database schema, Apollo integration, scoring engine, job queue
- Phase 1 UI: ✅ Command bar, prospect cards, sequence visualizer, thread panel
- Navigation: 🔄 Building (collapsible sidebar + outreach routes)

## Phase 2: Sequence Builder + A/B Testing Engine

### 1. Sequence Builder
**What**: Allow natural language sequence creation + variation management

**Components**:
- `lib/sequences/builder.ts` - Programmatic sequence builder
- `app/api/sequences/route.ts` - CRUD API for sequences
- `components/sequence-builder/agentic.tsx` - Natural language sequence creator
- Prompt: "Create a 3-touch sequence: Day 1 email about hiring, Day 3 LinkedIn connect, Day 7 call request"

**Deliverables**:
- Natural language → sequence template
- Variant generation (A/B/C)
- Touch point types: email, LinkedIn, call, meeting, SMS
- Wait logic, conditional branching

### 2. A/B Testing Engine
**What**: Automatic variant creation + statistical significance tracking

**Components**:
- `lib/testing/ab-engine.ts` - Traffic split logic
- `lib/testing/significance.ts` - Statistical calculation
- `components/ab-test/variants.tsx` - Variant comparison UI
- Database: `ab_test_results` table

**Deliverables**:
- Split traffic 50/50 or custom distribution
- Track: open rate, click rate, reply rate, meetings booked
- Winner calculation with confidence intervals
- Auto-promote winners

### 3. Campaign Builder (Agentic)
**What**: Natural language campaign creation + targeting

**Components**:
- `lib/campaigns/builder.ts` - Campaign template engine
- `app/api/campaigns/route.ts` - Campaign management API
- `components/campaign-builder/agentic.tsx` - "Create campaign targeting [ICP] with [sequence]"

## Phase 3: Multi-Channel Orchestration + Feedback Loops

### 1. Channel Integrations
**What**: Send/receive across channels

**Integrations**:
- Email (SendGrid/Resend API)
- LinkedIn (via Apollo or browser automation)
- Calendar (Google/Calendly for meeting scheduling)
- Calls (Twilio for call tracking)

**Components**:
- `lib/channels/email.ts` - Send/track opens/clicks
- `lib/channels/linkedin.ts` - Connection requests + messages
- `lib/channels/calendar.ts` - Meeting booking
- `app/api/webhooks/[channel]/route.ts` - Inbound message handling

### 2. Feedback Loop
**What**: Learn from replies/bounces/engagement

**Components**:
- `lib/feedback/analyzer.ts` - Parse replies (positive/negative/out-of-office)
- `lib/feedback/optimizer.ts` - Suggest improvements based on performance
- `components/feedback/dashboard.tsx` - Reply analysis + suggestions
- Database: `feedback_signals` table

**Deliverables**:
- Categorize replies into: interested, not interested, out-of-office, referral, no reply
- Detect sentiment
- Recommend sequence adjustments
- Pause prospects who don't engage after 3 touches

### 3. Intelligence Layer (Light)
**What**: Proactive suggestions based on performance

**Components**:
- `lib/intelligence/recommendations.ts` - Pattern matching for suggestions
- `components/intelligence/suggestions.tsx` - "This sequence performs 34% better, try it?"

**Deliverables**:
- "Your 'hiring' theme has 2x reply rate vs generic"
- "Consider variant B, it shows statistical significance"
- "Engagement dropped, try a new angle"

## Priorities

1. **Phase 2 - Sequence Builder** (ready to queue)
2. **Phase 2 - A/B Engine** (ready to queue)
3. **Phase 2 - Campaign Builder** (ready to queue)
4. **Phase 3 - Email Integration** (needs SendGrid account)
5. **Phase 3 - Feedback Loop** (needs Phase 4 inbound data)

## Blockers
- Email sending API keys (SendGrid/Resend)
- LinkedIn automation (proxy consideration)
- Supabase keys for production

## Can Start Now (No Blockers)
1. Sequence builder (natural language → template)
2. A/B testing engine (traffic split + tracking)
3. Campaign builder (agentic targeting)
