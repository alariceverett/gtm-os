# Autonomous Outreach & Research Platform — Architecture & Implementation Plan

**Version:** 1.0  
**Date:** 2026-02-24  
**Status:** Design Complete → Ready for Implementation  
**Owner:** Agent Architecture Subagent  

---

## Executive Summary

This document defines the architecture for expanding the GTM Command Center into a full autonomous outreach and research platform. The system will enable natural language command interfaces, automated prospect research via Apollo.io, multi-channel outreach orchestration, and ABM campaign generation—all with robust safety controls and human oversight.

**Vision:** An AI-native GTM operating system where operators describe targets in plain English; the system handles research, enrichment, personalization, and multi-touch orchestration; humans provide oversight and handle high-leverage relationship moments.

---

## 1. Agent Architecture Design

### 1.1 Organization Chart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GTM COMMAND CENTER                                    │
│                    Autonomous Outreach Platform                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │  ORCHESTRATOR LEAD  │─── Central router, workflow management, escalations│
│  └──────────┬──────────┘                                                    │
│             │ delegates to divisions                                          │
│             ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      DIVISION LEADS                                      ││
│  ├──────────────────┬──────────────────┬──────────────────┬────────────────┤│
│  │  RESEARCH DIV    │  OUTREACH DIV    │  CAMPAIGN DIV    │  OPS DIV       ││
│  │  ┌────────────┐  │  ┌────────────┐  │  ┌────────────┐  │  ┌──────────┐  ││
│  │  │intelligence│  │  │  outreach  │  │  │   abm-gen  │  │  │  ops-runner│  ││
│  │  │   lead     │  │  │   lead     │  │  │    lead    │  │  │    lead    │  ││
│  │  └─────┬──────┘  │  └─────┬──────┘  │  └─────┬──────┘  │  └─────┬──────┘  ││
│  │        │ spawns  │        │ spawns  │        │ spawns  │        │ spawns  ││
│  │   ┌────┴────┐    │   ┌────┴────┐    │   ┌────┴────┐    │   ┌────┴────┐    ││
│  │   ▼         ▼    │   ▼         ▼    │   ▼         ▼    │   ▼         ▼    ││
│  │ research  data- │ email     social-│ content   persona│ tooling-  qa-risk││
│  │           analytics      linkedin   │    ─         gen │ env                        ││
│  │                  │  sms       ├──────►     │                  ││
│  │                  │                   │                  │                  ││
│  └──────────────────┴──────────────────┴──────────────────┴──────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    INFRASTRUCTURE DIVISION                            ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ││
│  │  │  mcp-    │  │  queue   │  │ database │  │  safety  │  │  audit   │  ││
│  │  │  server  │  │  worker  │  │   layer  │  │  guard   │  │  logger  │  ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Division Lead Specifications

#### Research Division (`intelligence`)
- **Primary Agent:** `intelligence` (already configured)
- **Responsibility:** Prospect discovery, account enrichment, signal monitoring
- **Spawns:** `research`, `data-analytics`
- **APIs:** Apollo.io, Clearbit, BuiltWith (technographics), Crunchbase (funding)
- **Outputs:** Enriched account records, intent signals, research summaries

#### Outreach Division (`outreach` - NEW)
- **Primary Agent:** `outreach` (to be configured)
- **Responsibility:** Multi-channel message delivery, reply monitoring, engagement tracking
- **Spawns:** Email workers, LinkedIn workers, SMS workers
- **APIs:** SendGrid/Mailgun (email), LinkedIn API (social), Twilio (SMS/voice)
- **Outputs:** Delivery confirmations, engagement metrics, reply classifications

#### Campaign Division (`abm-gen` - NEW)
- **Primary Agent:** `abm-gen` (to be configured)
- **Responsibility:** ABM strategy generation, content personalization, sequence design
- **Spawns:** `content` generator, `persona` analyzer
- **APIs:** Claude (content generation), CMS (content library)
- **Outputs:** Campaign blueprints, personalized content, touch sequences

#### Operations Division (`ops-runner` - exists)
- **Primary Agent:** `ops-runner` (already configured)
- **Responsibility:** Queue management, rate limiting, compliance monitoring, human review routing
- **Spawns:** `tooling-env`, `qa-risk`
- **Functions:** Rate limit enforcement, approval gates, audit logging, error handling

### 1.3 Communication Protocols

