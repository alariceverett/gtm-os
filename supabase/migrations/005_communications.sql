-- ==========================================
-- Communications Table - All touch points logging
-- ==========================================

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES outreach_sequences(id) ON DELETE SET NULL,
  step_id VARCHAR(50), -- References step within sequence
  variant VARCHAR(10) DEFAULT 'A',
  
  -- Channel & Type
  channel VARCHAR(50) NOT NULL CHECK (channel IN (
    'email',
    'linkedin',
    'phone',
    'sms',
    'meeting',
    'note',
    'api',
    'chat',
    'direct_mail'
  )),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  
  -- Message Content
  subject TEXT,
  body TEXT,
  body_html TEXT,
  
  -- For calls and meetings
  notes TEXT,
  duration_seconds INTEGER,
  recording_url VARCHAR(500),
  
  -- Status Flow based on channel
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  status_details JSONB DEFAULT '{}'::jsonb,
  
  -- Channel-specific statuses:
  -- Email: pending, queued, sent, delivered, opened, clicked, replied, positive_reply, forwarded, bounced, spam_complaint, unsubscribed
  -- LinkedIn: pending, connection_sent, connected, messaged, replied, endorsed, viewed_profile
  -- Phone: pending, dialed, voicemail, connected, no_answer, callback_scheduled, completed
  -- Meeting: pending, scheduled, confirmed, completed, no_show, cancelled, rescheduled
  -- General: draft, pending, sent, delivered, read, responded, completed, failed
  
  -- Engagement Tracking
  engagement_data JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "email": {
  --     "opened_at": "2025-02-25T10:30:00Z",
  --     "open_count": 3,
  --     "ip_address": "192.168.1.1",
  --     "user_agent": "Mozilla/5.0...",
  --     "clicked_at": "2025-02-25T10:35:00Z",
  --     "clicked_links": ["https://..."],
  --     "forwarded": false
  --   },
  --   "meeting": {
  --     "scheduled_at": "2025-03-01T14:00:00Z",
  --     "calendar_event_id": "...",
  --     "meeting_url": "https://zoom.us/j/...",
  --     "outcome": "completed",
  --     "next_steps": "Schedule demo"
  --   }
  -- }
  
  -- Reply Analysis (AI/ML processed)
  reply_analysis JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "sentiment": "positive", -- "positive", "neutral", "negative"
  --   "intent": "interested", -- "interested", "not_interested", "wrong_person", "timing", "needs_more_info"
  --   "objections": ["pricing", "competitor"],
  --   "buying_signals": ["budget", "authority", "timeline"],
  --   "urgency_score": 7,
  --   "suggested_response": "...",
  --   "auto_reply": false
  -- }
  
  -- Threading
  thread_id UUID REFERENCES communications(id),
  in_reply_to UUID REFERENCES communications(id),
  message_id VARCHAR(255), -- External message ID (email Message-ID)
  
  -- Sending
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by_user_id UUID,
  sent_by_system VARCHAR(50), -- "manual", "sequence", "api", "ai"
  
  -- Error/Retry
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Source tracking
  source VARCHAR(50), -- "sequence", "manual", "api", "import", "integration"
  source_details JSONB DEFAULT '{}'::jsonb
);

-- Email-specific tracking table (for detailed analytics)
CREATE TABLE IF NOT EXISTS email_tracking_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- "open", "click", "bounce", "complaint", "unsubscribe"
  event_data JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "ip_address": "...",
  --   "user_agent": "...",
  --   "referrer": "...",
  --   "link_url": "...",
  --   "bounce_reason": "...",
  --   "bounce_type": "soft" or "hard"
  -- }
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Meeting outcomes table
CREATE TABLE IF NOT EXISTS meeting_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  actual_start_at TIMESTAMP WITH TIME ZONE,
  actual_end_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, no_show, cancelled, rescheduled
  outcome VARCHAR(50), -- demo_booked, proposal_sent, closed_won, closed_lost, qualified_out, nurture
  attended_by JSONB DEFAULT '[]'::jsonb, -- [{"name": "...", "email": "...", "attended": true}]
  notes TEXT,
  next_steps TEXT,
  opportunity_created BOOLEAN DEFAULT false,
  opportunity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_communications_prospect ON communications(prospect_id);
