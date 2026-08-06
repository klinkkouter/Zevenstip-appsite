const crypto = require('crypto');

// The 12 PT exercises that were hardcoded in pt/index.html before the
// library existed - seeded once so nothing is lost when this table is
// first created. Explanations copied from the original EXPLANATIONS map.
const DEFAULT_EXERCISES = [
  { name: 'Side-lying adduction (R, ankle weight)', detail: '2 × 15', freq: 1, cat: 'floor',
    explanation: 'Lying on your side, top leg bent forward, lift your bottom leg up to meet it.' },
  { name: 'Clamshells (bilateral)', detail: '1 × 30', freq: 1, cat: 'floor',
    explanation: 'Lying on your side with knees bent and feet together, open your top knee like a book.' },
  { name: 'Offset glute bridge (bilateral)', detail: '2 × 10', freq: 1, cat: 'floor',
    explanation: 'Lie on your back, knees bent, and lift your hips toward the ceiling.' },
  { name: 'Toega (alternating, bilateral)', detail: '1 × 10', freq: 1, cat: 'seated',
    explanation: 'Lift your big toe while pressing the other four down flat.' },
  { name: 'Standing arch doming (bilateral)', detail: '5s hold × 15', freq: 2, cat: 'standing',
    explanation: 'Without curling your toes, lift your arch to shorten your foot.' },
  { name: 'Big toe abduction (bilateral)', detail: '1 × 15', freq: 1, cat: 'seated',
    explanation: 'Pull your big toe away from the other toes, sideways.' },
  { name: 'Cervical extension SNAGs', detail: '× 10', freq: 1, cat: 'head',
    explanation: 'Gently tip your chin up and back.' },
  { name: 'Cervical rotation SNAGs', detail: '× 10 each side', freq: 1, cat: 'head',
    explanation: 'Slowly turn your head to look over one shoulder.' },
  { name: 'Upper trap stretch', detail: '3 × 30s hold', freq: 1, cat: 'head',
    explanation: 'Tilt your ear toward your shoulder while the other shoulder drops down.' },
  { name: 'Chin tuck', detail: '3s hold × 15', freq: 1, cat: 'head',
    explanation: 'Draw your chin straight back, like making a "double chin".' },
  { name: 'Triple extension wall drill', detail: '5 × 6', freq: 1, cat: 'standing',
    explanation: 'Hands on the wall, drive one knee up and down explosively.' },
  { name: 'Banded lateral leg pull (ankle band)', detail: '2 × 15 each side', freq: 1, cat: 'standing',
    explanation: 'Band anchored to your side and looped around your ankle, pull that leg out sideways against the resistance.' },
];

async function ensureExerciseLibraryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pt_exercise_library (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      freq INTEGER NOT NULL DEFAULT 1,
      explanation TEXT NOT NULL DEFAULT '',
      cat TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Migration: earlier version of this table used a 'pose' column (a
  // symbolic key) instead of free-text 'explanation'. Rename it in place
  // so existing rows survive, rather than losing them.
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pt_exercise_library' AND column_name = 'pose'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pt_exercise_library' AND column_name = 'explanation'
      ) THEN
        ALTER TABLE pt_exercise_library RENAME COLUMN pose TO explanation;
      END IF;
    END $$;
  `);

  const existing = await client.query('SELECT id FROM pt_exercise_library LIMIT 1');
  if (existing.rows.length === 0) {
    for (const ex of DEFAULT_EXERCISES) {
      await client.query(
        'INSERT INTO pt_exercise_library (id, name, detail, freq, explanation, cat) VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), ex.name, ex.detail, ex.freq, ex.explanation, ex.cat]
      );
    }
  }
}

module.exports = { ensureExerciseLibraryTable };