#### 1.3.1 Message Bus Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT BUS (Redis/RabbitMQ)               │
├─────────────────────────────────────────────────────────────┤
│  Channels:                                                  │
│  • research.completed → enrichment needed                   │
│  • account.enriched → campaign generation triggered         │
│  • campaign.ready → approval required                       │
│  • message.approved → send to outreach queue               │
│  • message.delivered → engagement tracking                 │
│  • reply.received → classification → human or auto         │
│  • error.occurred → circuit breaker or escalation          │
└─────────────────────────────────────────────────────────────┘
```

#### 1.3.2 Agent Handoff Contract

All inter-agent communication follows the structured handoff schema:

```json
{
  "handoff": {
    "from": "agent-id",
    "to": "agent-id",
    "task": {
      "id": "uuid",
      "type": "research|enrich|generate|send|approve",
      "priority": 1-5,
      "ttl": "ISO-8601 duration"
    },
    "payload": {
      "artifact_refs": ["file-paths"],
      "context_summary": "max 200 chars",
      "constraints": ["list of must-follow rules"],
      "approval_required": true|false
    },
    "provenance": {
      "parent_task": "uuid",
      "spawn_chain": ["agent-1", "agent-2"],
      "created_at": "timestamp"
    }
  }
}
```

#### 1.3.3 Status Broadcasting

Each division publishes heartbeat status every 60 seconds:

```json
{
  "agent": "division-lead-id",
  "status": "healthy|degraded|error",
  "metrics": {
    "tasks_queued": 0,
    "tasks_processing": 0,
    "success_rate_1h": 0.98,
    "avg_processing_time_ms": 1500
  },
  "capacity": {
    "concurrent_tasks": 10,
    "available_slots": 7
  }
}
```

### 1.4 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT LAYER                                                                │
│  ┌─────────┐  Natural Language Commands                                     │
│  │  User   │  "Research 50 VP Sales in Series A SaaS"                      │
│  └────┬────┘                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │              COMMAND INTERPRETER                         │              │ │
│  │                                                           │              │ │
│  │  Parse → Validate → Expand → Create Task Spec            │              │ │
│  │  "Research" → Apollo API → filters → job manifest        │              │ │
│  └──────────────────────┬──────────────────────────────────────────────────┘ │
│                         │                                                    │
│                         ▼                                                    │
│  RESEARCH LAYER          │ Apollo.io MCP                                    │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Apollo    │─►│  Account Scraper │─►│  Enrichment      │                 │
│  │   MCP      │  │  (Apollo API)     │  │  (Clearbit/BuiltWith)│              │
│  └────────────┘  └──────────────────┘  └──────────────────┘                 │
│                         │                                                    │
│                         ▼                                                    │
│  DATABASE LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ ││
│  │  │ Accounts │  │ Contacts │  │Campaigns │  │ Messages │  │ Analytics│ ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ ││
│  │       ▲            ▲            ▲            ▲            ▲          ││
│  └───────┼────────────┼────────────┼────────────┼────────────┼──────────┘│
│          │            │            │            │            │            │
│          └────────────┴────────────┴────────────┴────────────┘            │
│                         │                                                    │
│                         ▼                                                    │
│  CAMPAIGN LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ABM Strategy Generator → Content Personalizer → Sequence Builder        ││
│  │  "Create ABM campaign for TechCorp"                                     ││
│  │   ↓                                                                      ││
│  │  [Account Research] → [Persona Analysis] → [Message Variants]          ││
│  │   ↓                                                                      ││
│  │  Campaign Blueprint → Approval Queue                                     ││
│  └───────────────────────────┬─────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼ (on approval)                                  │
│  OUTREACH LAYER                                                             │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐              │
│  │   Email      │  LinkedIn    │     SMS      │   Voice      │              │
│  │   Worker     │   Worker     │   Worker     │   (Twilio)   │              │
│  ├──────────────┼──────────────┼──────────────┼──────────────┤              │
│  │ SendGrid/    │ LinkedIn     │ Twilio       │ (Future)     │              │
│  │ Mailgun      │ API          │ Messaging    │              │              │
│  └──────────────┴──────────────┴──────────────┴──────────────┘              │
│                              │                                               │
│                              ▼                                                │
│  MONITORING LAYER                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Delivery Tracking → Reply Classification → Engagement Scoring            ││
│  │       ↓                    ↓                      ↓                      ││
│  │  Alert if failure    Route to human       Update account heat           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Phases

### Phase Overview

| Phase | Duration | Theme | Primary Agents | Success Criteria |
|-------|----------|-------|----------------|------------------|
| 1 | Weeks 1-2 | Foundation | `orchestrator`, `claude-code`, `ops-runner` | Infra ready, command parsing working |
| 2 | Weeks 3-5 | Research | `intelligence`, `research`, `data-analytics` | Apollo integration live, enrichment pipeline |
| 3 | Weeks 6-8 | Outreach | `outreach` (NEW), email workers | Multi-channel sending, delivery tracking |
| 4 | Weeks 9-12 | Autonomy | `abm-gen` (NEW), full orchestration | End-to-end ABM, approval workflows, self-healing |

### 2.1 Phase 1: Foundation (Weeks 1-2)

**Objective:** Build the infrastructure layer that all other phases depend on.

**Deliverables:**
1. **Command Parser Service**
   - Natural language command interpreter
   - Intent classification (research|campaign|send|report)
   - Parameter extraction using Claude
   - Validation schema enforcement

2. **Task Queue System**
   - Redis/RabbitMQ deployment
   - Priority queues per division
   - Dead letter queue for failures
   - Retry logic with exponential backoff

3. **Database Schema Extensions**
   - Accounts table (enriched)
   - Contacts table (validated)
   - Campaigns table (versioned)
   - Messages table (audit trail)
   - Analytics/Events table

4. **Safety Framework Foundation**
   - Rate limit configuration
   - Approval gate infrastructure
   - Audit logging setup
   - Circuit breaker patterns

**Tasks:**

| Task | Owner | Estimate | Dependencies |
|------|-------|----------|--------------|
| Scaffold queue infrastructure | `claude-code` | 4h | None |
| Design unified database schema | `build-backend` | 6h | None |
| Build command parser MVP | `claude-code` | 8h | None |
| Implement DLQ and retry logic | `build-backend` | 4h | Queue scaffold |
| Create rate limit service | `ops-runner` | 6h | Database |
| Build approval gate UI | `build-frontend` | 8h | Database |

**Phase 1 Completion Criteria:**
- [ ] Queue system processes 100 test jobs with <1% failure
- [ ] Command parser correctly interprets 10 canonical NL commands
- [ ] Database schema supports all required entity relationships
- [ ] Rate limiting prevents >100 requests/minute per API
- [ ] Approval gates block unapproved high-volume sends

### 2.2 Phase 2: Research Automation (Weeks 3-5)

**Objective:** Integrate Apollo.io for autonomous prospect research and data enrichment.

**Deliverables:**
1. **Apollo.io MCP Integration**
   - Apollo MCP server setup
   - API credential management (secure)
   - Search capability wrapper
   - Enrichment pipeline

2. **Research Orchestration Agent**
   - Spawn research jobs from natural language
   - Batch processing for large requests
   - Deduplication logic
   - Incremental updates

3. **Enrichment Pipeline**
   - Clearbit integration (firmographics)
   - BuiltWith integration (technographics)
   - Intent signal aggregation
   - Confidence scoring

4. **Research Dashboard**
   - Account list with enrichment status
   - Signal timeline view
   - Data quality indicators
   - Export capabilities

**Tasks:**

| Task | Owner | Estimate | Dependencies |
|------|-------|----------|--------------|
| Set up Apollo MCP server | `tooling-env` | 4h | Phase 1 complete |
| Build research job processor | `intelligence` | 8h | Queue system |
| Implement Apollo search wrapper | `research` | 6h | Apollo MCP |
| Add Clearbit enrichment | `research` | 6h | Database |
| Add BuiltWith technographics | `research` | 6h | Database |
| Build research dashboard | `build-frontend` | 12h | API endpoints |
| Create deduplication logic | `data-analytics` | 6h | Research pipeline |

**Phase 2 Completion Criteria:**
- [ ] "Research 50 VP Sales in Series A SaaS" completes in <5 minutes
- [ ] Enrichment adds 5+ data points per account (funding, tech stack, etc.)
- [ ] Deduplication prevents >95% duplicate contacts
- [ ] Data quality score visible for all accounts
- [ ] Research results export to CSV/JSON

### 2.3 Phase 3: Multi-Channel Outreach (Weeks 6-8)

**Objective:** Enable sending across email, LinkedIn, and SMS with delivery tracking.

**Deliverables:**
1. **Email Delivery System**
   - SendGrid/Mailgun integration
   - Template management
   - SPF/DKIM/DMARC validation
   - Bounce/complaint handling

2. **LinkedIn Outreach System**
   - LinkedIn API or MCP integration
   - Connection request workflow
   - Message sequencing
   - Compliance guardrails

3. **SMS Delivery System**
   - Twilio integration
   - Opt-in/opt-out management
   - Character limit handling
   - Delivery status tracking

4. **Engagement Tracking**
   - Open/click tracking (email)
   - Reply detection and classification
   - Engagement scoring algorithm
   - Alert system for hot leads

**Tasks:**

| Task | Owner | Estimate | Dependencies |
|------|-------|----------|--------------|
| Configure SendGrid/Mailgun | `tooling-env` | 4h | Phase 1 complete |
| Build email worker service | `outreach` | 10h | Queue system |
| Implement email templates | `ux-design` | 8h | Email worker |
| Integrate LinkedIn API/MCP | `research` | 12h | Authentication |
| Build LinkedIn worker | `outreach` | 10h | LinkedIn access |
| Set up Twilio account | `tooling-env` | 2h | Phase 1 |
| Build SMS worker | `outreach` | 8h | Twilio setup |
| Create engagement tracker | `data-analytics` | 10h | Delivery pipeline |
| Build reply classifier | `intelligence` | 8h | NLP model |

**Phase 3 Completion Criteria:**
- [ ] Send 100 emails with >95% delivery rate
- [ ] Send 50 LinkedIn messages with no API violations
- [ ] Send 50 SMS messages with opt-in verified
- [ ] Track opens/clicks for >90% of delivered emails
- [ ] Classify replies into categories (positive, negative, neutral, question)
- [ ] Engagement score updates within 5 minutes of activity

### 2.4 Phase 4: Full Autonomy & ABM (Weeks 9-12)

**Objective:** Complete the autonomous ABM workflow with approval gates and self-healing.

**Deliverables:**
1. **ABM Strategy Generator**
   - Campaign blueprint generation from natural language
   - Multi-touch sequence design
   - Channel selection logic
   - Personalization at scale

2. **A/B Testing Framework**
   - Variant creation and assignment
   - Statistical significance calculator
   - Winner selection logic
   - Performance dashboards

3. **Self-Healing Mechanisms**
   - Circuit breakers for failing APIs
   - Automatic retry with backoff
   - Fallback provider switching
   - Alert escalation for human review

4. **Full Natural Language Interface**
   - Complete command coverage
   - Context-aware suggestions
   - Error recovery dialogs
   - Voice input (optional)

**Tasks:**

| Task | Owner | Estimate | Dependencies |
|------|-------|----------|--------------|
| Build ABM generator agent | `abm-gen` | 16h | Phase 3 |
| Create sequence builder | `abm-gen` | 12h | ABM generator |
| Implement A/B test framework | `data-analytics` | 10h | Campaign system |
| Build circuit breaker service | `ops-runner` | 8h | All integrations |
| Create fallback provider logic | `ops-runner` | 6h | Circuit breakers |
| Enhance NL interface | `product-strategy` | 12h | All features |
| Build full system tests | `qa-risk` | 16h | All phases |
| Create operator runbook | `docs-knowledge` | 8h | All features |

**Phase 4 Completion Criteria:**
- [ ] "Create personalized ABM campaign for TechCorp" generates complete campaign
- [ ] Campaign includes 3+ touch points across 2+ channels
- [ ] A/B tests run automatically and select winners
- [ ] System auto-recovers from common API failures
- [ ] All high-risk actions route through approval gate
- [ ] End-to-end test completes with no human intervention

---

## 3. Safety & Controls

### 3.1 Rate Limiting Framework

| Resource | Daily Limit | Per-Minute Limit | Burst Allowance | Action on Exceed |
|----------|-------------|------------------|-----------------|------------------|
| **Apollo API** | 10,000 calls | 100/min | 150 | Queue + retry after 60s |
| **Email (SendGrid)** | 10,000 sends | 200/min | 300 | Pause + alert ops |
| **LinkedIn API** | 150 requests | 10/min | 20 | Cooldown 15min |
| **Twilio SMS** | 1,000 sends | 50/min | 75 | Pause + queue |
| **Claude API** | 5,000 calls | 60/min | 90 | Queue + priority reduction |

**Rate Limit Configuration:**
```yaml
rate_limits:
  apollo:
    tier: paid  # Change to paid_tier after upgrade
    daily: 10000
    per_minute: 100
    burst: 150
    window_reset: 60
  
  email:
    provider: sendgrid
    daily: 10000
    per_minute: 200
    burst: 300
    warmup:  # Gradual ramp for new domains
      day_1: 50
      day_7: 200
      day_30: 500
      day_90: 10000
  
  linkedin:
    daily: 150
    per_hour: 60
    per_minute: 10
    burst: 20
    connections_per_day: 20
    messages_per_day: 50
