#!/usr/bin/env node
// Record a process execution (start, complete, or rate)
// Usage: 
//   Start:    node run_process.js start '<json>'
//   Complete: node run_process.js complete '<json>'
//   Rate:     node run_process.js rate '<json>'

const { query } = require('./db');

async function main() {
  const action = process.argv[2];
  const input = JSON.parse(process.argv[3]);

  if (action === 'start') {
    if (!input.process_id) { console.error('Missing: process_id'); process.exit(1); }
    const result = await query(
      `INSERT INTO cc_process_runs (process_id, decision_id, delegation_id, actor, review_requested)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.process_id, input.decision_id || null, input.delegation_id || null, 
       input.actor || null, input.review_requested || false]
    );
    console.log(`✅ Process run started: ${input.process_id} → ${result.rows[0].id}`);
  
  } else if (action === 'complete') {
    if (!input.run_id) { console.error('Missing: run_id'); process.exit(1); }
    await query(
      `UPDATE cc_process_runs SET status = 'completed', completed_at = now(), outcome_notes = $2
       WHERE id = $1`,
      [input.run_id, input.outcome_notes || null]
    );
    console.log(`✅ Process run completed: ${input.run_id}`);

  } else if (action === 'rate') {
    if (!input.run_id || !input.rating) { console.error('Missing: run_id, rating (1-5)'); process.exit(1); }
    await query(
      `UPDATE cc_process_runs SET quality_rating = $2, quality_notes = $3
       WHERE id = $1`,
      [input.run_id, input.rating, input.quality_notes || null]
    );
    console.log(`✅ Process rated: ${input.run_id} → ${input.rating}/5`);

  } else {
    console.error('Usage: run_process.js [start|complete|rate] <json>');
    process.exit(1);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
