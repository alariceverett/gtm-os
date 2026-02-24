-- Meeting analysis + client updates pipeline (local-first baseline)
create extension if not exists pgcrypto;

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  source_type text not null default 'text' check (source_type in ('text','voice_transcript')),
  note_text text not null,
  meeting_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_actions (
  id uuid primary key default gen_random_uuid(),
  meeting_note_id uuid not null references public.meeting_notes(id) on delete cascade,
  client_name text not null,
  action_text text not null,
  owner text,
  status text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_updates (
  id uuid primary key default gen_random_uuid(),
  meeting_note_id uuid references public.meeting_notes(id) on delete set null,
  client_name text not null,
  update_text text not null,
  status text not null default 'draft' check (status in ('draft','due','sent','cancelled')),
  due_date date,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_meeting_notes_touch on public.meeting_notes;
create trigger trg_meeting_notes_touch
before update on public.meeting_notes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_meeting_actions_touch on public.meeting_actions;
create trigger trg_meeting_actions_touch
before update on public.meeting_actions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_client_updates_touch on public.client_updates;
create trigger trg_client_updates_touch
before update on public.client_updates
for each row execute function public.touch_updated_at();

create index if not exists idx_meeting_notes_created_at on public.meeting_notes(created_at desc);
create index if not exists idx_meeting_actions_status on public.meeting_actions(status, due_date);
create index if not exists idx_client_updates_status on public.client_updates(status, due_date);
