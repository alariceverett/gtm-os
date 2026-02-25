# Phase 2: Email Sequence System Design

**Version:** 1.0  
**Date:** 2026-02-25  
**Status:** Design Complete → Ready for Implementation  
**Dependencies:** Phase 1 (Research Pipeline) Complete  

---

## Executive Summary

This document defines the complete technical design for a multi-step email outreach automation system. The system enables:

- **Sequence Templates:** Reusable, versioned email sequences with conditional branching
- **Smart Timing:** Configurable delays between steps, business hours awareness, timezone handling
- **Personalization Engine:** Token-based merge fields with fallbacks and ML-enriched data
- **A/B Testing:** Variant management with statistical significance tracking
- **Analytics:** Open, click, reply tracking with engagement scoring
- **Safety Controls:** Rate limiting (50/day warm-up), human approval gates, compliance

**Target:** Apollo.io + SMTP (SendGrid/Mailgun) integration

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL SEQUENCE SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         SCHEMA LAYER                                      │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│  │  │   email_     │ │  sequence_   │ │   email_     │ │   email_     │  │  │
│  │  │   templates  │ │   enrollments│ │   sends      │ │   analytics  │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│  │  │   sequence_  │ │   ab_test_   │ │   personali- │ │   approval_  │  │  │
│  │  │   steps      │ │   variants   │ │   zation_    │ │   queue      │  │  │
│  │  │              │ │              │ │   tokens     │ │              │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         QUEUE SYSTEM                                      │  │
│  │                                                                          │  │
│  │   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐               │  │
│  │   │  Scheduled  │───▶│   Sending    │───▶│   Tracking   │               │  │
│  │   │   Queue     │    │   Worker     │    │   Handler    │               │  │
│  │   └─────────────┘    └──────────────┘    └──────────────┘               │  │
│  │          │                  │                   │                       │  │
│  │          ▼                  ▼                   ▼                       │  │
│  │   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐               │  │
│  │   │   Delayed   │    │   SMTP/      │    │   Webhook    │               │  │
│  │   │   Jobs      │    │   Apollo     │    │   Receiver   │               │  │
│  │   └─────────────┘    └──────────────┘    └──────────────┘               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                      PERSONALIZATION ENGINE                               │  │
│  │                                                                          │  │
│  │   Input: "Hi {{first_name|there}}, I noticed {{company}} uses {{tech}}" │  │
│  │                   │                                                      │  │
│  │                   ▼                                                      │  │
│  │   ┌───────────────┬───────────────┬───────────────┐                     │  │
│  │   │ Token Parser  │ Context Fetch │ Substitution│                     │  │
│  │   │ {{key|def}}   │ prospect+co   │ Render      │                     │  │
│  │   └───────────────┴───────────────┴───────────────┘                     │  │
│  │                   │                                                      │  │
│  │                   ▼                                                      │  │
│  │   Output: "Hi Sarah, I noticed Acme Corp uses Salesforce"              │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Design

### 2.1 Core Tables

