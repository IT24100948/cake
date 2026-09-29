const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const isTest = process.env.NODE_ENV === 'test';

module.exports = {
  isTest,
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: isTest
      ? process.env.DB_NAME_TEST || 'devma_test'
      : process.env.DB_NAME || 'devma_cake_party',
  },
  jwt: {
    secret: process.env.JWT_SECRET || (isTest ? 'test-secret' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  uploadDir: path.join(__dirname, '..', '..', 'uploads'),
};

if (!module.exports.jwt.secret) {
  throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env and set it.');
}
