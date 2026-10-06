#!/usr/bin/env node
/**
 * VN Server — простой сервис для VN Studio
 *
 * - Статика: плеер + редактор
 * - Проекты: JSON сценарии (CRUD)
 * - Ассеты: загрузка картинок, отдача по относительным URL
 *
 * Запуск:  npm start
 *          node server.js
 * Порт:    PORT=3000 (по умолчанию 3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// .env должен грузиться ДО чтения process.env
const fsSync = fs;
const envPath = path.join(__dirname, '.env');
try {
  require('dotenv').config({ path: envPath });
  if (fsSync.existsSync(envPath)) {
    console.log('[env] loaded', envPath);
  } else {
    console.warn('[env] файл не найден:', envPath);
    console.warn('[env] скопируйте .env.example → .env и укажите DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  }
} catch (e) {
  console.warn('[env] dotenv не загружен:', e.message);
  console.warn('[env] выполните: npm install dotenv');
}

const { initDb, isDbEnabled, getDbStatus } = require('./lib/db');
const auth = require('./lib/auth');
const projectsLib = require('./lib/projects');


const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
// Legacy flat assets dir (migrated on startup)
const LEGACY_ASSETS = path.join(DATA, 'assets');

for (const dir of [PUBLIC, DATA, PROJECTS]) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Layout:
 *   data/projects/<id>/project.json
 *   data/projects/<id>/assets/<file>
 */
function projectDir(id) {
  return path.join(PROJECTS, safeId(id));
}
function projectJsonPath(id) {
  return path.join(projectDir(id), 'project.json');
}
function projectAssetsDir(id) {
  return path.join(projectDir(id), 'assets');
}
function ensureProjectDirs(id) {
  const pid = safeId(id);
  fs.mkdirSync(projectAssetsDir(pid), { recursive: true });
  return pid;
}
function assetPublicUrl(projectId, filename) {
  return `/assets/${safeId(projectId)}/${filename}`;
}
function resolveAssetFile(projectId, filename) {
  const safeName = path.basename(filename).replace(/\.\./g, '');
  return path.join(projectAssetsDir(projectId), safeName);
}

/** One-time migrate: data/projects/*.json + data/assets/<id>/ → new layout */
function migrateLegacyLayout() {
  if (!fs.existsSync(PROJECTS)) return;
  for (const name of fs.readdirSync(PROJECTS)) {
    const full = path.join(PROJECTS, name);
    // old: projects/foo.json
    if (name.endsWith('.json') && fs.statSync(full).isFile()) {
      const id = safeId(name.replace(/\.json$/, ''));
      if (!id) continue;
      ensureProjectDirs(id);
      const dest = projectJsonPath(id);
      if (!fs.existsSync(dest)) {
        fs.renameSync(full, dest);
        console.log('[migrate] project', id);
      } else {
        fs.unlinkSync(full);
      }
    }
  }
  if (fs.existsSync(LEGACY_ASSETS)) {
    for (const id of fs.readdirSync(LEGACY_ASSETS)) {
      const srcDir = path.join(LEGACY_ASSETS, id);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      const pid = safeId(id);
      ensureProjectDirs(pid);
      const destDir = projectAssetsDir(pid);
      for (const f of fs.readdirSync(srcDir)) {
        const from = path.join(srcDir, f);
        const to = path.join(destDir, f);
        if (fs.statSync(from).isFile() && !fs.existsSync(to)) {
          fs.renameSync(from, to);
        }
      }
      try { fs.rmSync(srcDir, { recursive: true, force: true }); } catch (_) {}
      console.log('[migrate] assets', pid);
    }
    try {
      if (fs.readdirSync(LEGACY_ASSETS).length === 0) fs.rmdirSync(LEGACY_ASSETS);
    } catch (_) {}
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  const data = body == null ? '' : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    'Content-Length': data.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(data);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Very small multipart parser for single file field "file" + optional "projectId" */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('No multipart boundary');
  const boundary = m[1] || m[2];
  const parts = buf.toString('binary').split('--' + boundary);
  const fields = {};
  let file = null;

  for (const part of parts) {
    if (part === '--' || part === '--\r\n' || part.trim() === '') continue;
    const sep = part.indexOf('\r\n\r\n');
    if (sep < 0) continue;
    const head = part.slice(0, sep);
    let body = part.slice(sep + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);

    const nameMatch = /name="([^"]+)"/i.exec(head);
    const fileMatch = /filename="([^"]*)"/i.exec(head);
    const name = nameMatch ? nameMatch[1] : null;
    if (!name) continue;

    if (fileMatch) {
      const filename = path.basename(fileMatch[1] || 'upload.bin');
      const ctypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(head);
      file = {
        field: name,
        filename,
        contentType: ctypeMatch ? ctypeMatch[1].trim() : 'application/octet-stream',
        data: Buffer.from(body, 'binary'),
      };
    } else {
      fields[name] = Buffer.from(body, 'binary').toString('utf8');
    }
  }
  return { fields, file };
}


