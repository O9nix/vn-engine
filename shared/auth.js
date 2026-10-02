const crypto = require('crypto');

const AUTH_URL =
  process.env.AUTH_URL ||
  process.env.AUTH_ISSUER ||
  'http://127.0.0.1:8090';

const JWT_SECRET =
  process.env.AUTH_JWT_SECRET ||
  'dev-only-change-me-vn-auth-secret';

const ISSUER =
  process.env.AUTH_ISSUER ||
  AUTH_URL;

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url');
}

function verifyJwt(token) {
  const parts = String(token || '').split('.');

  if (parts.length !== 3) {
    throw new Error('invalid_token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  let header;
  let payload;

  try {
    header = JSON.parse(
      base64urlDecode(encodedHeader).toString('utf8')
    );

    payload = JSON.parse(
      base64urlDecode(encodedPayload).toString('utf8')
    );
  } catch (_) {
    throw new Error('invalid_token');
  }

  /*
   * Наш development auth-server выпускает именно HS256.
   */
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported JWT algorithm');
  }

  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  /*
   * timingSafeEqual требует одинаковую длину буферов.
   */
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('invalid_token');
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== ISSUER) {
    throw new Error('invalid_issuer');
  }

  if (!payload.exp || payload.exp <= now) {
    throw new Error('expired_token');
  }

  return payload;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    throw new Error('missing_token');
  }

  return header.slice(7).trim();
}

async function authenticate(req) {
  try {
    const token = getBearerToken(req);
    return verifyJwt(token);
  } catch (_) {
    return null;
  }
}

async function requireAuth(req) {
  const claims = verifyJwt(getBearerToken(req));

  return {
    userId: claims.sub,
    username: claims.preferred_username,
    roles: claims.roles || ['user'],
    claims
  };
}

function authUser(claims) {
  if (!claims) return null;

  return {
    userId: claims.sub,
    username: claims.preferred_username,
    roles: claims.roles || ['user'],
    claims
  };
}

function authHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  };
}

module.exports = {
  requireAuth,
  authenticate,
  authUser,
  authHeaders,
  issuer: ISSUER,
  verifyJwt
};