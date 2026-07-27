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

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pt_app_state (
      user_id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureTable(client);

    if (req.method === 'GET') {
      const userId = (req.query.user || 'default').toString();
      const result = await client.query('SELECT state FROM pt_app_state WHERE user_id = $1', [userId]);
      res.status(200).json({ state: result.rows[0] ? result.rows[0].state : null });
      return;
    }

    if (req.method === 'POST') {
      const { user, state } = req.body || {};
      const userId = (user || 'default').toString();
      if (!state || typeof state !== 'object') {
        res.status(400).json({ error: 'Missing state' });
        return;
      }
      await client.query(
        `INSERT INTO pt_app_state (user_id, state, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET state = $2, updated_at = now()`,
        [userId, JSON.stringify(state)]
      );
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
