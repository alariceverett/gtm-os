-- ==========================================
-- Outreach Sequences Table - Multi-step sequences with A/B testing
-- ==========================================

CREATE TABLE IF NOT EXISTS outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'email' CHECK (type IN (
    'email',
    'linkedin',
    'phone',
    'multi_channel',
    'mixed'
  )),
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  
  -- A/B Testing Configuration
  ab_test_enabled BOOLEAN DEFAULT false,
  ab_test_config JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "test_type": "subject_line", -- "subject_line", "body", "sender", "cta", "timing"
  --   "variants": ["A", "B", "C"],
  --   "traffic_split": {"A": 50, "B": 50},
  --   "winner_metric": "reply_rate", -- "open_rate", "reply_rate", "click_rate", "meeting_rate"
  --   "min_samples": 100,
  --   "confidence_level": 0.95
  -- }
  
  -- Sequence Steps (ordered array)
  steps JSONB DEFAULT '[]'::jsonb,
  -- [
  --   {
  --     "id": "step_1",
  --     "order": 1,
  --     "name": "Initial Outreach",
  --     "channel": "email",
  --     "delay_days": 0,
  --     "send_time": "09:00",
  --     "subject_template": "{{company.name}} - {{personalization_hook}}",
  --     "body_template": "...",
  --     "variants": {
  --       "A": { "subject": "...", "body": "..." },
  --       "B": { "subject": "...", "body": "..." }
  --     }
  --   },
  --   {
  --     "id": "step_2",
  --     "order": 2,
  --     "name": "LinkedIn Connect",
  --     "channel": "linkedin",
  --     "delay_days": 2,
  --     "condition": "if_no_reply",
  --     "message_template": "..."
  --   },
  --   {
  --     "id": "step_3",
  --     "order": 3,
  --     "name": "Follow-up Email",
  --     "channel": "email",
  --     "delay_days": 4,
  --     "condition": "if_no_reply",
  --     "subject_template": "Re: {{previous_subject}}",
  --     "body_template": "..."
  --   }
  -- ]
  
  -- Personalization Tokens
  tokens JSONB DEFAULT '[]'::jsonb,
  -- ["company.name", "contact.first_name", "contact.title", "signal.hiring", "tech_stack_match"]
  
  -- Exit Conditions
  exit_conditions JSONB DEFAULT '[]'::jsonb,
  -- [
  --   {"condition": "replied", "action": "exit_to_nurture"},
  --   {"condition": "booked_meeting", "action": "exit_to_sales"},
  --   {"condition": "hard_bounce", "action": "blacklist"},
  --   {"condition": "unsubscribed", "action": "blacklist"},
  --   {"condition": "max_steps_completed", "action": "exit_to_long_term_nurture"}
  -- ]
  
  -- Performance Stats
  stats JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "total_contacts_enrolled": 1000,
  --   "currently_active": 450,
  --   "completed": 400,
  --   "exited": 150,
  --   "step_stats": {
  --     "step_1": {"sent": 1000, "opened": 400, "replied": 150},
  --     "step_2": {"sent": 850, "opened": 200, "replied": 50},
  --     "step_3": {"sent": 800, "opened": 150, "replied": 30}
  --   }
  -- }
  
  -- Variants for A/B testing
  variants JSONB DEFAULT '[]'::jsonb,
  -- [
  --   {
  --     "id": "variant_a",
  --     "name": "Direct Value Prop",
  --     "description": "Focus on ROI benefits",
  --     "traffic_percentage": 50
  --   },
  --   {
  --     "id": "variant_b",
  --     "name": "Problem-Solution",
  --     "description": "Focus on pain point resolution",
  --     "traffic_percentage": 50
  --   }
  -- ]
  
  -- Winning variant (auto-selected)
  winning_variant_id VARCHAR(50),
  winner_selected_at TIMESTAMP WITH TIME ZONE,
  winner_selection_method VARCHAR(50), -- "auto", "manual"
  
  -- Template References
  email_template_ids UUID[],
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL,
  organization_id UUID,
  
  -- Usage
  campaign_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Table for sequence step performance (granular tracking)
CREATE TABLE IF NOT EXISTS sequence_step_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  
  -- Variant breakdown
  variant VARCHAR(10) DEFAULT 'A',
  
  -- Volume
  enrolled INTEGER DEFAULT 0,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  
  -- Engagement
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  positive_replied INTEGER DEFAULT 0,
  forwarded INTEGER DEFAULT 0,
  
  -- Outcomes
  meetings_booked INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  won_deals INTEGER DEFAULT 0,
  revenue DECIMAL(15, 2) DEFAULT 0,
  
  -- Bounces/Complaints
  bounced INTEGER DEFAULT 0,
  unsubscribed INTEGER DEFAULT 0,
  marked_spam INTEGER DEFAULT 0,
  
  -- Rates (calculated)
  open_rate DECIMAL(5, 2),
  click_rate DECIMAL(5, 2),
  reply_rate DECIMAL(5, 2),
  positive_rate DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(sequence_id, step_id, date, variant)
);

