const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) throw new Error('No Postgres connection string found in environment');
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

module.exports = { getPool };
