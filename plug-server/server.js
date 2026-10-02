const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  requireAuth,
  authenticate,
  authUser,
  authHeaders,
  issuer
} = require('../shared/auth');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const PLUGINS = path.join(DATA, 'plugins');
const DOCS = path.join(DATA, 'docs');

for (const dir of [PLUGINS, DOCS]) {
  fs.mkdirSync(dir, { recursive: true });
}

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...authHeaders()
  });

  res.end(
    type.startsWith('application/json')
      ? JSON.stringify(body, null, 2)
      : body
  );

  return true;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function isValidPluginId(value) {
  return /^[a-z0-9][a-z0-9._-]{1,99}$/.test(String(value || ''));
}

function isValidVersion(value) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    String(value || '')
  );
}

function isSafePathPart(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  );
}

function pluginManifestPath(id, version) {
  return path.join(PLUGINS, id, version, 'manifest.json');
}

function pluginEntryPath(id, version, entry) {
  return path.join(PLUGINS, id, version, entry);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', chunk => {
      data += chunk;

      if (data.length > 5_000_000) {
        reject(
          Object.assign(new Error('request_too_large'), {
            statusCode: 413
          })
        );
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(
          Object.assign(new Error('invalid_json'), {
            statusCode: 400
          })
        );
      }
    });

    req.on('error', reject);
  });
}

function index() {
  const plugins = [];

  if (!fs.existsSync(PLUGINS)) {
    return plugins;
  }

  for (const id of fs.readdirSync(PLUGINS)) {
    const idDir = path.join(PLUGINS, id);

    if (!fs.statSync(idDir).isDirectory()) {
      continue;
    }

    for (const version of fs.readdirSync(idDir)) {
      const manifest = pluginManifestPath(id, version);

      if (fs.existsSync(manifest)) {
        const value = readJson(manifest, null);

        if (value) {
          plugins.push(value);
        }
      }
    }
  }

  return plugins;
}

function compareVersions(a, b) {
  const parse = value => {
    const match = String(value).match(
      /^(\d+)\.(\d+)\.(\d+)(?:-(.*))?$/
    );

    if (!match) {
      return [0, 0, 0, ''];
    }

    return [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      match[4] || ''
    ];
  };

  const av = parse(a);
  const bv = parse(b);

  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) {
      return av[i] - bv[i];
    }
  }

  if (!av[3] && bv[3]) return 1;
  if (av[3] && !bv[3]) return -1;

  return av[3].localeCompare(bv[3], undefined, {
    numeric: true
  });
}

function latest(plugins) {
  const result = new Map();

  for (const plugin of plugins) {
    const current = result.get(plugin.id);

    if (
      !current ||
      compareVersions(plugin.version, current.version) > 0
    ) {
      result.set(plugin.id, plugin);
    }
  }

  return [...result.values()];
}

function validateManifest(input) {
  const manifest = { ...(input || {}) };

  if (
    !manifest.id ||
    !manifest.name ||
    !manifest.version ||
    !manifest.entry
  ) {
    throw Object.assign(
      new Error(
        'manifest требует id, name, version и entry'
      ),
      { statusCode: 400 }
    );
  }

  if (!isValidPluginId(manifest.id)) {
    throw Object.assign(
      new Error('некорректный id'),
      { statusCode: 400 }
    );
  }

  if (!isValidVersion(manifest.version)) {
    throw Object.assign(
      new Error('некорректная version'),
      { statusCode: 400 }
    );
  }

  if (
    typeof manifest.entry !== 'string' ||
    !isSafePathPart(manifest.entry) ||
    !manifest.entry.endsWith('.js')
  ) {
    throw Object.assign(
      new Error('некорректный entry'),
      { statusCode: 400 }
    );
  }

  return manifest;
}

function pluginVersionExists(id, version) {
  return fs.existsSync(
    pluginManifestPath(id, version)
  );
}

