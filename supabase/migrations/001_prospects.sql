-- ==========================================
-- Prospects Table - Core prospect data
-- ==========================================

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Information
  company_name VARCHAR(255) NOT NULL,
  company_domain VARCHAR(255),
  company_industry VARCHAR(100),
  company_size VARCHAR(50), -- e.g., "1-10", "11-50", "51-200", etc.
  company_annual_revenue VARCHAR(50),
  company_funding_stage VARCHAR(50),
  company_funding_amount DECIMAL(15, 2),
  company_location VARCHAR(255),
  company_website VARCHAR(255),
  company_linkedin_url VARCHAR(255),
  company_description TEXT,
  company_tech_stack JSONB DEFAULT '[]'::jsonb,
  
  -- Contact Information
  contact_first_name VARCHAR(100),
  contact_last_name VARCHAR(100),
  contact_title VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_linkedin_url VARCHAR(255),
  contact_department VARCHAR(100),
  contact_seniority VARCHAR(50), -- "entry", "manager", "director", "vp", "c-suite"
  
  -- Quality & Scoring
  quality_score CHAR(1) CHECK (quality_score IN ('A', 'B', 'C', 'D', 'E', 'F')),
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  intent_score INTEGER CHECK (intent_score >= 0 AND intent_score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  
  -- Signal Detection
  signals JSONB DEFAULT '[]'::jsonb, -- Array of detected signals
  signal_count INTEGER DEFAULT 0,
  last_signal_at TIMESTAMP WITH TIME ZONE,
  
  -- Enrichment Data
  enrichment_source VARCHAR(50), -- "apollo", "manual", "import", "api"
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  enriched_at TIMESTAMP WITH TIME ZONE,
  
  -- Status & Campaign
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'contacted', 'engaged', 'opportunity', 'nurture', 'unqualified', 'blacklisted')),
  assigned_to UUID,
  campaign_id UUID,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT valid_email CHECK (contact_email IS NULL OR contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT unique_company_contact UNIQUE (company_domain, contact_email)
);

-- Indexes for performance
CREATE INDEX idx_prospects_quality_score ON prospects(quality_score);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_industry ON prospects(company_industry);
CREATE INDEX idx_prospects_funding_stage ON prospects(company_funding_stage);
CREATE INDEX idx_prospects_created_at ON prospects(created_at DESC);
CREATE INDEX idx_prospects_signals ON prospects USING GIN(signals);
CREATE INDEX idx_prospects_tech_stack ON prospects USING GIN(company_tech_stack);
CREATE INDEX idx_prospects_campaign ON prospects(campaign_id);
CREATE INDEX idx_prospects_assigned ON prospects(assigned_to);

-- Full-text search
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_industry, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(contact_first_name, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(contact_last_name, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(contact_title, '')), 'D')
  ) STORED;

CREATE INDEX idx_prospects_search ON prospects USING GIN(search_vector);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE prospects IS 'Core prospect and company information with quality scoring';
COMMENT ON COLUMN prospects.quality_score IS 'A-F grade based on fit and intent signals';
COMMENT ON COLUMN prospects.signals IS 'Array of detected buying signals like hiring, funding, tech stack changes';
COMMENT ON COLUMN prospects.fit_score IS '0-100 score based on ICP match';
COMMENT ON COLUMN prospects.intent_score IS '0-100 score based on behavioral signals';
