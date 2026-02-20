#!/usr/bin/env node
// Record a decision to cc_decisions
// Usage: node record_decision.js '<json>'

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  
  const required = ['decision_id', 'title', 'decision', 'category', 'department'];
  for (const field of required) {
    if (!input[field]) {
      console.error(`Missing required field: ${field}`);
      process.exit(1);
    }
  }

  await query(
    `INSERT INTO cc_decisions 
      (decision_id, title, status, signal, thesis, decision, alternatives, 
       authority_level, reversibility, success_metrics, triggered_by, category, department,
       decision_level, parent_decision_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (decision_id) DO UPDATE SET
       title = EXCLUDED.title,
       status = EXCLUDED.status,
       signal = EXCLUDED.signal,
       thesis = EXCLUDED.thesis,
       decision = EXCLUDED.decision,
       alternatives = EXCLUDED.alternatives,
       authority_level = EXCLUDED.authority_level,
       reversibility = EXCLUDED.reversibility,
       success_metrics = EXCLUDED.success_metrics,
       triggered_by = EXCLUDED.triggered_by,
       category = EXCLUDED.category,
       department = EXCLUDED.department,
       decision_level = EXCLUDED.decision_level,
       parent_decision_id = EXCLUDED.parent_decision_id`,
    [
      input.decision_id,
      input.title,
      input.status || 'active',
      input.signal || null,
      input.thesis || null,
      input.decision,
      JSON.stringify(input.alternatives || []),
      input.authority_level || 'ceo_autonomous',
      input.reversibility || 'moderate',
      JSON.stringify(input.success_metrics || []),
      input.triggered_by || null,
      input.category,
      input.department,
      input.decision_level || 'ceo',
      input.parent_decision_id || null
    ]
  );

  console.log(`✅ Decision ${input.decision_id} recorded: ${input.title}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
