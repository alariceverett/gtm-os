#!/usr/bin/env node
// Pre-action lookback: query past performance before making a decision or delegation
// Usage: node lookback.js '<json>'
// json: { type: "process"|"decision"|"delegation"|"agent", id: "...", limit: 5 }
//
// Returns: past runs, avg quality, {USER_NAME}'s comments, lessons learned
// The output should be READ by the actor before proceeding.

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  const limit = input.limit || 5;

  console.log('\n🔍 PRE-ACTION LOOKBACK\n');

  if (input.type === 'process') {
    // How did this process perform recently?
    const stats = await query(
      `SELECT COUNT(*) as total, 
              ROUND(AVG(quality_rating)::numeric, 1) as avg_quality,
              MIN(quality_rating) as worst,
              MAX(quality_rating) as best
       FROM cc_process_runs WHERE process_id = $1 AND quality_rating IS NOT NULL`,
      [input.id]
    );
    const recent = await query(
      `SELECT quality_rating, quality_notes, outcome_notes, started_at
       FROM cc_process_runs WHERE process_id = $1 AND status = 'completed'
       ORDER BY started_at DESC LIMIT $2`,
      [input.id, limit]
    );
    const process = await query(
      `SELECT name, description FROM cc_processes WHERE process_id = $1`, [input.id]
    );

    if (process.rows[0]) {
      console.log(`Process: ${process.rows[0].name}`);
      console.log(`Description: ${process.rows[0].description}`);
    }
    const s = stats.rows[0];
    console.log(`\nPerformance: ${s.total} rated runs, avg ${s.avg_quality || 'n/a'}/5 (worst: ${s.worst || 'n/a'}, best: ${s.best || 'n/a'})`);
    
    if (recent.rows.length > 0) {
      console.log('\nRecent runs:');
      for (const r of recent.rows) {
        console.log(`  ${r.started_at?.toISOString().slice(0,16)} — ${r.quality_rating || '?'}/5 — ${r.quality_notes || r.outcome_notes || 'no notes'}`);
      }
    }

  } else if (input.type === 'decision') {
    // What happened with similar decisions?
    const recent = await query(
      `SELECT d.decision_id, d.title, d.status, d.category, d.department,
              (SELECT string_agg(ds.content, ' | ') FROM cc_decision_steps ds 
               WHERE ds.decision_id = d.decision_id AND ds.step_type = 'learning') as learnings
       FROM cc_decisions d
       WHERE d.category = $1 AND d.decision_id != $2
       ORDER BY d.created_at DESC LIMIT $3`,
      [input.category || 'process', input.id || '', limit]
    );

    console.log(`Similar decisions (category: ${input.category || 'process'}):\n`);
    for (const r of recent.rows) {
      console.log(`  ${r.decision_id}: ${r.title} [${r.status}]`);
      if (r.learnings) console.log(`    Learnings: ${r.learnings}`);
    }

  } else if (input.type === 'delegation') {
    // How did this delegate perform recently?
    const recent = await query(
      `SELECT d.decision_id, d.brief, d.status, d.result, d.agent_pose,
              d.completed_at, d.started_at
       FROM cc_delegations d
       WHERE d.delegated_to = $1
       ORDER BY d.created_at DESC LIMIT $2`,
      [input.id, limit]
    );

    console.log(`Delegation history for: ${input.id}\n`);
    for (const r of recent.rows) {
      const duration = r.completed_at && r.started_at 
        ? Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 60000) + 'min'
        : 'ongoing';
      console.log(`  ${r.decision_id} [${r.status}] ${duration}`);
      console.log(`    Brief: ${(r.brief || '').slice(0, 100)}`);
      if (r.result) console.log(`    Result: ${r.result.slice(0, 100)}`);
    }

  } else if (input.type === 'feedback') {
    // What has {USER_NAME} said recently? (from decision steps with type 'learning' or comments)
    const recent = await query(
      `SELECT decision_id, title, content, actor, created_at
       FROM cc_decision_steps
       WHERE step_type IN ('learning', 'confirmation')
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    console.log('Recent learnings & confirmations:\n');
    for (const r of recent.rows) {
      console.log(`  ${r.decision_id} — ${r.title || 'untitled'}`);
      console.log(`    ${r.content.slice(0, 150)}`);
      console.log('');
    }
  }

  console.log('\n---');
  console.log('Use this context to inform your next action. Adjust approach based on past performance.\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
