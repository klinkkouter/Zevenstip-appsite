const { getPool } = require('../_lib/db');
const { ensureAuthTables, getSessionUser } = require('../_lib/auth');
const { ensureAccessRequestsTable } = require('../_lib/access-requests');

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureAccessRequestsTable(client);
    const caller = await getSessionUser(client, req);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT id, name, email, message, created_at FROM access_requests WHERE handled = false ORDER BY created_at'
      );
      res.status(200).json({ requests: result.rows });
      return;
    }

    if (req.method === 'POST') {
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      await client.query('UPDATE access_requests SET handled = true WHERE id = $1', [id]);
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
