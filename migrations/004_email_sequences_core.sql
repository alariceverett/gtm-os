-- Migration 004: Email Sequence System Core
-- Phase 2: Multi-step email outreach automation
-- Date: 2026-02-25

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search

-- ========================================================================
-- 1. EMAIL TEMPLATES
-- ========================================================================

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
  tokens_used TEXT[] DEFAULT '{}',
  required_fields TEXT[] DEFAULT '{}',
  
  -- Metadata
  category TEXT DEFAULT 'outreach',
  tone TEXT DEFAULT 'professional',
  
  -- Versioning (A/B testing support)
  version INTEGER DEFAULT 1,
  is_variant BOOLEAN DEFAULT false,
  parent_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  variant_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  
  -- Analytics benchmark
  avg_open_rate DECIMAL(5,2),
  avg_reply_rate DECIMAL(5,2),
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_templates_slug ON email_templates(slug);
CREATE INDEX idx_email_templates_status ON email_templates(status);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_parent ON email_templates(parent_template_id) WHERE is_variant = true;

-- Full-text search index
CREATE INDEX idx_email_templates_search ON email_templates 
  USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(subject, '') || ' ' || COALESCE(body_text, '')));

COMMENT ON TABLE email_templates IS 'Reusable email templates with personalization token support';

-- ========================================================================
-- 2. EMAIL SEQUENCES
-- ========================================================================

CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Strategy
  sequence_type TEXT DEFAULT 'cold_outreach' 
    CHECK (sequence_type IN ('cold_outreach', 'nurture', 're_engagement', 'follow_up')),
  goal TEXT,
  
  -- Configuration
  max_steps INTEGER DEFAULT 5,
  abort_on_reply BOOLEAN DEFAULT true,
  abort_on_meeting BOOLEAN DEFAULT true,
  
  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_config JSONB DEFAULT '{}',
  
  -- Timing defaults
  default_send_timezone TEXT DEFAULT 'America/New_York',
  business_hours_only BOOLEAN DEFAULT true,
  min_span_hours INTEGER DEFAULT 72,
  
  -- Entry criteria
  entry_conditions JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'draft' 
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  
  -- Stats (denormalized for performance)
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  avg_completion_time_hours INTEGER,
  
  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_sequences_slug ON email_sequences(slug);
CREATE INDEX idx_email_sequences_status ON email_sequences(status);
CREATE INDEX idx_email_sequences_type ON email_sequences(sequence_type);

COMMENT ON TABLE email_sequences IS 'Multi-step email sequence definitions with smart timing';

-- ========================================================================
-- 3. EMAIL SEQUENCE STEPS
-- ========================================================================

CREATE TABLE email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  
  -- Ordering
  step_number INTEGER NOT NULL,
  
  -- Content reference
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  
  -- Can override template for this step
  subject_override TEXT,
  body_override TEXT,
  
  -- Timing (relative to previous step or enroll)
  wait_days INTEGER DEFAULT 3,
  wait_hours INTEGER DEFAULT 0,
  wait_minutes INTEGER DEFAULT 0,
  
  -- Send window (respect prospect timezone)
  send_window_start TIME DEFAULT '09:00',
  send_window_end TIME DEFAULT '17:00',
  respect_weekends BOOLEAN DEFAULT true,
  
  -- Conditions (skip logic)
  condition_config JSONB DEFAULT '{}',
  
  -- A/B variant mapping
  variant_for TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sequence_id, step_number)
);

CREATE INDEX idx_sequence_steps_sequence ON email_sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_template ON email_sequence_steps(template_id);
CREATE INDEX idx_sequence_steps_active ON email_sequence_steps(is_active);
CREATE INDEX idx_sequence_steps_variant ON email_sequence_steps(sequence_id, variant_for) 
  WHERE variant_for IS NOT NULL;

COMMENT ON TABLE email_sequence_steps IS 'Individual steps within a sequence with timing and conditions';