#### email_templates
Stores reusable email templates with personalization tokens.

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  
  -- Personalization
  tokens_used TEXT[] DEFAULT '{}', -- ['first_name', 'company', 'title']
  required_fields TEXT[] DEFAULT '{}', -- Must have these to send
  
  -- Metadata
  category TEXT DEFAULT 'outreach', -- outreach, follow_up, breakup, nurture
  tone TEXT DEFAULT 'professional', -- casual, professional, formal, friendly
  
  -- Versioning (A/B testing support)
  version INTEGER DEFAULT 1,
  is_variant BOOLEAN DEFAULT false,
  parent_template_id UUID REFERENCES email_templates(id),
  variant_name TEXT, -- 'control', 'variant_a', 'shorter_subject'
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, archived
  
  -- Analytics benchmark
  avg_open_rate DECIMAL(5,2), -- e.g., 25.50 for 25.5%
  avg_reply_rate DECIMAL(5,2),
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_slug ON email_templates(slug);
CREATE INDEX idx_email_templates_status ON email_templates(status);
CREATE INDEX idx_email_templates_category ON email_templates(category);
```

#### email_sequences (extends cc_sequence_templates)
Multi-step sequence definitions.

```sql
CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Strategy
  sequence_type TEXT DEFAULT 'cold_outreach', -- cold_outreach, nurture, re_engagement
  goal TEXT, -- "book_meeting", "get_reply", "content_download"
  
  -- Configuration
  max_steps INTEGER DEFAULT 5,
  abort_on_reply BOOLEAN DEFAULT true, -- Stop sequence if prospect replies
  abort_on_meeting BOOLEAN DEFAULT true,
  
  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_config JSONB DEFAULT '{}', -- {variants: 2, split: 50/50, auto_select: true}
  
  -- Timing defaults
  default_send_timezone TEXT DEFAULT 'America/New_York',
  business_hours_only BOOLEAN DEFAULT true,
  min_span_hours INTEGER DEFAULT 72, -- Minimum hours between emails
  
  -- Entry criteria
  entry_conditions JSONB DEFAULT '{}', -- {min_score: 50, must_have_email: true}
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, paused, archived
  
  -- Stats (denormalized for performance)
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  avg_completion_time_hours INTEGER, -- Average time from first to last email
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_sequences_slug ON email_sequences(slug);
CREATE INDEX idx_email_sequences_status ON email_sequences(status);
CREATE INDEX idx_email_sequences_type ON email_sequences(sequence_type);
```

#### email_sequence_steps
Individual steps within a sequence.

```sql
CREATE TABLE email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  
  -- Ordering
  step_number INTEGER NOT NULL,
  
  -- Content reference
  template_id UUID REFERENCES email_templates(id),
  
  -- Can override template for this step
  subject_override TEXT,
  body_override TEXT,
  
  -- Timing (relative to previous step or enroll)
  wait_days INTEGER DEFAULT 3,
  wait_hours INTEGER DEFAULT 0,
  wait_minutes INTEGER DEFAULT 0,
  
  -- Send window (respect prospect timezone)
  send_window_start TIME DEFAULT '09:00', -- Don't send before
  send_window_end TIME DEFAULT '17:00', -- Don't send after
  respect_weekends BOOLEAN DEFAULT true, -- Skip Sat/Sun
  
  -- Conditions (skip logic)
  condition_config JSONB DEFAULT '{}', -- {skip_if_opened_prev: true, skip_if_clicked: false}
  
  -- A/B variant mapping
  variant_for TEXT, -- 'control', 'variant_a', etc. (if step varies by variant)
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sequence_id, step_number)
);

CREATE INDEX idx_sequence_steps_sequence ON email_sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_template ON email_sequence_steps(template_id);
CREATE INDEX idx_sequence_steps_active ON email_sequence_steps(is_active);
```

#### sequence_enrollments (extends cc_sequence_enrollments)
Tracks prospects enrolled in sequences.

```sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id), -- Link to existing prospects
  contact_id UUID REFERENCES contacts(id), -- Alternative link
  
  -- External reference (for Apollo integration)
  external_lead_id TEXT, -- Apollo lead ID or other external reference
  
  -- Current state
  status TEXT DEFAULT 'pending', -- pending, active, paused, completed, cancelled, bounced
  current_step INTEGER DEFAULT 0, -- 0 = not started, 1+ = current step
  
  -- A/B variant assigned
  assigned_variant TEXT DEFAULT 'control',
  
  -- Timing
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- First email sent
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Next scheduled action
  next_step_due_at TIMESTAMPTZ,
  
  -- Exit reasons
  exit_reason TEXT, -- replied, bounced, unsubscribed, meeting_booked, manual
  exit_at TIMESTAMPTZ,
  
  -- Personalization context (snapshot at enrollment)
  personalization_context JSONB DEFAULT '{}', -- {campaign: "Q1", source: "event"}
  
  -- Thread tracking
  thread_id TEXT, -- Email thread ID for reply detection
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_enrollments_prospect ON sequence_enrollments(prospect_id);
CREATE INDEX idx_enrollments_next_due ON sequence_enrollments(next_step_due_at) 
  WHERE status IN ('pending', 'active');
CREATE INDEX idx_enrollments_active ON sequence_enrollments(sequence_id, status) 
  WHERE status = 'active';
