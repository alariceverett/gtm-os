alter table if exists public.cc_qualified_accounts
  add column if not exists qualification_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists readiness_score integer,
  add column if not exists readiness_status text not null default 'not_yet',
  add column if not exists pilot_onboarding_routed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cc_qualified_accounts_readiness_status_check'
      and conrelid = 'public.cc_qualified_accounts'::regclass
  ) then
    alter table public.cc_qualified_accounts
      add constraint cc_qualified_accounts_readiness_status_check
      check (readiness_status in ('qualified', 'not_yet'));
  end if;
end $$;

update public.cc_qualified_accounts
set readiness_status = coalesce(readiness_status, 'not_yet')
where readiness_status is null;

create index if not exists idx_cc_qualified_accounts_readiness_status on public.cc_qualified_accounts(readiness_status, created_at desc);
create index if not exists idx_cc_qualified_accounts_pilot_onboarding_routed_at on public.cc_qualified_accounts(pilot_onboarding_routed_at desc);