```

### 3.2 Approval Gates

**Gate Triggers (Auto-Route to Human Review):**

| Trigger Condition | Review Type | Default Action | Timeout |
|-------------------|-------------|----------------|---------|
| Bulk email >100 recipients | Safety reviewer | HOLD | 24h |
| New domain first send | Ops lead | APPROVE if warm | 4h |
| LinkedIn message with URL | Compliance check | HOLD if shortened | 2h |
| Campaign estimate >$500/mo | Budget owner | HOLD | 48h |
| Contact marked "do not contact" | Privacy reviewer | REJECT | Immediate |
| Reply sentiment negative | Account owner | PAUSE sequence | 1h |
| API error rate >10% | Technical lead | ALERT only | N/A |
| Unusual send pattern | Security review | HOLD | 2h |

**Approval Interface:**
- Route: `/ops/review-queue`
- Shows: Task summary, risk assessment, recommended action
- Actions: Approve, Reject, Modify, Escalate
- Evidence: Audit trail of decision

### 3.3 Compliance Framework

**GDPR Compliance:**
```
Required for EU contacts:
├── Consent tracking (opt-in timestamp + method)
├── Data retention limits (delete after 2 years inactive)
├── Right to erasure workflow (contact → delete propagation)
├── Data portability export (JSON/CSV on request)
└── Lawful basis documentation (legitimate interest vs consent)
```

**CAN-SPAM / CASL Compliance:**
```
Required for email:
├── Unsubscribe link (honor within 10 days)
├── Physical mailing address in footer
├── Accurate "From" name and address
├── Clear subject line (no deceptive headers)
└── Commercial nature disclosure
```

**Anti-Spam Measures:**
```
Pre-flight checks:
├── Content spam score (<5/10 via SpamAssassin)
├── Link validation (no blacklisted domains)
├── Image-to-text ratio (>60% text)
├── Unsubscribe presence check
├── Daily volume per domain warm-up schedule
└── Engagement rate monitoring (>0.5% to maintain deliverability)
```

### 3.4 Error Handling & Circuit Breakers

**Circuit Breaker States:**
```
CLOSED: Normal operation, requests pass through
  ↓ (error rate > threshold)
