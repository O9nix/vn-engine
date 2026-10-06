#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { initDb, isDbEnabled, query } = require('../lib/db');
const projectsLib = require('../lib/projects');

async function main() {
  await initDb();
  if (!isDbEnabled()) {
    console.error('DB not available');
    process.exit(1);
  }
  const DATA = path.join(__dirname, '..', 'data');
  let ownerId = null;
  const email = process.env.MIGRATE_OWNER_EMAIL;
  if (email) {
    const rows = await query('SELECT id FROM users WHERE email = :e LIMIT 1', { e: email.toLowerCase() });
    if (rows[0]) ownerId = rows[0].id;
    else console.warn('MIGRATE_OWNER_EMAIL not found, owner_id will be null');
  } else {
    const rows = await query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (rows[0]) ownerId = rows[0].id;
  }
  const result = await projectsLib.importFilesToDb(DATA, ownerId);
  console.log('[migrate:projects]', result, 'owner_id=', ownerId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
