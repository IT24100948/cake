/**
 * Vercel serverless entry: the whole Express API runs as one function.
 * vercel.json rewrites every /api/* request here; Express sees the original path.
 */
module.exports = require('../server/src/app');
