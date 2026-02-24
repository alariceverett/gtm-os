-- Lead magnet + teaser product pipeline (local-first)

create table if not exists public.lead_magnets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  status text not null default 'draft' check (status in ('draft','live','paused','archived')),
  asset_format text not null default 'checklist',
  optin_url text,
  owner text not null default 'growth',
  notes text,
  performance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teaser_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  status text not null default 'draft' check (status in ('draft','live','paused','archived')),
  offer_type text not null default 'tripwire',
  price_cents integer not null default 0 check (price_cents >= 0),
  checkout_url text,
  owner text not null default 'growth',
  notes text,
  performance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('lead_magnet','teaser_product')),
  asset_id uuid not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  asset_status_at_event text not null default 'draft' check (asset_status_at_event in ('draft','live','paused','archived')),
  occurred_at timestamptz not null default now()
);

create index if not exists idx_delivery_events_asset on public.delivery_events (asset_type, asset_id, occurred_at desc);

create or replace function public.cc_assets_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_lead_magnets_updated_at on public.lead_magnets;
create trigger trg_lead_magnets_updated_at
before update on public.lead_magnets
for each row execute function public.cc_assets_touch_updated_at();

drop trigger if exists trg_teaser_products_updated_at on public.teaser_products;
create trigger trg_teaser_products_updated_at
before update on public.teaser_products
for each row execute function public.cc_assets_touch_updated_at();

insert into public.lead_magnets (title, slug, status, asset_format, owner, notes)
values
  ('GTM Launch Checklist', 'gtm-launch-checklist', 'draft', 'checklist', 'growth', 'Core acquisition setup checklist'),
  ('30-Day Growth Plan Template', '30-day-growth-plan-template', 'live', 'template', 'growth', 'Lead magnet for agency founders')
on conflict (slug) do update
set title = excluded.title,
    status = excluded.status,
    asset_format = excluded.asset_format,
    owner = excluded.owner,
    notes = excluded.notes;

insert into public.teaser_products (title, slug, status, offer_type, price_cents, owner, notes)
values
  ('Mini Funnel Audit', 'mini-funnel-audit', 'draft', 'tripwire', 1900, 'growth', 'Low-ticket entry product'),
  ('Ad Creative Swipe File Pack', 'ad-creative-swipe-pack', 'live', 'micro-course', 2900, 'growth', 'Teaser product for paid traffic buyers')
on conflict (slug) do update
set title = excluded.title,
    status = excluded.status,
    offer_type = excluded.offer_type,
    price_cents = excluded.price_cents,
    owner = excluded.owner,
    notes = excluded.notes;
