const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HOST = process.env.AUTH_HOST || '0.0.0.0';
const PORT = Number(process.env.AUTH_PORT || 8090);
const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-only-change-me-vn-auth-secret';
const ISSUER = process.env.AUTH_ISSUER || `http://127.0.0.1:${PORT}`;
const ACCESS_TTL = Number(process.env.AUTH_ACCESS_TTL || 15 * 60);
const REFRESH_TTL = Number(process.env.AUTH_REFRESH_TTL || 30 * 24 * 60 * 60);
const CORS_ORIGIN = process.env.AUTH_CORS_ORIGIN || '*';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

let users = readJson(USERS_FILE, []);
let sessions = readJson(SESSIONS_FILE, []);

function saveUsers() { writeJson(USERS_FILE, users); }
function saveSessions() { writeJson(SESSIONS_FILE, sessions); }

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}
function signJwt(header, payload) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(input).digest('base64url');
  return `${input}.${signature}`;
}
function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_token');
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('invalid_token');
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('invalid_token');
  if (payload.iss !== ISSUER) throw new Error('invalid_issuer');
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('expired_token');
  return payload;
}

function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: 'HS256', typ: 'JWT' },
    {
      iss: ISSUER,
      sub: user.id,
      preferred_username: user.username,
      roles: user.roles || ['user'],
      iat: now,
      exp: now + ACCESS_TTL
    }
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `${salt}:${derived}`;
}
function verifyPassword(password, stored) {
  const [salt, expectedHex] = String(stored).split(':');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function sanitizeUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName, roles: user.roles || ['user'], createdAt: user.createdAt };
}
function newId(prefix) { return `${prefix}_${crypto.randomBytes(12).toString('hex')}`; }
function newRefreshToken() { return crypto.randomBytes(48).toString('base64url'); }

function issueTokens(user) {
  const refreshToken = newRefreshToken();
  const now = Date.now();
  sessions.push({ token: refreshToken, userId: user.id, createdAt: now, expiresAt: now + REFRESH_TTL * 1000 });
  saveSessions();
  return { accessToken: createAccessToken(user), tokenType: 'Bearer', expiresIn: ACCESS_TTL, refreshToken };
}

function authUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new Error('missing_token');
  return verifyJwt(header.slice(7));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) { reject(new Error('body_too_large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}
function validUsername(username) { return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username); }
function validPassword(password) { return typeof password === 'string' && password.length >= 6 && password.length <= 200; }

async function handle(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'vn-auth-service', issuer: ISSUER, time: new Date().toISOString() });
  }

  if (req.method === 'GET' && pathname === '/.well-known/openid-configuration') {
    return json(res, 200, {
      issuer: ISSUER,
      token_endpoint: `${ISSUER}/api/auth/token`,
      userinfo_endpoint: `${ISSUER}/api/auth/me`,
      authorization_endpoint: null,
      jwks_uri: null,
      grant_types_supported: ['password', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none']
    });
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const password = body.password;
    const displayName = String(body.displayName || username).trim().slice(0, 80);
    if (!validUsername(username)) return json(res, 400, { error: 'invalid_username', message: 'Username: 3-32 символа, латиница, цифры, ., _, -.' });
    if (!validPassword(password)) return json(res, 400, { error: 'invalid_password', message: 'Пароль должен содержать минимум 6 символов.' });
    if (users.some(u => u.username === username)) return json(res, 409, { error: 'user_exists', message: 'Пользователь уже существует.' });
    const user = { id: newId('usr'), username, displayName, passwordHash: hashPassword(password), roles: ['user'], createdAt: new Date().toISOString() };
    users.push(user); saveUsers();
    return json(res, 201, { user: sanitizeUser(user), ...issueTokens(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const user = users.find(u => u.username === username);
    if (!user || !verifyPassword(String(body.password || ''), user.passwordHash)) return json(res, 401, { error: 'invalid_credentials', message: 'Неверный логин или пароль.' });
    return json(res, 200, { user: sanitizeUser(user), ...issueTokens(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/refresh') {
    const body = await readBody(req);
    const session = sessions.find(s => s.token === body.refreshToken);
    if (!session || session.expiresAt <= Date.now()) return json(res, 401, { error: 'invalid_refresh_token' });
    const user = users.find(u => u.id === session.userId);
    if (!user) return json(res, 401, { error: 'user_not_found' });
    sessions = sessions.filter(s => s.token !== session.token); saveSessions();
    return json(res, 200, { user: sanitizeUser(user), ...issueTokens(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const body = await readBody(req);
    if (body.refreshToken) { sessions = sessions.filter(s => s.token !== body.refreshToken); saveSessions(); }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    try {
      const claims = authUser(req);
      const user = users.find(u => u.id === claims.sub);
      if (!user) return json(res, 401, { error: 'user_not_found' });
      return json(res, 200, { user: sanitizeUser(user), claims });
    } catch (err) {
      return json(res, 401, { error: err.message || 'unauthorized' });
    }
  }

  return json(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'internal_error', message: err.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`VN Auth Service: ${ISSUER}`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Data: ${DATA_DIR}`);
  if (JWT_SECRET.startsWith('dev-only')) console.warn('WARNING: using development JWT secret. Set AUTH_JWT_SECRET before any shared/network deployment.');
});
