#!/usr/bin/env node
/**
 * Devma Cake n' Party - run everything locally with one command (no Docker).
 *
 *   node scripts/start.js    (or: npm start, ./start.sh, start.bat)
 *
 *  1. Runs scripts/setup.js: creates server/.env, checks MySQL, creates + seeds the database on first run.
 *  2. Starts the API (Express, auto-restarts on change) and the website (Vite) together.
 *  3. Opens the website in your browser. Press Ctrl+C to stop both.
 */
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const tty = process.stdout.isTTY;
const color = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color(32); const red = color(31); const bold = color(1);

/** True when nothing answers on the port and it can be bound the way the servers bind it. */
function isFree(port) {
  const answers = (host) => new Promise((resolve) => {
    const sock = net.connect({ port, host });
    sock.setTimeout(500);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => resolve(false));
  });
  const bindable = () => new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
  return Promise.all([answers('127.0.0.1'), answers('::1')])
    .then(([a, b]) => (a || b ? false : bindable()));
}

async function freePort(preferred) {
  for (let p = preferred; p < preferred + 30; p += 1) if (await isFree(p)) return p;
  throw new Error(`No free port found near ${preferred}.`);
}

function openBrowser(url) {
  const cmd = isWin ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const cmdArgs = isWin ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref(); } catch { /* no browser available */ }
}

/** Runs an npm script with each output line prefixed, e.g. "[api] ...". */
function run(name, colorCode, npmArgs, env) {
  const child = spawn(npm, npmArgs, { cwd: ROOT, env: { ...process.env, ...env }, shell: isWin });
  const prefix = color(colorCode)(`[${name}]`);
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach((l) => out.write(`${prefix} ${l}\n`));
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

async function main() {
  // 1. Setup (interactive the first time, instant afterwards)
  const setup = spawnSync(process.execPath, [path.join(__dirname, 'setup.js')], { cwd: ROOT, stdio: 'inherit' });
  if (setup.status !== 0) process.exit(setup.status || 1);

  // 2. Ports (macOS often uses 5000 for AirPlay, so pick the next free one)
  const apiPort = await freePort(Number(process.env.PORT) || 5000);
  const webPort = await freePort(Number(process.env.WEB_PORT) || 5173);
  const url = `http://localhost:${webPort}`;

  const children = [
    run('api', 35, ['run', 'dev', '-w', 'server'], { PORT: String(apiPort), CLIENT_URL: url }),
    run('web', 36, ['run', 'dev', '-w', 'client', '--', '--port', String(webPort), '--strictPort'], { API_PORT: String(apiPort) }),
  ];

  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    children.forEach((c) => {
      if (c.exitCode !== null) return;
      // On Windows the child is a cmd.exe wrapper: end the whole process tree so no server keeps its port.
      if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill('SIGINT');
    });
    setTimeout(() => process.exit(code), 800);
  };
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  children.forEach((c) => c.on('exit', (code) => {
    if (!stopping) { console.error(red(`\n  A server stopped unexpectedly (exit code ${code}). The log above shows why.`)); stop(code || 1); }
  }));

  // 3. Wait until both answer, then open the browser
  const started = Date.now();
  for (;;) {
    try {
      const [api, web] = await Promise.all([
        fetch(`http://localhost:${apiPort}/api/health`).then((r) => r.ok),
        fetch(url).then((r) => r.ok),
      ]);
      if (api && web) break;
    } catch { /* not up yet */ }
    if (Date.now() - started > 90000) { console.error(red('  The servers did not start within 90 seconds.')); return stop(1); }
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(green(`
  ============================================================
   READY:  ${bold(url)}
  ============================================================`));
  console.log(`
   Home page (all links):  ${url}
   Staff / admin portal:   ${url}/staff/login
   API:                    http://localhost:${apiPort}/api/health
   Demo logins:            server/.seed-credentials
   Database:               open MySQL Workbench > schema "devma_cake_party"

   Press Ctrl+C to stop.
`);
  if (!process.env.NO_BROWSER) openBrowser(url);
}

main().catch((err) => { console.error(red(`  ${err.message}`)); process.exit(1); });
