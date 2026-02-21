import 'dotenv/config';
import { pool, closePool } from './db.mjs';

const sql = `
select id, stream, title, status, priority, updated_at, completed_at
from public.cc_operator_tasks
where owner = 'user'
order by priority asc, created_at asc;
`;

const summarySql = `
select
  count(*) filter (where status in ('todo')) as todo,
  count(*) filter (where status in ('in_progress')) as in_progress,
  count(*) filter (where status in ('done','completed')) as done,
  count(*) as total
from public.cc_operator_tasks
where owner='user';
`;

async function main(){
  const [tasks, summary] = await Promise.all([
    pool.query(sql),
    pool.query(summarySql),
  ]);
  console.log(JSON.stringify({summary: summary.rows[0], tasks: tasks.rows}, null, 2));
}

main().finally(async()=>{ await closePool(); });
