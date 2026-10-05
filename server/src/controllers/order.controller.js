const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta } = require('../utils/helpers');
const { publicUrl } = require('../middleware/upload');
const svc = require('../services/order.service');
const gateway = require('../services/paymentGateway');

const LIST_COLUMNS = `o.id, o.order_number, o.status, o.payment_status, o.payment_option, o.fulfillment_type, o.event_date,
  o.total_amount, o.created_at, o.updated_at,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
  EXISTS(SELECT 1 FROM cake_requirements cr WHERE cr.order_id = o.id) AS has_custom_cake`;

// ----- Customer side -----

// US15 - Submit order
async function create(req, res) {
  const order = await svc.createOrder(req, req.body, publicUrl(req.file));
  res.status(201).json({ order, message: `Order ${order.order_number} submitted successfully` });
}

// US18 - Order status and history
async function myOrders(req, res) {
  const { status } = req.query;
  const where = ['o.customer_id = ?'];
  const params = [req.customer.id];
  if (status === 'active') where.push(`o.status NOT IN ('COMPLETED','CANCELLED','REJECTED')`);
  else if (status === 'past') where.push(`o.status IN ('COMPLETED','CANCELLED','REJECTED')`);
  const pg = paginate(req.query, 10);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM orders o WHERE ${where.join(' AND ')}`, params);
  const data = await query(
    `SELECT ${LIST_COLUMNS} FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data: data.map((o) => ({ ...o, has_custom_cake: !!o.has_custom_cake })), meta: pageMeta(total, pg) });
}

async function myOrder(req, res) {
  const detail = await svc.getOrderDetail(req.params.id, { forCustomer: true });
  if (detail.customer_id !== req.customer.id) throw ApiError.notFound('Order not found');
  res.json({ order: detail });
}

async function cancelMyOrder(req, res) {
  await svc.customerCancel(req, req.params.id, req.body.reason);
  res.json({ message: 'Order cancelled' });
}

/** Customer pays the balance of their order online through the built-in gateway. */
async function payMyOrder(req, res) {
  const transaction = await svc.payOnline(req, req.params.id, req.body);
  res.status(201).json({ transaction, order: await svc.getOrderDetail(req.params.id, { forCustomer: true }), message: 'Payment successful' });
}

/** The gateway's test cards, shown on the (prototype) payment form. */
function testCards(req, res) {
  res.json({ data: gateway.testCards() });
}

// ----- Staff side -----

// US16 - View orders
async function list(req, res) {
  const { status, paymentStatus, fulfillmentType, search, from, to, eventFrom, eventTo, customerId } = req.query;
  const where = [];
  const params = [];
  if (status === 'ACTIVE') where.push(`o.status NOT IN ('COMPLETED','CANCELLED','REJECTED')`);
  else if (status) { where.push('o.status = ?'); params.push(status); }
  if (paymentStatus) { where.push('o.payment_status = ?'); params.push(paymentStatus); }
  if (fulfillmentType) { where.push('o.fulfillment_type = ?'); params.push(fulfillmentType); }
  if (customerId) { where.push('o.customer_id = ?'); params.push(customerId); }
  if (search) {
    where.push('(o.order_number LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  if (from) { where.push('o.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('o.created_at <= ?'); params.push(`${to} 23:59:59`); }
  if (eventFrom) { where.push('o.event_date >= ?'); params.push(eventFrom); }
  if (eventTo) { where.push('o.event_date <= ?'); params.push(eventTo); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query, 20);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM orders o JOIN customers c ON c.id = o.customer_id ${whereSql}`, params);
  const sort = req.query.sort === 'event' ? 'o.event_date ASC, o.id' : 'o.created_at DESC, o.id DESC';
  const data = await query(
    `SELECT ${LIST_COLUMNS}, c.full_name AS customer_name, c.phone AS customer_phone,
            (SELECT COALESCE(SUM(IF(p.kind = 'REFUND', -p.amount, p.amount)),0) FROM payments p WHERE p.order_id = o.id) AS amount_paid
       FROM orders o JOIN customers c ON c.id = o.customer_id ${whereSql}
      ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  const counts = await query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  res.json({
    data: data.map((o) => ({ ...o, has_custom_cake: !!o.has_custom_cake })),
    meta: pageMeta(total, pg),
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  });
}

async function getOne(req, res) {
  res.json({ order: await svc.getOrderDetail(req.params.id) });
}

// US17 - Update order details
async function update(req, res) {
  await svc.updateOrderDetails(req, req.params.id, req.body);
  res.json({ order: await svc.getOrderDetail(req.params.id), message: 'Order updated' });
}

// US19 - Confirm order
async function confirm(req, res) {
  await svc.confirmOrder(req, req.params.id, req.body);
  res.json({ order: await svc.getOrderDetail(req.params.id), message: 'Order confirmed' });
}

// US17 / US23 - Update status
async function changeStatus(req, res) {
  await svc.changeStatus(req, req.params.id, req.body);
  res.json({ order: await svc.getOrderDetail(req.params.id), message: 'Order status updated' });
}

module.exports = { create, myOrders, myOrder, cancelMyOrder, payMyOrder, testCards, list, getOne, update, confirm, changeStatus };
