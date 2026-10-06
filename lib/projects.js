'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, isDbEnabled } = require('./db');

/**
 * File layout (unchanged):
 *   data/projects/<id>/scenario.json   — full game JSON
 *   data/projects/<id>/project.json    — legacy mirror (optional write)
 *   data/projects/<id>/assets/
 */

function safeId(id) {
  return String(id || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function projectsRoot(dataDir) {
  return path.join(dataDir, 'projects');
}

function projectDir(dataDir, id) {
  return path.join(projectsRoot(dataDir), safeId(id));
}

function scenarioPath(dataDir, id) {
  return path.join(projectDir(dataDir, id), 'scenario.json');
}

function legacyProjectPath(dataDir, id) {
  return path.join(projectDir(dataDir, id), 'project.json');
}

function scenarioKey(id) {
  return `projects/${safeId(id)}/scenario.json`;
}

function ensureDirs(dataDir, id) {
  const pid = safeId(id);
  fs.mkdirSync(path.join(projectDir(dataDir, pid), 'assets'), { recursive: true });
  return pid;
}

function readScenarioFile(dataDir, id) {
  const sid = safeId(id);
  const sp = scenarioPath(dataDir, sid);
  if (fs.existsSync(sp)) {
    return JSON.parse(fs.readFileSync(sp, 'utf8'));
  }
  const lp = legacyProjectPath(dataDir, sid);
  if (fs.existsSync(lp)) {
    return JSON.parse(fs.readFileSync(lp, 'utf8'));
  }
  return null;
}

function writeScenarioFile(dataDir, id, body) {
  const sid = ensureDirs(dataDir, id);
  const payload = { ...body, id: sid };
  delete payload.owner_id;
  const text = JSON.stringify(payload, null, 2);
  fs.writeFileSync(scenarioPath(dataDir, sid), text, 'utf8');
  // legacy mirror for old tools
  fs.writeFileSync(legacyProjectPath(dataDir, sid), text, 'utf8');
  return sid;
}

function nodeCount(body) {
  return Array.isArray(body && body.nodes) ? body.nodes.length : 0;
}

async function listFromDb({ scope, userId, q }) {
  let sql =
    `SELECT p.id, p.title, p.description, p.cover_url AS coverUrl, p.published, p.node_count AS nodes, p.updated_at AS updatedAt,
            p.owner_id, u.display_name AS owner_name
     FROM projects p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE 1=1`;
  const params = {};
  if (scope === 'mine') {
    if (!userId) return [];
    sql += ' AND p.owner_id = :uid';
    params.uid = userId;
  } else {
    // public feed
    sql += ' AND p.published = 1';
  }
  if (q && String(q).trim()) {
    sql += ' AND (p.title LIKE :q OR IFNULL(p.description,\'\') LIKE :q)';
    params.q = '%' + String(q).trim().slice(0, 80) + '%';
  }
  sql += ' ORDER BY p.updated_at DESC LIMIT 200';
  const rows = await query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    coverUrl: r.coverUrl || '',
    published: !!r.published,
    nodes: r.nodes,
    updatedAt: r.updatedAt,
    owner_id: r.owner_id,
    owner_name: r.owner_name || null,
  }));
}

async function getMeta(id) {
  const rows = await query('SELECT * FROM projects WHERE id = :id LIMIT 1', { id: safeId(id) });
  return rows[0] || null;
}

async function canRead(id, user) {
  const meta = await getMeta(id);
  if (!meta) return { ok: false, meta: null };
  if (meta.published) return { ok: true, meta };
  if (user && meta.owner_id && Number(meta.owner_id) === Number(user.id)) return { ok: true, meta };
  return { ok: false, meta };
}

async function canWrite(id, user) {
  if (!user) return { ok: false, meta: null, reason: 'auth' };
  const meta = await getMeta(id);
  if (!meta) return { ok: true, meta: null }; // new project
  if (meta.owner_id == null) return { ok: true, meta }; // unclaimed (migrated)
  if (Number(meta.owner_id) === Number(user.id)) return { ok: true, meta };
  return { ok: false, meta, reason: 'forbidden' };
}

