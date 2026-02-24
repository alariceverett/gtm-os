import { closePool } from './db.mjs';
import { runMigrations } from './migration-runner.mjs';

const verifyOnly = process.argv.includes('--verify');

async function main() {
  try {
    const { verification, appliedCount } = await runMigrations({ verifyOnly });

    for (const row of verification) {
      console.log(`[migrate] ${row.status.padEnd(17)} ${row.fileName}`);
    }

    if (verifyOnly) {
      console.log('[migrate] verification complete');
    } else {
      console.log(`[migrate] done (${appliedCount} applied)`);
    }
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('[migrate] failed:', error.message);
  process.exitCode = 1;
});
