import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');

const pairs = [
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0001_lifecycle_campaign_analytics.sql',
    source: 'org/sql/2026-02-21_lifecycle_campaign_analytics.sql',
  },
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0002_cc_funnels_sequences.sql',
    source: 'org/sql/2026-02-21_cc_funnels_sequences.sql',
  },
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0003_lead_magnets_teasers.sql',
    source: 'org/sql/2026-02-21_lead_magnets_teasers.sql',
  },
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0004_meeting_analysis_client_updates.sql',
    source: 'org/sql/2026-02-21_meeting_analysis_client_updates.sql',
  },
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0007_cc_qualified_accounts.sql',
    source: 'org/sql/2026-02-21_cc_qualified_accounts.sql',
  },
  {
    migration: 'apps/gtm-command-center/scripts/migrations/0008_cc_qualified_accounts_pipeline_stage.sql',
    source: 'org/sql/2026-02-21_cc_qualified_accounts_pipeline_stage.sql',
  },
];

const destructivePattern = /\b(drop\s+table|drop\s+schema|truncate\s+table|delete\s+from|alter\s+table\s+.+\s+drop\s+)/i;

function checksum(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function main() {
  let ok = true;

  for (const pair of pairs) {
    const migrationPath = path.resolve(workspaceRoot, pair.migration);
    const sourcePath = path.resolve(workspaceRoot, pair.source);
    const [migrationSql, sourceSql] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(sourcePath, 'utf8'),
    ]);

    const migrationHash = checksum(migrationSql);
    const sourceHash = checksum(sourceSql);

    if (migrationHash !== sourceHash) {
      ok = false;
      console.error(`[verify:migrations] mismatch ${pair.migration} != ${pair.source}`);
    } else {
      console.log(`[verify:migrations] match ${pair.migration}`);
    }

    if (destructivePattern.test(migrationSql)) {
      ok = false;
      console.error(`[verify:migrations] potential destructive SQL in ${pair.migration}`);
    } else {
      console.log(`[verify:migrations] non-destructive ${pair.migration}`);
    }
  }

  if (!ok) {
    process.exitCode = 1;
    return;
  }

  console.log('[verify:migrations] source parity + non-destructive checks passed');
}

main().catch((error) => {
  console.error('[verify:migrations] failed:', error.message);
  process.exitCode = 1;
});
