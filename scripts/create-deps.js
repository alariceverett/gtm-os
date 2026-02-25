const { Client } = require('pg');

async function createDeps() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:AdZeta122025!@db.oxuujtjrnpwfldgasqwa.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to create dependency tables...');
    await client.connect();

    // Create prospects table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        industry TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ prospects table created (or exists)');

    // Create contacts table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ contacts table created (or exists)');

    console.log('✅ Dependencies ready');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDeps();
