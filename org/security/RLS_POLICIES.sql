-- RLS_POLICIES.sql — Row Level Security for Project Forge
-- Run after setup-tables.sql to lock down all tables
-- Requires: org_id column on each table (added below if missing)

-- ============================================================
-- Step 1: Add org_id column to all tables (if not present)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'cc_decisions', 'cc_decision_steps', 'cc_delegations',
    'cc_priorities', 'cc_processes', 'cc_process_runs',
    'cc_prompt_versions', 'cc_comments', 'cc_messages',
    'email_subscribers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id TEXT DEFAULT ''default''',
      tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_org_id ON %I(org_id)',
      replace(tbl, '.', '_'), tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Step 2: Enable RLS on all tables
-- ============================================================

ALTER TABLE cc_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_decision_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_process_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Step 3: Drop existing policies (idempotent re-runs)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'cc_decisions', 'cc_decision_steps', 'cc_delegations',
    'cc_priorities', 'cc_processes', 'cc_process_runs',
    'cc_prompt_versions', 'cc_comments', 'cc_messages',
    'email_subscribers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org_isolation_select_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org_isolation_insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org_isolation_update_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'org_isolation_delete_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'service_role_bypass_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_deny_' || tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- Step 4: Create policies
-- ============================================================

-- Helper: set org_id via a Supabase JWT claim or session variable
-- Usage: SET app.current_org_id = 'my-org';
-- Or via Supabase: auth.jwt() ->> 'org_id'

-- For each table: authenticated sees own org, anon sees nothing, service bypasses

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'cc_decisions', 'cc_decision_steps', 'cc_delegations',
    'cc_priorities', 'cc_processes', 'cc_process_runs',
    'cc_prompt_versions', 'cc_comments', 'cc_messages',
    'email_subscribers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Service role: full access (bypasses RLS by default, but explicit for clarity)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_bypass_' || tbl, tbl
    );

    -- Anonymous: deny everything
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO anon USING (false) WITH CHECK (false)',
      'anon_deny_' || tbl, tbl
    );

    -- Authenticated: filter by org_id
    -- org_id is matched against the session variable current_setting('app.current_org_id')
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (org_id = current_setting(''app.current_org_id'', true))',
      'org_isolation_select_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (org_id = current_setting(''app.current_org_id'', true))',
      'org_isolation_insert_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (org_id = current_setting(''app.current_org_id'', true)) WITH CHECK (org_id = current_setting(''app.current_org_id'', true))',
      'org_isolation_update_' || tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (org_id = current_setting(''app.current_org_id'', true))',
      'org_isolation_delete_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Verification query (run manually to confirm)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename LIKE 'cc_%' OR tablename = 'email_subscribers';