-- ========================================================================
-- 4. SEQUENCE ENROLLMENTS
-- ========================================================================

CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- External reference (for Apollo integration)
  external_lead_id TEXT,
  
  -- Current state
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled', 'bounced')),
  current_step INTEGER DEFAULT 0,
  
  -- A/B variant assigned
  assigned_variant TEXT DEFAULT 'control',
  
  -- Timing
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Next scheduled action
  next_step_due_at TIMESTAMPTZ,
  
  -- Exit reasons
  exit_reason TEXT CHECK (exit_reason IN ('replied', 'bounced', 'unsubscribed', 'meeting_booked', 'manual', 'sequence_complete')),
  exit_at TIMESTAMPTZ,
  
  -- Personalization context (snapshot at enrollment)
  personalization_context JSONB DEFAULT '{}',
  
  -- Thread tracking
  thread_id TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_enrollments_prospect ON sequence_enrollments(prospect_id);
CREATE INDEX idx_enrollments_contact ON sequence_enrollments(contact_id);
CREATE INDEX idx_enrollments_external ON sequence_enrollments(external_lead_id);

-- Scheduler index - finds emails ready to send
CREATE INDEX idx_enrollments_next_due ON sequence_enrollments(next_step_due_at) 
  WHERE status IN ('pending', 'active');

-- Active enrollments for a sequence
CREATE INDEX idx_enrollments_active ON sequence_enrollments(sequence_id, status) 
  WHERE status = 'active';

COMMENT ON TABLE sequence_enrollments IS 'Tracks prospects enrolled in sequences with state machine';

-- ========================================================================
-- 5. EMAIL SENDS (Queue & History)
-- ========================================================================

CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES email_sequence_steps(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Content (final, after personalization)
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  personalized_data JSONB,
  
  -- Status lifecycle
  status TEXT DEFAULT 'queued' 
    CHECK (status IN (
      'queued', 'scheduled', 'sending', 'sent', 'delivered', 
      'opened', 'clicked', 'replied', 'bounced', 'failed', 'cancelled'
    )),
  
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
  provider TEXT,
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
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_sends_status ON email_sends(status);
CREATE INDEX idx_email_sends_enrollment ON email_sends(enrollment_id);
CREATE INDEX idx_email_sends_prospect ON email_sends(prospect_id);
CREATE INDEX idx_email_sends_template ON email_sends(template_id);

-- Scheduler indexes
CREATE INDEX idx_email_sends_scheduled ON email_sends(scheduled_for) 
  WHERE status = 'scheduled';
CREATE INDEX idx_email_sends_queued ON email_sends(queued_at) 
  WHERE status = 'queued';

-- Analytics indexes
CREATE INDEX idx_email_sends_sent ON email_sends(sent_at);
CREATE INDEX idx_email_sends_provider ON email_sends(provider, status);

COMMENT ON TABLE email_sends IS 'Tracks every email send through entire lifecycle';

-- ========================================================================
-- 6. EMAIL EVENTS (Analytics)
-- ========================================================================

CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  email_send_id UUID REFERENCES email_sends(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  
  -- Event type
  event_type TEXT NOT NULL 
    CHECK (event_type IN ('open', 'click', 'reply', 'bounce', 'spam_report', 'unsubscribe', 'forward')),
  
  -- Event data
  event_data JSONB DEFAULT '{}',
  
  -- Source
  ip_address INET,
  user_agent TEXT,
  
  -- For opens
  email_client TEXT,
  device_type TEXT,
  
  -- For clicks
  link_url TEXT,
  link_position TEXT,
  
  -- For replies
  reply_body TEXT,
  reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'negative', 'neutral', 'question')),
  reply_auto_categorized BOOLEAN DEFAULT false,
  
  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_send ON email_events(email_send_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_occurred ON email_events(occurred_at);
CREATE INDEX idx_email_events_enrollment ON email_events(enrollment_id);

COMMENT ON TABLE email_events IS 'Tracks opens, clicks, replies, and other email events';

-- ========================================================================
-- 7. SEQUENCE ANALYTICS (Aggregated)
-- ========================================================================

CREATE TABLE sequence_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  
  -- Time window
  period_type TEXT NOT NULL 
    CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
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

COMMENT ON TABLE sequence_analytics IS 'Aggregated analytics for sequences over time periods';

-- ========================================================================
-- 8. EMAIL APPROVAL QUEUE
-- ========================================================================

CREATE TABLE email_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  batch_id TEXT,
  emails_count INTEGER NOT NULL DEFAULT 1,
  
  -- Risk assessment
  risk_score INTEGER, -- 0-100
  risk_factors TEXT[],
  
  -- Content preview
  template_id UUID REFERENCES email_templates(id),
  sample_subject TEXT,
  sample_body TEXT,
  recipients_preview JSONB,
  
  -- Request
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Decision
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'modifications_requested')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  decision_note TEXT,
  
  -- Auto-expire
  expires_at TIMESTAMPTZ,
  auto_action_on_expire TEXT CHECK (auto_action_on_expire IN ('reject', 'escalate')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_status ON email_approval_queue(status);
CREATE INDEX idx_approval_expires ON email_approval_queue(expires_at) 
  WHERE status = 'pending';
CREATE INDEX idx_approval_batch ON email_approval_queue(batch_id);

COMMENT ON TABLE email_approval_queue IS 'Human approval queue for bulk/high-risk email sends';

-- ========================================================================
-- 9. PROSPECT ENGAGEMENT SCORES
-- ========================================================================

CREATE TABLE prospect_engagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID UNIQUE REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Scores
  overall_score INTEGER DEFAULT 0,
  email_score INTEGER DEFAULT 0,
  sequence_score INTEGER DEFAULT 0,
  
  -- Engagement history
  total_emails_received INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  
  heat_level TEXT DEFAULT 'cold' 
    CHECK (heat_level IN ('cold', 'warm', 'hot', 'very_hot')),
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engagement_prospect ON prospect_engagement_scores(prospect_id);
CREATE INDEX idx_engagement_heat ON prospect_engagement_scores(heat_level, last_activity_at);

COMMENT ON TABLE prospect_engagement_scores IS 'Calculated engagement scores for prospect prioritization';

-- ========================================================================
-- 10. TRIGGERS & FUNCTIONS
-- ========================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trg_email_templates_updated_at 
  BEFORE UPDATE ON email_templates 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_email_sequences_updated_at 
  BEFORE UPDATE ON email_sequences 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sequence_steps_updated_at 
  BEFORE UPDATE ON email_sequence_steps 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sequence_enrollments_updated_at 
  BEFORE UPDATE ON sequence_enrollments 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_email_sends_updated_at 
  BEFORE UPDATE ON email_sends 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Function to assign A/B variant
CREATE OR REPLACE FUNCTION assign_ab_variant(p_sequence_id UUID, p_prospect_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_config JSONB;
  v_variants TEXT[];
  v_weights INTEGER[];
  v_total_weight INTEGER;
  v_random_val INTEGER;
  v_cumulative INTEGER := 0;
  v_assignment TEXT;
BEGIN
  SELECT ab_test_config INTO v_config 
  FROM email_sequences 
  WHERE id = p_sequence_id;
  
  IF v_config IS NULL OR NOT (v_config->>'enabled')::BOOLEAN THEN
    RETURN 'control';
  END IF;
  
  -- Get variants from config
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_config->'variants')) INTO v_variants;
  SELECT ARRAY(SELECT (elem::TEXT)::INTEGER 
               FROM jsonb_array_elements(v_config->'weights') AS elem) INTO v_weights;
  
  IF v_variants IS NULL OR array_length(v_variants, 1) IS NULL THEN
    RETURN 'control';
  END IF;
  
  -- Calculate total weight
  SELECT COALESCE(SUM(w), 1) INTO v_total_weight 
  FROM UNNEST(v_weights) AS w;
  
  -- Generate random value
  v_random_val := floor(random() * v_total_weight);
  
  -- Find weighted variant
  FOR i IN 1..array_length(v_variants, 1) LOOP
    v_cumulative := v_cumulative + COALESCE(v_weights[i], 1);
    IF v_random_val < v_cumulative THEN
      v_assignment := v_variants[i];
      EXIT;
    END IF;
  END LOOP;
  
  RETURN COALESCE(v_assignment, 'control');
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate step conditions
CREATE OR REPLACE FUNCTION evaluate_step_conditions(
  p_enrollment_id UUID,
  p_step_id UUID,
  p_condition_config JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_enrollment RECORD;
  v_prev_opens INTEGER;
  v_has_replied BOOLEAN;
BEGIN
  -- Get enrollment state
  SELECT * INTO v_enrollment 
  FROM sequence_enrollments 
  WHERE id = p_enrollment_id;
  
  IF v_enrollment IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check skip_if_opened_prev
  IF (p_condition_config->>'skip_if_opened_prev')::BOOLEAN THEN
    SELECT COUNT(*) INTO v_prev_opens 
    FROM email_sends es
    JOIN email_events ee ON ee.email_send_id = es.id
    WHERE es.enrollment_id = p_enrollment_id 
      AND es.sequence_step_id != p_step_id
      AND ee.event_type = 'open';
    
    IF v_prev_opens > 0 THEN
      RETURN false; -- Skip this step
    END IF;
  END IF;
  
  -- Check skip_if_replied
  IF (p_condition_config->>'skip_if_replied')::BOOLEAN THEN
    SELECT EXISTS(
      SELECT 1 FROM sequence_enrollments 
      WHERE id = p_enrollment_id 
        AND exit_reason = 'replied'
    ) INTO v_has_replied;
    
    IF v_has_replied THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true; -- Proceed
END;
$$ LANGUAGE plpgsql;

-- Function to increment sequence stats
CREATE OR REPLACE FUNCTION increment_sequence_stats(
  p_sequence_id UUID,
  p_field TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    UPDATE email_sequences 
    SET %I = COALESCE(%I, 0) + 1,
        updated_at = NOW()
    WHERE id = $1
  ', p_field, p_field) USING p_sequence_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================================================
-- 11. RLS POLICIES
-- ========================================================================

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_engagement_scores ENABLE ROW LEVEL SECURITY;

-- Users can view all templates
CREATE POLICY templates_select_all ON email_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY templates_insert_own ON email_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY templates_update_own ON email_templates
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Users can view all sequences
CREATE POLICY sequences_select_all ON email_sequences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sequences_insert_own ON email_sequences
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY sequences_update_own ON email_sequences
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Steps inherit sequence permissions
CREATE POLICY steps_select_all ON email_sequence_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY steps_insert_based ON email_sequence_steps
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM email_sequences WHERE id = sequence_id AND created_by = auth.uid())
  );

