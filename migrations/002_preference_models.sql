-- Migration 002: Preference Models Table
-- Stores user preferences for personalization and adaptive AI behavior
-- Enables GTM OS to learn and adapt to user working styles

create extension if not exists pgcrypto;

-- User preference categories

create table if not exists public.preference_models (
  id uuid primary key default gen_random_uuid(),
  
  -- User context
  user_id uuid not null unique,
  
  -- Communication preferences
  communication_style text not null default 'balanced' check (communication_style in ('concise', 'balanced', 'detailed')),
  notification_frequency text not null default 'as_needed' check (notification_frequency in ('realtime', 'hourly_digest', 'as_needed', 'daily_summary')),
  preferred_channels text[] default '{"in_app"}'::text[],
  
  -- Content preferences
  preferred_output_format text not null default 'structured' check (preferred_output_format in ('bullet_points', 'structured', 'narrative', 'visual')),
  detail_level text not null default 'standard' check (detail_level in ('minimal', 'standard', 'comprehensive')),
  
  -- AI behavior preferences
  autonomy_level text not null default 'suggest' check (autonomy_level in ('notify_only', 'suggest', 'auto_with_review', 'full_auto')),
  confirmation_required_for text[] default '{"deletions","external_comms","purchases"}'::text[],
  
  -- Topic/domain interests (for personalization)
  interests jsonb default '{}'::jsonb,
  
  -- Time and scheduling
  timezone text not null default 'America/New_York',
  working_hours jsonb default '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}'::jsonb,
  preferred_meeting_times jsonb default '[]'::jsonb,
  
  -- UI preferences
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  density text not null default 'comfortable' check (density in ('compact', 'comfortable', 'spacious')),
  
  -- Language preferences
  language text not null default 'en',
  
  -- Learning flags (what the system has learned)
  learned_patterns jsonb default '{}'::jsonb,
  
  -- Version control
  version integer not null default 1,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
comment on table public.preference_models is 'User preference data for adaptive AI personalization';
create index idx_preference_models_user_id on public.preference_models(user_id);
create index idx_preference_models_comm_style on public.preference_models(communication_style);
create index idx_preference_models_autonomy on public.preference_models(autonomy_level);

-- Trigger for updated_at
drop trigger if exists trg_preference_models_updated_at on public.preference_models;
create trigger trg_preference_models_updated_at
  before update on public.preference_models
  for each row execute function public.set_updated_at();

-- Increment version on update
create or replace function public.increment_preference_version()
returns trigger as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_preference_models_version on public.preference_models;
create trigger trg_preference_models_version
  before update on public.preference_models
  for each row execute function public.increment_preference_version();

-- RLS policies
alter table public.preference_models enable row level security;

create policy preference_models_select_own on public.preference_models
  for select using (user_id = auth.uid());

create policy preference_models_insert_own on public.preference_models
  for insert with check (user_id = auth.uid());

create policy preference_models_update_own on public.preference_models
  for update using (user_id = auth.uid());

create policy preference_models_delete_own on public.preference_models
  for delete using (user_id = auth.uid());
