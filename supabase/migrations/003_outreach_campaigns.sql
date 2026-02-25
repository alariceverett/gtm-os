-- ==========================================
-- Outreach Campaigns Table - Campaign definitions
-- ==========================================

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'outbound_email',
    'linkedin_sequence',
    'multi_channel',
    'event_follow_up',
    'nurture',
    'reactivation',
    'account_based'
  )),
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_approval',
    'scheduled',
    'active',
    'paused',
    'completed',
    'archived'
  )),
  
  -- Schedule
  start_date DATE,
  end_date DATE,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  
  -- Targeting Parameters
  targeting_params JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "quality_score_min": "B",
  --   "industries": ["saas", "fintech"],
  --   "company_size": ["51-200", "201-500"],
  --   "job_titles": ["vp engineering", "director infrastructure"],
  --   "technologies": ["aws", "kubernetes"],
  --   "signals": ["hiring_devops", "recent_funding"],
  --   "exclude_campaigns": ["uuid-of-previous-campaign"],
  --   "exclude_contacted_days": 30
  -- }
  
  -- Audience Definition
  audience_source VARCHAR(50) DEFAULT 'manual' CHECK (audience_source IN (
    'manual',
    'segment',
    'icp_match',
    'research_job',
    'list_upload',
    'crm_sync'
  )),
  audience_segment_id UUID,
  
  -- Sequence Assignment
  primary_sequence_id UUID,
  variant_test_enabled BOOLEAN DEFAULT false,
  
  -- Goal & Tracking
  goals JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "target_prospects": 500,
  --   "target_meetings": 50,
  --   "target_reply_rate": 0.15,
  --   "target_positive_rate": 0.05
  -- }
  
  -- Volume Controls
  daily_limit INTEGER DEFAULT 100,
  total_limit INTEGER,
  sending_window JSONB DEFAULT '{
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "start_time": "09:00",
    "end_time": "17:00",
    "batch_size": 10,
    "batch_delay_minutes": 5
  }'::jsonb,
  
  -- Performance Tracking
  performance_summary JSONB DEFAULT '{}'::jsonb,
  -- Auto-updated by trigger based on communications
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "track_opens": true,
  --   "track_clicks": true,
  --   "auto_unsubscribe": true,
  --   "personalization_enabled": true,
  --   "ai_review_enabled": false,
  --   "human_approval_required": false
  -- }
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL,
  organization_id UUID,
  
  -- Approval Flow
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_campaigns_status ON outreach_campaigns(status);
CREATE INDEX idx_campaigns_type ON outreach_campaigns(type);
CREATE INDEX idx_campaigns_dates ON outreach_campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_targeting ON outreach_campaigns USING GIN(targeting_params);
CREATE INDEX idx_campaigns_org ON outreach_campaigns(organization_id);
CREATE INDEX idx_campaigns_created ON outreach_campaigns(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON outreach_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Campaign Performance View
CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT 
  c.id,
  c.name,
  c.type,
  c.status,
  COUNT(DISTINCT p.id) as total_prospects,
  COUNT(DISTINCT CASE WHEN com.channel = 'email' THEN com.id END) as emails_sent,
  COUNT(DISTINCT CASE WHEN com.channel = 'email' AND com.status = 'opened' THEN com.id END) as emails_opened,
  COUNT(DISTINCT CASE WHEN com.channel = 'email' AND com.status IN ('replied', 'positive_reply') THEN com.id END) as emails_replied,
  COUNT(DISTINCT CASE WHEN com.channel = 'linkedin' THEN com.id END) as linkedin_steps,
  COUNT(DISTINCT CASE WHEN com.channel = 'call' THEN com.id END) as calls_made,
  COUNT(DISTINCT CASE WHEN com.channel = 'meeting' THEN com.id END) as meetings_booked,
  COUNT(DISTINCT CASE WHEN p.status = 'opportunity' THEN p.id END) as opportunities_created,
  ROUND(
    COUNT(DISTINCT CASE WHEN com.channel = 'email' AND com.status = 'opened' THEN com.id END)::DECIMAL 
    / NULLIF(COUNT(DISTINCT CASE WHEN com.channel = 'email' THEN com.id END), 0) * 100, 
    2
  ) as open_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN com.channel = 'email' AND com.status IN ('replied', 'positive_reply') THEN com.id END)::DECIMAL 
    / NULLIF(COUNT(DISTINCT CASE WHEN com.channel = 'email' THEN com.id END), 0) * 100, 
    2
  ) as reply_rate
FROM outreach_campaigns c
LEFT JOIN prospects p ON p.campaign_id = c.id
LEFT JOIN communications com ON com.prospect_id = p.id
GROUP BY c.id, c.name, c.type, c.status;

-- RLS Policies
ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_select_policy ON outreach_campaigns
  FOR SELECT USING (created_by = auth.uid() OR organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY campaigns_insert_policy ON outreach_campaigns
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY campaigns_update_policy ON outreach_campaigns
  FOR UPDATE USING (created_by = auth.uid() OR organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Comments
COMMENT ON TABLE outreach_campaigns IS 'Campaign definitions and targeting parameters';
COMMENT ON COLUMN outreach_campaigns.targeting_params IS 'JSON targeting criteria for ICP matching';
COMMENT ON COLUMN outreach_campaigns.sending_window IS 'Configuration for when messages are sent';
COMMENT ON COLUMN outreach_campaigns.goals IS 'Campaign targets and KPIs';
