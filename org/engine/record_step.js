#!/usr/bin/env node
// Record a step in the decision process
// Usage: node record_step.js '<json>'
//
// step_type values:
//   thought       — internal reasoning, data considered, mental model
//   self_review   — Excellence Preamble checklist results
//   advisor       — advisor consultation (actor = which advisor)
//   meeting       — meeting resolution (actor = attendees)
//   action        — action step decided
//   brief         — exact brief sent to a lead/agent
//   prompt        — literal prompt text passed to spawned agent
//   result        — outcome/result received back
//   learning      — what was learned from the result
//   confirmation  — explicit confirmation that a quality gate passed

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  
  if (!input.decision_id || !input.step_type || !input.content) {
    console.error('Missing required: decision_id, step_type, content');
    process.exit(1);
  }

  const result = await query(
    `INSERT INTO cc_decision_steps 
      (decision_id, step_type, step_order, title, content, actor, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.decision_id,
      input.step_type,
      input.step_order || 0,
      input.title || null,
      input.content,
      input.actor || null,
      JSON.stringify(input.metadata || {})
    ]
  );

  console.log(`✅ Step recorded for ${input.decision_id}: ${input.step_type} — ${input.title || input.content.slice(0, 50)}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
