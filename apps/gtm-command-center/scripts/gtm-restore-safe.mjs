import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, closePool } from './db.mjs';
import { GTM_CORE_TABLES } from './gtm-core-tables.mjs';

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`invalid identifier: ${name}`);
  return `"${name}"`;
}

async function run() {
  const backupDir = process.argv[2];
  if (!backupDir) {
    throw new Error('usage: node scripts/gtm-restore-safe.mjs <backup-dir>');
  }

  const sourceSchema = process.env.SOURCE_SCHEMA || 'public';
  const targetSchema = process.env.TARGET_SCHEMA || 'gtm_restore_test';
  const tableSuffix = process.env.TABLE_SUFFIX || '_restore_test';

  if (!/^[a-zA-Z0-9_]+$/.test(tableSuffix)) throw new Error(`invalid TABLE_SUFFIX: ${tableSuffix}`);

  await pool.query(`create schema if not exists ${quoteIdent(targetSchema)}`);

  for (const table of GTM_CORE_TABLES) {
    const columnsPath = path.join(backupDir, `${table}.columns.json`);
    const dataPath = path.join(backupDir, `${table}.ndjson`);

    const columns = JSON.parse(await readFile(columnsPath, 'utf8'));
    const lines = (await readFile(dataPath, 'utf8')).trim();
    const rows = lines ? lines.split('\n').map((line) => JSON.parse(line)) : [];

    const src = `${quoteIdent(sourceSchema)}.${quoteIdent(table)}`;
    const dstTable = `${table}${tableSuffix}`;
    const dst = `${quoteIdent(targetSchema)}.${quoteIdent(dstTable)}`;

    await pool.query(`create table if not exists ${dst} (like ${src} including all)`);
    await pool.query(`truncate table ${dst}`);

    if (rows.length) {
      const colList = columns.map(quoteIdent).join(', ');
      for (const row of rows) {
        const values = columns.map((c) => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`insert into ${dst} (${colList}) values (${placeholders})`, values);
      }
    }

    const { rows: countRows } = await pool.query(`select count(*)::int as n from ${dst}`);
    console.log(`[restore] loaded table=${targetSchema}.${dstTable} rows=${countRows[0].n}`);
  }

  console.log(`[restore] COMPLETE schema=${targetSchema} suffix=${tableSuffix} from=${backupDir}`);
}

run()
  .catch((err) => {
    console.error('[restore] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