```

#### email_sends (The Queue & History)
Tracks every email that needs to be sent, is sent, or failed.

```sql
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  sequence_step_id UUID REFERENCES email_sequence_steps(id),
  template_id UUID REFERENCES email_templates(id),
  prospect_id UUID REFERENCES prospects(id),
  
  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Content (final, after personalization)
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  personalized_data JSONB, -- Snapshot of tokens used
  
  -- Status lifecycle
  status TEXT DEFAULT 'queued', -- queued, scheduled, sending, sent, delivered, opened, clicked, replied, bounced, failed, cancelled
  
  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Provider info
  provider TEXT, -- sendgrid, mailgun, apollo, smtp
  provider_message_id TEXT,
  
  -- Send metadata
  from_email TEXT,
  from_name TEXT,
  reply_to TEXT,
  headers JSONB,
  
  -- Tracking
  tracking_pixel_id TEXT,
  link_tracking_enabled BOOLEAN DEFAULT true,
  
  -- Bounce/Failure details
  bounce_reason TEXT,
  bounce_category TEXT, -- hard_bounce, soft_bounce, spam, invalid
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Approval (if required)
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_email_sends_enrollment ON email_sends(enrollment_id);
CREATE INDEX idx_email_sends_scheduled ON email_sends(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_email_sends_queued ON email_sends(queued_at) WHERE status = 'queued';
CREATE INDEX idx_email_sends_provider ON email_sends(provider, status);
```

#### email_analytics (Aggregated + Individual Events)
Tracks opens, clicks, and replies.

```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  email_send_id UUID REFERENCES email_sends(id),
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  
  -- Event type
  event_type TEXT NOT NULL, -- open, click, reply, bounce, spam_report, unsub
  
  -- Event data
  event_data JSONB, -- {url: "...", ip: "...", user_agent: "..."}
  
  -- Source
  ip_address INET,
  user_agent TEXT,
  
  -- For opens
  email_client TEXT, -- Detected from user agent
  device_type TEXT, -- mobile, desktop, tablet
  
  -- For clicks
  link_url TEXT,
  link_position TEXT, -- which link in email
  
  -- For replies
  reply_body TEXT,
  reply_sentiment TEXT, -- positive, negative, neutral, question -- detected
  reply_auto_categorized BOOLEAN DEFAULT false,
  
  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_send ON email_events(email_send_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_occurred ON email_events(occurred_at);
CREATE INDEX idx_email_events_enrollment ON email_events(enrollment_id);
```

### 2.2 Pivot/Analytics Tables

#### sequence_analytics (Aggregated stats)
```sql
CREATE TABLE sequence_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES email_sequences(id),
  
  -- Time window
  period_type TEXT, -- daily, weekly, monthly, all_time
  period_start DATE,
  period_end DATE,
  
  -- Enrollment stats
  enrollments INTEGER DEFAULT 0,
  active_enrollments INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  cancelled INTEGER DEFAULT 0,
  
  -- Engagement
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  
  -- Rates (calculated)
  delivery_rate DECIMAL(5,2),
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  reply_rate DECIMAL(5,2),
  positive_reply_rate DECIMAL(5,2),
  
  -- Time-based
  avg_time_to_open_hours DECIMAL(6,2),
  avg_time_to_reply_hours DECIMAL(6,2),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sequence_id, period_type, period_start)
);

CREATE INDEX idx_sequence_analytics_sequence ON sequence_analytics(sequence_id);
CREATE INDEX idx_sequence_analytics_period ON sequence_analytics(period_type, period_start);
```

#### prospect_engagement_scores
```sql
CREATE TABLE prospect_engagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id),
  
  -- Scores
  overall_score INTEGER DEFAULT 0, -- 0-100
  email_score INTEGER DEFAULT 0, -- Based on opens/clicks/replies
  sequence_score INTEGER DEFAULT 0, -- Where they are in sequences
  
  -- Engagement history
  total_emails_received INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  
  heat_level TEXT DEFAULT 'cold', -- cold, warm, hot, very_hot
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engagement_prospect ON prospect_engagement_scores(prospect_id);
CREATE INDEX idx_engagement_heat ON prospect_engagement_scores(heat_level, last_activity_at);
```

### 2.3 Compliance Tables

#### email_approval_queue
For human review of bulk sends.

```sql
CREATE TABLE email_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  batch_id TEXT, -- Group multiple emails
  emails_count INTEGER,
  
  -- Risk assessment
  risk_score INTEGER, -- 0-100
  risk_factors TEXT[], -- ['bulk_send', 'new_domain', 'high_bounce_risk']
  
  -- Content preview
  template_id UUID REFERENCES email_templates(id),
  sample_subject TEXT,
  sample_body TEXT,
  recipients_preview JSONB, -- First 5 recipients for review
  
  -- Request
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Decision
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, modifications
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  decision_note TEXT,
  
  -- Auto-expire
  expires_at TIMESTAMPTZ,
  auto_action_on_expire TEXT -- 'reject', 'escalate'
);