OPEN: Block requests immediately, return cached/fallback
  ↓ (timeout expires)
HALF_OPEN: Allow limited test requests
  ↓ (test succeeds)
CLOSED: Resume normal operation
```

**Breaker Configuration:**
```yaml
circuit_breakers:
  apollo_api:
    failure_threshold: 5
    success_threshold: 3
    timeout: 60s
    half_open_max_calls: 3
  
  sendgrid:
    failure_threshold: 10
    success_threshold: 5
    timeout: 120s
    fallback_provider: mailgun
  
  linkedin_api:
    failure_threshold: 3
    success_threshold: 2
    timeout: 900s  # 15 min cooldown
    alert_on_open: true
```

**Error Categories & Responses:**

| Error Type | Example | Auto-Response | Alert Level |
|------------|---------|---------------|-------------|
| Transient | 502 Gateway Timeout | Retry 3x, then queue | INFO |
| Rate Limit | 429 Too Many Requests | Backoff + retry | WARN |
| Auth | 401 Invalid API Key | Pause + alert ops | CRITICAL |
| Compliance | Bounce: spam complaint | Stop + flag contact | CRITICAL |
| Data | Missing required field | Reject + log | ERROR |
| Logic | Invalid state transition | Alert + retry once | ERROR |

### 3.5 Human Override Mechanisms

**Emergency Stop:**
```bash
# Immediate halt of all outbound operations
POST /ops/emergency-stop
Body: { reason: "suspicious_pattern_detected", initiated_by: "operator_id" }

