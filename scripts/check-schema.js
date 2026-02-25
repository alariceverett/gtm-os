const { Client } = require('pg');

async function checkSchemaMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:AdZeta122025!@db.oxuujtjrnpwfldgasqwa.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schema_migrations'
      ORDER BY ordinal_position;
    `);
    
    console.log('schema_migrations columns:');
    cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}) ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`));
    
    const existing = await client.query(`SELECT * FROM schema_migrations ORDER BY version;`);
    console.log('\nExisting migrations:', existing.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSchemaMigrations();
