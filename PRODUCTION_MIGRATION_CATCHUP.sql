-- PRODUCTION MIGRATION CATCHUP
-- Run ALL past migrations that might have been missed
-- Execute this in Supabase Dashboard SQL Editor for production

-- 000. Create exec_sql function
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 001. Create feedback_signals table
CREATE TABLE IF NOT EXISTS public.feedback_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  card_type TEXT,
  section TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 002. Create preference_models table  
CREATE TABLE IF NOT EXISTS public.preference_models (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  card_order TEXT[] DEFAULT '{}',
  weights JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 003. Create autonomous_tasks table
CREATE TABLE IF NOT EXISTS public.autonomous_tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 1,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 004. Create research_ledger table
CREATE TABLE IF NOT EXISTS public.research_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT,
  finding TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 005. Create qualified_accounts table
CREATE TABLE IF NOT EXISTS public.qualified_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  qualification_score FLOAT DEFAULT 0,
  status TEXT DEFAULT 'new',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 006. Create funnels table
CREATE TABLE IF NOT EXISTS public.funnels (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  funnel_name TEXT NOT NULL,
  stages JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 007. Schema cache refresh (notify only)
NOTIFY pgrst, 'reload schema';

-- 008. Add missing columns to feedback_signals
ALTER TABLE public.feedback_signals 
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 009. Add anonymous RLS policy for feedback_signals
ALTER TABLE public.feedback_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous feedback" ON public.feedback_signals;
CREATE POLICY "Allow anonymous feedback"
  ON public.feedback_signals
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 010. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_employee BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 011. Enable Email Auth (done in Supabase Dashboard, no SQL needed)
-- Skipped - Dashboard configuration

-- 012. Fix feedback RLS
DROP POLICY IF EXISTS "Allow anonymous reads" ON public.feedback_signals;
CREATE POLICY "Allow anonymous reads"
  ON public.feedback_signals
  FOR SELECT
  TO anon
  USING (true);

-- 013-017. Profiles RLS policies (combine into clean version)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "service_role_all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "service_role_all"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 018. Create profile for jim.kernan@adzeta.io
-- Replace UUID with actual user ID from auth.users
INSERT INTO public.profiles (id, email, is_employee, role, created_at, updated_at)
SELECT id, email, true, 'admin', NOW(), NOW()
FROM auth.users
WHERE email = 'jim.kernan@adzeta.io'
ON CONFLICT (id) DO UPDATE 
SET is_employee = true, role = 'admin', updated_at = NOW();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_employee, role, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    CASE WHEN NEW.email LIKE '%@adzeta.io' THEN true ELSE false END,
    CASE WHEN NEW.email LIKE '%@adzeta.io' THEN 'admin' ELSE 'user' END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Final schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'Migration catchup complete' as status;
SELECT COUNT(*) as total_profiles FROM public.profiles;
SELECT email, is_employee, role FROM public.profiles WHERE email = 'jim.kernan@adzeta.io';