CREATE INDEX idx_approval_status ON email_approval_queue(status);
CREATE INDEX idx_approval_expires ON email_approval_queue(expires_at) WHERE status = 'pending';
```

---

## 3. Personalization Engine Design

### 3.1 Token System

**Token Format:** `{{key}}` or `{{key|default}}`

**Supported Tokens:**

| Token | Source | Example Output |
|-------|--------|----------------|
| `{{first_name}}` | prospect.first_name | "Sarah" |
| `{{last_name}}` | prospect.last_name | "Johnson" |
| `{{email}}` | prospect.email | "sarah@acme.com" |
| `{{company}}` | prospect.company_name or company.name | "Acme Corp" |
| `{{title}}` | prospect.title | "VP of Sales" |
| `{{industry}}` | company.industry | "Software" |
| `{{team_size}}` | company.employee_count_range | "50-100" |
| `{{location}}` | company.location | "San Francisco, CA" |
| `{{tech_stack}}` | enriched_accounts.tech_stack | "Salesforce, HubSpot" |
| `{{funding_stage}}` | enriched_accounts.funding_stage | "Series B" |
| `{{day_of_week}}` | System - prospect's timezone | "Tuesday" |
| `{{time_of_day}}` | System - prospect's timezone | "morning" (6-12) |
| `{{sender_name}}` | Current user profile | "Alex" |
| `{{sender_company}}` | Current user team | "Adzeta" |
| `{{custom.*}}` | enrollment.personalization_context | Dynamic |

### 3.2 Personalization Pipeline

```typescript
// Pseudo-code for personalization service

interface PersonalizationContext {
  prospect: Prospect;
  company: Company;
  enrichment?: EnrichedAccount;
  enrollment?: SequenceEnrollment;
  sender: UserProfile;
  custom: Record<string, any>;
}

class PersonalizationEngine {
  async render(template: string, context: PersonalizationContext): Promise<string> {
    // Step 1: Parse tokens
    const tokens = this.parseTokens(template);
    
    // Step 2: Fetch values
    const values = await this.resolveTokens(tokens, context);
    
    // Step 3: Apply fallbacks and defaults
    const resolved = this.applyFallbacks(tokens, values);
    
    // Step 4: Substitute
    return this.substitute(template, resolved);
  }
  
  private parseTokens(template: string): ParsedToken[] {
    // Regex: /\{\{(\w+(?:\.\w+)?)(?:\|([^}]+))?\}\}/g
    // Matches: {{first_name}}, {{first_name|there}}, {{custom.campaign}}
  }
  
  private async resolveTokens(tokens: ParsedToken[], context: PersonalizationContext): Promise<Record<string, any>> {
    const values: Record<string, any> = {};
    
    for (const token of tokens) {
      if (token.key.startsWith('custom.')) {
        values[token.key] = context.custom[token.key.replace('custom.', '')];
      } else if (['day_of_week', 'time_of_day'].includes(token.key)) {
        values[token.key] = this.getTimeBasedValue(token.key, context.prospect.timezone);
      } else {
        values[token.key] = await this.getFromContext(token.key, context);
      }
    }
    
    return values;
  }
  
  private applyFallbacks(tokens: ParsedToken[], values: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const token of tokens) {
      let value = values[token.key];
      
      // Apply specific fallbacks
      if (!value || value === '') {
        value = token.default || this.getDefaultFor(token.key);
      }
      
      // Apply transforms
      value = this.applyTransform(value, token.transform);
      
      result[token.key] = value;
    }
    
    return result;
  }
}

// Default fallbacks
const DEFAULT_FALLBACKS: Record<string, string> = {
  first_name: 'there',
  company: 'your company',
  title: 'your role',
  tech_stack: 'modern tools',
  // ...
};
```

### 3.3 A/B Testing Personalization

```sql
-- When enrolling, randomly assign variant
-- Or use weighted assignment based on past performance

