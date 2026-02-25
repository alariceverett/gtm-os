const { Client } = require('pg');

async function checkDeps() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:AdZeta122025!@db.oxuujtjrnpwfldgasqwa.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Existing tables in database:');
    tables.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    const needed = ['prospects', 'contacts', 'profiles'];
    console.log('\nMigration dependencies:');
    for (const t of needed) {
      const exists = tables.rows.some(r => r.table_name === t);
      console.log(`  ${exists ? '✓' : '✗'} ${t}`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkDeps();
