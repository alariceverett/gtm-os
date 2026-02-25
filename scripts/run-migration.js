const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2] || 'migrations/004_email_sequences_core.sql';

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:AdZeta122025!@db.oxuujtjrnpwfldgasqwa.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected');

    const sql = fs.readFileSync(path.join(__dirname, '..', migrationFile), 'utf8');
    console.log(`📄 Executing migration: ${migrationFile}`);
    console.log('⏳ This may take a moment...\n');

    const startTime = Date.now();
    await client.query(sql);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Record migration
    const crypto = require('crypto');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    await client.query(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at) 
      VALUES ('004', 'email sequences core', $1, NOW())
      ON CONFLICT (version) DO UPDATE SET applied_at = NOW();
    `, [checksum]);

    console.log(`\n✅ Migration completed in ${duration}s`);

    // Verify tables created
    console.log('\n📊 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'email_templates', 'email_sequences', 'email_sequence_steps',
        'sequence_enrollments', 'email_sends', 'email_events',
        'sequence_analytics', 'email_approval_queue', 'prospect_engagement_scores'
      )
      ORDER BY table_name;
    `);

    console.log(`✓ ${tableCheck.rows.length}/9 tables created:`);
    tableCheck.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // Verify RLS policies
    console.log('\n🔒 Verifying RLS policies...');
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (
        'email_templates', 'email_sequences', 'email_sequence_steps',
        'sequence_enrollments', 'email_sends', 'email_events',
        'sequence_analytics', 'email_approval_queue', 'prospect_engagement_scores'
      );
    `);

    const rlsEnabled = rlsCheck.rows.filter(r => r.rowsecurity === true).length;
    console.log(`✓ ${rlsEnabled}/9 tables have RLS enabled`);

    // Check policies
    const policies = await client.query(`
      SELECT tablename, COUNT(*) as policy_count
      FROM pg_policies 
      WHERE schemaname = 'public'
      AND tablename IN (
        'email_templates', 'email_sequences', 'email_sequence_steps',
        'sequence_enrollments', 'email_sends', 'email_events',
        'sequence_analytics', 'email_approval_queue', 'prospect_engagement_scores'
      )
      GROUP BY tablename;
    `);
    console.log(`✓ ${policies.rows.reduce((sum, r) => sum + parseInt(r.policy_count), 0)} policies created across ${policies.rows.length} tables`);

    // Verify seed data
    console.log('\n🌱 Verifying seed data...');
    const templates = await client.query('SELECT COUNT(*) FROM email_templates');
    const sequences = await client.query('SELECT COUNT(*) FROM email_sequences');
    const steps = await client.query('SELECT COUNT(*) FROM email_sequence_steps');

    console.log(`✓ ${templates.rows[0].count} email templates`);
    console.log(`✓ ${sequences.rows[0].count} sequences`);
    console.log(`✓ ${steps.rows[0].count} sequence steps`);

    // Check migration record
    const migration = await client.query("SELECT version FROM schema_migrations WHERE version = '004'");
    if (migration.rows.length > 0) {
      console.log('\n✓ Migration 004 recorded in schema_migrations');
    }

    // List functions created
    console.log('\n⚙️ Functions created:');
    const functions = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_schema = 'public'
      AND routine_name IN ('set_updated_at', 'assign_ab_variant', 'evaluate_step_conditions', 'increment_sequence_stats')
    `);
    functions.rows.forEach(f => console.log(`  - ${f.routine_name}()`));

    console.log('\n🎉 Migration 004: SUCCESS');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (err.message.includes('already exists')) {
      console.log('\nNote: Migration may have been partially applied previously.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
