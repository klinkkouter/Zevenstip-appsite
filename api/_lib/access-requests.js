async function ensureAccessRequestsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT,
      handled BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

module.exports = { ensureAccessRequestsTable };
