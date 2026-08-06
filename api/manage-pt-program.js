const crypto = require('crypto');
const { getPool } = require('./_lib/db');
const { ensureAuthTables, getSessionUser } = require('./_lib/auth');
const { ensureExerciseLibraryTable } = require('./_lib/exercise-library');
const { ensurePtAssignmentsTable, canManageClient } = require('./_lib/pt-assignments');

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureExerciseLibraryTable(client);
    await ensurePtAssignmentsTable(client);
    const caller = await getSessionUser(client, req);
    if (!caller || (caller.role !== 'admin' && caller.role !== 'pt')) {
      res.status(403).json({ error: 'Admin or PT only' });
      return;
    }

    if (req.method === 'GET') {
      const userId = req.query.userId;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      if (!(await canManageClient(client, caller, userId))) {
        res.status(403).json({ error: "You don't have access to this person's program" });
        return;
      }
      const person = await client.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
      if (!person.rows.length) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }
      const assignments = await client.query(
        `SELECT a.id, a.detail, a.freq, a.library_id, l.name, l.explanation, l.cat
         FROM pt_assignments a
         JOIN pt_exercise_library l ON l.id = a.library_id
         WHERE a.user_id = $1
         ORDER BY a.created_at`,
        [userId]
      );
      res.status(200).json({ person: person.rows[0], assignments: assignments.rows });
      return;
    }

    if (req.method === 'POST') {
      const { userId, libraryId } = req.body || {};
      if (!userId || !libraryId) {
        res.status(400).json({ error: 'Missing userId or libraryId' });
        return;
      }
      if (!(await canManageClient(client, caller, userId))) {
        res.status(403).json({ error: "You don't have access to this person's program" });
        return;
      }
      const lib = await client.query('SELECT detail, freq FROM pt_exercise_library WHERE id = $1', [libraryId]);
      if (!lib.rows.length) {
        res.status(404).json({ error: 'Exercise not found in library' });
        return;
      }
      const existing = await client.query(
        'SELECT id FROM pt_assignments WHERE user_id = $1 AND library_id = $2',
        [userId, libraryId]
      );
      if (existing.rows.length) {
        res.status(409).json({ error: 'Already assigned' });
        return;
      }
      const id = crypto.randomUUID();
      await client.query(
        'INSERT INTO pt_assignments (id, user_id, library_id, detail, freq) VALUES ($1, $2, $3, $4, $5)',
        [id, userId, libraryId, lib.rows[0].detail, lib.rows[0].freq]
      );
      res.status(201).json({ id });
      return;
    }

    if (req.method === 'PUT') {
      const { id, detail, freq } = req.body || {};
      if (!id || !detail) {
        res.status(400).json({ error: 'Missing fields' });
        return;
      }
      const assignment = await client.query('SELECT user_id FROM pt_assignments WHERE id = $1', [id]);
      if (!assignment.rows.length) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      if (!(await canManageClient(client, caller, assignment.rows[0].user_id))) {
        res.status(403).json({ error: "You don't have access to this person's program" });
        return;
      }
      await client.query('UPDATE pt_assignments SET detail = $1, freq = $2 WHERE id = $3', [
        detail,
        freq === 2 ? 2 : 1,
        id,
      ]);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      const assignment = await client.query('SELECT user_id FROM pt_assignments WHERE id = $1', [id]);
      if (!assignment.rows.length) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      if (!(await canManageClient(client, caller, assignment.rows[0].user_id))) {
        res.status(403).json({ error: "You don't have access to this person's program" });
        return;
      }
      await client.query('DELETE FROM pt_assignments WHERE id = $1', [id]);
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
