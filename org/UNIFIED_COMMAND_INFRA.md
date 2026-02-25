# Unified Command Infrastructure

## Architecture: One Entry Point

```
User Command (natural language)
         ↓
    [Command Parser]
         ↓
    Intent Detected
         ↓
    ┌─────┴─────┐
research   campaign   sequence
    │          │          │
    ▼          ▼          ▼
[Queue Worker]  [Queue Worker]  [Queue Worker]
    │                  │              │
    ▼                  ▼              ▼
[Visual Results] [Visual Results] [Visual Results]
         ↓
    [Suggestions]
         ↓
User Refines / Executes
```

## Workers (Async Processing)

### 1. Research Worker (`workers/research.ts`)
**Triggers:** Research job created
**Flow:**
1. Poll Apollo via MCP
2. Enrich prospects
3. Score quality
4. Update completion %
5. Stream results to UI
6. Suggest: "Create campaign from these 23 A+ prospects?"

### 2. Sequence Worker (`workers/sequence.ts`)
**Triggers:** Sequence step scheduled + Campaign active
**Flow:**
1. Check prospect status
2. Select variant (A/B test split)
3. Send via channel (email/LinkedIn)
4. Schedule next step
5. Update prospect "last contact"

### 3. Analytics Worker (`workers/analytics.ts`)
**Triggers:** Webhook event received
**Flow:**
1. Process webhook (open/click/reply/meeting)
2. Update campaign metrics
3. Check A/B test significance
4. If winner determined → promote variant
5. If engagement drops → suggest new angle

## Webhook Handlers (Inbound Events)

### Email (`app/api/webhooks/email/route.ts`)
**Events:** opened, clicked, replied, bounced
- Opens: Track timing, device, location
- Clicks: UTM tracking, link performance
- Replies: Sentiment analysis (positive/negative/OOF)
- Bounces: Pause, flag for manual review

### LinkedIn (`app/api/webhooks/linkedin/route.ts`)
**Events:** connection accepted, message read, replied
- Connection: Move to "connected" status
- Message read: Track timing
- Reply: Parse intent, categorize

### Calendar (`app/api/webhooks/calendar/route.ts`)
**Events:** meeting booked, cancelled, no-show
- Booked: Campaign success metric
- No-show: Flag for follow-up
- Cancelled: Suggest reschedule

## Unified Command Examples

### Command → Execution

**"Research CMOs at fintechs Series B+ in NYC"**
```
Parse: { action: 'research', icp: {...} }
Queue: research job
Visual: Progress card → prospect cards
Suggest: "Create hiring campaign?"
```

**"Create campaign targeting those with 3-touch sequence"**
```
Parse: { action: 'campaign', icp: 'previous', sequence: '3-touch' }
Queue: campaign creation
Visual: Campaign card with sequence timeline
Suggest: "A/B test subject lines?"
```

**"A/B test: 'Join our team' vs 'Scale with us'"**
```
Parse: { action: 'ab_test', variants: [...] }
Queue: test activation
Visual: Variant comparison dashboard
Auto: Winner promotion when significant
```

## Visual Outputs (Beautiful, Not Forms)

### Research Complete
- **Prospect Cards:** Photo, grade, company, signals, swipe actions
- **Map View:** Geographic distribution
- **Timeline:** When prospects were found
- **Filters:** Dynamic by command, not form

### Campaign Running
- **Live Metrics:** Real-time opens, clicks, replies
- **Sequence Flow:** Visual timeline with progress
- **Suggestion Cards:** "Variant A winning, promote?"
- **Reply Stream:** Incoming responses categorized

### A/B Test Active
- **Variant Bars:** Side-by-side performance
- **Confidence Indicator:** "94% significant" when ready
- **Projected Winner**: Auto-calculated
- **Auto-promote Toggle**: Set threshold, hands-off

## Technical Flow

```
[Command Bar Input]
     ↓
middleware: command-parser.ts
     ↓
Intent → Action type
     ↓
API route handler
     ↓
DB: Create job/queue item
     ↓
Worker picks up (cron/poll)
     ↓
Execute with progress updates
     ↓
Supabase Realtime → UI updates
     ↓
Suggestion engine → recommend next
     ↓
User command continues thread

Workers run via Vercel Cron (15min) or Supabase Edge (immediate)
```

## API Routes

```
POST /api/commands          # Main entry (replaces separate endpoints)
GET  /api/research/jobs     # List user jobs
GET  /api/research/jobs/:id # Job details + results
GET  /api/campaigns         # Active campaigns
GET  /api/prospects         # Enriched prospects
POST /api/webhooks/:channel # Inbound events
```

## Deployment

- Workers: Vercel Cron (15min) or Supabase Edge Functions
- Webhooks: API routes (real-time)
- UI: Realtime subscriptions for live updates
