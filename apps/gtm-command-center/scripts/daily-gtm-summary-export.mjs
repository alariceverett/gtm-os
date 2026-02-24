import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createServerSupabaseClient } from '../lib/supabase-clients.mjs';
import { resolveRuntimeMode } from '../lib/supabase-env.mjs';
import { collectDailyGtmSummary, renderDailyGtmSummaryMarkdown } from '../lib/daily-gtm-summary.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportsDir = path.resolve(projectRoot, '.run', 'reports', 'daily-gtm-summary');
const dateStamp = new Date().toISOString().slice(0, 10);

async function main() {
  const runtimeMode = resolveRuntimeMode(process.env);
  const pool = runtimeMode === 'pg' && process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
  const supabase = runtimeMode === 'supabase' ? createServerSupabaseClient(process.env) : null;

  try {
    const summary = await collectDailyGtmSummary({ runtimeMode, pool, supabase, projectRoot });
    const markdown = renderDailyGtmSummaryMarkdown(summary, dateStamp);

    await mkdir(reportsDir, { recursive: true });

    const mdPath = path.join(reportsDir, `daily-gtm-summary-${dateStamp}.md`);
    const jsonPath = path.join(reportsDir, `daily-gtm-summary-${dateStamp}.json`);
    const latestMdPath = path.join(reportsDir, 'daily-gtm-summary-latest.md');
    const latestJsonPath = path.join(reportsDir, 'daily-gtm-summary-latest.json');

    await writeFile(mdPath, markdown, 'utf8');
    await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    await writeFile(latestMdPath, markdown, 'utf8');
    await writeFile(latestJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    console.log(`Wrote daily GTM summary:\n- ${mdPath}\n- ${jsonPath}\n- ${latestMdPath}\n- ${latestJsonPath}`);
  } finally {
    if (pool) await pool.end();
  }
}

main().catch((error) => {
  console.error('daily GTM summary export failed:', error.message);
  process.exitCode = 1;
});
