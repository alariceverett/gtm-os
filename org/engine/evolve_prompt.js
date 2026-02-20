#!/usr/bin/env node
// Prompt evolution: generate improvement suggestions based on quality data
// Usage: node evolve_prompt.js <process_id|agent_name>
//
// Reads: process run ratings, quality notes, decision learnings, {USER_NAME}'s feedback
// Outputs: specific prompt/process improvements to apply

const { query } = require('./db');

async function main() {
  const target = process.argv[2];
  if (!target) { console.error('Usage: evolve_prompt.js <process_id|agent_name>'); process.exit(1); }

  console.log(`\n🧬 PROMPT EVOLUTION ANALYSIS: ${target}\n`);

  // Get process runs with low ratings
  const lowRated = await query(
    `SELECT quality_rating, quality_notes, outcome_notes, started_at
     FROM cc_process_runs 
     WHERE process_id = $1 AND quality_rating IS NOT NULL AND quality_rating <= 3
     ORDER BY started_at DESC LIMIT 10`,
    [target]
  );

  // Get process runs with high ratings
  const highRated = await query(
    `SELECT quality_rating, quality_notes, outcome_notes, started_at
     FROM cc_process_runs 
     WHERE process_id = $1 AND quality_rating IS NOT NULL AND quality_rating >= 4
     ORDER BY started_at DESC LIMIT 10`,
    [target]
  );

  // Get learnings from decisions that used this process
  const learnings = await query(
    `SELECT ds.content, ds.title, ds.decision_id
     FROM cc_decision_steps ds
     JOIN cc_process_runs pr ON pr.decision_id = ds.decision_id
     WHERE pr.process_id = $1 AND ds.step_type = 'learning'
     ORDER BY ds.created_at DESC LIMIT 10`,
    [target]
  );

  // Get delegation results for this agent/lead
  const delegationResults = await query(
    `SELECT decision_id, brief, status, result
     FROM cc_delegations
     WHERE delegated_to ILIKE $1 AND result IS NOT NULL
     ORDER BY created_at DESC LIMIT 10`,
    ['%' + target + '%']
  );

  // Output analysis
  if (lowRated.rows.length > 0) {
    console.log('⚠️  LOW-RATED RUNS (≤3/5):');
    for (const r of lowRated.rows) {
      console.log(`  ${r.started_at?.toISOString().slice(0,16)} — ${r.quality_rating}/5`);
      if (r.quality_notes) console.log(`    Issue: ${r.quality_notes}`);
      if (r.outcome_notes) console.log(`    Outcome: ${r.outcome_notes}`);
    }
    console.log('');
  }

  if (highRated.rows.length > 0) {
    console.log('✅ HIGH-RATED RUNS (≥4/5):');
    for (const r of highRated.rows) {
      console.log(`  ${r.started_at?.toISOString().slice(0,16)} — ${r.quality_rating}/5`);
      if (r.quality_notes) console.log(`    What worked: ${r.quality_notes}`);
    }
    console.log('');
  }

  if (learnings.rows.length > 0) {
    console.log('📖 LEARNINGS FROM DECISIONS:');
    for (const r of learnings.rows) {
      console.log(`  ${r.decision_id}: ${r.content.slice(0, 150)}`);
    }
    console.log('');
  }

  if (delegationResults.rows.length > 0) {
    console.log('📋 DELEGATION RESULTS:');
    for (const r of delegationResults.rows) {
      console.log(`  ${r.decision_id} [${r.status}]: ${(r.result || '').slice(0, 120)}`);
    }
    console.log('');
  }

  // Summary
  const total = lowRated.rows.length + highRated.rows.length;
  if (total > 0) {
    const avgLow = lowRated.rows.reduce((s, r) => s + r.quality_rating, 0) / (lowRated.rows.length || 1);
    const avgHigh = highRated.rows.reduce((s, r) => s + r.quality_rating, 0) / (highRated.rows.length || 1);
    console.log('📊 EVOLUTION SIGNALS:');
    console.log(`  Low-rated patterns (avg ${avgLow.toFixed(1)}): ${lowRated.rows.length} runs — look for common issues`);
    console.log(`  High-rated patterns (avg ${avgHigh.toFixed(1)}): ${highRated.rows.length} runs — replicate what works`);
    console.log(`  Learnings captured: ${learnings.rows.length}`);
    console.log('');
    console.log('→ Apply insights above to update the process doc or agent prompt.');
    console.log('→ Specific changes should be committed with a reference to this analysis.');
  } else {
    console.log('📊 No rated runs yet. Start tracking to enable evolution.');
  }

  console.log('');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