async function upsertProject(dataDir, body, user, { claimUnowned = true } = {}) {
  if (!isDbEnabled()) throw Object.assign(new Error('DB required'), { status: 503 });
  if (!user) throw Object.assign(new Error('Войдите в аккаунт'), { status: 401 });

  let id = safeId(body.id);
  if (!id) {
    id = crypto.randomBytes(4).toString('hex');
    while ((await getMeta(id)) || fs.existsSync(projectDir(dataDir, id))) {
      id = crypto.randomBytes(4).toString('hex');
    }
  }

  const access = await canWrite(id, user);
  if (!access.ok) {
    throw Object.assign(new Error('Нет прав на этот проект'), { status: 403 });
  }

  const title = String(body.title || id).slice(0, 255);
  const description = String(body.description || '').slice(0, 4000);
  const coverUrl = String(body.coverUrl || body.cover || '').slice(0, 1024);
  const published = body.published === true ? 1 : body.published === false ? 0 : access.meta ? (access.meta.published ? 1 : 0) : 0;
  const key = scenarioKey(id);
  const nodes = nodeCount(body);

  writeScenarioFile(dataDir, id, {
    ...body,
    id,
    title,
    description,
    coverUrl,
    published: !!published,
  });

  let ownerId = user.id;
  if (access.meta && access.meta.owner_id != null) {
    ownerId = access.meta.owner_id;
  } else if (access.meta && access.meta.owner_id == null && claimUnowned) {
    ownerId = user.id;
  }

  await query(
    `INSERT INTO projects (id, owner_id, title, description, cover_url, published, scenario_key, node_count)
     VALUES (:id, :owner_id, :title, :description, :cover_url, :published, :scenario_key, :node_count)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       description = VALUES(description),
       cover_url = VALUES(cover_url),
       published = VALUES(published),
       scenario_key = VALUES(scenario_key),
       node_count = VALUES(node_count),
       owner_id = IF(owner_id IS NULL, VALUES(owner_id), owner_id),
       updated_at = CURRENT_TIMESTAMP`,
    {
      id,
      owner_id: ownerId,
      title,
      description: description || null,
      cover_url: coverUrl || null,
      published,
      scenario_key: key,
      node_count: nodes,
    }
  );

  return { id, title, description, coverUrl, published: !!published, owner_id: ownerId };
}

async function loadProjectForApi(dataDir, id, user) {
  if (isDbEnabled()) {
    const { ok, meta } = await canRead(id, user);
    if (!meta && !readScenarioFile(dataDir, id)) {
      return null;
    }
    if (meta && !ok) {
      throw Object.assign(new Error('Черновик доступен только автору'), { status: 403 });
    }
    // file may exist without DB row (legacy) — allow read if published in file
    const data = readScenarioFile(dataDir, id);
    if (!data) return null;
    if (!meta) {
      if (data.published === false && !(user && false)) {
        // legacy unpublished without DB — only via file flag
        if (data.published === false) {
          throw Object.assign(new Error('Черновик'), { status: 403 });
        }
      }
    }
    return { ...data, id: safeId(id), published: meta ? !!meta.published : data.published !== false };
  }
  return readScenarioFile(dataDir, id);
}

async function importFilesToDb(dataDir, defaultOwnerId) {
  const root = projectsRoot(dataDir);
  if (!fs.existsSync(root)) return { imported: 0 };
  let imported = 0;
  for (const name of fs.readdirSync(root)) {
    const id = safeId(name);
    if (!id) continue;
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const data = readScenarioFile(dataDir, id);
    if (!data) continue;
    const existing = await getMeta(id);
    if (existing) continue;
    const published = data.published === false ? 0 : 1;
    writeScenarioFile(dataDir, id, { ...data, id, published: !!published });
    await query(
      `INSERT INTO projects (id, owner_id, title, description, cover_url, published, scenario_key, node_count)
       VALUES (:id, :owner_id, :title, :description, :cover_url, :published, :scenario_key, :node_count)`,
      {
        id,
        owner_id: defaultOwnerId || null,
        title: String(data.title || id).slice(0, 255),
        description: String(data.description || '').slice(0, 4000) || null,
        cover_url: String(data.coverUrl || data.cover || '').slice(0, 1024) || null,
        published,
        scenario_key: scenarioKey(id),
        node_count: nodeCount(data),
      }
    );
    imported++;
  }
  return { imported };
}

module.exports = {
  safeId,
  scenarioPath,
  scenarioKey,
  readScenarioFile,
  writeScenarioFile,
  listFromDb,
  getMeta,
  canRead,
  canWrite,
  upsertProject,
  loadProjectForApi,
  importFilesToDb,
  ensureDirs,
};
