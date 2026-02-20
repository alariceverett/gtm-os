// Shared database connection for decision engine
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. See setup.sh to configure your database.');
}
const DB_URL = process.env.DATABASE_URL;

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
