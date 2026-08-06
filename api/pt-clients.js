const { getPool } = require('./_lib/db');
const { ensureAuthTables, getSessionUser } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    const caller = await getSessionUser(client, req);
    if (!caller || caller.role !== 'pt') {
      res.status(403).json({ error: 'PT only' });
      return;
    }
    const result = await client.query(
      "SELECT id, name, email FROM users WHERE pt_id = $1 AND role = 'user' ORDER BY name",
      [caller.id]
    );
    res.status(200).json({ clients: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
