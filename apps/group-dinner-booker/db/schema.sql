-- Group Dinner Booker (NYC) v1 schema scaffold

create extension if not exists pgcrypto;

create type event_status as enum ('draft', 'active', 'confirmed', 'archived');
create type candidate_status as enum (
  'shortlisted',
  'platform_checking',
  'platform_booked',
  'outreach_pending',
  'outreach_sent',
  'awaiting_response',
  'negotiating',
  'declined',
  'confirmed',
  'closed_lost'
);
create type budget_band as enum ('$', '$$', '$$$', '$$$$');
create type candidate_source as enum ('manual', 'referral', 'web');
create type reservation_platform as enum ('resy', 'opentable', 'direct', 'other');
create type booking_path as enum ('resy', 'opentable', 'manual_outreach');
create type booking_path_status as enum (
  'not_started',
  'checking',
  'attempted',
  'contacted',
  'responded',
  'booked',
  'blocked'
);
create type availability_result as enum ('available', 'unavailable', 'waitlist');
create type message_direction as enum ('outbound', 'inbound');
create type message_channel as enum ('email', 'contact_form', 'phone', 'other');

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id),
  title text not null,
  event_date date not null,
  time_window_start time,
  time_window_end time,
  min_party_size int not null check (min_party_size > 1),
  max_party_size int not null check (max_party_size >= min_party_size),
  budget_band budget_band,
  neighborhoods text[] not null default '{}',
  dietary_notes text,
  accessibility_notes text,
  status event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighborhood text,
  borough text,
  cuisine text,
  website_url text,
  resy_url text,
  opentable_url text,
  group_dining_email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_candidates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  current_status candidate_status not null default 'shortlisted',
  priority_rank int,
  source candidate_source not null default 'manual',
  notes text,
  follow_up_due_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, restaurant_id)
);

create table candidate_booking_paths (
  id uuid primary key default gen_random_uuid(),
  event_candidate_id uuid not null references event_candidates(id) on delete cascade,
  path booking_path not null,
  status booking_path_status not null default 'not_started',
  status_changed_at timestamptz not null default now(),
  first_attempted_at timestamptz,
  last_attempted_at timestamptz,
  completed_at timestamptz,
  status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_candidate_id, path)
);

create table reservation_attempts (
  id uuid primary key default gen_random_uuid(),
  event_candidate_id uuid not null references event_candidates(id) on delete cascade,
  platform reservation_platform not null,
  attempted_at timestamptz not null default now(),
  availability_result availability_result not null,
  slot_time timestamptz,
  party_size int,
  confirmation_code text,
  notes text,
  created_by_user_id uuid references users(id)
);

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  event_candidate_id uuid not null references event_candidates(id) on delete cascade,
  direction message_direction not null,
  channel message_channel not null,
  subject text,
  body text not null,
  sender_name text,
  recipient text,
  sent_or_received_at timestamptz not null default now(),
  structured_result jsonb,
  created_by_user_id uuid references users(id)
);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  event_candidate_id uuid not null references event_candidates(id) on delete cascade,
  from_status candidate_status,
  to_status candidate_status not null,
  changed_by_user_id uuid references users(id),
  reason text,
  created_at timestamptz not null default now()
);

create table event_confirmations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events(id) on delete cascade,
  event_candidate_id uuid not null unique references event_candidates(id),
  confirmed_at timestamptz not null default now(),
  final_headcount int,
  confirmed_time timestamptz,
  financial_terms jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text
);

create index idx_event_candidates_status on event_candidates(event_id, current_status);
create index idx_event_candidates_follow_up on event_candidates(follow_up_due_at);
create index idx_candidate_booking_paths_candidate on candidate_booking_paths(event_candidate_id, path);
create index idx_candidate_booking_paths_status on candidate_booking_paths(status, status_changed_at desc);
create index idx_outreach_messages_time on outreach_messages(event_candidate_id, sent_or_received_at desc);
create index idx_status_history_time on status_history(event_candidate_id, created_at desc);
create index idx_events_owner_date on events(owner_user_id, event_date);
