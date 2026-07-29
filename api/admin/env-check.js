const { getPool } = require('../_lib/db');
const { ensureAuthTables, getSessionUser } = require('../_lib/auth');

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    const caller = await getSessionUser(client, req);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    res.status(200).json({
      hasResendApiKey: !!process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
