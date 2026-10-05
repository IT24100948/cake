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
  // Express 5 reports listen errors (e.g. port already in use) to this callback.
  app.listen(port, (err) => {
    if (err) {
      console.error(err.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the other program or set PORT in server/.env.`
        : `Could not start the API: ${err.message}`);
      process.exit(1);
    }
    console.log(`Devma API running on http://localhost:${port}`);
  });
}

start();