function resolvePublishedFlag(id, body) {
  if (body && typeof body.published === 'boolean') return body.published;
  try {
    const fp = projectPath(id);
    if (fs.existsSync(fp)) {
      const prev = JSON.parse(fs.readFileSync(fp, 'utf8'));
      // старые проекты без поля считаем опубликованными
      if (typeof prev.published === 'boolean') return prev.published;
      return true;
    }
  } catch (_) {}
  return false;
}

function listProjects() {
  if (!fs.existsSync(PROJECTS)) return [];
  return fs
    .readdirSync(PROJECTS)
    .filter((id) => {
      try {
        return fs.statSync(path.join(PROJECTS, id)).isDirectory() && fs.existsSync(projectJsonPath(id));
      } catch {
        return false;
      }
    })
    .map((id) => {
      try {
        const raw = JSON.parse(fs.readFileSync(projectJsonPath(id), 'utf8'));
        return {
          id,
          title: raw.title || id,
          updatedAt: raw.updatedAt || null,
          published: raw.published !== false,
          nodes: Array.isArray(raw.nodes) ? raw.nodes.length : 0,
        };
      } catch {
        return { id, title: id, updatedAt: null, nodes: 0 };
      }
    })
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function projectPath(id) {
  return projectJsonPath(id);
}

function serveStatic(req, res, filePath) {
  const resolved = path.resolve(filePath);
  const allowed =
    resolved.startsWith(path.resolve(PUBLIC)) ||
    resolved.startsWith(path.resolve(PROJECTS));
  if (!allowed) {
    return send(res, 403, 'Forbidden');
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    return send(res, 404, 'Not found');
  }
  const ext = path.extname(resolved).toLowerCase();
  const data = fs.readFileSync(resolved);
  send(res, 200, data, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext.match(/\.(png|jpe?g|gif|webp|svg)$/) ? 'public, max-age=86400' : 'no-cache',
  });
}

