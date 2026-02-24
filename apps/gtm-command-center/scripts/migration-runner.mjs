import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function ensureMigrationTable() {
  await pool.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

function checksumOf(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function loadMigrations() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (fileName) => {
      const absPath = path.resolve(MIGRATIONS_DIR, fileName);
      const sql = await readFile(absPath, 'utf8');
      const match = fileName.match(/^(\d+)_?(.*)\.sql$/i);
      return {
        fileName,
        absPath,
        sql,
        version: match?.[1] ?? fileName,
        name: match?.[2] ? match[2].replaceAll('_', ' ') : fileName,
        checksum: checksumOf(sql),
      };
    })
  );
}

export async function verifyMigrationState() {
  await ensureMigrationTable();
  const migrations = await loadMigrations();
  const result = await pool.query(
    'select version, checksum, applied_at from public.schema_migrations order by version asc'
  );
  const applied = new Map(result.rows.map((row) => [row.version, row]));

  const verification = migrations.map((migration) => {
    const existing = applied.get(migration.version);
    if (!existing) {
      return { ...migration, status: 'pending' };
    }
    if (existing.checksum !== migration.checksum) {
      return {
        ...migration,
        status: 'checksum_mismatch',
        appliedChecksum: existing.checksum,
        appliedAt: existing.applied_at,
      };
    }
    return { ...migration, status: 'applied', appliedAt: existing.applied_at };
  });

  return verification;
}

export async function runMigrations({ verifyOnly = false } = {}) {
  const verification = await verifyMigrationState();

  const mismatches = verification.filter((m) => m.status === 'checksum_mismatch');
  if (mismatches.length) {
    throw new Error(
      `checksum mismatch for applied migration(s): ${mismatches
        .map((m) => m.fileName)
        .join(', ')}`
    );
  }

  if (verifyOnly) {
    return { verification, appliedCount: 0 };
  }

  let appliedCount = 0;
  for (const migration of verification) {
    if (migration.status === 'applied') {
      console.log(`[migrate] skip ${migration.fileName} (already applied)`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(migration.sql);
      await client.query(
        `insert into public.schema_migrations (version, name, checksum)
         values ($1, $2, $3)
         on conflict (version) do update set
           name = excluded.name,
           checksum = excluded.checksum,
           applied_at = now()`,
        [migration.version, migration.name, migration.checksum]
      );
      await client.query('commit');
      appliedCount += 1;
      console.log(`[migrate] applied ${migration.fileName}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  return { verification: await verifyMigrationState(), appliedCount };
}
