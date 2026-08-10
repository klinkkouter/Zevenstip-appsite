const { getPool } = require('../_lib/db');
const { ensureAuthTables, getSessionUser } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    const user = await getSessionUser(client, req);
    if (!user) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }
    let pt = null;
    if (user.pt_id) {
      const result = await client.query('SELECT name, email FROM users WHERE id = $1', [user.pt_id]);
      if (result.rows.length) pt = result.rows[0];
    }
    res.status(200).json({ id: user.id, email: user.email, name: user.name, role: user.role, pt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