# Resume operations
POST /ops/resume-normal
Body: { approved_by: "operator_id", note: "issue_resolved" }
```

**Scoped Overrides:**
- Pause specific campaign
- Block specific domain/provider
- Override rate limit (briefly)
- Force approval/rejection
- Skip enrichment for specific account

**Override Audit Trail:**
All overrides logged with:
- Operator ID
- Timestamp
- Scope affected
- Reason provided
- Duration
- System state before/after

---

## 4. Technical Stack

### 4.1 API Integrations

| Service | Purpose | Integration Type | Cost Model | Fallback |
|---------|---------|------------------|------------|----------|
| **Apollo.io** | Prospect search, contact enrichment | MCP Server | $59-299/mo | Clearbit + manual research |
| **Clearbit** | Firmographics, technographics | REST API | $99-499/mo | BuiltWith + Apollo |
| **BuiltWith** | Technology stack detection | REST API | $295/mo (pro) | Manual research |
| **Crunchbase** | Funding, company news | REST API | $89/mo | News API + LinkedIn |
| **SendGrid** | Email delivery | REST API | Free tier: 100/day, then $14.95/50k | Mailgun, AWS SES |
| **Mailgun** | Email delivery fallback | REST API | $35/mo for 50k | AWS SES |
| **LinkedIn** | Social outreach, company data | MCP Server | $ varies by tier | Chrome extension automation |
| **Twilio** | SMS, voice | REST API | ~$0.0075/SMS | Plivo, Vonage |
| **Calendly** | Meeting scheduling | REST API | Free tier available | Native calendar integration |
| **Google Calendar** | Meeting integration | REST API | Free | Calendly fallback |
| **OpenAI** | Content generation, parsing | API | Pay-as-you-go | Local LLM fallback |
| **Claude** | Content generation, reasoning | API | Pay-as-you-go | OpenAI fallback |

### 4.2 Database Schema Extensions

**New Tables:**

```sql
-- Accounts table (extends existing companies)
CREATE TABLE enriched_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  
  -- Firmographics
  employee_count_range VARCHAR(50),
  annual_revenue_estimate VARCHAR(50),
  industry_vertical VARCHAR(100),
  headquarters_location JSONB,
  
  -- Technographics
  tech_stack JSONB,  -- [{name: "Salesforce", category: "CRM"}]
  tech_stack_score INTEGER,  -- 0-100, richness of data
  
  -- Intent Signals
  intent_signals JSONB,  -- [{type: "hiring", signal: "VP Sales", date: ...}]
  intent_score INTEGER,  -- 0-100
  
  -- Funding
  funding_stage VARCHAR(50),
  funding_amount VARCHAR(50),
  last_funding_date DATE,
  investor_list TEXT[],
  
  -- Enrichment metadata
  enrichment_status VARCHAR(20),  -- pending|in_progress|complete|failed
  enriched_at TIMESTAMP,
  enrichment_source VARCHAR(50)[],  -- ["apollo", "clearbit", "builtwith"]
  data_quality_score INTEGER,  -- 0-100
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES enriched_accounts(id),
  
  -- Contact info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  email_verified BOOLEAN DEFAULT false,
  email_status VARCHAR(20),  -- valid|invalid|catch_all|unknown
  phone VARCHAR(50),
  linkedin_url VARCHAR(255),
  
  -- Professional
  title VARCHAR(200),
  department VARCHAR(100),
  seniority_level VARCHAR(50),  -- C-level|VP|Director|Manager|Individual
  
  -- Research
  research_notes TEXT,
  pain_points TEXT[],
  recent_activity TEXT[],  -- News mentions, LinkedIn posts
  
  -- Compliance
  consent_status VARCHAR(20),  -- opted_in|opted_out|needs_consent
  consent_date TIMESTAMP,
  consent_method VARCHAR(50),
  gdpr_applies BOOLEAN DEFAULT false,
  do_not_contact BOOLEAN DEFAULT false,
  
  -- Engagement
  engagement_score INTEGER DEFAULT 0,
  last_contact_date TIMESTAMP,
  last_contact_channel VARCHAR(20),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Configuration
  campaign_type VARCHAR(50),  -- abm|cold_outreach|nurture|event
  status VARCHAR(20),  -- draft|pending_approval|active|paused|completed|archived
  
  -- Strategy
  target_criteria JSONB,  -- Parsed from natural language
  target_accounts UUID[],  -- References enriched_accounts
  excluded_accounts UUID[],
  
  -- Sequence
  sequence_config JSONB,  -- Multi-touch sequence definition
  
  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_variants JSONB,  -- Variant definitions
  ab_test_winner VARCHAR(50),  -- Selected variant
  
  -- Metrics
  total_contacts INTEGER DEFAULT 0,
  contacted_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  meeting_count INTEGER DEFAULT 0,
  
  -- Automation
  auto_pause_on_negative_reply BOOLEAN DEFAULT true,
  auto_escalate_hot_lead BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table (audit trail)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  contact_id UUID REFERENCES contacts(id),
  
  -- Content
  channel VARCHAR(20),  -- email|linkedin|sms|phone
  direction VARCHAR(10),  -- outbound|inbound
  subject TEXT,
  body TEXT,
  
  -- Delivery
  status VARCHAR(20),  -- queued|sending|sent|delivered|failed|bounced
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  
  -- Reply handling
  replied_at TIMESTAMP,
  reply_classification VARCHAR(20),  -- positive|negative|neutral|question|oop
  reply_auto_processed BOOLEAN DEFAULT false,
  
  -- Metadata
  provider VARCHAR(50),  -- sendgrid|linkedin|twilio
  provider_message_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Research jobs table
