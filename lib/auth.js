'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, isDbEnabled } = require('./db');

const COOKIE_NAME = 'vn_sid';
const BCRYPT_ROUNDS = 10;

function sessionDays() {
  return Math.max(1, Number(process.env.SESSION_DAYS) || 14);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function setSessionCookie(res, token, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 255) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

async function registerUser({ email, password, displayName }) {
  if (!isDbEnabled()) throw Object.assign(new Error('Auth unavailable'), { status: 503 });
  email = String(email || '').trim().toLowerCase();
  displayName = String(displayName || '').trim().slice(0, 120) || email.split('@')[0];
  if (!validateEmail(email)) throw Object.assign(new Error('Некорректный email'), { status: 400 });
  if (!validatePassword(password)) {
    throw Object.assign(new Error('Пароль: минимум 8 символов'), { status: 400 });
  }
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const result = await query(
      'INSERT INTO users (email, password_hash, display_name) VALUES (:email, :password_hash, :display_name)',
      { email, password_hash, display_name: displayName }
    );
    return { id: result.insertId, email, display_name: displayName };
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('Email уже зарегистрирован'), { status: 409 });
    }
    throw e;
  }
}

async function verifyLogin(email, password) {
  if (!isDbEnabled()) throw Object.assign(new Error('Auth unavailable'), { status: 503 });
  email = String(email || '').trim().toLowerCase();
  const rows = await query(
    'SELECT id, email, password_hash, display_name FROM users WHERE email = :email LIMIT 1',
    { email }
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Неверный email или пароль'), { status: 401 });
  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) throw Object.assign(new Error('Неверный email или пароль'), { status: 401 });
  return { id: user.id, email: user.email, display_name: user.display_name };
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const token_hash = hashToken(token);
  const days = sessionDays();
  const expires = new Date(Date.now() + days * 864e5);
  await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)',
    { user_id: userId, token_hash, expires_at: expires }
  );
  return { token, maxAgeSec: days * 86400, expires };
}

async function destroySession(token) {
  if (!token || !isDbEnabled()) return;
  await query('DELETE FROM sessions WHERE token_hash = :h', { h: hashToken(token) });
}

async function getUserFromRequest(req) {
  if (!isDbEnabled()) return null;
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const rows = await query(
    `SELECT u.id, u.email, u.display_name, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = :h
     LIMIT 1`,
    { h: hashToken(token) }
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE token_hash = :h', { h: hashToken(token) });
    return null;
  }
  return { id: row.id, email: row.email, display_name: row.display_name };
}

module.exports = {
  COOKIE_NAME,
  registerUser,
  verifyLogin,
  createSession,
  destroySession,
  getUserFromRequest,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
};
