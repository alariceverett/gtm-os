#!/usr/bin/env node
// Version control for prompts and process docs
// Usage:
//   Save:     node version_prompt.js save '<json>'
//   List:     node version_prompt.js list '<target_type>' '<target_id>'
//   Rollback: node version_prompt.js rollback '<json>'
//   Check:    node version_prompt.js check '<target_type>' '<target_id>'
//
// target_type: "process", "agent_prompt", "preamble", "supplement", "system"
// target_id: e.g. "product-pipeline", "head-of-product", "excellence-preamble"

const { query } = require('./db');
const fs = require('fs');

async function main() {
  const action = process.argv[2];
  
  if (action === 'save') {
    // Save a new version of a prompt/process doc
    const input = JSON.parse(process.argv[3]);
    if (!input.target_type || !input.target_id || !input.content) {
      console.error('Missing: target_type, target_id, content');
      process.exit(1);
    }

    // Get next version number
    const vResult = await query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version 
       FROM cc_prompt_versions WHERE target_type = $1 AND target_id = $2`,
      [input.target_type, input.target_id]
    );
    const version = vResult.rows[0].next_version;

    // Get quality avg before this change
    let qualityBefore = null;
    if (input.process_id) {
      const qResult = await query(
        `SELECT ROUND(AVG(quality_rating)::numeric, 2) as avg
         FROM cc_process_runs WHERE process_id = $1 AND quality_rating IS NOT NULL`,
        [input.process_id]
      );
      qualityBefore = qResult.rows[0]?.avg || null;
    }

    await query(
      `INSERT INTO cc_prompt_versions 
        (target_type, target_id, version, content, change_reason, triggered_by_decision, quality_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.target_type, input.target_id, version, input.content,
       input.change_reason || null, input.triggered_by_decision || null, qualityBefore]
    );

    console.log(`✅ Version ${version} saved for ${input.target_type}/${input.target_id}`);
    if (qualityBefore) console.log(`   Quality at time of change: ${qualityBefore}/5`);

  } else if (action === 'list') {
    // List all versions
    const targetType = process.argv[3];
    const targetId = process.argv[4];
    
    const result = await query(
      `SELECT version, created_at, change_reason, quality_before, quality_after, 
              rolled_back, rollback_reason
       FROM cc_prompt_versions 
       WHERE target_type = $1 AND target_id = $2
       ORDER BY version DESC`,
      [targetType, targetId]
    );

    console.log(`\n📜 VERSION HISTORY: ${targetType}/${targetId}\n`);
    for (const r of result.rows) {
      const rb = r.rolled_back ? ' ⏪ ROLLED BACK' : '';
      const qb = r.quality_before ? ` | quality before: ${r.quality_before}` : '';
      const qa = r.quality_after ? ` → after: ${r.quality_after}` : '';
      console.log(`  v${r.version} — ${r.created_at?.toISOString().slice(0,16)}${rb}`);
      console.log(`    Reason: ${r.change_reason || 'initial version'}`);
      if (qb || qa) console.log(`    Quality: ${qb}${qa}`);
      if (r.rollback_reason) console.log(`    Rollback reason: ${r.rollback_reason}`);
    }

  } else if (action === 'rollback') {
    // Rollback to a previous version
    const input = JSON.parse(process.argv[3]);
    if (!input.target_type || !input.target_id || !input.to_version) {
      console.error('Missing: target_type, target_id, to_version');
      process.exit(1);
    }

    // Get the content of the target version
    const target = await query(
      `SELECT content FROM cc_prompt_versions 
       WHERE target_type = $1 AND target_id = $2 AND version = $3`,
      [input.target_type, input.target_id, input.to_version]
    );
    if (target.rows.length === 0) {
      console.error(`Version ${input.to_version} not found`);
      process.exit(1);
    }

    // Mark all versions after target as rolled back
    await query(
      `UPDATE cc_prompt_versions SET rolled_back = true, rolled_back_at = now(), 
              rollback_reason = $4
       WHERE target_type = $1 AND target_id = $2 AND version > $3`,
      [input.target_type, input.target_id, input.to_version, input.reason || 'quality regression']
    );

    // If file_path provided, write the rolled-back content to disk
    if (input.file_path) {
      fs.writeFileSync(input.file_path, target.rows[0].content);
      console.log(`✅ Rolled back to v${input.to_version} and wrote to ${input.file_path}`);
    } else {
      console.log(`✅ Rolled back to v${input.to_version} (marked later versions as rolled back)`);
      console.log(`   Content available — pass file_path to write to disk`);
    }

  } else if (action === 'check') {
    // Check if quality has trended down since last change
    const targetType = process.argv[3];
    const targetId = process.argv[4];

    const versions = await query(
      `SELECT version, quality_before, quality_after, created_at, change_reason
       FROM cc_prompt_versions 
       WHERE target_type = $1 AND target_id = $2 AND NOT rolled_back
       ORDER BY version DESC LIMIT 3`,
      [targetType, targetId]
    );

    if (versions.rows.length === 0) {
      console.log('No versions tracked yet.');
      return;
    }

    console.log(`\n🔎 QUALITY CHECK: ${targetType}/${targetId}\n`);
    
    const latest = versions.rows[0];
    if (latest.quality_before && latest.quality_after) {
      const delta = latest.quality_after - latest.quality_before;
      if (delta < -0.5) {
        console.log(`⚠️  QUALITY REGRESSION DETECTED`);
        console.log(`   v${latest.version} changed quality from ${latest.quality_before} → ${latest.quality_after} (${delta.toFixed(1)})`);
        console.log(`   Change reason: ${latest.change_reason}`);
        console.log(`   Consider rolling back to v${latest.version - 1}`);
      } else if (delta > 0.5) {
        console.log(`✅ Quality improved: ${latest.quality_before} → ${latest.quality_after} (+${delta.toFixed(1)})`);
      } else {
        console.log(`➡️  Quality stable: ${latest.quality_before} → ${latest.quality_after}`);
      }
    } else {
      console.log(`   Latest: v${latest.version} — ${latest.change_reason || 'no reason'}`);
      console.log(`   Quality data not yet available for comparison.`);
    }

  } else {
    console.error('Usage: version_prompt.js [save|list|rollback|check] <args>');
    process.exit(1);
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
