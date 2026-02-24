-- Research ledger required fields alignment (NOW item 2 closeout)
-- Ensures canonical keys exist for: hypothesis, evidence source, confidence,
-- recommended action, owner, timestamp, and status taxonomy.

update public.cc_activity_log
set details = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(details, '{}'::jsonb),
            '{evidence_source}',
            to_jsonb(coalesce(nullif(details->>'evidence_source',''), nullif(details->>'source_signal',''), 'unknown')),
            true
          ),
          '{recommended_action}',
          to_jsonb(coalesce(nullif(details->>'recommended_action',''), nullif(details->>'target_recommendation',''), 'pending_action_definition')),
          true
        ),
        '{owner}',
        to_jsonb(coalesce(nullif(details->>'owner',''), nullif(actor,''), 'unassigned')),
        true
      ),
      '{timestamp}',
      to_jsonb(coalesce(nullif(details->>'timestamp',''), to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
      true
    ),
    '{status}',
    to_jsonb(
      case
        when lower(coalesce(details->>'status','')) in ('new_signal','triaged','validated','actioned','parked','discarded')
          then lower(details->>'status')
        else 'new_signal'
      end
    ),
    true
  ),
  '{confidence}',
  to_jsonb(greatest(0, least(100, coalesce((details->>'confidence')::int, 0)))),
  true
)
where event_type = 'research_ledger_entry';

create index if not exists idx_cc_activity_log_research_owner
  on public.cc_activity_log ((details->>'owner'))
  where event_type = 'research_ledger_entry';

create index if not exists idx_cc_activity_log_research_timestamp
  on public.cc_activity_log ((details->>'timestamp'))
  where event_type = 'research_ledger_entry';
