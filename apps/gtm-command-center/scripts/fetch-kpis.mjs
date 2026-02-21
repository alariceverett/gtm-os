import "dotenv/config";
import { pool, closePool } from "./db.mjs";

const SQL = `
with delegations_24h as (
  select count(*)::int as c
  from public.cc_delegations
  where created_at >= now() - interval '24 hours'
),
completed_24h as (
  select count(*)::int as c
  from public.cc_delegations
  where completed_at >= now() - interval '24 hours'
),
active_runs as (
  select count(*)::int as c
  from public.cc_process_runs
  where status in ('running','in_progress','started')
),
open_priorities as (
  select count(*)::int as c
  from public.cc_priorities
  where lower(coalesce(status,'')) not in ('done','completed','cancelled')
),
avg_quality_7d as (
  select round(avg(quality_rating)::numeric, 2) as v
  from public.cc_process_runs
  where quality_rating is not null
    and started_at >= now() - interval '7 days'
)
select json_build_object(
  'generated_at', now(),
  'delegations_24h', (select c from delegations_24h),
  'completed_delegations_24h', (select c from completed_24h),
  'active_process_runs', (select c from active_runs),
  'open_priorities', (select c from open_priorities),
  'avg_quality_7d', (select v from avg_quality_7d)
) as kpis;
`;

async function main() {
  const { rows } = await pool.query(SQL);
  console.log(JSON.stringify(rows[0].kpis, null, 2));
}

main()
  .catch((err) => {
    console.error('KPI fetch failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
