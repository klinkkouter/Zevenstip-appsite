const { getPool } = require('../_lib/db');
const { ensureAuthTables, getSessionUser, createUser } = require('../_lib/auth');
const { sendEmail } = require('../_lib/email');
const { ensureExerciseLibraryTable } = require('../_lib/exercise-library');
const { ensurePtAssignmentsTable, seedDefaultAssignmentsForUser } = require('../_lib/pt-assignments');

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureExerciseLibraryTable(client);
    await ensurePtAssignmentsTable(client);
    const caller = await getSessionUser(client, req);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT id, email, name, role, pt_id, created_at FROM users ORDER BY created_at'
      );
      res.status(200).json({ users: result.rows });
      return;
    }

    if (req.method === 'PUT') {
      const { userId, ptId } = req.body || {};
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      await client.query('UPDATE users SET pt_id = $1 WHERE id = $2', [ptId || null, userId]);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'POST') {
      const { email, password, name, role } = req.body || {};
      if (!email || !password || !name || !['user', 'admin', 'pt'].includes(role)) {
        res.status(400).json({ error: 'Missing or invalid fields' });
        return;
      }
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [
        email.toLowerCase().trim(),
      ]);
      if (existing.rows.length) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      const user = await createUser(client, { email, password, name, role });
      await seedDefaultAssignmentsForUser(client, user.id);

      try {
        await sendEmail({
          to: user.email,
          subject: 'Your login for the PT routine app',
          text:
            `Hi ${name},\n\n` +
            `An account has been created for you on the PT routine app.\n\n` +
            `Log in here: https://www.zevenstip.com/login/\n` +
            `Email: ${user.email}\n` +
            `Password: ${password}\n\n` +
            `You can change your password by asking an admin to reset it.`,
        });
      } catch (emailErr) {
        console.error('Failed to send welcome email', emailErr);
      }

      res.status(201).json(user);
      return;
    }

    if (req.method === 'DELETE') {
      const { userId } = req.body || {};
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      if (userId === caller.id) {
        res.status(400).json({ error: "You can't delete your own account" });
        return;
      }
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS pt_app_state (
          user_id TEXT PRIMARY KEY,
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await client.query('DELETE FROM pt_app_state WHERE user_id = $1', [userId]);
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
