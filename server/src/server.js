const app = require('./app');
const { port } = require('./config/env');
const { pool } = require('./config/db');

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`Cannot connect to MySQL: ${err.message}\nCheck the DB_* settings in server/.env and run "npm run setup".`);
    process.exit(1);
  }
  app.listen(port, () => console.log(`Devma API running on http://localhost:${port}`));
}

start();
