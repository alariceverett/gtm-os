-- Migration 001: Feedback Signals Table
-- Stores user feedback (thumbs up/down, ratings, comments) on AI outputs
-- Enables GTM OS learning loops and quality scoring

create extension if not exists pgcrypto;

-- Feedback type enum values: thumbs_up, thumbs_down, star_rating, comment, report
create table if not exists public.feedback_signals (
  id uuid primary key default gen_random_uuid(),
  
  -- Source context
  user_id uuid not null,
  session_id uuid,
  
  -- What received feedback
  content_type text not null check (content_type in ('message', 'task_output', 'decision_draft', 'report', 'suggestion')),
  content_id uuid not null,
  agent_id text, -- Which agent produced the content
  
  -- Feedback data
  feedback_type text not null check (feedback_type in ('thumbs_up', 'thumbs_down', 'star_rating', 'comment', 'report')),
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  category text check (category in ('accuracy', 'tone', 'helpfulness', 'speed', 'other')),
  
  -- Evidence reference for KPI events (link to supporting data)
  evidence_ref jsonb default '{}'::jsonb,
  
  -- Metadata
  context jsonb default '{}'::jsonb, -- Page, workflow state, etc.
  tags text[] default '{}',
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz, -- If feedback was addressed
  
  -- Constraints
  constraint feedback_signals_rating_required check (
    (feedback_type = 'star_rating' and rating is not null) or 
    (feedback_type != 'star_rating')
  )
);

-- Indexes for common queries
comment on table public.feedback_signals is 'User feedback on AI outputs for quality improvement';
create index idx_feedback_signals_user_id on public.feedback_signals(user_id);
create index idx_feedback_signals_content_id on public.feedback_signals(content_id);
create index idx_feedback_signals_created_at on public.feedback_signals(created_at desc);
create index idx_feedback_signals_agent_id on public.feedback_signals(agent_id);
create index idx_feedback_signals_type on public.feedback_signals(feedback_type);
create index idx_feedback_signals_evidence on public.feedback_signals using gin(evidence_ref);

-- Trigger for updated_at

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_feedback_signals_updated_at on public.feedback_signals;
create trigger trg_feedback_signals_updated_at
  before update on public.feedback_signals
  for each row execute function public.set_updated_at();

-- RLS policies (disabled by default, enable after role setup)
alter table public.feedback_signals enable row level security;

create policy feedback_signals_select_own on public.feedback_signals
  for select using (user_id = auth.uid());

create policy feedback_signals_insert_own on public.feedback_signals
  for insert with check (user_id = auth.uid());

create policy feedback_signals_update_own on public.feedback_signals
  for update using (user_id = auth.uid());
