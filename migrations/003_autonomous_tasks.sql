-- Migration 003: Autonomous Tasks Table
-- Stores AI-generated tasks with user approval workflow
-- Enables GTM OS to suggest and (conditionally) execute actions

create extension if not exists pgcrypto;

-- Auto-generated tasks with approval gates

create table if not exists public.autonomous_tasks (
  id uuid primary key default gen_random_uuid(),
  
  -- Ownership and assignment
  user_id uuid not null,
  assigned_to uuid, -- Can be null (system) or user_id
  
  -- Task definition
  title text not null,
  description text,
  task_type text not null check (task_type in ('suggestion', 'auto_action', 'review_required', 'scheduled')),
  priority integer not null default 50 check (priority >= 0 and priority <= 100),
  
  -- Status workflow: pending -> reviewing -> approved -> executing -> completed/failed
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected', 'executing', 'completed', 'failed', 'cancelled')),
  
  -- Source tracking (which agent/context created this)
  source_agent text not null,
  source_context jsonb default '{}'::jsonb,
  trigger_event text,
  
  -- Evidence/justification for the task
  evidence_ref jsonb not null default '{}'::jsonb,
  expected_outcome text,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  
  -- Automation configuration
  action_type text check (action_type in ('http_request', 'db_operation', 'file_operation', 'message_send', 'task_create', 'custom')),
  action_config jsonb, -- Encoded action to execute
  
  -- Execution tracking
  scheduled_for timestamptz,
  executed_at timestamptz,
  execution_result jsonb,
  execution_error text,
  retry_count integer not null default 0,
  max_retries integer not null default 0,
  
  -- Approval workflow
  approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  approval_notes text,
  
  -- Related entities
  parent_task_id uuid references public.autonomous_tasks(id) on delete set null,
  related_decision_id uuid,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz
);

-- Indexes
comment on table public.autonomous_tasks is 'AI-generated autonomous tasks with approval workflow';
create index idx_autonomous_tasks_user_id on public.autonomous_tasks(user_id);
create index idx_autonomous_tasks_status on public.autonomous_tasks(status);
create index idx_autonomous_tasks_created_at on public.autonomous_tasks(created_at desc);
create index idx_autonomous_tasks_source_agent on public.autonomous_tasks(source_agent);
create index idx_autonomous_tasks_task_type on public.autonomous_tasks(task_type);
create index idx_autonomous_tasks_risk_level on public.autonomous_tasks(risk_level);
create index idx_autonomous_tasks_scheduled_for on public.autonomous_tasks(scheduled_for);
create index idx_autonomous_tasks_evidence on public.autonomous_tasks using gin(evidence_ref);

-- Trigger for updated_at
drop trigger if exists trg_autonomous_tasks_updated_at on public.autonomous_tasks;
create trigger trg_autonomous_tasks_updated_at
  before update on public.autonomous_tasks
  for each row execute function public.set_updated_at();

-- Auto-update completed_at when status changes to completed/done

create or replace function public.autonomous_tasks_touch_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status in ('completed','done') and old.status not in ('completed','done') then
    new.completed_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_autonomous_tasks_completed_at on public.autonomous_tasks;
create trigger trg_autonomous_tasks_completed_at
  before update on public.autonomous_tasks
  for each row execute function public.autonomous_tasks_touch_completed_at();

-- RLS policies
alter table public.autonomous_tasks enable row level security;

create policy autonomous_tasks_select_own on public.autonomous_tasks
  for select using (user_id = auth.uid());

create policy autonomous_tasks_insert_system on public.autonomous_tasks
  for insert with check (true); -- Allow system inserts

create policy autonomous_tasks_update_own on public.autonomous_tasks
  for update using (user_id = auth.uid() or assigned_to = auth.uid());

-- View for pending approvals (convenience)
create or replace view public.pending_autonomous_tasks as
select * from public.autonomous_tasks
where approval_required = true
  and status in ('pending', 'reviewing')
  and (expires_at is null or expires_at > now());
