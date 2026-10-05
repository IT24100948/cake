const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta } = require('../utils/helpers');
const svc = require('../services/order.service');

async function listForOrder(req, res) {
  const [order] = await query('SELECT id FROM orders WHERE id = ?', [req.params.id]);
  if (!order) throw ApiError.notFound('Order not found');
  const detail = await svc.getOrderDetail(order.id);
  res.json({
    data: detail.payments,
    summary: { total: detail.total_amount, paid: detail.amount_paid, balance: detail.balance_due, paymentStatus: detail.payment_status },
  });
}

// US20 - Record payment
async function record(req, res) {
  await svc.recordPayment(req, req.params.id, req.body);
  res.status(201).json({ order: await svc.getOrderDetail(req.params.id), message: 'Payment recorded' });
}

// US21 - Update payment status
async function updateStatus(req, res) {
  await svc.updatePaymentStatus(req, req.params.id, req.body);
  res.json({ order: await svc.getOrderDetail(req.params.id), message: 'Payment status updated' });
}

/** All payments (Payments page). */
async function list(req, res) {
  const { from, to, method, search, kind } = req.query;
  const where = [];
  const params = [];
  if (from) { where.push('p.paid_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('p.paid_at <= ?'); params.push(`${to} 23:59:59`); }
  if (method) { where.push('p.method = ?'); params.push(method); }
  if (kind === 'PAYMENT' || kind === 'REFUND') { where.push('p.kind = ?'); params.push(kind); }
  if (search) {
    where.push('(o.order_number LIKE ? OR c.full_name LIKE ? OR p.reference_no LIKE ?)');
    params.push(...Array(3).fill(`%${search}%`));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query, 25);
  const base = `FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id
                LEFT JOIN staff s ON s.id = p.recorded_by LEFT JOIN payment_transactions t ON t.id = p.transaction_id ${whereSql}`;
  // Net total: refunds count against the payments received.
  const [{ total, amount }] = await query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(IF(p.kind = 'REFUND', -p.amount, p.amount)),0) AS amount ${base}`, params
  );
  const data = await query(
    `SELECT p.*, o.order_number, o.payment_status, o.payment_option, o.total_amount, c.full_name AS customer_name,
            s.full_name AS recorded_by_name, t.card_brand, t.card_last4
     ${base} ORDER BY p.paid_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data, meta: pageMeta(total, pg), totalAmount: Number(amount) });
}

module.exports = { listForOrder, record, updateStatus, list };
