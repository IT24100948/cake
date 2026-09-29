const { query } = require('../config/db');
const { paginate, pageMeta } = require('../utils/helpers');

// US06 - View access and audit records
async function list(req, res) {
  const { action, actorType, search, from, to, category } = req.query;
  const where = [];
  const params = [];
  if (action) { where.push('action = ?'); params.push(action); }
  if (actorType) { where.push('actor_type = ?'); params.push(actorType); }
  if (category === 'access') where.push(`action IN ('LOGIN_SUCCESS','LOGIN_FAILED','LOGIN_BLOCKED','ACCOUNT_LOCKED','LOGOUT','PASSWORD_CHANGED','CUSTOMER_LOGIN','CUSTOMER_LOGIN_FAILED')`);
  if (search) {
    where.push('(actor_name LIKE ? OR entity_type LIKE ? OR CAST(details AS CHAR) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (from) { where.push('created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('created_at <= ?'); params.push(`${to} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query, 25);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`, params);
  const data = await query(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data, meta: pageMeta(total, pg) });
}

async function actions(req, res) {
  const rows = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  res.json({ data: rows.map((r) => r.action) });
}

module.exports = { list, actions };
