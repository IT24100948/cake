#!/usr/bin/env node
/**
 * Devma Cake n' Party - local setup against your own MySQL server
 * (the one you open in MySQL Workbench). No Docker needed.
 *
 *   node scripts/setup.js          create server/.env if missing, check MySQL, and on the
 *                                  first run create the tables and load the demo data
 *   node scripts/setup.js --reset  wipe the database and load fresh demo data
 *
 * Safe to run again: an existing database is kept unless --reset is given.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, 'server', '.env');
const ENV_EXAMPLE = path.join(ROOT, 'server', '.env.example');
const CREDENTIALS_FILE = path.join(ROOT, 'server', '.seed-credentials');
const DEFAULT_DEMO_PASSWORD = 'Devma@2026';

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const YES = args.includes('--yes') || args.includes('-y');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

const c = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const cyan = c(36); const green = c(32); const yellow = c(33); const red = c(31); const bold = c(1);
const say = (s = '') => console.log(s);
function fail(msg) {
  console.error(`\n${red('  ✖ ' + msg.split('\n')[0])}${msg.includes('\n') ? '\n' + msg.split('\n').slice(1).join('\n') : ''}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- prompts
// One shared reader with a line queue, so answers typed or pasted ahead are never lost.
let rl = null;
let muted = false;
const queued = [];
const waiting = [];
function reader() {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl.setPrompt('');
  // Don't echo while a password is typed (like the mysql command-line client).
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (s) => { if (!muted) write(s); };
  rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : queued.push(line)));
  rl.on('close', () => { while (waiting.length) waiting.shift()(''); });
  return rl;
}
function closePrompts() { if (rl) rl.close(); }

async function ask(question, { fallback = '', secret = false } = {}) {
  if (!interactive) return fallback;
  reader();
  process.stdout.write(question);
  muted = secret;
  const answer = queued.length ? queued.shift() : await new Promise((resolve) => waiting.push(resolve));
  muted = false;
  if (secret) process.stdout.write('\n');
  return answer === '' ? fallback : answer;
}

// ---------------------------------------------------------------- server/.env
function readEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/** Sets KEY=value in server/.env, replacing an existing line or appending one. */
function writeEnvValues(values) {
  let text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^\\s*#?\\s*${key}\\s*=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_FILE, text);
}

async function askMysqlLogin(current = {}) {
  say(cyan('  Enter the MySQL login you use in MySQL Workbench (press Enter to keep the value in brackets).'));
  const host = await ask(`  MySQL host [${current.DB_HOST || '127.0.0.1'}]: `, { fallback: current.DB_HOST || '127.0.0.1' });
  const port = await ask(`  MySQL port [${current.DB_PORT || '3306'}]: `, { fallback: current.DB_PORT || '3306' });
  const user = await ask(`  MySQL user [${current.DB_USER || 'root'}]: `, { fallback: current.DB_USER || 'root' });
  const password = await ask('  MySQL password: ', { fallback: '', secret: true });
  return { DB_HOST: host, DB_PORT: port, DB_USER: user, DB_PASSWORD: password };
}

async function ensureEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    const env = readEnv();
    if (!env.JWT_SECRET || env.JWT_SECRET.startsWith('change-me')) writeEnvValues({ JWT_SECRET: crypto.randomBytes(32).toString('hex') });
    return;
  }
  say(cyan('  Creating server/.env ...'));
  fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
  writeEnvValues({ JWT_SECRET: crypto.randomBytes(32).toString('hex') });
  if (interactive) writeEnvValues(await askMysqlLogin());
  say(green('  ✔ server/.env created.'));
}

// ---------------------------------------------------------------- MySQL
const HELP_NOT_RUNNING = `
  MySQL Server is not running (or not on that host/port). MySQL Workbench is only the
  client - it needs a MySQL Server to connect to. To start the server:
    • Windows: press Start, type "Services", find MySQL84 / MySQL80 (or MySQL) and click Start
               - or in Workbench: Server > Startup/Shutdown > Start Server
    • macOS:   System Settings > MySQL > Start MySQL Server
               (Homebrew install: brew services start mysql)
  No MySQL Server installed? Get "MySQL Community Server" (Windows: MySQL Installer)
  from https://dev.mysql.com/downloads/ and set a root password while installing.
  If MySQL runs on another port, change DB_PORT in server/.env.`;

