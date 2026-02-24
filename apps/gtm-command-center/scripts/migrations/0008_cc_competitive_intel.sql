create extension if not exists pgcrypto;

create table if not exists public.cc_competitive_intel_entries (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  signal text not null check (signal in ('creative_refresh', 'offer_shift', 'channel_expansion', 'pricing_change', 'hiring_signal', 'partnership_signal', 'other')),
  source text not null,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100),
  strategic_note text not null,
  linked_qualified_account_id uuid references public.cc_qualified_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cc_competitive_intel_created_at on public.cc_competitive_intel_entries(created_at desc);
create index if not exists idx_cc_competitive_intel_brand on public.cc_competitive_intel_entries(lower(brand));
create index if not exists idx_cc_competitive_intel_linked_account on public.cc_competitive_intel_entries(linked_qualified_account_id);

create or replace function public.cc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cc_competitive_intel_updated_at on public.cc_competitive_intel_entries;
create trigger trg_cc_competitive_intel_updated_at
before update on public.cc_competitive_intel_entries
for each row execute function public.cc_set_updated_at();
