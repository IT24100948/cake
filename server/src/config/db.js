const mysql = require('mysql2/promise');
const { db, dbPoolSize, dbTimezone } = require('./env');

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: dbPoolSize,
  maxIdle: dbPoolSize,
  idleTimeout: 60000,
  enableKeepAlive: true,
  dateStrings: true,
  decimalNumbers: true,
  timezone: dbTimezone,
});

// NOW()/CURDATE() in SQL must agree with the app's business timezone, even on a UTC database server.
pool.pool.on('connection', (conn) => conn.query(`SET time_zone = '${dbTimezone.replace(/[^0-9:+-]/g, '')}'`));

/** Run a query on the pool and return the rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Run `fn(conn)` inside a transaction. Commits on success, rolls back on error.
 * `conn.q(sql, params)` returns rows, like `query` above.
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  conn.q = async (sql, params = []) => (await conn.query(sql, params))[0];
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTransaction };
