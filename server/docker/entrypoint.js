/**
 * Docker start-up for the Devma app container.
 *
 *  1. Waits until MySQL accepts connections (first boot of the MySQL container takes a while).
 *  2. First run only (no tables yet): creates the schema and loads the demo data.
 *     Set RESET_DB=true to wipe and re-seed on start.
 *  3. Starts the API, which also serves the built storefront (SERVE_CLIENT=true).
 *
 * Written in Node rather than shell so it runs the same whatever line endings
 * the repository was checked out with (Windows).
 */
const mysql = require('mysql2/promise');
const { db } = require('../src/config/env');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[devma] ${msg}`);

async function waitForDatabase(timeoutMs = 180000) {
  const started = Date.now();
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const conn = await mysql.createConnection({ ...db, connectTimeout: 5000 });
      await conn.query('SELECT 1');
      await conn.end();
      log(`MySQL is ready at ${db.host}:${db.port}.`);
      return;
    } catch (err) {
      if (Date.now() - started > timeoutMs) throw new Error(`MySQL did not become ready: ${err.message}`);
      if (attempt === 1 || attempt % 5 === 0) log(`Waiting for MySQL (${err.code || err.message})…`);
      await sleep(2000);
    }
  }
}

async function isSeeded() {
  const conn = await mysql.createConnection(db);
  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'roles'", [db.database]
    );
    if (!rows[0].n) return false;
    const [[r]] = await conn.query('SELECT COUNT(*) AS n FROM roles');
    return r.n > 0;
  } finally {
    await conn.end();
  }
}

async function main() {
  await waitForDatabase();
  const reset = process.env.RESET_DB === 'true';
  if (reset || !(await isSeeded())) {
    log(reset ? 'RESET_DB=true — recreating the database…' : 'First run — creating tables and demo data…');
    process.env.CONFIRM_DB_RESET = 'yes';
    const { resetDatabase } = require('../db/reset');
    const { seed } = require('../db/seed');
    await resetDatabase();
    await seed(); // leaves the shared connection pool open; the server reuses it
  } else {
    log('Database already set up — keeping existing data.');
  }

  const port = process.env.PORT || 8080;
  const pass = process.env.SEED_PASSWORD;
  log('');
  log('================================================================');
  log(`  Devma Cake n' Party is running:  http://localhost:${process.env.PUBLIC_PORT || port}`);
  log(`  Staff portal:                    http://localhost:${process.env.PUBLIC_PORT || port}/staff/login`);
  if (pass) {
    log(`  Logins (all use password ${pass}):`);
    log('    admin@devma.lk     Admin (everything)');
    log('    staff@devma.lk     Shop Staff (orders, payments, delivery)');
    log('    support@devma.lk   Technical Support (staff accounts, audit)');
    log('    customer@devma.lk  Customer (shop, orders, notifications)');
  }
  log('================================================================');
  require('../src/server');
}

main().catch((err) => {
  console.error('[devma] Start-up failed:', err.message);
  process.exit(1);
});
