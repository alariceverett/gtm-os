#!/usr/bin/env node
// Show process execution stats: frequency, avg quality, review count
// Usage: node process_stats.js [process_id]

const { query } = require('./db');

async function main() {
  const processId = process.argv[2];

  let sql, params;
  if (processId) {
    sql = `SELECT p.process_id, p.name, p.category,
             COUNT(r.id) as total_runs,
             COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed,
             ROUND(AVG(r.quality_rating)::numeric, 1) as avg_quality,
             COUNT(CASE WHEN r.review_requested THEN 1 END) as reviews_requested,
             MAX(r.started_at) as last_run
           FROM cc_processes p
           LEFT JOIN cc_process_runs r ON r.process_id = p.process_id
           WHERE p.process_id = $1
           GROUP BY p.process_id, p.name, p.category`;
    params = [processId];
  } else {
    sql = `SELECT p.process_id, p.name, p.category,
             COUNT(r.id) as total_runs,
             COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed,
             ROUND(AVG(r.quality_rating)::numeric, 1) as avg_quality,
             COUNT(CASE WHEN r.review_requested THEN 1 END) as reviews_requested,
             MAX(r.started_at) as last_run
           FROM cc_processes p
           LEFT JOIN cc_process_runs r ON r.process_id = p.process_id
           GROUP BY p.process_id, p.name, p.category
           ORDER BY total_runs DESC`;
    params = [];
  }

  const result = await query(sql, params);
  
  if (result.rows.length === 0) {
    console.log('No processes found.');
    return;
  }

  console.log('\n📊 PROCESS STATS\n');
  for (const row of result.rows) {
    console.log(`${row.process_id} — ${row.name} [${row.category || 'uncategorized'}]`);
    console.log(`  Runs: ${row.total_runs} (${row.completed} completed)`);
    console.log(`  Avg Quality: ${row.avg_quality || 'unrated'}/5`);
    console.log(`  Reviews Requested: ${row.reviews_requested}`);
    console.log(`  Last Run: ${row.last_run || 'never'}`);
    console.log('');
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
