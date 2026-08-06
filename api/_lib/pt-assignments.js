const crypto = require('crypto');

async function ensurePtAssignmentsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pt_assignments (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      library_id UUID NOT NULL REFERENCES pt_exercise_library(id) ON DELETE CASCADE,
      detail TEXT NOT NULL,
      freq INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, library_id)
    )
  `);
}

// Gives a user a starter program (a copy of the whole library) if they
// don't have any assignments yet - so nobody's Daily PT section is empty,
// whether they're a brand-new account or an existing one seeing this for
// the first time after the personalization feature shipped.
async function seedDefaultAssignmentsForUser(client, userId) {
  const existing = await client.query('SELECT id FROM pt_assignments WHERE user_id = $1 LIMIT 1', [userId]);
  if (existing.rows.length > 0) return;

  const library = await client.query('SELECT id, detail, freq FROM pt_exercise_library');
  for (const ex of library.rows) {
    await client.query(
      'INSERT INTO pt_assignments (id, user_id, library_id, detail, freq) VALUES ($1, $2, $3, $4, $5)',
      [crypto.randomUUID(), userId, ex.id, ex.detail, ex.freq]
    );
  }
}

module.exports = { ensurePtAssignmentsTable, seedDefaultAssignmentsForUser };
