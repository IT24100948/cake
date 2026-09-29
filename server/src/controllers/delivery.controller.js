const { query } = require('../config/db');
const { paginate, pageMeta } = require('../utils/helpers');
const svc = require('../services/order.service');

// US22 - Delivery / collection board
async function list(req, res) {
  const { date, from, to, status, type, search, scope } = req.query;
  const where = [`o.status NOT IN ('CANCELLED','REJECTED')`];
  const params = [];
  if (scope !== 'all') where.push(`o.status <> 'PENDING'`);
  if (date) { where.push('COALESCE(d.scheduled_date, o.event_date) = ?'); params.push(date); }
  if (from) { where.push('COALESCE(d.scheduled_date, o.event_date) >= ?'); params.push(from); }
  if (to) { where.push('COALESCE(d.scheduled_date, o.event_date) <= ?'); params.push(to); }
  if (status === 'OPEN') where.push(`d.status NOT IN ('DELIVERED','COLLECTED')`);
  else if (status) { where.push('d.status = ?'); params.push(status); }
  if (type) { where.push('d.type = ?'); params.push(type); }
  if (search) {
    where.push('(o.order_number LIKE ? OR d.recipient_name LIKE ? OR d.contact_phone LIKE ? OR d.city LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const pg = paginate(req.query, 25);
  const base = `FROM deliveries d JOIN orders o ON o.id = d.order_id LEFT JOIN staff s ON s.id = d.assigned_staff_id ${whereSql}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
  const data = await query(
    `SELECT d.*, o.order_number, o.status AS order_status, o.payment_status, o.event_date, o.total_amount,
            s.full_name AS assigned_staff_name
     ${base} ORDER BY COALESCE(d.scheduled_date, o.event_date) ASC, d.id LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data, meta: pageMeta(total, pg) });
}

async function update(req, res) {
  await svc.updateDelivery(req, req.params.id, req.body);
  res.json({ order: await svc.getOrderDetail(req.params.id), message: 'Delivery details saved' });
}

async function updateStatus(req, res) {
  await svc.updateDeliveryStatus(req, req.params.id, req.body);
  res.json({ message: 'Delivery status updated' });
}

module.exports = { list, update, updateStatus };
