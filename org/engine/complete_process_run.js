#!/usr/bin/env node
// Complete a process run
// Usage: node complete_process_run.js '<json>'

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);

  if (!input.run_id || !input.status) {
    console.error('Missing required: run_id, status');
    process.exit(1);
  }

  if (!['completed', 'failed', 'skipped'].includes(input.status)) {
    console.error('status must be: completed, failed, or skipped');
    process.exit(1);
  }

  const sets = ['completed_at = now()', 'status = $2'];
  const params = [input.run_id, input.status];
  let i = 3;

  if (input.quality_rating != null) {
    sets.push(`quality_rating = $${i++}`);
    params.push(input.quality_rating);
  }
  if (input.quality_notes != null) {
    sets.push(`quality_notes = $${i++}`);
    params.push(input.quality_notes);
  }
  if (input.outcome_notes != null) {
    sets.push(`outcome_notes = $${i++}`);
    params.push(input.outcome_notes);
  }
  if (input.review_requested != null) {
    sets.push(`review_requested = $${i++}`);
    params.push(input.review_requested);
  }

  await query(
    `UPDATE cc_process_runs SET ${sets.join(', ')} WHERE id = $1`,
    params
  );

  console.log(`✅ Process run ${input.run_id} → ${input.status}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
