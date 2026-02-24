create extension if not exists pgcrypto;

create table if not exists public.cc_qualified_accounts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  website text not null,
  est_spend_tier text not null check (est_spend_tier in ('500k-1m', '1m-3m', '3m+')),
  channels jsonb not null default '[]'::jsonb,
  contact_role text not null,
  qualification_confidence numeric(5,2) not null check (qualification_confidence >= 0 and qualification_confidence <= 100),
  is_qualified boolean not null default false,
  outreach_enrolled_at timestamptz,
  outreach_sequence_template_id uuid references public.cc_sequence_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cc_qualified_accounts_created_at on public.cc_qualified_accounts(created_at desc);
create index if not exists idx_cc_qualified_accounts_is_qualified on public.cc_qualified_accounts(is_qualified);

create or replace function public.cc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cc_qualified_accounts_updated_at on public.cc_qualified_accounts;
create trigger trg_cc_qualified_accounts_updated_at
before update on public.cc_qualified_accounts
for each row execute function public.cc_set_updated_at();
