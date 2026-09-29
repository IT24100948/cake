const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta } = require('../utils/helpers');

// US16 - Staff view customer details
async function list(req, res) {
  const { search } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.city LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query, 20);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM customers c ${whereSql}`, params);
  const data = await query(
    `SELECT c.id, c.full_name, c.email, c.phone, c.city, c.is_active, c.created_at,
            COUNT(o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','REJECTED') THEN o.total_amount END),0) AS total_spent,
            MAX(o.created_at) AS last_order_at
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id ${whereSql}
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data, meta: pageMeta(total, pg) });
}

async function getOne(req, res) {
  const [customer] = await query(
    'SELECT id, full_name, email, phone, address, city, is_active, created_at FROM customers WHERE id = ?',
    [req.params.id]
  );
  if (!customer) throw ApiError.notFound('Customer not found');
  const orders = await query(
    `SELECT id, order_number, status, payment_status, fulfillment_type, event_date, total_amount, created_at
       FROM orders WHERE customer_id = ? ORDER BY created_at DESC`,
    [customer.id]
  );
  res.json({ customer, orders });
}

module.exports = { list, getOne };
