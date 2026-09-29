const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { paginate, pageMeta } = require('../utils/helpers');

// US24 - Customer receives order status information
async function list(req, res) {
  const pg = paginate(req.query, 20);
  const where = req.query.unread === 'true' ? 'AND n.is_read = 0' : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM notifications n WHERE n.customer_id = ? ${where}`, [req.customer.id]);
  const data = await query(
    `SELECT n.*, o.order_number FROM notifications n LEFT JOIN orders o ON o.id = n.order_id
      WHERE n.customer_id = ? ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`,
    [req.customer.id, pg.limit, pg.offset]
  );
  res.json({ data: data.map((n) => ({ ...n, is_read: !!n.is_read })), meta: pageMeta(total, pg) });
}

async function unreadCount(req, res) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM notifications WHERE customer_id = ? AND is_read = 0', [req.customer.id]);
  res.json({ count: n });
}

async function markRead(req, res) {
  const r = await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?', [req.params.id, req.customer.id]);
  if (!r.affectedRows) throw ApiError.notFound('Notification not found');
  res.json({ message: 'Marked as read' });
}

async function markAllRead(req, res) {
  await query('UPDATE notifications SET is_read = 1 WHERE customer_id = ? AND is_read = 0', [req.customer.id]);
  res.json({ message: 'All notifications marked as read' });
}

module.exports = { list, unreadCount, markRead, markAllRead };
