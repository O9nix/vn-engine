#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { configFromEnv } = require('../lib/db');

async function main() {
  const cfg = configFromEnv();
  if (!cfg) {
    console.error('Set DB_HOST (and DB_*) in .env — see .env.example');
    process.exit(1);
  }
  // connect without database first to create DB if needed
  const { database, ...rest } = cfg;
  const conn = await mysql.createConnection(rest);
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.changeUser({ database });
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log('[migrate]', file);
    for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await conn.query(stmt);
    }
  }
  await conn.end();
  console.log('[migrate] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
