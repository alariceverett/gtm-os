-- Basic activity logging for command center actions
create table if not exists public.cc_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  lead_key text,
  sequence_template_id uuid references public.cc_sequence_templates(id) on delete set null,
  sequence_enrollment_id uuid references public.cc_sequence_enrollments(id) on delete set null,
  actor text not null default 'api',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cc_activity_log_created_at on public.cc_activity_log (created_at desc);
create index if not exists idx_cc_activity_log_lead_key on public.cc_activity_log (lead_key);
create index if not exists idx_cc_activity_log_event_type on public.cc_activity_log (event_type);
