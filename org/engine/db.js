// Shared database connection for decision engine
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  throw new Error('DATABASE_URL is required. Set it in .env (local) or environment variables.');
}

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
