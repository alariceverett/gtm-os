create extension if not exists pgcrypto;

create table if not exists public.cc_trade_show_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  website text,
  context_notes text,
  pain_points jsonb not null default '[]'::jsonb,
  last_promised_followup text,
  last_capture_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_trade_show_individuals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cc_trade_show_accounts(id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  context_notes text,
  pain_points jsonb not null default '[]'::jsonb,
  last_promised_followup text,
  last_capture_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_trade_show_captures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cc_trade_show_accounts(id) on delete cascade,
  individual_id uuid not null references public.cc_trade_show_individuals(id) on delete cascade,
  meeting_note_id uuid references public.meeting_notes(id) on delete set null,
  followup_action_id uuid references public.meeting_actions(id) on delete set null,
  source text not null default 'voice_memo_placeholder',
  transcript_text text not null,
  context_notes text,
  pain_points jsonb not null default '[]'::jsonb,
  promised_followup text,
  extracted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cc_trade_show_accounts_name on public.cc_trade_show_accounts(lower(account_name));
create index if not exists idx_cc_trade_show_individuals_account on public.cc_trade_show_individuals(account_id, lower(full_name));
create index if not exists idx_cc_trade_show_captures_created on public.cc_trade_show_captures(created_at desc);

create or replace function public.cc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cc_trade_show_accounts_updated_at on public.cc_trade_show_accounts;
create trigger trg_cc_trade_show_accounts_updated_at
before update on public.cc_trade_show_accounts
for each row execute function public.cc_set_updated_at();

drop trigger if exists trg_cc_trade_show_individuals_updated_at on public.cc_trade_show_individuals;
create trigger trg_cc_trade_show_individuals_updated_at
before update on public.cc_trade_show_individuals
for each row execute function public.cc_set_updated_at();
