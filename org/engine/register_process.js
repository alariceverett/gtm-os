#!/usr/bin/env node
// Register a process in the registry
// Usage: node register_process.js '<json>'

const { query } = require('./db');

async function main() {
  const input = JSON.parse(process.argv[2]);
  
  if (!input.process_id || !input.name) {
    console.error('Missing required: process_id, name');
    process.exit(1);
  }

  await query(
    `INSERT INTO cc_processes (process_id, name, description, file_path, category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (process_id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       file_path = EXCLUDED.file_path,
       category = EXCLUDED.category,
       updated_at = now()`,
    [
      input.process_id,
      input.name,
      input.description || null,
      input.file_path || null,
      input.category || null
    ]
  );

  console.log(`✅ Process registered: ${input.process_id} — ${input.name}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
