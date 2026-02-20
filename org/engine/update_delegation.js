#!/usr/bin/env node
// Update a delegation status and result
// Usage: node update_delegation.js '<json>'
// json: { decision_id, delegated_to, status, result }

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  
  if (!input.decision_id || !input.delegated_to) {
    console.error('Missing required: decision_id, delegated_to');
    process.exit(1);
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (input.status) {
    updates.push(`status = $${idx++}`);
    values.push(input.status);
  }
  if (input.result) {
    updates.push(`result = $${idx++}`);
    values.push(input.result);
  }
  if (input.status === 'running') {
    updates.push(`started_at = $${idx++}`);
    values.push(new Date().toISOString());
  }
  if (['completed', 'failed'].includes(input.status)) {
    updates.push(`completed_at = $${idx++}`);
    values.push(new Date().toISOString());
  }
  if (input.agent_pose) {
    updates.push(`agent_pose = $${idx++}`);
    values.push(input.agent_pose);
  }

  values.push(input.decision_id);
  values.push(input.delegated_to);

  await query(
    `UPDATE cc_delegations SET ${updates.join(', ')} 
     WHERE decision_id = $${idx++} AND delegated_to = $${idx}`,
    values
  );

  console.log(`✅ Updated ${input.delegated_to} on ${input.decision_id}: ${input.status}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
