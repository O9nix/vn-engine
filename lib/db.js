'use strict';

let pool = null;
let enabled = false;
let mysql = null;
let lastError = null;

function loadMysql() {
  if (!mysql) mysql = require('mysql2/promise');
  return mysql;
}

function configFromEnv() {
  const host = process.env.DB_HOST || '';
  if (!host) return null;
  return {
    host,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'vn',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vn_studio',
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  };
}

async function initDb() {
  const cfg = configFromEnv();
  if (!cfg) {
    enabled = false;
    lastError = 'DB_HOST не задан (создайте файл .env из .env.example)';
    console.log('[db] DB_HOST not set — auth API disabled (file projects still work)');
    return false;
  }
  try {
    const m = loadMysql();
    pool = m.createPool(cfg);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    enabled = true;
    console.log('[db] connected ' + cfg.user + '@' + cfg.host + ':' + cfg.port + '/' + cfg.database);
    return true;
  } catch (e) {
    enabled = false;
    pool = null;
    lastError = e.message;
    console.error('[db] connection failed:', e.message);
    console.error('[db] auth API disabled until MariaDB is available');
    return false;
  }
}

function isDbEnabled() {
  return enabled && !!pool;
}

function getPool() {
  if (!pool) throw new Error('Database not available');
  return pool;
}

async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

function getDbStatus() {
  return { enabled, lastError, hasHost: !!(process.env.DB_HOST) };
}

module.exports = { initDb, isDbEnabled, getPool, query, configFromEnv, getDbStatus };
