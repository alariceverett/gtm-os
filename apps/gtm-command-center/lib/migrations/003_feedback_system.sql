-- Feedback & Learning Infrastructure Migration
-- GATE 3: Feedback & Learning System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Signal types enum
CREATE TYPE feedback_signal_type AS ENUM (
    'explicit_positive',
    'explicit_negative',
    'implicit_dwell',
    'implicit_skip',
    'command_issued',
    'override_taken',
    'question_asked'
);

-- Feedback signals table - captures all user interactions
CREATE TABLE feedback_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    signal_type feedback_signal_type NOT NULL,
    context JSONB DEFAULT '{}'::JSONB,
    -- {page, section, previous_actions, ui_state}
    content TEXT,
    -- voice/text transcript or null
    outcome JSONB DEFAULT '{}'::JSONB,
    -- what happened after feedback
    processed BOOLEAN DEFAULT FALSE,
    learning_weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_feedback_signals_user_id ON feedback_signals(user_id);
CREATE INDEX idx_feedback_signals_timestamp ON feedback_signals(timestamp DESC);
CREATE INDEX idx_feedback_signals_signal_type ON feedback_signals(signal_type);
CREATE INDEX idx_feedback_signals_processed ON feedback_signals(processed);
CREATE INDEX idx_feedback_signals_context_page ON feedback_signals((context->>'page'));
CREATE INDEX idx_feedback_signals_context_section ON feedback_signals((context->>'section'));

-- GIN index for flexible JSONB queries
CREATE INDEX idx_feedback_signals_context_gin ON feedback_signals USING GIN (context);
CREATE INDEX idx_feedback_signals_outcome_gin ON feedback_signals USING GIN (outcome);

-- Preference models table - per-user learned preferences
CREATE TABLE preference_models (
    user_id TEXT PRIMARY KEY,
    model_version INTEGER DEFAULT 1,
    feature_weights JSONB DEFAULT '{}'::JSONB,
    -- what the user cares about
    ui_config JSONB DEFAULT '{}'::JSONB,
    -- personalized layout
    prediction_accuracy FLOAT DEFAULT 0.0,
    training_examples INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for model version queries
CREATE INDEX idx_preference_models_version ON preference_models(model_version);
CREATE INDEX idx_preference_models_last_updated ON preference_models(last_updated DESC);

-- Outcome ledger table - tracks action-outcome pairs for learning
CREATE TYPE outcome_type_enum AS ENUM (
    'conversion',
    'dismissal',
    'escalation',
    'completion',
    'abandonment',
    'success',
    'failure'
);

CREATE TABLE outcome_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_taken JSONB NOT NULL,
    outcome_value FLOAT CHECK (outcome_value >= -1.0 AND outcome_value <= 1.0),
    -- -1 to 1
    outcome_type outcome_type_enum NOT NULL,
    feedback_id UUID REFERENCES feedback_signals(id) ON DELETE SET NULL,
    learning_applied BOOLEAN DEFAULT FALSE,
    user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for outcome ledger
CREATE INDEX idx_outcome_ledger_feedback_id ON outcome_ledger(feedback_id);
CREATE INDEX idx_outcome_ledger_user_id ON outcome_ledger(user_id);
CREATE INDEX idx_outcome_ledger_outcome_type ON outcome_ledger(outcome_type);
CREATE INDEX idx_outcome_ledger_learning_applied ON outcome_ledger(learning_applied);
CREATE INDEX idx_outcome_ledger_created_at ON outcome_ledger(created_at DESC);

-- Dwell time tracking table (for efficient time-series queries)
CREATE TABLE dwell_time_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    page TEXT NOT NULL,
    section TEXT,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    scroll_depth FLOAT CHECK (scroll_depth >= 0.0 AND scroll_depth <= 1.0),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dwell time
CREATE INDEX idx_dwell_time_user_id ON dwell_time_sessions(user_id);
CREATE INDEX idx_dwell_time_page ON dwell_time_sessions(page);
CREATE INDEX idx_dwell_time_section ON dwell_time_sessions(section);
CREATE INDEX idx_dwell_time_start_time ON dwell_time_sessions(start_time DESC);
CREATE INDEX idx_dwell_time_duration ON dwell_time_sessions(duration_seconds) WHERE duration_seconds IS NOT NULL;

-- Interaction log batch table (for batched writes)
CREATE TABLE interaction_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    batch_data JSONB NOT NULL,
    -- array of interactions
    session_id TEXT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_interaction_batches_user_id ON interaction_batches(user_id);
CREATE INDEX idx_interaction_batches_session_id ON interaction_batches(session_id);
CREATE INDEX idx_interaction_batches_processed ON interaction_batches(processed);
CREATE INDEX idx_interaction_batches_created_at ON interaction_batches(created_at DESC);

-- Analytics materialized view for fast feedback queries
CREATE MATERIALIZED VIEW feedback_analytics AS
SELECT 
    signal_type,
    DATE_TRUNC('day', timestamp) as day,
    COUNT(*) as count,
    AVG(learning_weight) as avg_weight,
    COUNT(DISTINCT user_id) as unique_users
FROM feedback_signals
GROUP BY signal_type, DATE_TRUNC('day', timestamp);

CREATE INDEX idx_feedback_analytics_day ON feedback_analytics(day DESC);
CREATE INDEX idx_feedback_analytics_signal_type ON feedback_analytics(signal_type);

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_signals_updated_at
    BEFORE UPDATE ON feedback_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preference_models_updated_at
    BEFORE UPDATE ON preference_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outcome_ledger_updated_at
    BEFORE UPDATE ON outcome_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE feedback_signals IS 'Primary table for capturing user feedback signals and interactions';
COMMENT ON TABLE preference_models IS 'Per-user learned preference models for personalization';
COMMENT ON TABLE outcome_ledger IS 'Tracks actions and their outcomes for reinforcement learning';
COMMENT ON TABLE dwell_time_sessions IS 'Tracks time spent on pages/sections for engagement analysis';
COMMENT ON TABLE interaction_batches IS 'Batched interaction data for efficient processing';
COMMENT ON MATERIALIZED VIEW feedback_analytics IS 'Pre-aggregated feedback metrics for fast querying';
