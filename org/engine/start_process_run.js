#!/usr/bin/env node
// Start a process run
// Usage: node start_process_run.js '<json>'

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);

  if (!input.process_id || !input.actor) {
    console.error('Missing required: process_id, actor');
    process.exit(1);
  }

  const result = await query(
    `INSERT INTO cc_process_runs (process_id, decision_id, delegation_id, actor, status, started_at)
     VALUES ($1, $2, $3, $4, 'running', now())
     RETURNING id`,
    [
      input.process_id,
      input.decision_id || null,
      input.delegation_id || null,
      input.actor
    ]
  );

  const runId = result.rows[0].id;
  console.log(`✅ Process run started: ${runId}`);
  console.log(runId);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
