-- ==========================================
-- Research Jobs Table - Queue for discovery tasks
-- ==========================================

CREATE TABLE IF NOT EXISTS research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job Configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'prospect_search',
    'company_enrichment',
    'bulk_import',
    'signal_detection',
    'list_building',
    'data_cleansing',
    'competitor_research'
  )),
  
  -- Search Parameters (Apollo-style search config)
  search_params JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "filters": {
  --     "industry": ["saas", "fintech"],
  --     "company_size": ["51-200", "201-500"],
  --     "job_titles": ["vp engineering", "cto"],
  --     "technologies": ["react", "aws"],
  --     "funding_stage": ["series_a", "series_b"],
  --     "signal_types": ["hiring", "funding"]
  --   },
  --   "limit": 1000,
  --   "sort_by": "quality_score"
  -- }
  
  -- Data Sources
  sources JSONB DEFAULT '["apollo"]'::jsonb, -- e.g., ["apollo", "linkedin", "crm", "manual"]
  
  -- Progress Tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'queued',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled'
  )),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  -- Job Statistics
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  
  -- Results
  result_summary JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "prospects_created": 150,
  --   "companies_found": 89,
  --   "average_quality_score": "B+",
  --   "top_industries": {"saas": 45, "fintech": 30},
  --   "signals_detected": {"hiring": 67, "funding": 12}
  -- }
  
  -- Target Configuration
  assign_to_campaign_id UUID,
  assign_to_user_id UUID,
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Error Handling
  last_error TEXT,
  error_details JSONB DEFAULT '{}'::jsonb,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ownership
  created_by UUID NOT NULL,
  organization_id UUID,
  
  -- Job Grouping
  batch_id UUID,
  parent_job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE,
  
  -- Constraints
  CONSTRAINT valid_progress CHECK (processed_records <= total_records)
);

-- Indexes for performance
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_type ON research_jobs(type);
CREATE INDEX idx_research_jobs_created_at ON research_jobs(created_at DESC);
CREATE INDEX idx_research_jobs_batch ON research_jobs(batch_id);
CREATE INDEX idx_research_jobs_status_created ON research_jobs(status, created_at DESC);
CREATE INDEX idx_research_jobs_progress ON research_jobs(id, progress_percentage, status) 
  WHERE status IN ('running', 'paused');
CREATE INDEX idx_research_jobs_scheduled ON research_jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_research_jobs_updated_at
  BEFORE UPDATE ON research_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for active jobs monitoring
CREATE OR REPLACE VIEW active_research_jobs AS
SELECT 
  *,
  CASE 
    WHEN status = 'running' AND started_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
    ELSE NULL
  END as running_seconds,
  CASE 
    WHEN processed_records > 0 AND started_at IS NOT NULL THEN
      (processed_records::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (now() - started_at)), 0))::DECIMAL(10,2)
    ELSE 0
  END as records_per_second
FROM research_jobs
WHERE status IN ('pending', 'queued', 'running', 'paused');

-- Function to get job queue stats
CREATE OR REPLACE FUNCTION get_research_queue_stats()
RETURNS TABLE (
  status VARCHAR(50),
  count BIGINT,
  avg_progress DECIMAL,
  oldest_job TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rj.status,
    COUNT(*)::BIGINT,
    AVG(rj.progress_percentage)::DECIMAL(5,2),
    MIN(rj.created_at)
  FROM research_jobs rj
  GROUP BY rj.status
  ORDER BY 
    CASE rj.status 
      WHEN 'running' THEN 1
      WHEN 'queued' THEN 2
      WHEN 'pending' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_jobs_select_policy ON research_jobs
  FOR SELECT USING (created_by = auth.uid() OR organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY research_jobs_insert_policy ON research_jobs
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY research_jobs_update_policy ON research_jobs
  FOR UPDATE USING (created_by = auth.uid() OR organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Comments
COMMENT ON TABLE research_jobs IS 'Queue for async research and discovery tasks';
COMMENT ON COLUMN research_jobs.type IS 'Type of research job: prospect_search, company_enrichment, etc.';
COMMENT ON COLUMN research_jobs.search_params IS 'JSON configuration for search filters and parameters';
COMMENT ON COLUMN research_jobs.progress_percentage IS '0-100 completion percentage';
