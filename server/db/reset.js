/**
 * Creates the database (if missing) and (re)creates all tables from schema.sql.
 * Usage: npm run db:reset   (NODE_ENV=test targets the test database)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { db } = require('../src/config/env');

async function resetDatabase({ silent = false } = {}) {
  const conn = await mysql.createConnection({
    host: db.host, port: db.port, user: db.user, password: db.password, multipleStatements: true,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${db.database}\``);
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(sql);
    if (!silent) console.log(`Database "${db.database}" schema created.`);
  } finally {
    await conn.end();
  }
}

module.exports = { resetDatabase };

if (require.main === module) {
  resetDatabase().catch((err) => {
    console.error('Database reset failed:', err.message);
    process.exit(1);
  });
}
