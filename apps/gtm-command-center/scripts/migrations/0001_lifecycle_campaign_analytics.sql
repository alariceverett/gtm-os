-- Lifecycle marketing + campaign analytics core tables

create table if not exists public.lifecycle_stages (
  stage_key text primary key,
  display_name text not null,
  stage_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  contact_ref text not null,
  event_type text not null default 'stage_transition',
  from_stage text references public.lifecycle_stages(stage_key),
  to_stage text not null references public.lifecycle_stages(stage_key),
  campaign_ref text,
  metadata jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  campaign_ref text not null,
  source text not null default 'local',
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12,2) not null default 0,
  conversions integer not null default 0,
  revenue numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(metric_date, campaign_ref, source)
);

create index if not exists idx_lifecycle_events_contact_event_at
  on public.lifecycle_events(contact_ref, event_at desc);

create index if not exists idx_lifecycle_events_to_stage_event_at
  on public.lifecycle_events(to_stage, event_at desc);

create index if not exists idx_campaign_metrics_metric_date
  on public.campaign_metrics(metric_date desc);

create index if not exists idx_campaign_metrics_campaign_ref
  on public.campaign_metrics(campaign_ref);

create or replace function public.lifecycle_stages_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.campaign_metrics_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_lifecycle_stages_updated_at on public.lifecycle_stages;
create trigger trg_lifecycle_stages_updated_at
before update on public.lifecycle_stages
for each row execute function public.lifecycle_stages_touch_updated_at();

drop trigger if exists trg_campaign_metrics_updated_at on public.campaign_metrics;
create trigger trg_campaign_metrics_updated_at
before update on public.campaign_metrics
for each row execute function public.campaign_metrics_touch_updated_at();

insert into public.lifecycle_stages (stage_key, display_name, stage_order)
values
  ('lead', 'Lead', 10),
  ('mql', 'MQL', 20),
  ('sql', 'SQL', 30),
  ('opportunity', 'Opportunity', 40),
  ('customer', 'Customer', 50)
on conflict (stage_key) do update
set
  display_name = excluded.display_name,
  stage_order = excluded.stage_order,
  is_active = true;
