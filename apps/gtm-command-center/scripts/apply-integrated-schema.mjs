import { closePool } from './db.mjs';
import { runMigrations } from './migration-runner.mjs';

async function run() {
  try {
    const { appliedCount } = await runMigrations({ verifyOnly: false });
    console.log(`[schema] integrated command-center schema is up to date (${appliedCount} applied)`);
  } finally {
    await closePool();
  }
}

run().catch((error) => {
  console.error('[schema] failed:', error.message);
  process.exitCode = 1;
});