-- Users can view all enrollments
CREATE POLICY enrollments_select_all ON sequence_enrollments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY enrollments_insert_based ON sequence_enrollments
  FOR INSERT TO authenticated WITH CHECK (true);

-- Email sends
CREATE POLICY sends_select_all ON email_sends
  FOR SELECT TO authenticated USING (true);

-- Email events
CREATE POLICY events_select_all ON email_events
  FOR SELECT TO authenticated USING (true);

-- Analytics
CREATE POLICY analytics_select_all ON sequence_analytics
  FOR SELECT TO authenticated USING (true);

-- Approval queue
CREATE POLICY approval_select_all ON email_approval_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY approval_update_reviewer ON email_approval_queue
  FOR UPDATE TO authenticated USING (true);

-- Engagement scores
CREATE POLICY engagement_select_all ON prospect_engagement_scores
  FOR SELECT TO authenticated USING (true);

-- ========================================================================
-- 12. SEED DATA
-- ========================================================================

-- Default email templates
INSERT INTO email_templates (slug, name, subject, body_text, category, tone, status) VALUES
('cold_outreach_01', 'Cold Outreach - Value Prop', 
 'Quick question about {{company}}', 
 'Hi {{first_name|there}},

I noticed {{company}} specializes in {{industry}} and might be facing challenges with [common pain point].

We help companies like {{company}} [achieve specific result] - typically seeing [metric] within [timeframe].

Would you be open to a brief conversation about how we might help {{company}}?

Best,
{{sender_name}}',
 'outreach', 'professional', 'active'),

