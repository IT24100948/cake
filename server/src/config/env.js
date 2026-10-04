const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const isTest = process.env.NODE_ENV === 'test';
const isVercel = !!process.env.VERCEL;

// Devma trades on Sri Lanka time. Serverless hosts run in UTC, so pin the
// process clock (order numbers, "today", event-date checks) to the business zone.
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';

/**
 * Database settings come from DATABASE_URL (mysql://user:pass@host:port/db, as
 * given by TiDB Cloud, Aiven, Railway…) or from the individual DB_* variables.
 */
function dbConfig() {
  const base = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'devma_cake_party',
  };
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    Object.assign(base, {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')) || base.database,
    });
    if (/ssl|sslaccept|ssl-mode/i.test(u.search) && !process.env.DB_SSL) process.env.DB_SSL = 'true';
  }
  if (isTest) base.database = process.env.DB_NAME_TEST || 'devma_test';
  // Managed MySQL (TiDB Cloud, Aiven, PlanetScale…) requires TLS.
  if (process.env.DB_SSL === 'true') base.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  return base;
}

module.exports = {
  isTest,
  isVercel,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: dbConfig(),
  // MySQL session offset matching APP_TIMEZONE (Sri Lanka has no daylight saving).
  dbTimezone: process.env.DB_TIMEZONE || '+05:30',
  // Serverless functions each hold their own pool, so keep it small there.
  dbPoolSize: Number(process.env.DB_POOL_SIZE) || (isVercel ? 3 : 10),
  jwt: {
    secret: process.env.JWT_SECRET || (isTest ? 'test-secret' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  // Secure cookies by default in production (HTTPS, e.g. Vercel). Docker on http://localhost sets COOKIE_SECURE=false.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  // Serve the built storefront (client/dist) from Express — used by the Docker image.
  serveClient: process.env.SERVE_CLIENT === 'true',
  uploadDir: path.join(__dirname, '..', '..', 'uploads'),
  // When set (Vercel Blob store connected to the project), uploads go to Blob instead of local disk.
  blobToken: process.env.BLOB_READ_WRITE_TOKEN || '',
};

if (!module.exports.jwt.secret) {
  throw new Error('JWT_SECRET is not set. Locally: copy server/.env.example to server/.env. On Vercel: add it under Project Settings → Environment Variables.');
}
