-- ==========================================
-- Channel Performance Table - Split test analytics
-- ==========================================

CREATE TABLE IF NOT EXISTS channel_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimension fields
  date DATE NOT NULL,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'linkedin', 'phone', 'sms', 'multi_channel')),
  
  -- Campaign/Sequence context
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_id VARCHAR(50),
  
  -- A/B Variant
  variant VARCHAR(10) DEFAULT 'A',
  
  -- Audience segment
  segment_name VARCHAR(100), -- e.g., "enterprise_saas", "high_intent", "recent_funding"
  
  -- Volume metrics
  prospects_targeted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  
  -- Delivery metrics
  bounces INTEGER DEFAULT 0,
  unsubscribes INTEGER DEFAULT 0,
  spam_complaints INTEGER DEFAULT 0,
  
  -- Engagement metrics
  opens INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  negative_replies INTEGER DEFAULT 0,
  neutral_replies INTEGER DEFAULT 0,
  
  -- Outcome metrics
  meetings_booked INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  closed_won INTEGER DEFAULT 0,
  closed_lost INTEGER DEFAULT 0,
  revenue_won DECIMAL(15, 2) DEFAULT 0,
  revenue_lost DECIMAL(15, 2) DEFAULT 0,
  
  -- Calculated rates (stored for fast querying)
  delivery_rate DECIMAL(5, 2) DEFAULT 0,
  open_rate DECIMAL(5, 2) DEFAULT 0,
  click_rate DECIMAL(5, 2) DEFAULT 0,
  reply_rate DECIMAL(5, 2) DEFAULT 0,
  positive_rate DECIMAL(5, 2) DEFAULT 0,
  meeting_rate DECIMAL(5, 2) DEFAULT 0,
  opportunity_rate DECIMAL(5, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Costs (for ROI calculation)
  cost_per_message DECIMAL(10, 4) DEFAULT 0, -- in cents
  total_cost DECIMAL(10, 2) DEFAULT 0,
  cost_per_meeting DECIMAL(10, 2) DEFAULT 0,
  cost_per_opportunity DECIMAL(10, 2) DEFAULT 0,
  cost_per_deal DECIMAL(10, 2) DEFAULT 0,
  roi_percent DECIMAL(5, 2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  UNIQUE(date, channel, campaign_id, sequence_id, step_id, variant, segment_name)
);

-- Composite index for common queries
CREATE INDEX idx_channel_perf_date_channel ON channel_performance(date DESC, channel);
CREATE INDEX idx_channel_perf_campaign ON channel_performance(campaign_id, date DESC);
CREATE INDEX idx_channel_perf_sequence ON channel_performance(sequence_id, step_id);
CREATE INDEX idx_channel_perf_variant ON channel_performance(variant) WHERE variant IS NOT NULL;
CREATE INDEX idx_channel_perf_segment ON channel_performance(segment_name);

-- Trigger to auto-calculate rates
CREATE OR REPLACE FUNCTION calculate_channel_rates()
RETURNS TRIGGER AS $$
BEGIN
  -- Delivery rate
  NEW.delivery_rate := CASE 
    WHEN NEW.messages_sent > 0 THEN 
      ROUND((NEW.messages_delivered::DECIMAL / NEW.messages_sent) * 100, 2)
    ELSE 0 
  END;
  
  -- Open rate (of delivered)
  NEW.open_rate := CASE 
    WHEN NEW.messages_delivered > 0 THEN 
      ROUND((NEW.unique_opens::DECIMAL / NEW.messages_delivered) * 100, 2)
    ELSE 0 
  END;
  
  -- Click rate (of delivered)
  NEW.click_rate := CASE 
    WHEN NEW.messages_delivered > 0 THEN 
      ROUND((NEW.unique_clicks::DECIMAL / NEW.messages_delivered) * 100, 2)
    ELSE 0 
  END;
  
  -- Reply rate (of sent)
  NEW.reply_rate := CASE 
    WHEN NEW.messages_sent > 0 THEN 
      ROUND((NEW.replies::DECIMAL / NEW.messages_sent) * 100, 2)
    ELSE 0 
  END;
  
  -- Positive reply rate
  NEW.positive_rate := CASE 
    WHEN NEW.replies > 0 THEN 
      ROUND((NEW.positive_replies::DECIMAL / NEW.replies) * 100, 2)
    ELSE 0 
  END;
  
  -- Meeting rate
  NEW.meeting_rate := CASE 
    WHEN NEW.messages_sent > 0 THEN 
      ROUND((NEW.meetings_booked::DECIMAL / NEW.messages_sent) * 100, 2)
    ELSE 0 
  END;
  
  -- Opportunity rate
  NEW.opportunity_rate := CASE 
    WHEN NEW.messages_sent > 0 THEN 
      ROUND((NEW.opportunities_created::DECIMAL / NEW.messages_sent) * 100, 2)
    ELSE 0 
  END;
  
  -- Conversion rate
  NEW.conversion_rate := CASE 
    WHEN NEW.opportunities_created > 0 THEN 
      ROUND((NEW.closed_won::DECIMAL / NEW.opportunities_created) * 100, 2)
    ELSE 0 
  END;
  
  -- Cost calculations
  NEW.total_cost := NEW.messages_sent * NEW.cost_per_message;
  NEW.cost_per_meeting := CASE 
    WHEN NEW.meetings_booked > 0 THEN NEW.total_cost / NEW.meetings_booked 
    ELSE 0 
  END;
  NEW.cost_per_opportunity := CASE 
    WHEN NEW.opportunities_created > 0 THEN NEW.total_cost / NEW.opportunities_created 
    ELSE 0 
  END;
  NEW.cost_per_deal := CASE 
    WHEN NEW.closed_won > 0 THEN NEW.total_cost / NEW.closed_won 
    ELSE 0 
  END;
  NEW.roi_percent := CASE 
    WHEN NEW.total_cost > 0 THEN 
      ROUND(((NEW.revenue_won - NEW.total_cost) / NEW.total_cost) * 100, 2)
    ELSE 0 
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_rates_on_insert_update
  BEFORE INSERT OR UPDATE ON channel_performance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_channel_rates();

-- Function to aggregate performance by period
CREATE OR REPLACE FUNCTION get_performance_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_channel VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  channel VARCHAR(50),
  messages_sent BIGINT,
  delivery_rate DECIMAL(5,2),
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  reply_rate DECIMAL(5,2),
  positive_rate DECIMAL(5,2),
  meetings_booked BIGINT,
  opportunities_created BIGINT,
  closed_won BIGINT,
  revenue_won DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  roi_percent DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.channel,
    SUM(cp.messages_sent)::BIGINT,
    ROUND(AVG(cp.delivery_rate), 2),
    ROUND(AVG(cp.open_rate), 2),
    ROUND(AVG(cp.click_rate), 2),
    ROUND(AVG(cp.reply_rate), 2),
    ROUND(AVG(cp.positive_rate), 2),
    SUM(cp.meetings_booked)::BIGINT,
    SUM(cp.opportunities_created)::BIGINT,
    SUM(cp.closed_won)::BIGINT,
    SUM(cp.revenue_won),
    SUM(cp.total_cost),
    ROUND( 
      CASE WHEN SUM(cp.total_cost) > 0 
      THEN ((SUM(cp.revenue_won) - SUM(cp.total_cost)) / SUM(cp.total_cost)) * 100 
      ELSE 0 
      END, 2
    )
  FROM channel_performance cp
  WHERE cp.date BETWEEN p_start_date AND p_end_date
    AND (p_campaign_id IS NULL OR cp.campaign_id = p_campaign_id)
    AND (p_channel IS NULL OR cp.channel = p_channel)
  GROUP BY cp.channel
  ORDER BY SUM(cp.messages_sent) DESC;
END;
$$ LANGUAGE plpgsql;

-- View for A/B test comparison
CREATE OR REPLACE VIEW ab_test_comparison AS
SELECT 
  cp.campaign_id,
  cp.sequence_id,
  cp.step_id,
  cp.channel,
  cp.segment_name,
  DATE_TRUNC('week', cp.date) as test_week,
  cp.variant,
  SUM(cp.messages_sent) as total_sent,
  ROUND(AVG(cp.open_rate), 2) as avg_open_rate,
  ROUND(AVG(cp.click_rate), 2) as avg_click_rate,
  ROUND(AVG(cp.reply_rate), 2) as avg_reply_rate,
  ROUND(AVG(cp.positive_rate), 2) as avg_positive_rate,
  ROUND(AVG(cp.meeting_rate), 2) as avg_meeting_rate,
  SUM(cp.meetings_booked) as total_meetings,
  SUM(cp.revenue_won) as total_revenue
FROM channel_performance cp
WHERE cp.variant IS NOT NULL
GROUP BY cp.campaign_id, cp.sequence_id, cp.step_id, cp.channel, cp.segment_name, test_week, cp.variant
ORDER BY test_week DESC, cp.campaign_id, cp.variant;

-- View for channel benchmark comparison
CREATE OR REPLACE VIEW channel_benchmarks_current_month AS
SELECT 
  cp.channel,
  CURRENT_DATE as benchmark_date,
  COUNT(DISTINCT cp.date) as days_of_data,
  SUM(cp.messages_sent) as total_sent,
  ROUND(AVG(cp.delivery_rate), 2) as avg_delivery_rate,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cp.delivery_rate), 2) as median_delivery_rate,
  ROUND(AVG(cp.open_rate), 2) as avg_open_rate,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cp.open_rate), 2) as median_open_rate,
  ROUND(AVG(cp.reply_rate), 2) as avg_reply_rate,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cp.reply_rate), 2) as median_reply_rate,
  ROUND(AVG(cp.positive_rate), 2) as avg_positive_rate,
  ROUND(AVG(cp.meeting_rate), 2) as avg_meeting_rate,
  ROUND(AVG(cp.cost_per_message), 4) as avg_cost_per_message
FROM channel_performance cp
WHERE cp.date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY cp.channel
ORDER BY avg_reply_rate DESC;

-- RLS
ALTER TABLE channel_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY channel_perf_select_policy ON channel_performance
  FOR SELECT USING (
    campaign_id IS NULL OR 
    campaign_id IN (
      SELECT id FROM outreach_campaigns 
      WHERE created_by = auth.uid() OR organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY channel_perf_insert_policy ON channel_performance
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY channel_perf_update_policy ON channel_performance
  FOR UPDATE USING (
    campaign_id IN (
      SELECT id FROM outreach_campaigns WHERE created_by = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE channel_performance IS 'Aggregate performance metrics by channel, date, and variant for split testing';
COMMENT ON COLUMN channel_performance.variant IS 'A/B test variant identifier';
COMMENT ON COLUMN channel_performance.segment_name IS 'Audience segment for cohort analysis';
