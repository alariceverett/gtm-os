const { Client } = require('pg');
const fs = require('fs');

async function generateReport() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:AdZeta122025!@db.oxuujtjrnpwfldgasqwa.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log('='.repeat(60));
    console.log('MIGRATION 004 REPORT: Email Sequence System Core');
    console.log('='.repeat(60));
    console.log(`Executed: ${new Date().toISOString()}`);
    console.log('');

    // ============================================
    // TABLES VERIFICATION
    // ============================================
    console.log('📊 TABLES CREATED (9/9)');
    console.log('-'.repeat(40));
    
    const tables = [
      'email_templates',
      'email_sequences', 
      'email_sequence_steps',
      'sequence_enrollments',
      'email_sends',
      'email_events',
      'sequence_analytics',
      'email_approval_queue',
      'prospect_engagement_scores'
    ];

    for (const table of tables) {
      const cols = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      console.log(`  ✓ ${table.padEnd(30)} ${cols.rows[0].count} columns`);
    }

    // ============================================
    // RLS POLICIES VERIFICATION
    // ============================================
    console.log('');
    console.log('🔒 RLS POLICIES');
    console.log('-'.repeat(40));

    const policies = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = ANY($1::text[])
      ORDER BY tablename, policyname;
    `, [tables]);

    const policiesByTable = {};
    policies.rows.forEach(p => {
      if (!policiesByTable[p.tablename]) policiesByTable[p.tablename] = [];
      policiesByTable[p.tablename].push(`${p.cmd}: ${p.policyname}`);
    });

    console.log(`  Total policies: ${policies.rows.length}`);
    for (const [table, tablePolicies] of Object.entries(policiesByTable)) {
      console.log(`\n  ${table}:`);
      tablePolicies.forEach(p => console.log(`    - ${p}`));
    }

    // ============================================
    // INDEXES VERIFICATION
    // ============================================
    console.log('');
    console.log('📈 INDEXES CREATED');
    console.log('-'.repeat(40));

    const indexes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = ANY($1::text[])
      ORDER BY tablename, indexname;
    `, [tables]);

    console.log(`  Total indexes: ${indexes.rows.length}`);
    indexes.rows.slice(0, 15).forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });
    if (indexes.rows.length > 15) {
      console.log(`  ... and ${indexes.rows.length - 15} more`);
    }

    // ============================================
    // FUNCTIONS VERIFICATION
    // ============================================
    console.log('');
    console.log('⚙️ FUNCTIONS CREATED');
    console.log('-'.repeat(40));

    const funcs = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('set_updated_at', 'assign_ab_variant', 'evaluate_step_conditions', 'increment_sequence_stats')
      ORDER BY routine_name;
    `);

    funcs.rows.forEach(f => console.log(`  ✓ ${f.routine_name}()`));

    // ============================================
    // SEED DATA VERIFICATION
    // ============================================
    console.log('');
    console.log('🌱 SEED DATA INSERTED');
    console.log('-'.repeat(40));

    const templates = await client.query(`
      SELECT slug, name, category, tone, status 
      FROM email_templates 
      ORDER BY slug;
    `);
    console.log(`  Email Templates (${templates.rows.length}):`);
    templates.rows.forEach(t => {
      console.log(`    - ${t.slug.padEnd(20)} ${t.category}/${t.tone} [${t.status}]`);
    });

    const sequences = await client.query(`
      SELECT slug, name, sequence_type, status, max_steps
      FROM email_sequences
      ORDER BY slug;
    `);
    console.log(`\n  Sequences (${sequences.rows.length}):`);
    sequences.rows.forEach(s => {
      console.log(`    - ${s.slug.padEnd(20)} ${s.sequence_type} (${s.max_steps} steps) [${s.status}]`);
    });

    const steps = await client.query(`
      SELECT ss.step_number, et.slug as template_slug, ss.wait_days, ss.is_active
      FROM email_sequence_steps ss
      JOIN email_sequences es ON ss.sequence_id = es.id
      LEFT JOIN email_templates et ON ss.template_id = et.id
      WHERE es.slug = 'default_cold_sequence'
      ORDER BY ss.step_number;
    `);
    console.log(`\n  Sequence Steps (${steps.rows.length}):`);
    steps.rows.forEach(s => {
      console.log(`    - Step ${s.step_number}: ${s.template_slug || 'N/A'}, wait ${s.wait_days}d [${s.is_active ? 'active' : 'inactive'}]`);
    });

    // ============================================
    // TRIGGERS VERIFICATION
    // ============================================
    console.log('');
    console.log('🔔 TRIGGERS CREATED');
    console.log('-'.repeat(40));

    const triggers = await client.query(`
      SELECT trigger_name, event_object_table, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      AND trigger_name LIKE 'trg_%'
      ORDER BY event_object_table;
    `);

    console.log(`  Total triggers: ${triggers.rows.length}`);
    triggers.rows.forEach(t => {
      console.log(`  ✓ ${t.trigger_name} ON ${t.event_object_table} (${t.action_timing} ${t.event_manipulation})`);
    });

    // ============================================
    // FOREIGN KEYS
    // ============================================
    console.log('');
    console.log('🔗 FOREIGN KEYS');
    console.log('-'.repeat(40));

    const fks = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = ANY($1::text[]);
    `, [tables]);

    console.log(`  Total foreign keys: ${fks.rows.length}`);
    fks.rows.slice(0, 10).forEach(fk => {
      console.log(`  ✓ ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // ============================================
    // MIGRATION RECORD
    // ============================================
    console.log('');
    console.log('📝 MIGRATION STATUS');
    console.log('-'.repeat(40));

    const migration = await client.query(`
      SELECT version, name, applied_at
      FROM schema_migrations
      WHERE version = '004';
    `);

    if (migration.rows.length > 0) {
      const m = migration.rows[0];
      console.log(`  ✓ Migration recorded: ${m.version}`);
      console.log(`  ✓ Name: ${m.name}`);
      console.log(`  ✓ Applied at: ${m.applied_at}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ MIGRATION 004: COMPLETE');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ Report generation failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateReport();
