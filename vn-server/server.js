#!/usr/bin/env node
/**
 * Простой HTTP-сервер для Visual Novel Studio (Node.js)
 * Запуск:  node server.js
 * После запуска: http://localhost:8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 8080;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.md':   'text/markdown; charset=utf-8',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/login') urlPath = '/login.html';
  if (urlPath === '/register') urlPath = '/register.html';

  const filePath = path.join(DIR, urlPath);

  // Защита от path traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — Файл не найден');
      console.log(`  ✗ 404  ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    res.end(data);
    console.log(`  → ${urlPath}`);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('='.repeat(50));
  console.log('  Visual Novel Studio');
  console.log('='.repeat(50));
  console.log(`  Сервер запущен: ${url}`);
  console.log(`  Папка:          ${DIR}`);
  console.log();
  console.log('  Открой в браузере:');
  console.log(`    ${url}`);
  console.log();
  console.log('  Остановить: Ctrl+C');
  console.log('='.repeat(50));

  // Пробуем открыть браузер
  const openCmd = process.platform === 'win32' ? 'start' :
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${openCmd} ${url}`, () => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} занят. Попробуй: node server.js 8090`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