CREATE OR REPLACE FUNCTION assign_ab_variant(sequence_id UUID, prospect_id UUID)
RETURNS TEXT AS $$
DECLARE
  config JSONB;
  variants TEXT[];
  weights INTEGER[];
  total_weight INTEGER;
  random_val INTEGER;
  cumulative INTEGER := 0;
BEGIN
  SELECT ab_test_config INTO config FROM email_sequences WHERE id = sequence_id;
  
  IF NOT config->>'enabled' THEN
    RETURN 'control';
  END IF;
  
  -- Get variants from config
  variants := ARRAY(SELECT jsonb_array_elements_text(config->'variants'));
  weights := ARRAY(SELECT jsonb_array_elements_text(config->'weights'))::INTEGER[];
  
  total_weight := (SELECT SUM(w) FROM unnest(weights) AS w);
  random_val := floor(random() * total_weight);
  
  FOR i IN 1..array_length(variants, 1) LOOP
    cumulative := cumulative + weights[i];
    IF random_val < cumulative THEN
      RETURN variants[i];
    END IF;
  END LOOP;
  
  RETURN 'control';
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Queue System Design

### 4.1 Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUEUE SYSTEM LAYERS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: Job Definition (Supabase)                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  email_sends table with statuses: queued → scheduled → sending   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 2: Scheduler (Cron/Timer)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Poll every minute for emails where scheduled_for <= NOW()       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 3: Rate Limiter (Redis/Supabase)                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Track sends per hour/day:                                         │   │
│  │  - Daily limit: 50 (warm-up) → 200 (week 2) → 500 (week 4)      │   │
│  │  - Hourly limit: Based on daily rate / 24                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 4: Sending Worker (Next.js API route or Edge Function)          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  - Personalize content                                          │   │
│  │  - Call SendGrid/Mailgun API                                       │   │
│  │  - Update status → sent                                          │   │
│  │  - Log event                                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 5: Webhook Handler (API route)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  - Receive delivery confirmations                                  │   │
│  │  - Receive open/click events                                       │   │
│  │  - Update email_sends, create email_events                         │   │
│  │  - Trigger conditional logic (if replied, stop sequence)        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Rate Limiting Configuration

```yaml
rate_limits:
  # Warm-up schedule for new domains/senders
  warmup:
    day_1: 50           # Start conservative
    day_2: 100
    day_7: 200          # Week 1
    day_14: 400         # Week 2
    day_30: 1000        # Month 1
    day_90: 5000        # Quarterly
  
  # Per-provider limits
  providers:
    sendgrid:
      daily: 10000
      per_minute: 200
      burst: 300
    
    mailgun:
      daily: 10000
      per_minute: 200
      burst: 300
    
    apollo:
      daily: 500
      per_minute: 50
      burst: 75
  
  # Per-sequence limits
  sequences:
    max_daily_per_sequence: 100
    max_concurrent_per_sequence: 50
```

### 4.3 Queue Worker Logic

```typescript
// Pseudo-code for email queue worker

class EmailQueueWorker {
  private rateLimiter: RateLimiter;
  private personalizationEngine: PersonalizationEngine;
  private emailProvider: EmailProvider; // SendGrid/Mailgun
  
  async processQueue(): Promise<void> {
    // Get emails ready to send
    const pending = await this.getPendingEmails();
    
    for (const email of pending) {
      // Check rate limits
      const canSend = await this.rateLimiter.checkLimit(
        email.provider || 'sendgrid',
        email.from_email
      );
      
      if (!canSend) {
        await this.delay(email.id, 'rate_limited');
        continue;
      }
      
      // Check approval if required
      if (email.requires_approval && !email.approved_at) {
        await this.updateStatus(email.id, 'awaiting_approval');
        continue;
      }
      
      // Personalize content
      const context = await this.buildContext(email);
      const personalized = await this.personalizationEngine.render(
        template, 
        context
      );
      
      // Send
      try {
        const result = await this.sendEmail(email, personalized);
        await this.markSent(email.id, result.providerMessageId);
      } catch (error) {
        await this.handleSendFailure(email.id, error);
      }
    }
  }
  
  private async handleSendFailure(emailId: string, error: Error): Promise<void> {
    const email = await this.getEmail(emailId);
    const newRetryCount = email.retry_count + 1;
    
    if (newRetryCount >= MAX_RETRIES) {
      await this.markFailed(emailId, error.message);
    } else {
      // Exponential backoff: 5min, 15min, 45min
      const delayMinutes = 5 * Math.pow(3, newRetryCount - 1);
      await this.scheduleRetry(emailId, newRetryCount, delayMinutes);
    }
  }
}
```

