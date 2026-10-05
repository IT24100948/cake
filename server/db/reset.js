/**
 * Creates the database (if missing) and (re)creates all tables from schema.sql.
 * Usage: npm run db:reset   (NODE_ENV=test targets the test database)
 *
 * This DROPS every table. Against a non-local database (e.g. production on
 * TiDB Cloud / Aiven) it refuses unless CONFIRM_DB_RESET=yes is set.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { db, dbTimezone } = require('../src/config/env');

const isLocalHost = (h) => ['127.0.0.1', 'localhost', '::1'].includes(h);

async function resetDatabase({ silent = false } = {}) {
  if (!isLocalHost(db.host) && process.env.CONFIRM_DB_RESET !== 'yes') {
    throw new Error(
      `Refusing to reset remote database "${db.database}" on ${db.host}: every table would be dropped.\n` +
      'If this is intended (first-time setup), run again with CONFIRM_DB_RESET=yes.'
    );
  }
  const { database, ...conn } = db;
  const connection = await mysql.createConnection({ ...conn, multipleStatements: true });
  try {
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch (err) {
      // Some hosted plans only allow the database they created for you.
      if (!silent) console.warn(`Could not create database (${err.code}); using existing "${database}".`);
    }
    await connection.query(`USE \`${database}\``);
    await connection.query(`SET time_zone = '${dbTimezone}'`);
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(sql);
    if (!silent) console.log(`Database "${database}" on ${db.host} — schema created.`);
  } finally {
    await connection.end();
  }
}

module.exports = { resetDatabase };

if (require.main === module) {
  resetDatabase().catch((err) => {
    console.error('Database reset failed:', err.message);
    process.exit(1);
  });
}