-- Indexes
CREATE INDEX idx_sequences_status ON outreach_sequences(status);
CREATE INDEX idx_sequences_type ON outreach_sequences(type);
CREATE INDEX idx_sequences_org ON outreach_sequences(organization_id);
CREATE INDEX idx_sequences_created ON outreach_sequences(created_at DESC);
CREATE INDEX idx_sequences_ab_test ON outreach_sequences(ab_test_enabled) WHERE ab_test_enabled = true;

CREATE INDEX idx_step_perf_sequence ON sequence_step_performance(sequence_id);
CREATE INDEX idx_step_perf_step ON sequence_step_performance(step_id);
CREATE INDEX idx_step_perf_date ON sequence_step_performance(date DESC);
CREATE INDEX idx_step_perf_variant ON sequence_step_performance(variant);

-- Triggers
CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_step_perf_updated_at
  BEFORE UPDATE ON sequence_step_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for sequence comparison (A/B test results)
CREATE OR REPLACE VIEW sequence_ab_test_results AS
SELECT 
  s.id as sequence_id,
  s.name as sequence_name,
  s.ab_test_config,
  s.winning_variant_id,
  v.variant,
  COUNT(*) as sample_size,
  SUM(sp.sent) as total_sent,
  ROUND(AVG(sp.open_rate), 2) as avg_open_rate,
  ROUND(AVG(sp.reply_rate), 2) as avg_reply_rate,
  ROUND(AVG(sp.positive_rate), 2) as avg_positive_rate,
  SUM(sp.meetings_booked) as total_meetings,
  SUM(sp.revenue) as total_revenue
FROM outreach_sequences s
CROSS JOIN LATERAL jsonb_array_elements_text(s.ab_test_config->'variants') as v(variant)
LEFT JOIN sequence_step_performance sp ON sp.sequence_id = s.id AND sp.variant = v.variant
WHERE s.ab_test_enabled = true
GROUP BY s.id, s.name, s.ab_test_config, s.winning_variant_id, v.variant;

-- Function to determine winning variant
CREATE OR REPLACE FUNCTION determine_winning_variant(
  p_sequence_id UUID,
  p_metric VARCHAR(50) DEFAULT 'reply_rate',
  p_min_samples INTEGER DEFAULT 100,
  p_confidence DECIMAL(3, 2) DEFAULT 0.95
)
RETURNS TABLE (
  winner VARCHAR(10),
  confidence DECIMAL(5, 4),
  reason TEXT
) AS $$
DECLARE
  v_winner VARCHAR(10);
  v_confidence DECIMAL(5, 4);
  v_reason TEXT;
BEGIN
  -- Simplified winning determination based on metric performance
  SELECT 
    variant,
    0.95, -- Placeholder confidence calculation
    format('Variant %s has highest %s rate', variant, p_metric)
  INTO v_winner, v_confidence, v_reason
  FROM (
    SELECT 
      variant,
      CASE p_metric
        WHEN 'open_rate' THEN AVG(open_rate)
        WHEN 'reply_rate' THEN AVG(reply_rate)
        WHEN 'positive_rate' THEN AVG(positive_rate)
        ELSE AVG(reply_rate)
      END as metric_value
    FROM sequence_step_performance
    WHERE sequence_id = p_sequence_id
    GROUP BY variant
    ORDER BY 2 DESC
    LIMIT 1
  ) best;
  
  RETURN QUERY SELECT v_winner, v_confidence, v_reason;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_step_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY sequences_select_policy ON outreach_sequences
  FOR SELECT USING (created_by = auth.uid() OR organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY sequences_insert_policy ON outreach_sequences
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY step_perf_select_policy ON sequence_step_performance
  FOR SELECT USING (sequence_id IN (
    SELECT id FROM outreach_sequences WHERE created_by = auth.uid()
  ));

-- Comments
COMMENT ON TABLE outreach_sequences IS 'Multi-step outreach sequences with A/B testing support';
COMMENT ON COLUMN outreach_sequences.steps IS 'Ordered array of sequence steps with templates';
COMMENT ON COLUMN outreach_sequences.variants IS 'A/B test variant definitions';
COMMENT ON COLUMN outreach_sequences.exit_conditions IS 'Rules for when to exit a prospect from the sequence';
