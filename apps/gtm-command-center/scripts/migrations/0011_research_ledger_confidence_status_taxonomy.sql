-- Research ledger taxonomy + confidence band normalization (jsonb details on cc_activity_log)
-- Decision: keep confidence score as integer 0-100 and add derived confidence_band + explicit status taxonomy.

-- Backfill defaults for historical entries.
update public.cc_activity_log
set details = jsonb_set(
  jsonb_set(
    jsonb_set(
      coalesce(details, '{}'::jsonb),
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
    to_jsonb(
      greatest(0, least(100, coalesce((details->>'confidence')::int, 0)))
    ),
    true
  ),
  '{confidence_band}',
  to_jsonb(
    case
      when coalesce((details->>'confidence')::int, 0) >= 80 then 'high'
      when coalesce((details->>'confidence')::int, 0) >= 60 then 'medium'
      else 'low'
    end
  ),
  true
)
where event_type = 'research_ledger_entry';

-- Expression indexes for common filtering/sorting in Research Ledger UI/API.
create index if not exists idx_cc_activity_log_research_status
  on public.cc_activity_log ((details->>'status'))
  where event_type = 'research_ledger_entry';

create index if not exists idx_cc_activity_log_research_confidence
  on public.cc_activity_log (((details->>'confidence')::int))
  where event_type = 'research_ledger_entry';