### 4.4 Conditional Logic (If Replied → Stop)

```typescript
// Trigger function concept for reply handling

async function handleReplyReceived(
  emailSendId: string,
  replyData: ReplyData
): Promise<void> {
  // 1. Record the event
  await db.email_events.insert({
    email_send_id: emailSendId,
    event_type: 'reply',
    reply_body: replyData.body,
    reply_sentiment: await classifySentiment(replyData.body),
    occurred_at: replyData.timestamp
  });
  
  // 2. Get enrollment
  const send = await db.email_sends.findById(emailSendId);
  const enrollment = await db.sequence_enrollments.findById(send.enrollment_id);
  const sequence = await db.email_sequences.findById(enrollment.sequence_id);
  
  // 3. Check if should pause sequence
  if (sequence.abort_on_reply) {
    // Cancel pending emails for this enrollment
    await db.email_sends.updateMany(
      { enrollment_id: enrollment.id, status: { in: ['queued', 'scheduled'] } },
      { status: 'cancelled', cancel_reason: 'prospect_replied' }
    );
    
    // Update enrollment
    await db.sequence_enrollments.update(enrollment.id, {
      status: 'completed',
      exit_reason: 'replied',
      exit_at: new Date()
    });
    
    // 4. Route to human for review
    await notifySequenceCompleted(enrollment.id, 'replied');
  }
  
  // 5. Score the reply
  if (replyData.sentiment === 'positive' || replyData.sentiment === 'question') {
    await updateProspectHeatLevel(enrollment.prospect_id, 'hot');
  }
}
```

---

## 5. API Contracts

### 5.1 Sequence Management API

```typescript
// POST /api/sequences
// Create new sequence
interface CreateSequenceRequest {
  name: string;
  slug: string;
  description?: string;
  sequence_type: 'cold_outreach' | 'nurture' | 're_engagement';
  steps: Array<{
    step_number: number;
    template_id: string;
    wait_days: number;
    wait_hours?: number;
    send_window_start?: string; // "09:00"
    send_window_end?: string;
    condition_config?: {
      skip_if_opened_prev?: boolean;
      skip_if_clicked_prev?: boolean;
    };
  }>;
  ab_test_config?: {
    enabled: boolean;
    variants: string[];
    weights: number[];
    auto_select: boolean;
  };
}

// GET /api/sequences
// List sequences with stats
interface ListSequencesResponse {
  sequences: Array<{
    id: string;
    name: string;
    slug: string;
    status: 'draft' | 'active' | 'paused' | 'archived';
    total_enrolled: number;
    active_enrollments: number;
    avg_open_rate: number;
    avg_reply_rate: number;
    created_at: string;
  }>;
  pagination: PaginationInfo;
}

// POST /api/sequences/:id/enroll
// Enroll prospects in sequence
interface EnrollProspectsRequest {
  prospect_ids: string[];
  personalization_context?: Record<string, any>;
  start_immediately?: boolean; // false = queue for scheduled start
  start_at?: string; // ISO date for delayed start
}

interface EnrollProspectsResponse {
  enrollment_ids: string[];
  assigned_variants: Record<string, string>; // prospect_id -> variant
}

// POST /api/sequences/:id/pause
// Pause all active enrollments
interface PauseSequenceRequest {
  reason?: string;
  resume_at?: string; // Auto-resume time
}
```

### 5.2 Template Management API

```typescript
// POST /api/templates
// Create email template
interface CreateTemplateRequest {
  slug: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  category?: string;
  tone?: string;
  required_fields?: string[];
}

// POST /api/templates/:id/preview
// Preview personalization
interface PreviewTemplateRequest {
  prospect_id: string;
  custom_tokens?: Record<string, any>;
}

interface PreviewTemplateResponse {
  subject: string;
  body_html: string;
  body_text: string;
  tokens_used: string[];
  tokens_resolved: Record<string, string>;
  missing_tokens: string[];
}

// POST /api/templates/:id/test
// Send test email
interface TestTemplateRequest {
  to_email: string;
  prospect_id?: string; // Optional - use real prospect for personalization
}
```

