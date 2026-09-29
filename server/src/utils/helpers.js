/** Parse pagination params with sane bounds. */
function paginate(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function pageMeta(total, { page, limit }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const money = (n) => Math.round(Number(n) * 100) / 100;

/** Local-date string YYYY-MM-DD. */
function toDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLKR(n) {
  return `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { paginate, pageMeta, money, toDateString, formatLKR };
