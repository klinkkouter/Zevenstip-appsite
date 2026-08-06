const { getPool } = require('./_lib/db');
const { ensureAuthTables, getSessionUser } = require('./_lib/auth');
const { ensureExerciseLibraryTable } = require('./_lib/exercise-library');
const { ensurePtAssignmentsTable, seedDefaultAssignmentsForUser } = require('./_lib/pt-assignments');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const client = await getPool().connect();
  try {
    await ensureAuthTables(client);
    await ensureExerciseLibraryTable(client);
    await ensurePtAssignmentsTable(client);

    const sessionUser = await getSessionUser(client, req);
    if (!sessionUser) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }

    await seedDefaultAssignmentsForUser(client, sessionUser.id);

    const result = await client.query(
      `SELECT a.id, a.detail, a.freq, l.name, l.explanation, l.cat
       FROM pt_assignments a
       JOIN pt_exercise_library l ON l.id = a.library_id
       WHERE a.user_id = $1
       ORDER BY a.created_at`,
      [sessionUser.id]
    );
    res.status(200).json({ exercises: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};