### 5.3 Analytics API

```typescript
// GET /api/analytics/sequences/:id
// Get sequence performance
interface SequenceAnalyticsResponse {
  summary: {
    total_enrolled: number;
    active: number;
    completed: number;
    cancelled: number;
    emails_sent: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
    meetings_booked: number;
  };
  daily_stats: Array<{
    date: string;
    emails_sent: number;
    opens: number;
    clicks: number;
    replies: number;
  }>;
  step_performance: Array<{
    step_number: number;
    template_name: string;
    emails_sent: number;
    open_rate: number;
    reply_rate: number;
  }>;
  ab_test_results?: {
    control: VariantStats;
    variants: VariantStats[];
    winner?: string;
    confidence: number;
  };
}

// GET /api/analytics/prospects/:id
// Individual prospect engagement
interface ProspectEngagementResponse {
  prospect_id: string;
  engagement_score: number;
  heat_level: 'cold' | 'warm' | 'hot' | 'very_hot';
  email_history: Array<{
    sequence_name: string;
    sent_at: string;
    opened: boolean;
    clicked: boolean;
    replied: boolean;
    sentiment?: string;
  }>;
}
```

### 5.4 Webhook API (Inbound Events)

```typescript
// POST /webhooks/sendgrid
// Receive SendGrid events (delivery, open, click, bounce, spam)
interface SendGridEvent {
  event: 'delivered' | 'open' | 'click' | 'bounce' | 'spamreport' | 'unsubscribe';
  email: string;
  sg_message_id: string;
  timestamp: number;
  ip?: string;
  useragent?: string;
  url?: string; // For click events
  reason?: string; // For bounce events
  status?: string; // For bounce events
}

// POST /webhooks/apollo
// Receive Apollo tracking events
interface ApolloWebhookEvent {
  event_type: 'email_sent' | 'email_opened' | 'email_replied' | 'call_completed';
  lead_id: string;
  email?: string;
  occurred_at: string;
  metadata?: Record<string, any>;
}

// POST /webhooks/reply
// Manual or AI-powered reply detection
interface ReplyWebhookEvent {
  thread_id: string;
  from_email: string;
  subject: string;
  body_text: string;
  received_at: string;
  in_reply_to?: string; // Original message ID
}
```

---

## 6. Conditional Branching System

### 6.1 Condition Types

```typescript
// Conditions can be set at sequence or step level

interface StepCondition {
  // Skip conditions (don't send this step if...)
  skip_if?: {
    opened_prev?: boolean;      // Prospect opened any previous email
    clicked_prev?: boolean;   // Prospect clicked any previous link
    replied?: boolean;          // Prospect has replied
    enrollment_days_gt?: number; // Enrolled more than X days ago
    score_lt?: number;         // Engagement score below threshold
  };
  
  // Branch conditions (send different template based on...)
  branch?: {
    type: 'random' | 'a_b_test' | 'condition_based';
    // For condition_based:
    rules: Array<{
      condition: 'opened_prev' | 'clicked_prev' | 'score_gt';
      value: any;
      template_id: string; // Use this template if condition matches
    }>;
  };
  
  // Exit conditions (end sequence if...)
  exit_if?: {
    replied?: boolean;
    clicked?: boolean;
    meeting_booked?: boolean;
    score_reached?: number;
    unsubsribed?: boolean;
  };
}
```

### 6.2 Condition Evaluation

