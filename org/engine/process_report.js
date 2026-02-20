#!/usr/bin/env node
// Process tracking report
// Usage: node process_report.js

const { query } = require('./db');

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('       PROCESS TRACKING REPORT');
  console.log('═══════════════════════════════════════\n');

  // Runs per process
  const freq = await query(`
    SELECT p.process_id, p.name, COUNT(r.id) as runs
    FROM cc_processes p
    LEFT JOIN cc_process_runs r ON r.process_id = p.process_id
    GROUP BY p.process_id, p.name
    ORDER BY runs DESC
  `);

  console.log('📊 RUNS PER PROCESS');
  console.log('-------------------');
  for (const row of freq.rows) {
    console.log(`  ${row.name}: ${row.runs} runs`);
  }

  // Average quality
  const qual = await query(`
    SELECT p.name, ROUND(AVG(r.quality_rating)::numeric, 1) as avg_quality, COUNT(r.quality_rating) as rated
    FROM cc_processes p
    JOIN cc_process_runs r ON r.process_id = p.process_id
    WHERE r.quality_rating IS NOT NULL
    GROUP BY p.name
    ORDER BY avg_quality DESC
  `);

  console.log('\n⭐ AVERAGE QUALITY RATING');
  console.log('------------------------');
  if (qual.rows.length === 0) {
    console.log('  No rated runs yet.');
  } else {
    for (const row of qual.rows) {
      console.log(`  ${row.name}: ${row.avg_quality}/5 (${row.rated} rated)`);
    }
  }

  // Top 5
  console.log('\n🏆 TOP 5 MOST-USED PROCESSES');
  console.log('----------------------------');
  const top = freq.rows.filter(r => r.runs > 0).slice(0, 5);
  if (top.length === 0) {
    console.log('  No runs yet.');
  } else {
    top.forEach((row, i) => console.log(`  ${i + 1}. ${row.name} (${row.runs} runs)`));
  }

  // No runs
  const unused = freq.rows.filter(r => r.runs == 0);
  console.log('\n⚠️  PROCESSES WITH NO RUNS');
  console.log('--------------------------');
  if (unused.length === 0) {
    console.log('  All processes have been run!');
  } else {
    for (const row of unused) {
      console.log(`  - ${row.name}`);
    }
  }

  // Review requested
  const reviews = await query(`
    SELECT r.id, p.name, r.actor, r.outcome_notes, r.started_at
    FROM cc_process_runs r
    JOIN cc_processes p ON p.process_id = r.process_id
    WHERE r.review_requested = true
    ORDER BY r.started_at DESC
  `);

  console.log('\n🔍 RUNS WITH REVIEW REQUESTED');
  console.log('------------------------------');
  if (reviews.rows.length === 0) {
    console.log('  None.');
  } else {
    for (const row of reviews.rows) {
      console.log(`  - ${row.name} by ${row.actor} (${row.id.slice(0, 8)}…)`);
    }
  }

  // Last 24h
  const recent = await query(`
    SELECT r.id, p.name, r.actor, r.status, r.started_at
    FROM cc_process_runs r
    JOIN cc_processes p ON p.process_id = r.process_id
    WHERE r.started_at > now() - interval '24 hours'
    ORDER BY r.started_at DESC
  `);

  console.log('\n🕐 RUNS IN LAST 24 HOURS');
  console.log('------------------------');
  if (recent.rows.length === 0) {
    console.log('  None.');
  } else {
    for (const row of recent.rows) {
      const time = new Date(row.started_at).toISOString().slice(11, 16);
      console.log(`  ${time} — ${row.name} [${row.status}] by ${row.actor}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