CREATE INDEX idx_communications_campaign ON communications(campaign_id);
CREATE INDEX idx_communications_sequence ON communications(sequence_id, step_id);
CREATE INDEX idx_communications_channel ON communications(channel);
CREATE INDEX idx_communications_status ON communications(status);
CREATE INDEX idx_communications_direction ON communications(direction);
CREATE INDEX idx_communications_sent_at ON communications(sent_at DESC);
CREATE INDEX idx_communications_created_at ON communications(created_at DESC);
CREATE INDEX idx_communications_thread ON communications(thread_id);
CREATE INDEX idx_communications_scheduled ON communications(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_communications_engagement ON communications USING GIN(engagement_data);
CREATE INDEX idx_communications_reply ON communications USING GIN(reply_analysis);

CREATE INDEX idx_email_tracking_comm ON email_tracking_log(communication_id);
CREATE INDEX idx_email_tracking_event ON email_tracking_log(event_type);
CREATE INDEX idx_email_tracking_time ON email_tracking_log(occurred_at DESC);

CREATE INDEX idx_meeting_outcomes_comm ON meeting_outcomes(communication_id);
CREATE INDEX idx_meeting_outcomes_status ON meeting_outcomes(status);
CREATE INDEX idx_meeting_outcomes_scheduled ON meeting_outcomes(scheduled_at);

-- Trigger for updated_at
CREATE TRIGGER update_communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_outcomes_updated_at
  BEFORE UPDATE ON meeting_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for prospect communication timeline
CREATE OR REPLACE VIEW prospect_communication_timeline AS
SELECT 
  c.id,
  c.prospect_id,
  c.channel,
  c.direction,
  c.subject,
  c.status,
  c.sent_at,
  c.created_at,
  c.reply_analysis,
  c.engagement_data,
  p.company_name,
  p.contact_first_name,
  p.contact_last_name,
  p.contact_email,
  camp.name as campaign_name,
  seq.name as sequence_name,
  CASE 
    WHEN c.reply_analysis->>'sentiment' IS NOT NULL 
    THEN c.reply_analysis->>'sentiment'
    ELSE NULL
  END as sentiment
FROM communications c
LEFT JOIN prospects p ON p.id = c.prospect_id
LEFT JOIN outreach_campaigns camp ON camp.id = c.campaign_id
LEFT JOIN outreach_sequences seq ON seq.id = c.sequence_id
ORDER BY c.sent_at DESC NULLS LAST;

-- Function to get prospect engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(p_prospect_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
BEGIN
  -- Base score from email opens
  SELECT v_score + (COUNT(*) * 5)
  INTO v_score
  FROM email_tracking_log etl
  JOIN communications c ON c.id = etl.communication_id
  WHERE c.prospect_id = p_prospect_id AND etl.event_type = 'open';
  
  -- Add score for clicks
  SELECT v_score + (COUNT(*) * 15)
  INTO v_score
  FROM email_tracking_log etl
  JOIN communications c ON c.id = etl.communication_id
  WHERE c.prospect_id = p_prospect_id AND etl.event_type = 'click';
  
  -- Add score for replies (highest weight)
  SELECT v_score + (COUNT(*) * 25)
  INTO v_score
  FROM communications
  WHERE prospect_id = p_prospect_id AND direction = 'inbound';
  
  -- Add score for meetings
  SELECT v_score + (COUNT(*) * 50)
  INTO v_score
  FROM communications
  WHERE prospect_id = p_prospect_id AND channel = 'meeting' AND status = 'completed';
  
  -- Cap at 100
  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update engagement score on prospect
CREATE OR REPLACE FUNCTION update_prospect_engagement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prospects 
  SET engagement_score = calculate_engagement_score(NEW.prospect_id)
  WHERE id = NEW.prospect_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_engagement_on_tracking
  AFTER INSERT ON email_tracking_log
  FOR EACH ROW
  EXECUTE FUNCTION update_prospect_engagement();

-- RLS Policies
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY communications_select_policy ON communications
  FOR SELECT USING (prospect_id IN (
    SELECT id FROM prospects WHERE created_by = auth.uid()
  ));

CREATE POLICY communications_insert_policy ON communications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY email_tracking_select_policy ON email_tracking_log
  FOR SELECT USING (communication_id IN (
    SELECT id FROM communications WHERE prospect_id IN (
      SELECT id FROM prospects WHERE created_by = auth.uid()
    )
  ));

CREATE POLICY meeting_outcomes_select_policy ON meeting_outcomes
  FOR SELECT USING (communication_id IN (
    SELECT id FROM communications WHERE prospect_id IN (
      SELECT id FROM prospects WHERE created_by = auth.uid()
    )
  ));

-- Comments
COMMENT ON TABLE communications IS 'All touch points: email, LinkedIn, calls, meetings';
COMMENT ON COLUMN communications.reply_analysis IS 'AI-processed reply sentiment and intent';
COMMENT ON COLUMN communications.engagement_data IS 'Detailed engagement metrics per channel';
