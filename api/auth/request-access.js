const crypto = require('crypto');
const { getPool } = require('../_lib/db');
const { ensureAuthTables } = require('../_lib/auth');
const { ensureAccessRequestsTable } = require('../_lib/access-requests');
const { sendEmail } = require('../_lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureAccessRequestsTable(client);

    const { name, email, message } = req.body || {};
    if (!name || !email) {
      res.status(400).json({ error: 'Missing name or email' });
      return;
    }

    const id = crypto.randomUUID();
    await client.query('INSERT INTO access_requests (id, name, email, message) VALUES ($1, $2, $3, $4)', [
      id,
      name,
      email.toLowerCase().trim(),
      message || null,
    ]);

    const admins = await client.query("SELECT email FROM users WHERE role = 'admin'");
    const adminEmails = admins.rows.map((r) => r.email);
    if (adminEmails.length) {
      try {
        await sendEmail({
          to: adminEmails,
          subject: 'New access request — PT routine app',
          text:
            `${name} (${email}) requested access to the PT routine app.\n\n` +
            (message ? `Message: ${message}\n\n` : '') +
            `Create their account: https://www.zevenstip.com/admin`,
        });
      } catch (emailErr) {
        console.error('Failed to send access request email', emailErr);
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
