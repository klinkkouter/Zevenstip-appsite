const { getPool } = require('../_lib/db');
const { ensureAuthTables, createUser } = require('../_lib/auth');

// Creates the first admin account and migrates the pre-accounts 'default'
// progress row to it. Only works once - refuses if any user already exists,
// so it's safe to leave deployed rather than removing it after use.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    const existing = await client.query('SELECT id FROM users LIMIT 1');
    if (existing.rows.length) {
      res.status(403).json({ error: 'Already bootstrapped' });
      return;
    }

    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }
    const admin = await createUser(client, { email, password, name, role: 'admin' });

    await client.query(`
      CREATE TABLE IF NOT EXISTS pt_app_state (
        user_id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`UPDATE pt_app_state SET user_id = $1 WHERE user_id = 'default'`, [admin.id]);

    res.status(201).json(admin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
