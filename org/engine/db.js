// Shared database connection for decision engine
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres';

function getClient() {
  return new Client({
    connectionString: DB_URL,
    ssl: DB_URL.includes('supabase') ? { rejectUnauthorized: false } : false
  });
}

async function query(sql, params) {
  const client = getClient();
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    await client.end();
  }
}

module.exports = { getClient, query };
