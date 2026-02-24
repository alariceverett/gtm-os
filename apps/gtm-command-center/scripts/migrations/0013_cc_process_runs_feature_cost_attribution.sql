-- Feature/lane/cycle attribution + usage cost schema for cc_process_runs
-- Enables deterministic development cost rollups by feature and cycle in /ops.

alter table if exists public.cc_process_runs
  add column if not exists feature_key text,
  add column if not exists lane_key text,
  add column if not exists cycle_key text,
  add column if not exists model_name text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists total_tokens integer,
  add column if not exists cost_usd numeric(12,6);

create index if not exists idx_cc_process_runs_feature_cycle
  on public.cc_process_runs(feature_key, cycle_key, status);

create index if not exists idx_cc_process_runs_lane_cycle
  on public.cc_process_runs(lane_key, cycle_key);

create index if not exists idx_cc_process_runs_model_cycle
  on public.cc_process_runs(model_name, cycle_key);
