const crypto = require('crypto');
const { getPool } = require('../_lib/db');
const { ensureAuthTables, getSessionUser } = require('../_lib/auth');
const { ensureExerciseLibraryTable } = require('../_lib/exercise-library');

module.exports = async (req, res) => {
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureExerciseLibraryTable(client);
    const caller = await getSessionUser(client, req);
    if (!caller || caller.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT id, name, detail, freq, explanation, cat FROM pt_exercise_library ORDER BY cat, name'
      );
      res.status(200).json({ exercises: result.rows });
      return;
    }

    if (req.method === 'POST') {
      const { name, detail, freq, explanation, cat } = req.body || {};
      if (!name || !detail || !explanation || !['standing', 'floor', 'seated', 'head'].includes(cat)) {
        res.status(400).json({ error: 'Missing or invalid fields' });
        return;
      }
      const id = crypto.randomUUID();
      await client.query(
        'INSERT INTO pt_exercise_library (id, name, detail, freq, explanation, cat) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, name, detail, freq === 2 ? 2 : 1, explanation, cat]
      );
      res.status(201).json({ id, name, detail, freq: freq === 2 ? 2 : 1, explanation, cat });
      return;
    }

    if (req.method === 'PUT') {
      const { id, name, detail, freq, explanation, cat } = req.body || {};
      if (!id || !name || !detail || !explanation || !['standing', 'floor', 'seated', 'head'].includes(cat)) {
        res.status(400).json({ error: 'Missing or invalid fields' });
        return;
      }
      await client.query(
        'UPDATE pt_exercise_library SET name = $1, detail = $2, freq = $3, explanation = $4, cat = $5 WHERE id = $6',
        [name, detail, freq === 2 ? 2 : 1, explanation, cat, id]
      );
      res.status(200).json({ id, name, detail, freq: freq === 2 ? 2 : 1, explanation, cat });
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      await client.query('DELETE FROM pt_exercise_library WHERE id = $1', [id]);
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