async function handler(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  // ---- API ----
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      time: new Date().toISOString(),
      authEnabled: isDbEnabled(),
      db: getDbStatus(),
    });
  }

  // ---- Auth API (MariaDB; disabled if DB_HOST not set) ----
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    if (!isDbEnabled()) {
      const st = getDbStatus();
      const hint = st.lastError || 'Создайте .env с DB_HOST, DB_USER, DB_PASSWORD, DB_NAME';
      return sendJson(res, 503, { error: 'Auth недоступен: ' + hint });
    }
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const user = await auth.registerUser({
        email: body.email,
        password: body.password,
        displayName: body.display_name || body.displayName,
      });
      const session = await auth.createSession(user.id);
      auth.setSessionCookie(res, session.token, session.maxAgeSec);
      return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email, display_name: user.display_name } });
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message || 'register failed' });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    if (!isDbEnabled()) {
      const st = getDbStatus();
      const hint = st.lastError || 'Создайте .env с DB_HOST, DB_USER, DB_PASSWORD, DB_NAME';
      return sendJson(res, 503, { error: 'Auth недоступен: ' + hint });
    }
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const user = await auth.verifyLogin(body.email, body.password);
      const session = await auth.createSession(user.id);
      auth.setSessionCookie(res, session.token, session.maxAgeSec);
      return sendJson(res, 200, { ok: true, user });
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message || 'login failed' });
    }
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    try {
      const cookies = auth.parseCookies(req);
      await auth.destroySession(cookies[auth.COOKIE_NAME]);
    } catch (_) {}
    auth.clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    if (!isDbEnabled()) return sendJson(res, 200, { ok: true, user: null, authEnabled: false });
    try {
      const user = await auth.getUserFromRequest(req);
      return sendJson(res, 200, { ok: true, user, authEnabled: true });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }


  if (pathname === '/api/projects' && req.method === 'GET') {
    const scope = url.searchParams.get('scope') || 'public';
    const q = url.searchParams.get('q') || '';
    try {
      if (isDbEnabled()) {
        const user = await auth.getUserFromRequest(req);
        if (scope === 'mine') {
          if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт' });
          const projects = await projectsLib.listFromDb({ scope: 'mine', userId: user.id, q });
          return sendJson(res, 200, { projects, scope: 'mine' });
        }
        const projects = await projectsLib.listFromDb({ scope: 'public', q });
        return sendJson(res, 200, { projects, scope: 'public' });
      }
      return sendJson(res, 200, { projects: listProjects(), scope: 'files' });
    } catch (e) {
      return sendJson(res, e.status || 500, { error: e.message });
    }
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      if (isDbEnabled()) {
        const user = await auth.getUserFromRequest(req);
        if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт, чтобы сохранять проекты' });
        const result = await projectsLib.upsertProject(DATA, body, user);
        return sendJson(res, 200, {
          ok: true,
          id: result.id,
          published: result.published,
          url: `/play/${result.id}`,
          api: `/api/projects/${result.id}`,
        });
      }
      // fallback: file-only mode (no auth)
      let id = safeId(body.id) || crypto.randomBytes(4).toString('hex');
      if (!safeId(body.id)) {
        while (fs.existsSync(projectPath(id))) id = crypto.randomBytes(4).toString('hex');
      }
      const project = {
        id,
        title: body.title || id,
        updatedAt: new Date().toISOString(),
        version: body.version || 2,
        published: resolvePublishedFlag(id, body),
        variables: body.variables || [],
        assets: body.assets || [],
        assetFolders: body.assetFolders || [],
        scenes: body.scenes || [],
        nodes: body.nodes || [],
      };
      ensureProjectDirs(id);
      fs.writeFileSync(projectPath(id), JSON.stringify(project, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true, id, url: `/play/${id}`, api: `/api/projects/${id}` });
    } catch (e) {
      return sendJson(res, e.status || 400, { ok: false, error: e.message });
    }
  }

  const projMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projMatch) {
    const id = safeId(projMatch[1]);
    if (req.method === 'GET') {
      try {
        if (isDbEnabled()) {
          const user = await auth.getUserFromRequest(req);
          const data = await projectsLib.loadProjectForApi(DATA, id, user);
          if (!data) return sendJson(res, 404, { error: 'Not found' });
          return sendJson(res, 200, data);
        }
        const fp = projectPath(id);
        if (!fs.existsSync(fp)) return sendJson(res, 404, { error: 'Not found' });
        return send(res, 200, fs.readFileSync(fp), { 'Content-Type': 'application/json; charset=utf-8' });
      } catch (e) {
        return sendJson(res, e.status || 500, { error: e.message });
      }
    }
    if (req.method === 'PUT') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw.toString('utf8') || '{}');
        body.id = id;
        if (isDbEnabled()) {
          const user = await auth.getUserFromRequest(req);
          if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт' });
          const result = await projectsLib.upsertProject(DATA, body, user);
          return sendJson(res, 200, { ok: true, id: result.id, published: result.published });
        }
        const fp = projectPath(id);
        const project = {
          id,
          title: body.title || id,
          updatedAt: new Date().toISOString(),
          version: body.version || 2,
          published: resolvePublishedFlag(id, body),
          variables: body.variables || [],
          assets: body.assets || [],
          assetFolders: body.assetFolders || [],
          scenes: body.scenes || [],
          nodes: body.nodes || [],
        };
        ensureProjectDirs(id);
        fs.writeFileSync(fp, JSON.stringify(project, null, 2), 'utf8');
        return sendJson(res, 200, { ok: true, id });
      } catch (e) {
        return sendJson(res, e.status || 400, { ok: false, error: e.message });
      }
    }
    if (req.method === 'DELETE') {
      try {
        if (isDbEnabled()) {
          const user = await auth.getUserFromRequest(req);
          if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт' });
          const access = await projectsLib.canWrite(id, user);
          if (!access.ok) return sendJson(res, 403, { error: 'Нет прав' });
          await require('./lib/db').query('DELETE FROM projects WHERE id = :id', { id });
        }
        const dir = projectDir(id);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, e.status || 500, { error: e.message });
      }
    }
  }


  // Download remote URL into project assets
  if (pathname === '/api/assets/fetch' && req.method === 'POST') {
    try {
      if (isDbEnabled()) {
        const user = await auth.getUserFromRequest(req);
        if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт' });
      }
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      let projectId = safeId(body.projectId || url.searchParams.get('projectId') || 'common');
      if (!projectId) return sendJson(res, 400, { error: 'projectId required' });
      if (isDbEnabled()) {
        const user = await auth.getUserFromRequest(req);
        if (user) {
          const access = await projectsLib.canWrite(projectId, user);
          if (!access.ok) return sendJson(res, 403, { error: 'Нет прав' });
        }
      }
      const remoteUrl = String(body.url || '').trim();
      if (!/^https?:\/\//i.test(remoteUrl)) {
        return sendJson(res, 400, { error: 'Нужен http(s) URL' });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let remoteRes;
      try {
        remoteRes = await fetch(remoteUrl, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'VN-Studio-AssetFetcher/1.0',
            Accept: '*/*',
          },
        });
      } finally {
        clearTimeout(timer);
      }
      if (!remoteRes.ok) {
        return sendJson(res, 400, {
          error: `Удалённый сервер ответил ${remoteRes.status}`,
          status: remoteRes.status,
          url: remoteUrl,
        });
      }
      const arr = Buffer.from(await remoteRes.arrayBuffer());
      if (!arr.length) return sendJson(res, 400, { error: 'Пустой файл', url: remoteUrl });
      if (arr.length > 25 * 1024 * 1024) {
        return sendJson(res, 400, { error: 'Файл больше 25 МБ', url: remoteUrl });
      }
      let contentType = (remoteRes.headers.get('content-type') || '').split(';')[0].trim();
      let ext = path.extname(new URL(remoteUrl).pathname).toLowerCase();
      if (!ext || ext.length > 6) ext = guessExt(contentType);
      if (!ext || ext === '.bin') {
        // try from URL path segments
        if (/\.ogg(\?|$)/i.test(remoteUrl)) ext = '.ogg';
        else if (/\.mp3(\?|$)/i.test(remoteUrl)) ext = '.mp3';
        else if (/\.png(\?|$)/i.test(remoteUrl)) ext = '.png';
        else if (/\.jpe?g(\?|$)/i.test(remoteUrl)) ext = '.jpg';
        else if (/\.webp(\?|$)/i.test(remoteUrl)) ext = '.webp';
        else if (/\.gif(\?|$)/i.test(remoteUrl)) ext = '.gif';
        else if (/\.wav(\?|$)/i.test(remoteUrl)) ext = '.wav';
      }
      const base = String(body.name || path.basename(new URL(remoteUrl).pathname) || 'asset')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 40) || 'asset';
      const filename = `${base}_${Date.now().toString(36)}${ext || '.bin'}`;
      ensureProjectDirs(projectId);
      const dir = projectAssetsDir(projectId);
      fs.writeFileSync(path.join(dir, filename), arr);
      const rel = assetPublicUrl(projectId, filename);
      return sendJson(res, 200, {
        ok: true,
        url: rel,
        name: filename,
        size: arr.length,
        contentType: contentType || null,
        source: remoteUrl,
      });
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Таймаут загрузки (20с)' : (e.message || 'fetch failed');
      return sendJson(res, 400, { error: msg, url: null });
    }
  }

  // Upload asset: POST /api/assets?projectId=xxx  multipart field "file"
  if (pathname === '/api/assets' && req.method === 'POST') {
    try {
      const ctype = req.headers['content-type'] || '';
      const buf = await readBody(req);
      let projectId = safeId(url.searchParams.get('projectId') || 'common');
      let filename;
      let data;
      let contentType = 'application/octet-stream';

      if (ctype.includes('multipart/form-data')) {
        const { fields, file } = parseMultipart(buf, ctype);
        if (fields.projectId) projectId = safeId(fields.projectId) || projectId;
        if (!file) return sendJson(res, 400, { error: 'file field required' });
        data = file.data;
        contentType = file.contentType;
        const ext = path.extname(file.filename).toLowerCase() || guessExt(contentType);
        filename = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}${ext}`;
      } else if (ctype.includes('application/json')) {
        // { projectId, name, dataUrl } — data URL from editor
        const body = JSON.parse(buf.toString('utf8'));
        projectId = safeId(body.projectId || projectId) || 'common';
        const dataUrl = body.dataUrl || body.src || '';
        const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
        if (!m) return sendJson(res, 400, { error: 'dataUrl required' });
        contentType = m[1];
        data = Buffer.from(m[2], 'base64');
        const ext = path.extname(body.name || '').toLowerCase() || guessExt(contentType);
        filename = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}${ext}`;
      } else {
        return sendJson(res, 400, { error: 'Use multipart/form-data or JSON dataUrl' });
      }

      if (!contentType.startsWith('image/') && !contentType.startsWith('audio/')) {
        return sendJson(res, 400, { error: 'Only images or audio allowed' });
      }

      if (isDbEnabled()) {
        const user = await auth.getUserFromRequest(req);
        if (!user) return sendJson(res, 401, { error: 'Войдите в аккаунт' });
        const access = await projectsLib.canWrite(projectId, user);
        if (!access.ok) return sendJson(res, 403, { error: 'Нет прав на загрузку в этот проект' });
      }
      ensureProjectDirs(projectId);
      const dir = projectAssetsDir(projectId);
      fs.writeFileSync(path.join(dir, filename), data);
      const rel = assetPublicUrl(projectId, filename);
      return sendJson(res, 200, {
        ok: true,
        url: rel,
        projectId,
        filename,
        size: data.length,
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  // List assets for project
  const assetsList = pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetsList && req.method === 'GET') {
    const id = safeId(assetsList[1]);
    const dir = projectAssetsDir(id);
    if (!fs.existsSync(dir)) return sendJson(res, 200, { assets: [] });
    const assets = fs.readdirSync(dir).map((f) => ({
      name: f,
      url: assetPublicUrl(id, f),
      size: fs.statSync(path.join(dir, f)).size,
    }));
    return sendJson(res, 200, { assets });
  }

  // ---- Play page: inject project JSON ----
  const playMatch = pathname.match(/^\/play\/([^/]+)\/?$/);
  if (playMatch && req.method === 'GET') {
    const id = safeId(playMatch[1]);
    const fp = projectPath(id);
    let projectRaw = null;
    let projectObj = {};
    // prefer scenario.json
    const scenarioFile = path.join(projectDir(id), 'scenario.json');
    if (fs.existsSync(scenarioFile)) {
      projectRaw = fs.readFileSync(scenarioFile, 'utf8');
    } else if (fs.existsSync(fp)) {
      projectRaw = fs.readFileSync(fp, 'utf8');
    } else {
      return send(res, 404, 'Project not found');
    }
    try { projectObj = JSON.parse(projectRaw); } catch (_) {}
    if (isDbEnabled()) {
      try {
        const meta = await projectsLib.getMeta(id);
        if (meta) {
          projectObj.published = !!meta.published;
          if (!meta.published) {
            const user = await auth.getUserFromRequest(req);
            if (!user || Number(user.id) !== Number(meta.owner_id)) {
              projectObj.published = false;
            } else {
              // owner may preview via /play even draft? keep gate for public play
              projectObj.published = false;
            }
          }
        }
      } catch (_) {}
    }
    if (projectObj.published === false) {
      const msg = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Черновик</title>
<style>body{font-family:system-ui;background:#161221;color:#efe7d6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{max-width:420px;padding:28px;border:1px solid #3a3153;border-radius:12px;background:#1f1a2e;text-align:center}
a{color:#c9a24b}</style></head><body><div class="box">
<h1 style="font-family:Georgia,serif;font-style:italic;color:#b0658a;font-weight:normal">Ещё не опубликовано</h1>
<p>Проект «${(projectObj.title||id).replace(/</g,'')}» сохранён как черновик. Нажмите «Опубликовать» в редакторе, чтобы открыть публичную ссылку.</p>
<p><a href="/editor?id=${encodeURIComponent(id)}">Открыть редактор</a> · <a href="/">На главную</a></p>
</div></body></html>`;
      return send(res, 200, msg, { 'Content-Type': 'text/html; charset=utf-8' });
    }
    const project = projectRaw;
    let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    // inject auto-load of project after engine script boots
    // Flag early so demo boot skips; then load project after scripts
    html = html.replace(
      '<head>',
      `<head><script>window.__VN_PROJECT_ID__=${JSON.stringify(id)};window.__VN_PROJECT__=${project};</script>`
    );
    const inject = `
<script>
(function(){
  function boot(){
    if (typeof startGame === 'function' && window.__VN_PROJECT__) {
      startGame(window.__VN_PROJECT__);
    } else {
      setTimeout(boot, 30);
    }
  }
  boot();
})();
</script>
</body>`;
    if (html.includes('</body>')) html = html.replace('</body>', inject);
    else html += inject;
    return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
  }


  // Alias: /projects/:id/assets/:file
  const projAsset = pathname.match(/^\/projects\/([^/]+)\/assets\/(.+)$/);
  if (projAsset && req.method === 'GET') {
    const filePath = resolveAssetFile(projAsset[1], projAsset[2]);
    return serveStatic(req, res, filePath);
  }

  // ---- Static assets: /assets/:projectId/:file → data/projects/:id/assets/:file ----
  if (pathname.startsWith('/assets/')) {
    const rel = pathname.replace(/^\/assets\//, '');
    const parts = rel.split('/').filter(Boolean).map((p) => p.replace(/\.\./g, ''));
    if (parts.length < 2) return send(res, 404, 'Not found');
    const [pid, ...rest] = parts;
    const filePath = resolveAssetFile(pid, rest.join('/'));
    return serveStatic(req, res, filePath);
  }

  // ---- Public static ----
  if (pathname === '/' || pathname === '/home' || pathname === '/home.html') {
    return serveStatic(req, res, path.join(PUBLIC, 'home.html'));
  }
  if (pathname === '/login' || pathname === '/login.html') {
    return serveStatic(req, res, path.join(PUBLIC, 'login.html'));
  }
  if (pathname === '/register' || pathname === '/register.html') {
    return serveStatic(req, res, path.join(PUBLIC, 'register.html'));
  }
  if (pathname === '/studio' || pathname === '/index.html') {
    return serveStatic(req, res, path.join(PUBLIC, 'index.html'));
  }
  if (pathname === '/editor' || pathname === '/editor.html') {
    if (isDbEnabled()) {
      const user = await auth.getUserFromRequest(req);
      if (!user) {
        const next = encodeURIComponent(req.url || '/editor');
        res.writeHead(302, { Location: '/login?next=' + next, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Login required');
        return;
      }
    }
    return serveStatic(req, res, path.join(PUBLIC, 'editor.html'));
  }

  // fallback public file
  const pubFile = path.join(PUBLIC, pathname.replace(/^\//, ''));
  if (fs.existsSync(pubFile) && fs.statSync(pubFile).isFile()) {
    return serveStatic(req, res, pubFile);
  }

  sendJson(res, 404, { error: 'Not found', path: pathname });
}

function guessExt(ctype) {
  if (!ctype) return '.bin';
  if (ctype.includes('png')) return '.png';
  if (ctype.includes('jpeg') || ctype.includes('jpg')) return '.jpg';
  if (ctype.includes('gif')) return '.gif';
  if (ctype.includes('webp')) return '.webp';
  if (ctype.includes('svg')) return '.svg';
  return '.bin';
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((e) => {
    console.error(e);
    sendJson(res, 500, { error: e.message || 'Server error' });
  });
});

migrateLegacyLayout();

(async () => {
  await initDb();
  server.listen(PORT, () => {
    console.log(`VN Server http://localhost:${PORT}`);
    console.log(`  Data:    data/projects/<id>/project.json + assets/`);
    console.log(`  Home:    http://localhost:${PORT}/`);
    console.log(`  Editor:  http://localhost:${PORT}/editor`);
    console.log(`  Studio:  http://localhost:${PORT}/studio`);
    console.log(`  Play:    http://localhost:${PORT}/play/<projectId>`);
    console.log(`  Login:   http://localhost:${PORT}/login`);
    console.log(`  API:     http://localhost:${PORT}/api/projects`);
    console.log(`  Auth:    ${isDbEnabled() ? 'ON (MariaDB)' : 'OFF — set DB_HOST in .env'}`);
    console.log(`  Assets:  POST http://localhost:${PORT}/api/assets`);
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
