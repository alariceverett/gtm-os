#!/usr/bin/env node
// Sync org priority queue to Supabase
// Usage: node sync_priorities.js '<json array>'
// Each item: { rank, title, owner, phase, status, why_this_rank, decision_id? }

const { query } = require('./db');

async function main() {
  const items = JSON.parse(process.argv[2]);
  
  // Clear and rewrite (priority queue is always a full replacement)
  await query('DELETE FROM cc_priorities');
  
  for (const item of items) {
    await query(
      `INSERT INTO cc_priorities (rank, title, owner, phase, status, why_this_rank, decision_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        item.rank,
        item.title,
        item.owner || null,
        item.phase || null,
        item.status || 'queued',
        item.why_this_rank || null,
        item.decision_id || null
      ]
    );
  }

  console.log(`✅ Priority queue synced: ${items.length} items`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