CREATE TABLE research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  natural_language_query TEXT NOT NULL,
  parsed_criteria JSONB,
  
  -- Status
  status VARCHAR(20),  -- pending|running|complete|failed|cancelled
  progress_percent INTEGER DEFAULT 0,
  
  -- Results
  accounts_found INTEGER DEFAULT 0,
  accounts_enriched INTEGER DEFAULT 0,
  accounts_imported INTEGER DEFAULT 0,
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Approval queue
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type VARCHAR(50),  -- bulk_send|campaign_launch|data_export
  resource_type VARCHAR(50),  -- campaign|message|account_list
  resource_id UUID,
  
  -- Risk assessment
  risk_score INTEGER,  -- 0-100
  risk_factors TEXT[],
  
  -- Approval flow
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  reviewer_id UUID REFERENCES profiles(id),
  decision VARCHAR(20),  -- pending|approved|rejected|modifications_requested
  decision_at TIMESTAMP,
  decision_note TEXT,
  
  -- Auto-timeout
  expires_at TIMESTAMP,
  auto_action_on_expire VARCHAR(20)  -- reject|escalate
);

-- Audit log
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  actor_type VARCHAR(20),  -- user|agent|system
  
  resource_type VARCHAR(50),
  resource_id UUID,
  
  action VARCHAR(50),
  before_state JSONB,
  after_state JSONB,
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
```sql
-- Performance indexes
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_contact ON messages(contact_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_approval_requests_status ON approval_requests(decision);

-- Full-text search
CREATE INDEX idx_contacts_research_notes_fulltext ON contacts USING gin(to_tsvector('english', research_notes));
CREATE INDEX idx_enriched_accounts_tech_stack ON enriched_accounts USING gin(tech_stack);
```

### 4.3 Queue System Design

**Queue Topology:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                      REDIS QUEUE STRUCTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Priority Queues (highest to lowest):                               │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  q:research:urgent    │ Apollo search completion                ││
│  │  q:outreach:email     │ Email sends (with rate limiting)      ││
│  │  q:outreach:linkedin  │ LinkedIn outreach                      ││
│  │  q:enrich:accounts    │ Data enrichment jobs                   ││
│  │  q:generate:content   │ Content generation                     ││
│  │  q:analytics:process  │ Engagement tracking                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Dead Letter Queues:                                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  dlq:research      │ Max retries exceeded, needs human review   ││
│  │  dlq:outreach      │ Delivery failed, check contact info        ││
│  │  dlq:enrich        │ Enrichment API failure                   ││
│  │  dlq:general       │ Uncategorized failures                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Scheduled Queue:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  q:scheduled       │ Delayed sends, follow-ups                  ││
│  │  Score = timestamp when ready                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Worker Configuration:**
```yaml
workers:
  research_worker:
    queue: q:research
    concurrency: 3
    retry_policy:
      max_attempts: 3
      backoff: exponential
      initial_delay: 5s
      max_delay: 5m
    
  email_worker:
    queue: q:outreach:email
    concurrency: 5
    rate_limit: 200/minute
    retry_policy:
      max_attempts: 5
      backoff: linear
      delay: 60s
    
  linkedin_worker:
    queue: q:outreach:linkedin
    concurrency: 1  # Strictly single to respect API limits
    rate_limit: 10/minute
    retry_policy:
      max_attempts: 3
      backoff: fixed
      delay: 900s  # 15 min cooldown
```

### 4.4 Cost Optimization Strategies

**API Spend Management:**

| Strategy | Implementation | Savings |
|----------|---------------|---------|
| **Batch requests** | Group Apollo calls, fetch 100 contacts at once | 20-30% |
| **Cache enrichment** | Redis cache for 30 days, check before API call | 40-50% |
| **Tiered enrichment** | Basic (Apollo) → Advanced (Clearbit) only for high-value | 35% |
| **Smart retry** | Exponential backoff prevents wasted calls | 10-15% |
| **Usage quotas** | Daily spend caps with alerts at 80% | Prevents overages |
| **Off-peak processing** | Queue low-priority jobs for nights/weekends | Smooth spend |

**Estimated Monthly Costs (at scale):**

