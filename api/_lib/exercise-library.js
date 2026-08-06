const crypto = require('crypto');

// The 12 PT exercises that were hardcoded in pt/index.html before the
// library existed - seeded once so nothing is lost when this table is
// first created.
const DEFAULT_EXERCISES = [
  { name: 'Side-lying adduction (R, ankle weight)', detail: '2 × 15', freq: 1, pose: 'side_adduction', cat: 'floor' },
  { name: 'Clamshells (bilateral)', detail: '1 × 30', freq: 1, pose: 'clamshell', cat: 'floor' },
  { name: 'Offset glute bridge (bilateral)', detail: '2 × 10', freq: 1, pose: 'bridge', cat: 'floor' },
  { name: 'Toega (alternating, bilateral)', detail: '1 × 10', freq: 1, pose: 'foot_toega', cat: 'seated' },
  { name: 'Standing arch doming (bilateral)', detail: '5s hold × 15', freq: 2, pose: 'foot_arch_dome', cat: 'standing' },
  { name: 'Big toe abduction (bilateral)', detail: '1 × 15', freq: 1, pose: 'foot_big_toe_abd', cat: 'seated' },
  { name: 'Cervical extension SNAGs', detail: '× 10', freq: 1, pose: 'neck_cerv_extension', cat: 'head' },
  { name: 'Cervical rotation SNAGs', detail: '× 10 each side', freq: 1, pose: 'neck_cerv_rotation', cat: 'head' },
  { name: 'Upper trap stretch', detail: '3 × 30s hold', freq: 1, pose: 'neck_upper_trap', cat: 'head' },
  { name: 'Chin tuck', detail: '3s hold × 15', freq: 1, pose: 'neck_chin_tuck', cat: 'head' },
  { name: 'Triple extension wall drill', detail: '5 × 6', freq: 1, pose: 'wall_drill', cat: 'standing' },
  { name: 'Banded lateral leg pull (ankle band)', detail: '2 × 15 each side', freq: 1, pose: 'band_hip_abduction', cat: 'standing' },
];

async function ensureExerciseLibraryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pt_exercise_library (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      freq INTEGER NOT NULL DEFAULT 1,
      pose TEXT NOT NULL,
      cat TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const existing = await client.query('SELECT id FROM pt_exercise_library LIMIT 1');
  if (existing.rows.length === 0) {
    for (const ex of DEFAULT_EXERCISES) {
      await client.query(
        'INSERT INTO pt_exercise_library (id, name, detail, freq, pose, cat) VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), ex.name, ex.detail, ex.freq, ex.pose, ex.cat]
      );
    }
  }
}

module.exports = { ensureExerciseLibraryTable };
