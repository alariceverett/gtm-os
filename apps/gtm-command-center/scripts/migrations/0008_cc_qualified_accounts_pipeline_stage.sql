alter table if exists public.cc_qualified_accounts
  add column if not exists pipeline_stage text not null default 'qualified',
  add column if not exists discovery_promoted_at timestamptz,
  add column if not exists pilot_candidate_promoted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cc_qualified_accounts_pipeline_stage_check'
      and conrelid = 'public.cc_qualified_accounts'::regclass
  ) then
    alter table public.cc_qualified_accounts
      add constraint cc_qualified_accounts_pipeline_stage_check
      check (pipeline_stage in ('qualified', 'discovery', 'pilot_candidate'));
  end if;
end $$;

update public.cc_qualified_accounts
set pipeline_stage = 'qualified'
where pipeline_stage is null;

create index if not exists idx_cc_qualified_accounts_pipeline_stage on public.cc_qualified_accounts(pipeline_stage, created_at desc);