| Service | Volume | Cost/Unit | Monthly Cost |
|---------|--------|-----------|--------------|
| Apollo.io | 10k searches + 50k enrichments | $199/mo plan | $199 |
| Clearbit | 5k enrichments | $0.10/enrichment | $500 |
| SendGrid | 50k emails | $0.00029/email | $15 |
| LinkedIn | 1,500 messages | API licensing | ~$100 |
| Twilio SMS | 5,000 SMS | $0.0075/SMS | $38 |
| Claude API | 100k tokens/day | ~$0.008/1k tokens | $240 |
| Redis (Upstash) | 1GB + 10M ops | $10/mo | $10 |
| **Total** | | | **~$1,100/mo** |

**Cost Controls:**
```yaml
cost_controls:
  daily_budget_max: 100  # USD
  alert_thresholds: [50, 75, 90]  # % of daily budget
  
  api_priorities:
    apollo: 1  # Must have
    clearbit: 2  # Nice to have, can defer
    builtwith: 3  # Lowest priority
  
  auto_throttle:
    enabled: true
    on_budget_exceeded: pause_non_essential_jobs
    on_daily_limit: queue_for_next_day
```

---

## 5. MCP Integration Strategy

### 5.1 Claude MCP Server Usage

**MCP (Model Context Protocol) Servers as Tool Extensions:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MCP SERVER ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │   CLAUDE AGENT   │  Natural language interface                   │
│  └────────┬────────┘                                                │
│           │                                                         │
│           │  "Research VP Sales at Series A SaaS companies"          │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  MCP TOOL REGISTRY                           │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ Apollo MCP  │  │ Internal    │  │ Research            │  │   │
│  │  │ Server      │  │ APIs MCP    │  │ Orchestration       │  │   │
│  │  │             │  │ Server      │  │ Server              │  │   │
│  │  │ • search()  │  │             │  │                     │  │   │
│  │  │ • enrich()  │  │ • queryDB() │  │ • planResearch()    │  │   │
│  │  │ • validate()│  │ • updateDB()│  │ • batchJobs()       │  │   │
│  │  └──────┬──────┘  │ • getCache()│  │ • aggregate()       │  │   │
│  │         │         │             │  │                     │  │   │
│  │         │         └──────┬──────┘  └─────────────────────┘  │   │
│  │         │                │                                 │   │
│  └─────────┼────────────────┼─────────────────────────────────┘   │
│            │                │                                      │
│            └────────────────┘                                      │
│                     │                                              │
│                     ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                   API LAYER                                    ││
│  │  Apollo API  │  Clearbit API  │  BuiltWith API  │  Database   ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**MCP Server Configuration:**
```json
{
  "mcpServers": {
    "apollo": {
      "command": "npx",
      "args": ["@apollomcp/server"],
      "env": {
        "APOLLO_API_KEY": "${APOLLO_API_KEY}"
      }
    },
    "gtm-internal": {
      "command": "node",
      "args": ["./mcp-servers/gtm-internal-server.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "research-orchestrator": {
      "command": "node",
      "args": ["./mcp-servers/research-orchestrator.js"]
    }
  }
}
```

### 5.2 Agent-to-Agent Communication

**Communication Patterns:**

1. **Command Pattern** (One-way delegation)
   ```javascript
   // Orchestrator → Research Division
   {
     "type": "COMMAND",
     "action": "research_accounts",
     "payload": {
       "query": "VP Sales at Series A SaaS",
       "target_count": 50
     },
     "reply_to": "queue:research:completed"
   }
   ```

2. **Request-Reply Pattern** (Synchronous)
   ```javascript
   // Campaign Generator → Content Generator
   const content = await agent.sendRequest({
     to: "content-agent",
     action: "generate_email",
     payload: { persona: "technically_analytical", context: {...} },
     timeout: 30000
   });
   ```

3. **Pub-Sub Pattern** (Event broadcasting)
   ```javascript
   // When account is enriched
   agent.publish("account.enriched", {
     account_id: "uuid",
     enrichment_score: 85,
     new_signals: [...]
   });
   // → Campaign Division subscribes and generates sequences
   ```

4. **Work Queue Pattern** (Distributed processing)
   ```javascript
   // Bulk email sends
   messages.forEach(msg => {
     agent.enqueue("email:send", msg, {
       priority: msg.urgent ? 1 : 5,
       delay: msg.scheduled_for
     });
   });
   ```

### 5.3 Tool Delegation Model

**Delegation Hierarchy:**

```
Level 1: Operator (Human)
  ↓ Natural language command
  
Level 2: Orchestrator Agent (orchestrator)
  ↓ Parse + route + coordinate
  
Level 3: Division Leads (intelligence, outreach, abm-gen)
  ↓ Plan execution + spawn workers
  
Level 4: Specialist Agents (research, email-worker, content)
  ↓ Execute specific tasks
  
Level 5: Tool Workers (MCP servers, API clients)
  ↓ Interface with external services
```

**Delegation Rules:**
```yaml
delegation_rules:
  # Division leads can spawn specialists without approval
  intelligence:
    can_spawn: [research, data-analytics]
    max_concurrent: 5
    
  outreach:
    can_spawn: [email-worker, linkedin-worker, sms-worker]
    max_concurrent: 10
    
  abm-gen:
    can_spawn: [content, persona-analyzer]
    max_concurrent: 3
    
  # Specialists can spawn tools only
  research:
    can_spawn: [apollo-mcp, clearbit-api, builtwith-api]
    max_concurrent: 3
    
  # Actions requiring orchestrator approval
  requires_approval:
    - sending >100 emails
    - launching new campaign type
    - modifying rate limits
    - accessing restricted APIs
    - exporting contact lists
```

