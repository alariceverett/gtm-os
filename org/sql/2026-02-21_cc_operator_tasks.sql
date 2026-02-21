-- Operator-visible setup task tracker
create table if not exists public.cc_operator_tasks (
  id uuid primary key default gen_random_uuid(),
  stream text not null,
  title text not null,
  description text,
  owner text not null default 'user',
  status text not null default 'todo',
  priority integer not null default 50,
  source text not null default 'setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.cc_operator_tasks_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status in ('done','completed') and old.status not in ('done','completed') then
    new.completed_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_cc_operator_tasks_updated_at on public.cc_operator_tasks;
create trigger trg_cc_operator_tasks_updated_at
before update on public.cc_operator_tasks
for each row execute function public.cc_operator_tasks_touch_updated_at();
