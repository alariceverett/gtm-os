-- GTM funnel + sequence foundations
create table if not exists public.cc_funnels (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  status text not null default 'draft',
  channel text,
  goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.cc_funnels(id) on delete cascade,
  position integer not null default 1,
  name text not null,
  action_type text not null default 'email',
  delay_days integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_id, position)
);

create table if not exists public.cc_sequence_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  channel text not null default 'email',
  status text not null default 'active',
  description text,
  step_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_template_id uuid not null references public.cc_sequence_templates(id) on delete cascade,
  lead_key text not null,
  status text not null default 'queued',
  current_step_index integer not null default 0,
  next_send_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_template_id, lead_key)
);

create index if not exists idx_cc_funnels_status on public.cc_funnels(status);
create index if not exists idx_cc_sequence_enrollments_status_next_send on public.cc_sequence_enrollments(status, next_send_at);

create or replace function public.cc_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_cc_funnels_updated_at on public.cc_funnels;
create trigger trg_cc_funnels_updated_at before update on public.cc_funnels
for each row execute function public.cc_touch_updated_at();

drop trigger if exists trg_cc_funnel_steps_updated_at on public.cc_funnel_steps;
create trigger trg_cc_funnel_steps_updated_at before update on public.cc_funnel_steps
for each row execute function public.cc_touch_updated_at();

drop trigger if exists trg_cc_sequence_templates_updated_at on public.cc_sequence_templates;
create trigger trg_cc_sequence_templates_updated_at before update on public.cc_sequence_templates
for each row execute function public.cc_touch_updated_at();

drop trigger if exists trg_cc_sequence_enrollments_updated_at on public.cc_sequence_enrollments;
create trigger trg_cc_sequence_enrollments_updated_at before update on public.cc_sequence_enrollments
for each row execute function public.cc_touch_updated_at();
