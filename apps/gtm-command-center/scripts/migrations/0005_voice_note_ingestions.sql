-- Voice-note ingestion tracking for contact extraction + follow-up creation
create extension if not exists pgcrypto;

create table if not exists public.voice_note_ingestions (
  id uuid primary key default gen_random_uuid(),
  meeting_note_id uuid references public.meeting_notes(id) on delete set null,
  followup_action_id uuid references public.meeting_actions(id) on delete set null,
  source text not null default 'voice_note',
  transcript_text text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  company_name text,
  extracted_notes text,
  followup_text text,
  parse_confidence numeric(4,3) not null default 0.500,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_voice_note_ingestions_touch on public.voice_note_ingestions;
create trigger trg_voice_note_ingestions_touch
before update on public.voice_note_ingestions
for each row execute function public.touch_updated_at();

create index if not exists idx_voice_note_ingestions_created_at on public.voice_note_ingestions(created_at desc);
create index if not exists idx_voice_note_ingestions_contact_email on public.voice_note_ingestions(contact_email);