('follow_up_01', 'Follow-up - Reengagement',
 'Re: Quick question about {{company}}',
 'Hi {{first_name}},

I wanted to follow up on my previous note about [value prop].

I understand you''re likely busy. Would a brief {{day_of_week}} {{time_of_day}} work for a quick chat?

Best,
{{sender_name}}',
 'outreach', 'friendly', 'active'),

('breakup_01', 'Breakup - Closing Sequence',
 'Should I close your file?',
 'Hi {{first_name}},

I''ve reached out a few times about helping {{company}} with [value prop], but haven''t heard back.

I assume this means you''re either not interested or the timing isn''t right.

I''ll close your file unless I hear otherwise.

Best of luck,
{{sender_name}}',
 'outreach', 'professional', 'active');

-- Create a default sequence
INSERT INTO email_sequences (slug, name, description, sequence_type, status, max_steps, abort_on_reply, business_hours_only, min_span_hours) VALUES
('default_cold_sequence', 'Default Cold Outreach Sequence', 
 'A 4-step cold email sequence with smart timing', 
 'cold_outreach', 'active', 4, true, true, 72);

-- Add steps to the default sequence
INSERT INTO email_sequence_steps (sequence_id, step_number, template_id, wait_days, send_window_start, send_window_end, respect_weekends, is_active)
SELECT 
  (SELECT id FROM email_sequences WHERE slug = 'default_cold_sequence'),
  1,
  (SELECT id FROM email_templates WHERE slug = 'cold_outreach_01'),
  0, -- Send immediately upon enrollment
  '09:00',
  '17:00',
  true,
  true;

INSERT INTO email_sequence_steps (sequence_id, step_number, template_id, wait_days, send_window_start, send_window_end, respect_weekends, is_active)
SELECT 
  (SELECT id FROM email_sequences WHERE slug = 'default_cold_sequence'),
  2,
  (SELECT id FROM email_templates WHERE slug = 'follow_up_01'),
  3, -- Wait 3 days
  '09:00',
  '17:00',
  true,
  true;

INSERT INTO email_sequence_steps (sequence_id, step_number, template_id, wait_days, send_window_start, send_window_end, respect_weekends, condition_config, is_active)
SELECT 
  (SELECT id FROM email_sequences WHERE slug = 'default_cold_sequence'),
  3,
  (SELECT id FROM email_templates WHERE slug = 'follow_up_01'),
  7, -- Wait 7 days (10 total from start)
  '09:00',
  '17:00',
  true,
  '{"skip_if_opened_prev": true}',
  true;

INSERT INTO email_sequence_steps (sequence_id, step_number, template_id, wait_days, send_window_start, send_window_end, respect_weekends, is_active)
SELECT 
  (SELECT id FROM email_sequences WHERE slug = 'default_cold_sequence'),
  4,
  (SELECT id FROM email_templates WHERE slug = 'breakup_01'),
  7, -- Wait 7 days (17 total from start)
  '09:00',
  '17:00',
  true,
  true;

-- ========================================================================
-- Migration complete
-- ========================================================================

-- Migration 004 complete
-- Note: Migration record added by runner