async function connectWithRetry() {
  const mysql = require('mysql2/promise');
  for (let attempt = 1; ; attempt += 1) {
    if (attempt > 1) {
      // The login was just corrected in server/.env: load it again.
      delete require.cache[require.resolve('../server/src/config/env')];
      for (const k of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD']) delete process.env[k];
    }
    const { db } = require('../server/src/config/env');
    const { database, ...login } = db;
    try {
      const conn = await mysql.createConnection({ ...login, connectTimeout: 8000 });
      await conn.query('SELECT 1');
      return { conn, db };
    } catch (err) {
      const denied = err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_NOT_SUPPORTED_AUTH_MODE';
      if (denied && interactive && attempt <= 3) {
        say(yellow(`\n  MySQL refused the login for "${login.user}" (${err.code}).`));
        writeEnvValues(await askMysqlLogin(readEnv()));
        continue;
      }
      if (denied) fail(`MySQL refused the login for "${login.user}" on ${login.host}:${login.port}.\n  Put the user/password you use in MySQL Workbench into DB_USER / DB_PASSWORD in server/.env, then run this again.`);
      if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(err.code)) fail(`Cannot reach MySQL at ${login.host}:${login.port} (${err.code}).${HELP_NOT_RUNNING}`);
      fail(`Cannot connect to MySQL: ${err.message}`);
    }
  }
}

async function isSeeded(conn, database) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'roles'", [database]
  );
  if (!rows[0].n) return false;
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${database}\`.roles`);
  return r.n > 0;
}

// ---------------------------------------------------------------- main
async function main() {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 20) fail(`Node.js 20 or newer is required (you have ${process.version}). Get it from https://nodejs.org`);
  try { require.resolve('mysql2/promise'); } catch { fail('Dependencies are missing. Run "npm install" in the project folder first.'); }

  await ensureEnvFile();
  const { conn, db } = await connectWithRetry();
  say(green(`  ✔ Connected to MySQL at ${db.host}:${db.port} as ${db.user}.`));

  const seeded = await isSeeded(conn, db.database);
  if (seeded && !RESET) {
    // Older setups used drawn placeholder artwork for the demo products: switch them to real photos.
    const { applyProductPhotos } = require('../server/db/productPhotos');
    await conn.query(`USE \`${db.database}\``);
    const run = async (sql, params) => (await conn.query(sql, params))[0];
    const updated = await applyProductPhotos(run);
    if (updated) say(green(`  ✔ ${updated} demo product${updated === 1 ? '' : 's'} now use real photos.`));
  }
  await conn.end();

  if (seeded && !RESET) {
    say(green(`  ✔ Database "${db.database}" is ready (existing data kept).`));
    if (fs.existsSync(CREDENTIALS_FILE)) say(`    Demo logins: see server/.seed-credentials`);
    return;
  }

  if (seeded && RESET && !YES) {
    const answer = await ask(yellow(`  This deletes ALL data in "${db.database}" (orders, customers, staff...). Type "yes" to continue: `));
    if (answer.trim().toLowerCase() !== 'yes') { say('  Cancelled - nothing was changed.'); return; }
  }

  say(cyan(`  ${seeded ? 'Recreating' : 'Creating'} database "${db.database}" and loading demo data...`));
  process.env.CONFIRM_DB_RESET = 'yes';
  if (!process.env.SEED_PASSWORD) process.env.SEED_PASSWORD = DEFAULT_DEMO_PASSWORD;
  const { resetDatabase } = require('../server/db/reset');
  const { seed } = require('../server/db/seed');
  const { pool } = require('../server/src/config/db');
  try {
    await resetDatabase({ silent: true });
    await seed({ silent: true });
  } finally {
    await pool.end();
  }
  fs.writeFileSync(CREDENTIALS_FILE,
    `Devma demo accounts (local demo only)\nStaff portal:  http://localhost:5173/staff/login\nCustomer site: http://localhost:5173/login\n\n` +
    ['admin@devma.lk', 'staff@devma.lk', 'support@devma.lk', 'customer@devma.lk'].map((e) => `  ${e.padEnd(22)} ${process.env.SEED_PASSWORD}`).join('\n') + '\n');
  say(green(`  ✔ Database "${db.database}" created with demo data.`));
  say(`    All demo logins use the password ${bold(process.env.SEED_PASSWORD)}:`);
  say('      admin@devma.lk      Admin (everything)');
  say('      staff@devma.lk      Shop Staff (orders, payments, delivery)');
  say('      support@devma.lk    Technical Support (staff accounts, audit)');
  say('      customer@devma.lk   Customer (shop, orders)');
}

if (require.main === module) {
  say(`\n${bold("  Devma Cake n' Party - setup")}\n`);
  main().then(() => { closePrompts(); say(); }).catch((err) => { closePrompts(); fail(err.message); });
}