---

## 6. Risk Mitigation

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **API rate limits exceeded** | High | Medium | Circuit breakers, exponential backoff, fallback providers, queue-based throttling |
| **Data quality issues** | Medium | High | Multi-source enrichment, confidence scoring, human review gate for low-confidence data |
| **Email deliverability drop** | Medium | High | Domain warm-up, proper SPF/DKIM, engagement monitoring, list hygiene |
| **LinkedIn account suspension** | Medium | High | Strict rate limits, human-like delays, activity pattern randomization, backup accounts |
| **Database performance** | Low | High | Query optimization, proper indexing, connection pooling, read replicas |
| **Integration failures** | Medium | Medium | Circuit breakers, fallback providers, DLQ with human review |

### 6.2 Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **GDPR violation** | Low | Critical | Consent tracking, right to erasure, data retention limits, privacy officer review |
| **CAN-SPAM violation** | Low | Critical | Unsubscribe handling, address requirements, content review gates |
| **Data breach** | Low | Critical | Encryption at rest/transit, access controls, audit logging, security review |
| **Inaccurate prospect data** | Medium | Medium | Verification APIs, confidence thresholds, update cadence |

### 6.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low adoption** | Low | High | UX validation, operator feedback loops, gradual onboarding |
| **Negative brand impact** | Low | Critical | Approval gates for outbound, tone review, reply monitoring |
| **Cost overruns** | Medium | Medium | Budget alerts, daily caps, usage dashboards, tiered enrichment |
| **Dependency on single provider** | Medium | Medium | Multi-provider strategy, fallback configurations |

---

## 7. Immediate Next Actions

### Week 1 Priorities

| Priority | Action | Owner | Deliverable | Due |
|----------|--------|-------|-------------|-----|
| P0 | Set up Apollo MCP server | tooling-env | Working MCP connection, test search | Day 2 |
| P0 | Design unified database schema | build-backend | SQL migration files, schema diagram | Day 3 |
| P0 | Scaffold queue infrastructure | claude-code | Redis/queue deployment, test worker | Day 3 |
| P1 | Build command parser MVP | claude-code | Service that parses 10 NL commands | Day 4 |
| P1 | Create safety rate limit service | ops-runner | Rate limiting middleware | Day 5 |
| P1 | Set up SendGrid account + warm domain | tooling-env | Verified sender, warmup schedule | Day 5 |
| P2 | Build approval gate UI skeleton | build-frontend | /ops/review-queue route | Day 5 |
| P2 | Write integration tests plan | qa-risk | Test strategy document | Day 5 |

### Day 1-2 Checklist

- [ ] Apollo MCP server installed and authenticated
- [ ] Test query returns 10+ valid contacts
- [ ] Database migration plan reviewed
- [ ] Queue system choice finalized (Redis vs RabbitMQ)
- [ ] Development environment documented
- [ ] API keys secured in `.env.*` files (not in repo)

### Quick Wins

1. **Apollo search from CLI** (2 hours)
   ```bash
   > node scripts/apollo-search.js "VP Sales" "SaaS" "Series A"
   Found 50 contacts... Saved to temp/research-001.json
   ```

2. **Command parser prototype** (4 hours)
   ```javascript
   parseCommand("Research 50 VP Sales in Series A SaaS companies")
   // → { action: "research", filters: {...}, count: 50 }
   ```

3. **Basic enrichment pipeline** (4 hours)
   ```javascript
   // Apollo contact → Clearbit enrich → Calculate score → Save
   ```

---

## 8. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **ABM** | Account-Based Marketing — targeting specific accounts with personalized campaigns |
| **MCP** | Model Context Protocol — standard for AI tool integration |
| **Enrichment** | Adding additional data (firmographics, technographics) to account/contact records |
| **Cadence** | Sequence of touchpoints over time (email → LinkedIn → phone) |
| **Circuit Breaker** | Pattern that prevents cascade failures by temporarily blocking requests |
| **Dead Letter Queue** | Queue for messages that failed processing after max retries |
| **Warm-up** | Gradual increase in email volume for new domains to build sender reputation |

### B. External Documentation

- Apollo API Documentation: https://docs.apollo.io/
- SendGrid API Docs: https://docs.sendgrid.com/
- LinkedIn API: https://docs.microsoft.com/en-us/linkedin/
- Twilio Docs: https://www.twilio.com/docs
- Claude MCP: https://modelcontextprotocol.io/

### C. Related Internal Docs

- `org/SYSTEM_AGENT_REGISTRY.md` — Agent definitions
- `org/BUILD_PLAN_V1.md` — Current construction status
- `org/SWARM_OUTPUT_ACCELERATOR.md` — Quality requirements
- `org/COMMUNICATION_ORCHESTRATION.md` — Review burst format
- `adzeta-outreach/` — Existing outreach sequences

---

**Next Review Date:** 2026-03-03  
**Document Owner:** Agent Architecture Subagent  
**Sign-off Required:** Orchestrator Lead
