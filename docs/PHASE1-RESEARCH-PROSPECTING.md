# AdZeta Phase 1: Research & Prospecting Foundation

## Overview
Complete research + prospecting infrastructure with database schema, Apollo.io integration, and prospect quality scoring.

## Deliverables

### 1. Database Schema (Supabase Migrations)

| File | Table | Description |
|------|-------|-------------|
| `001_prospects.sql` | `prospects` | Core prospect data with company/contact info, quality A-F grading, signals, and enrichment data |
| `002_research_jobs.sql` | `research_jobs` | Queue for discovery tasks with progress tracking (0-100%) |
| `003_outreach_campaigns.sql` | `outreach_campaigns` | Campaign definitions with targeting params |
| `004_outreach_sequences.sql` | `outreach_sequences` | Multi-step sequences with A/B variant support |
| `005_communications.sql` | `communications` | All touch points: email, LinkedIn, call, meeting |
| `006_channel_performance.sql` | `channel_performance` | Split test results by channel/message variant |

**Key Features:**
- Full-text search on prospects
- JSONB for flexible signal and metadata storage
- Row Level Security (RLS) policies
- Automated rate calculation triggers
- Views for performance analytics

### 2. Apollo.io Integration

| File | Purpose |
|------|---------|
| `src/lib/apollo/client.ts` | MCP client with retry logic, rate limiting, and TypeScript types |
| `src/lib/apollo/enrichment.ts` | Prospect data enrichment with signal detection |

**Features:**
- Person/organization search
- Individual and bulk enrichment
- Signal detection (funding, hiring, tech stack)
- Confidence scoring
- Rate limit tracking

### 3. Quality Scoring Engine

| File | Description |
|------|-------------|
| `src/lib/scoring/prospect-quality.ts` | A-F scoring based on ICP fit and buying signals |

**Scoring Components:**
- **Company Fit (35 pts)**: Industry, size, location, revenue
- **Contact Fit (25 pts)**: Title, department, seniority
- **Signal Score (60 pts)**: Funding, hiring, intent, tech alignment
- **Timing (20 pts)**: Event recency, engagement history

**Signal Detection:**
- Funding raised (recent vs. historical)
- Hiring activity (role count, relevance)
- Tech stack matches
- Intent data from keywords/events
- Previous engagement

**Recommended Actions:**
- `A` grade → Immediate outreach
- `B` grade → Immediate outreach (high signals) or nurture
- `C` grade → Nurture sequence
- `D/E` grades → Low priority
- `F` grade → Auto-blacklist

### 4. Research Job Queue

| File | Description |
|------|-------------|
| `src/lib/research/job-queue.ts` | Async job processing with worker pool |
| `src/app/api/research/jobs/route.ts` | REST API for job management (list, create, bulk update) |
| `src/app/api/research/jobs/[id]/route.ts` | Individual job management (GET, PUT, DELETE) |
| `src/app/api/research/jobs/[id]/progress/route.ts` | UI-ready progress tracking endpoint |
| `src/lib/services/job-queue-service.ts` | Singleton service with default processors |

**Job Types:**
- `prospect_search` - Apollo search + enrichment
- `company_enrichment` - Company data enrichment
- `signal_detection` - Scan for buying signals
- `bulk_import` - CSV/list import
- `list_building` - Build targeted prospect lists
- `data_cleansing` - Data quality tasks
- `competitor_research` - Competitor analysis

**Progress Tracking:**
- Real-time percentage updates
- Records processed/total
- Success/error/skip counts
- Estimated time remaining
- Processing rate (records/min)
- Result summary

### 5. Environment Configuration

```bash
# Required
APOLLO_API_KEY=your_apollo_api_key
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
APOLLO_BASE_URL=https://api.apollo.io/v1
APOLLO_TIMEOUT=30000
APOLLO_MAX_RETRIES=3
RESEARCH_WORKERS=3
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/research/jobs` | List jobs with filters |
| POST | `/api/research/jobs` | Create new job |
| PUT | `/api/research/jobs` | Bulk action (pause/resume/cancel) |
| GET | `/api/research/jobs/[id]` | Get job details |
| PUT | `/api/research/jobs/[id]` | Update job (pause/cancel/retry) |
| DELETE | `/api/research/jobs/[id]` | Delete completed job |
| GET | `/api/research/jobs/[id]/progress` | Get real-time progress |

## Usage Example

```typescript
import { createEnrichmentService } from '@/lib/apollo/enrichment';
import { ProspectQualityScorer } from '@/lib/scoring/prospect-quality';
import ResearchJobQueue from '@/lib/research/job-queue';

// 1. Search for prospects
const enrichment = createEnrichmentService();
const results = await enrichment.searchAndEnrich({
  filters: {
    industries: ['saas', 'fintech'],
    companySize: ['51-200', '201-500'],
    jobTitles: ['vp engineering', 'director infrastructure'],
    technologies: ['aws', 'kubernetes'],
    signalTypes: ['hiring', 'funding'],
  },
  limit: 1000,
});

// 2. Score prospects against ICP
const scorer = new ProspectQualityScorer({
  targetIndustries: ['saas', 'fintech'],
  targetSize: ['51-200', '201-500'],
  targetTitles: ['vp', 'director', 'head'],
  targetDepartments: ['engineering', 'operations'],
  targetSeniorities: ['manager', 'director', 'vp'],
});

const scored = results.map(r => scorer.score({
  companyName: r.organization?.name!,
  industry: r.organization?.industry,
  size: r.organization?.size,
  techStack: r.organization?.technologies || [],
  contactTitle: r.person?.title,
  signals: r.signals,
}));

// 3. Submit research job for batch processing
const jobQueue = new ResearchJobQueue({ supabase });
const job = await jobQueue.createJob({
  name: 'Weekly ICP Search',
  type: 'prospect_search',
  searchParams: {
    filters: { /* ... */ },
    limit: 1000,
  },
  createdBy: userId,
});
```

## Verification Status

| Component | Status | Files |
|-----------|--------|-------|
| Database Migrations | ✅ VERIFIED | 6 migrations created |
| Apollo Client | ✅ VERIFIED | client.ts, enrichment.ts |
| Quality Scoring | ✅ VERIFIED | prospect-quality.ts |
| Research Job Queue | ✅ VERIFIED | job-queue.ts, service |
| API Routes | ✅ VERIFIED | 3 routes created |
| TypeScript Build | ✅ VERIFIED | Compiles successfully |

## Next Steps (Phase 2)

1. **Sequence Management UI**
   - Drag-and-drop sequence builder
   - Template library
   - Variant editing

2. **Campaign Execution**
   - Email sending integration (SendGrid/AWS SES)
   - LinkedIn automation
   - Scheduling engine

3. **Analytics Dashboard**
   - Performance charts
   - A/B test results
   - Funnel visualization

4. **Workflow Automation**
   - Trigger-based sequences
   - Lead routing rules
   - CRM sync