```sql
-- Function to evaluate step conditions
CREATE OR REPLACE FUNCTION evaluate_step_conditions(
  enrollment_id UUID,
  step_id UUID,
  condition_config JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  enrollment RECORD;
  prev_email_count INTEGER;
  prev_opens INTEGER;
  prev_clicks INTEGER;
  has_replied BOOLEAN;
BEGIN
  -- Get enrollment state
  SELECT * INTO enrollment FROM sequence_enrollments WHERE id = enrollment_id;
  
  -- Check skip conditions
  IF condition_config->>'skip_if_opened_prev' = 'true' THEN
    SELECT COUNT(*) INTO prev_opens 
    FROM email_sends es
    JOIN email_events ee ON ee.email_send_id = es.id
    WHERE es.enrollment_id = enrollment_id 
      AND es.step_number < enrollment.current_step
      AND ee.event_type = 'open';
    
    IF prev_opens > 0 THEN
      RETURN false; -- Skip this step
    END IF;
  END IF;
  
  IF condition_config->>'skip_if_replied' = 'true' THEN
    SELECT EXISTS(
      SELECT 1 FROM sequence_enrollments 
      WHERE id = enrollment_id 
        AND exit_reason = 'replied'
    ) INTO has_replied;
    
    IF has_replied THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true; -- Proceed with this step
END;
$$ LANGUAGE plpgsql;
```

---

## 7. Migration Plan

### 7.1 Migration Files

1. **001_email_sequences_core.sql**
   - Create `email_templates` table
   - Create `email_sequences` table
   - Create `email_sequence_steps` table

2. **002_sequence_enrollments.sql**
   - Create `sequence_enrollments` table (extends existing logic)
   - Create indexes for scheduler queries

3. **003_email_sends_queue.sql**
   - Create `email_sends` table
   - Create `email_events` table
   - Create `sequence_analytics` table

4. **004_approval_compliance.sql**
   - Create `email_approval_queue` table
   - Create `prospect_engagement_scores` table

### 7.2 Backward Compatibility

- Existing `cc_sequence_templates` data can be migrated to `email_sequences`
- Existing `cc_sequence_enrollments` can be migrated
- Keep old tables during transition period

### 7.3 Data Seeding

Migration should include default templates:
- Cold outreach templates (3 variants)
- Follow-up templates
- Breakup sequence templates

---

## 8. Risk Assessment & Compliance

### 8.1 GDPR/CAN-SPAM Compliance

| Requirement | Implementation |
|-------------|----------------|
| Unsubscribe | Mandatory unsubscribe link in templates. Handled via webhook. |
| Physical address | Required in footer - enforced by template validation |
| Consent tracking | `contacts.consent_status` field |
| Right to erasure | Cascade delete from contacts to enrollments, sends, events |
| Honest headers | Sent via authentic SendGrid/Mailgun domains |
| Opt-out honoring | Stop all sends to opted-out contacts within 10 days |

### 8.2 Rate Limit Safety

| Risk | Mitigation |
|------|------------|
| Exceed daily warm-up | Hard coded 50/day limit with manual override required |
| Burst sends | Per-minute throttling prevents spikes |
| Domain reputation damage | Gradual warm-up schedule enforced |
| API costs | Daily spend caps with alerts |

### 8.3 Human Approval Gates

| Trigger | Action |
|---------|--------|
| Bulk send > 10 emails | Create approval queue entry |
| New sequence activation | Safety review if > 100 prospects |
| Negative sentiment spike | Alert ops + pause sequence |
| Bounce rate > 5% | Alert + pause sends |

---

## 9. Testing Plan

### 9.1 Unit Tests

- Token parsing and substitution
- Rate limit calculations
- Condition evaluation logic
- Personalization engine

### 9.2 Integration Tests

- Full sequence enrollment → send → event flow
- Webhook event processing
- Approval queue workflow
- A/B variant assignment

### 9.3 Load Tests

- Queue processing at 50/day rate
- Concurrent sequence processing
- Database query performance with 10K+ enrollments

### 9.4 Security Tests

- SQL injection prevention in personalization
- Webhook signature validation
- RLS policy effectiveness

---

## 10. Next Steps

1. **Database Migration** (Day 1)
   - Run migration files
   - Seed default templates
   - Enable RLS

2. **Queue Implementation** (Day 1-2)
   - Implement rate limiter service
   - Build sending worker
   - Setup webhook endpoints

3. **Personalization Engine** (Day 2)
   - Token parser
   - Context resolver
   - Template preview endpoint

4. **Sequence Manager UI** (Day 3)
   - Sequence builder
   - Template editor with preview
   - Enrollment interface

5. **Analytics Dashboard** (Day 3-4)
   - Sequence performance charts
   - Individual prospect timeline
   - A/B test results

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Reviewed By:** N/A (Design Phase)  
**Next Review:** During Implementation Phase