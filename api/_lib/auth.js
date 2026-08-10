const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

async function ensureAuthTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','admin','pt')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Links a client (role='user') to the PT who manages them. SET NULL on
  // delete so removing a PT account gracefully unassigns their clients
  // instead of blocking the delete.
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pt_id UUID REFERENCES users(id) ON DELETE SET NULL
  `);
}

async function createUser(client, { email, password, name, role }) {
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await client.query(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)',
    [id, email.toLowerCase().trim(), passwordHash, name, role]
  );
  return { id, email: email.toLowerCase().trim(), name, role };
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function createSession(client, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await client.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    expiresAt,
  ]);
  return token;
}

async function getSessionUser(client, req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const result = await client.query(
    `SELECT u.id, u.email, u.name, u.role, u.pt_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return result.rows[0] || null;
}

async function deleteSession(client, req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await client.query('DELETE FROM sessions WHERE token = $1', [token]);
}

module.exports = {
  ensureAuthTables,
  createUser,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
};
