import { mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './db.mjs';
import { GTM_CORE_TABLES } from './gtm-core-tables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`invalid identifier: ${name}`);
  return `"${name}"`;
}

async function tableColumns(schema, table) {
  const { rows } = await pool.query(
    `select column_name
       from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position`,
    [schema, table],
  );
  return rows.map((r) => r.column_name);
}

async function run() {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupRoot = process.env.BACKUP_ROOT || path.join(appRoot, '.run', 'backups');
  const backupDir = path.join(backupRoot, `gtm-core-${ts}`);

  await mkdir(backupDir, { recursive: true });

  const manifest = {
    created_at_utc: ts,
    source_schema: 'public',
    format: 'ndjson',
    tables: [],
  };

  for (const table of GTM_CORE_TABLES) {
    const columns = await tableColumns('public', table);
    const query = `select * from ${quoteIdent('public')}.${quoteIdent(table)}`;
    const { rows } = await pool.query(query);

    const ndjson = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
    await writeFile(path.join(backupDir, `${table}.ndjson`), ndjson, 'utf8');
    await writeFile(path.join(backupDir, `${table}.columns.json`), JSON.stringify(columns, null, 2) + '\n', 'utf8');

    manifest.tables.push({ table, file: `${table}.ndjson`, columns_file: `${table}.columns.json`, rows: rows.length });
  }

  await writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const latestLink = path.join(backupRoot, 'latest');
  await rm(latestLink, { force: true });
  await symlink(backupDir, latestLink);

  console.log(`[backup] COMPLETE backup_dir=${backupDir}`);
  console.log(`[backup] MANIFEST ${path.join(backupDir, 'manifest.json')}`);
}

run()
  .catch((err) => {
    console.error('[backup] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
