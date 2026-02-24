import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createServerSupabaseClient } from '../lib/supabase-clients.mjs';
import { resolveRuntimeMode } from '../lib/supabase-env.mjs';
import { collectWeeklyScorecard, renderWeeklyScorecardMarkdown } from '../lib/weekly-scorecard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportsDir = path.resolve(projectRoot, '.run', 'reports', 'weekly-scorecard');
const dateStamp = new Date().toISOString().slice(0, 10);

async function main() {
  const runtimeMode = resolveRuntimeMode(process.env);
  const pool = runtimeMode === 'pg' && process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
  const supabase = runtimeMode === 'supabase' ? createServerSupabaseClient(process.env) : null;

  try {
    const scorecard = await collectWeeklyScorecard({ runtimeMode, pool, supabase, projectRoot });
    const markdown = renderWeeklyScorecardMarkdown(scorecard, dateStamp);

    await mkdir(reportsDir, { recursive: true });

    const mdPath = path.join(reportsDir, `weekly-scorecard-${dateStamp}.md`);
    const jsonPath = path.join(reportsDir, `weekly-scorecard-${dateStamp}.json`);
    const latestMdPath = path.join(reportsDir, 'weekly-scorecard-latest.md');
    const latestJsonPath = path.join(reportsDir, 'weekly-scorecard-latest.json');

    await writeFile(mdPath, markdown, 'utf8');
    await writeFile(jsonPath, `${JSON.stringify(scorecard, null, 2)}\n`, 'utf8');
    await writeFile(latestMdPath, markdown, 'utf8');
    await writeFile(latestJsonPath, `${JSON.stringify(scorecard, null, 2)}\n`, 'utf8');

    console.log(`Wrote weekly pilot scorecard:\n- ${mdPath}\n- ${jsonPath}\n- ${latestMdPath}\n- ${latestJsonPath}`);
    console.log('MARKER:WEEKLY_SCORECARD_GENERATED');
  } finally {
    if (pool) await pool.end();
  }
}

main().catch((error) => {
  console.error('weekly scorecard export failed:', error.message);
  process.exitCode = 1;
});