async function api(req, res, url) {
  if (
    req.method === 'GET' &&
    url.pathname === '/api/health'
  ) {
    return send(res, 200, {
      ok: true,
      service: 'vn-extension-hub',
      issuer
    });
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/auth/me'
  ) {
    try {
      return send(res, 200, {
        authenticated: true,
        user: await requireAuth(req)
      });
    } catch (error) {
      return send(
        res,
        error.statusCode || 401,
        {
          authenticated: false,
          error: error.message
        }
      );
    }
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/auth/status'
  ) {
    try {
      const claims = await authenticate(req);

      return send(res, 200, {
        authenticated: !!claims,
        user: claims ? authUser(claims) : null
      });
    } catch (error) {
      return send(res, 401, {
        authenticated: false,
        error: error.message
      });
    }
  }

  // Публичный каталог.
  if (
    req.method === 'GET' &&
    url.pathname === '/api/plugins'
  ) {
    let plugins = latest(index());

    const query = (
      url.searchParams.get('q') || ''
    ).trim().toLowerCase();

    if (query) {
      plugins = plugins.filter(plugin =>
        JSON.stringify(plugin)
          .toLowerCase()
          .includes(query)
      );
    }

    return send(res, 200, plugins);
  }

  // Расширения текущего пользователя.
  if (
    req.method === 'GET' &&
    url.pathname === '/api/plugins/mine'
  ) {
    try {
      const user = await requireAuth(req);

      const plugins = index().filter(
        plugin =>
          String(plugin.ownerId || '') ===
          String(user.userId)
      );

      return send(res, 200, latest(plugins));
    } catch (error) {
      return send(
        res,
        error.statusCode || 401,
        {
          error: error.message
        }
      );
    }
  }

  let match = url.pathname.match(
    /^\/api\/plugins\/([^/]+)$/
  );

  if (req.method === 'GET' && match) {
    const id = match[1];

    if (!isValidPluginId(id)) {
      return send(res, 400, {
        error: 'invalid_plugin_id'
      });
    }

    const versions = index().filter(
      plugin => plugin.id === id
    );

    if (!versions.length) {
      return send(res, 404, {
        error: 'plugin_not_found'
      });
    }

    return send(res, 200, {
      latest: latest(versions)[0],
      versions: versions.sort((a, b) =>
        compareVersions(b.version, a.version)
      )
    });
  }

  match = url.pathname.match(
    /^\/api\/plugins\/([^/]+)\/([^/]+)$/
  );

  if (req.method === 'GET' && match) {
    const [, id, version] = match;

    if (
      !isValidPluginId(id) ||
      !isValidVersion(version)
    ) {
      return send(res, 400, {
        error: 'invalid_plugin_reference'
      });
    }

    const manifest = pluginManifestPath(
      id,
      version
    );

    if (!fs.existsSync(manifest)) {
      return send(res, 404, {
        error: 'version_not_found'
      });
    }

    return send(
      res,
      200,
      readJson(manifest, {})
    );
  }

  // Публикация расширения.
  if (
    req.method === 'POST' &&
    url.pathname === '/api/plugins'
  ) {
    try {
      const user = await requireAuth(req);
      const payload = await readBody(req);

      const manifest = validateManifest(
        payload.manifest || payload
      );

      if (
        pluginVersionExists(
          manifest.id,
          manifest.version
        )
      ) {
        return send(res, 409, {
          error: 'version_already_exists',
          id: manifest.id,
          version: manifest.version
        });
      }

      if (
        typeof payload.code !== 'string' ||
        !payload.code.trim()
      ) {
        return send(res, 400, {
          error: 'extension_code_required'
        });
      }

      const entryPath = pluginEntryPath(
        manifest.id,
        manifest.version,
        manifest.entry
      );

      const publishedManifest = {
        ...manifest,
        ownerId: user.userId,
        ownerUsername: user.username,
        publishedAt: new Date().toISOString()
      };

      fs.mkdirSync(
        path.dirname(entryPath),
        { recursive: true }
      );

      writeJson(
        pluginManifestPath(
          manifest.id,
          manifest.version
        ),
        publishedManifest
      );

      fs.writeFileSync(
        entryPath,
        payload.code,
        'utf8'
      );

      return send(
        res,
        201,
        publishedManifest
      );
    } catch (error) {
      return send(
        res,
        error.statusCode || 400,
        {
          error: error.message
        }
      );
    }
  }

  // Документация.
  if (
    req.method === 'GET' &&
    url.pathname.startsWith('/api/docs/')
  ) {
    const relative =
      url.pathname.slice('/api/docs/'.length);

    const file = path.resolve(
      DOCS,
      relative.endsWith('.json')
        ? relative
        : `${relative}.json`
    );

    const docsRoot = path.resolve(DOCS);

    if (
      !file.startsWith(docsRoot + path.sep) ||
      !fs.existsSync(file)
    ) {
      return send(res, 404, {
        error: 'doc_not_found'
      });
    }

    return send(
      res,
      200,
      readJson(file, {})
    );
  }

  return false;
}

function staticFile(req, res, url) {
  if (url.pathname.startsWith('/plugins/')) {
    const relative =
      url.pathname.slice('/plugins/'.length);

    const file = path.resolve(
      PLUGINS,
      relative
    );

    const pluginsRoot =
      path.resolve(PLUGINS);

    if (
      !file.startsWith(
        pluginsRoot + path.sep
      )
    ) {
      return send(res, 403, {
        error: 'forbidden'
      });
    }

    if (
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      return send(res, 404, {
        error: 'plugin_file_not_found'
      });
    }

    const type = {
      '.js':
        'text/javascript; charset=utf-8',
      '.json':
        'application/json; charset=utf-8'
    }[path.extname(file)] ||
      'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });

    fs.createReadStream(file).pipe(res);
    return true;
  }

  const relative =
    url.pathname === '/'
      ? '/index.html'
      : url.pathname;

  const file = path.resolve(
    PUBLIC,
    `.${relative}`
  );

  const publicRoot =
    path.resolve(PUBLIC);

  if (
    !file.startsWith(
      publicRoot + path.sep
    )
  ) {
    return send(res, 403, {
      error: 'forbidden'
    });
  }

  if (
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    return send(res, 404, {
      error: 'not_found'
    });
  }

  const type = {
    '.html':
      'text/html; charset=utf-8',
    '.js':
      'text/javascript; charset=utf-8',
    '.css':
      'text/css'
  }[path.extname(file)] ||
    'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*'
  });

  fs.createReadStream(file).pipe(res);
  return true;
}

http.createServer(
  async (req, res) => {
    const url = new URL(
      req.url,
      `http://${req.headers.host || HOST}`
    );

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...authHeaders(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods':
            'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization'
        });

        return res.end();
      }

      if (await api(req, res, url)) {
        return;
      }

      staticFile(req, res, url);
    } catch (error) {
      send(res, 500, {
        error: error.message
      });
    }
  }
).listen(PORT, HOST, () => {
  console.log(
    `VN Extension Hub: http://${HOST}:${PORT}`
  );
});