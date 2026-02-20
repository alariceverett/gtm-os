#!/usr/bin/env node
// Record a delegation from a decision
// Usage: node record_delegation.js '<json>'

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  
  if (!input.decision_id || !input.delegated_to) {
    console.error('Missing required: decision_id, delegated_to');
    process.exit(1);
  }

  const result = await query(
    `INSERT INTO cc_delegations 
      (decision_id, delegated_to, brief, status, department, agent_pose, started_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.decision_id,
      input.delegated_to,
      input.brief || null,
      input.status || 'pending',
      input.department || null,
      input.agent_pose || 'building',
      input.status === 'running' ? new Date().toISOString() : null
    ]
  );

  console.log(`✅ Delegation ${result.rows[0].id} recorded: ${input.delegated_to} for ${input.decision_id}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
