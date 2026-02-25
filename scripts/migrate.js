#!/usr/bin/env node
/**
 * Database Migration Runner
 * 
 * Runs SQL migrations from the migrations/ directory.
 * Tracks applied migrations in a _migrations table.
 * Safe to run multiple times - skips already applied migrations.
 * 
 * Usage:
 *   node scripts/migrate.js              # Run all pending migrations
 *   node scripts/migrate.js --dry-run    # Show what would run
 *   node scripts/migrate.js --status     # Show migration status
 */

const fs = require('fs');
const path = require('path');
const { getClient } = require('../org/engine/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Ensure migrations table exists
const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL
  );
`;

async function initMigrationsTable(client) {
  await client.query(CREATE_MIGRATIONS_TABLE);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename, checksum FROM _migrations ORDER BY id');
  return new Map(result.rows.map(r => [r.filename, r.checksum]));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function computeChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runMigration(client, filename, dryRun = false) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  const checksum = computeChecksum(content);

  if (dryRun) {
    console.log(`  [DRY RUN] Would apply: ${filename}`);
    return { applied: false, checksum };
  }

  try {
    await client.query('BEGIN');
    await client.query(content);
    await client.query(
      'INSERT INTO _migrations (filename, checksum) VALUES ($1, $2)',
      [filename, checksum]
    );
    await client.query('COMMIT');
    console.log(`  ✅ Applied: ${filename}`);
    return { applied: true, checksum };
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${filename} failed: ${err.message}`);
  }
}

async function runMigrations(dryRun = false) {
  const client = getClient();
  
  try {
    await client.connect();
    
    // Initialize migrations table
    await initMigrationsTable(client);
    
    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations(client);
    const migrationFiles = getMigrationFiles();
    
    console.log(`\n📊 Migration Status`);
    console.log(`   Total migrations: ${migrationFiles.length}`);
    console.log(`   Applied: ${appliedMigrations.size}`);
    console.log(`   Pending: ${migrationFiles.length - appliedMigrations.size}\n`);
    
    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found in migrations/');
      return;
    }
    
    let applied = 0;
    let skipped = 0;
    let errors = [];
    
    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        // Check if content changed (safety check)
        const filepath = path.join(MIGRATIONS_DIR, filename);
        const content = fs.readFileSync(filepath, 'utf8');
        const currentChecksum = computeChecksum(content);
        const storedChecksum = appliedMigrations.get(filename);
        
        if (currentChecksum !== storedChecksum) {
          errors.push(`   ⚠️  ${filename} - Content changed after being applied!`);
        } else {
          console.log(`  ⏭️  Skipped (already applied): ${filename}`);
          skipped++;
        }
      } else {
        try {
          const result = await runMigration(client, filename, dryRun);
          if (result.applied) applied++;
        } catch (err) {
          errors.push(`   ❌ ${err.message}`);
        }
      }
    }
    
    console.log('\n📋 Summary');
    console.log(`   Applied: ${applied}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(e => console.log(e));
      process.exit(1);
    }
    
    if (dryRun && applied > 0) {
      console.log('\n⚠️  Dry run complete. Run without --dry-run to apply.');
    } else if (applied === 0 && skipped > 0) {
      console.log('\n✅ All migrations already applied.');
    } else if (applied > 0) {
      console.log('\n✅ Migrations completed successfully.');
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function showStatus() {
  const client = getClient();
  
  try {
    await client.connect();
    await initMigrationsTable(client);
    
    const appliedMigrations = await getAppliedMigrations(client);
    const migrationFiles = getMigrationFiles();
    
    console.log('\n📊 Migration Status\n');
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }
    
    console.log('Migration Files:');
    for (const filename of migrationFiles) {
      const isApplied = appliedMigrations.has(filename);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      console.log(`  ${status}  ${filename}`);
    }
    
    console.log(`\nTotal: ${migrationFiles.length} | Applied: ${appliedMigrations.size} | Pending: ${migrationFiles.length - appliedMigrations.size}`);
    
  } catch (err) {
    console.error('❌ Failed to get status:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus();
} else if (args.includes('--dry-run')) {
  runMigrations(true);
} else if (args.includes('--help')) {
  console.log(`
Database Migration Runner

Usage:
  node scripts/migrate.js [options]

Options:
  --dry-run    Show what migrations would run without applying
  --status     Show current migration status
  --help       Show this help message

Environment:
  DATABASE_URL  PostgreSQL connection string (required)
`);
} else {
  runMigrations(false);
}
