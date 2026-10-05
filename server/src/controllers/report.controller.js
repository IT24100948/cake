const { query } = require('../config/db');
const { toDateString } = require('../utils/helpers');

const EXCLUDED = `('CANCELLED','REJECTED')`;

// Management & Reporting - dashboard KPIs
async function summary(req, res) {
  const today = toDateString();
  const [k] = await query(
    `SELECT
       (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = ?) AS orders_today,
       (SELECT COUNT(*) FROM orders WHERE status = 'PENDING') AS pending_orders,
       (SELECT COUNT(*) FROM orders WHERE status NOT IN ('COMPLETED','CANCELLED','REJECTED','PENDING')) AS in_progress_orders,
       (SELECT COUNT(*) FROM orders WHERE event_date = ? AND status NOT IN ${EXCLUDED}) AS due_today,
       (SELECT COALESCE(SUM(IF(kind = 'REFUND', -amount, amount)),0) FROM payments WHERE DATE(paid_at) = ?) AS revenue_today,
       (SELECT COALESCE(SUM(IF(kind = 'REFUND', -amount, amount)),0) FROM payments WHERE YEAR(paid_at) = YEAR(CURDATE()) AND MONTH(paid_at) = MONTH(CURDATE())) AS revenue_month,
       (SELECT COALESCE(SUM(o.total_amount - COALESCE((SELECT SUM(IF(p.kind = 'REFUND', -p.amount, p.amount)) FROM payments p WHERE p.order_id = o.id),0)),0)
          FROM orders o WHERE o.status NOT IN ('PENDING','CANCELLED','REJECTED') AND o.payment_status IN ('UNPAID','PARTIALLY_PAID')) AS outstanding_balance,
       (SELECT COUNT(*) FROM products WHERE stock_quantity <= reorder_level) AS low_stock_products,
       (SELECT COUNT(*) FROM customers) AS total_customers,
       (SELECT COUNT(*) FROM customers WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())) AS new_customers_month`,
    [today, today, today]
  );
  res.json(Object.fromEntries(Object.entries(k).map(([key, v]) => [key, Number(v)])));
}

async function ordersByStatus(req, res) {
  const data = await query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC');
  res.json({ data });
}

/** Sales = payments received minus refunds, per day (defaults to the last 30 days). */
async function sales(req, res) {
  const to = req.query.to || toDateString();
  const fromDefault = new Date();
  fromDefault.setDate(fromDefault.getDate() - 29);
  const from = req.query.from || toDateString(fromDefault);
  const payments = await query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m-%d') AS day, SUM(IF(kind = 'REFUND', -amount, amount)) AS revenue, SUM(kind = 'PAYMENT') AS payments
       FROM payments WHERE paid_at BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    [`${from} 00:00:00`, `${to} 23:59:59`]
  );
  const orders = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total_amount) AS order_value
       FROM orders WHERE created_at BETWEEN ? AND ? AND status NOT IN ${EXCLUDED} GROUP BY day ORDER BY day`,
    [`${from} 00:00:00`, `${to} 23:59:59`]
  );
  // Fill every day in range so the chart has no gaps.
  const series = [];
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const day = toDateString(d);
    const p = payments.find((x) => x.day === day);
    const o = orders.find((x) => x.day === day);
    series.push({ day, revenue: Number(p?.revenue || 0), orders: Number(o?.orders || 0), order_value: Number(o?.order_value || 0) });
  }
  const [byMethod, byType] = await Promise.all([
    query(`SELECT method, SUM(IF(kind = 'REFUND', -amount, amount)) AS amount, SUM(kind = 'PAYMENT') AS count FROM payments WHERE paid_at BETWEEN ? AND ? GROUP BY method`,
      [`${from} 00:00:00`, `${to} 23:59:59`]),
    query(`SELECT oi.product_type, SUM(oi.line_total) AS amount FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ? AND o.status NOT IN ${EXCLUDED} GROUP BY oi.product_type`,
      [`${from} 00:00:00`, `${to} 23:59:59`]),
  ]);
  const [custom] = await query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(o.cake_quote_amount),0) AS amount FROM orders o JOIN cake_requirements cr ON cr.order_id = o.id
      WHERE o.created_at BETWEEN ? AND ? AND o.status NOT IN ${EXCLUDED}`,
    [`${from} 00:00:00`, `${to} 23:59:59`]
  );
  res.json({
    from, to, series,
    totals: {
      revenue: series.reduce((s, x) => s + x.revenue, 0),
      orders: series.reduce((s, x) => s + x.orders, 0),
      orderValue: series.reduce((s, x) => s + x.order_value, 0),
    },
    byMethod: byMethod.map((m) => ({ ...m, amount: Number(m.amount) })),
    byType: byType.map((t) => ({ ...t, amount: Number(t.amount) })),
    customCakes: { count: Number(custom.count), amount: Number(custom.amount) },
  });
}

async function topProducts(req, res) {
  const limit = Math.min(20, parseInt(req.query.limit, 10) || 5);
  const data = await query(
    `SELECT oi.product_id, oi.product_name, oi.product_type, SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ${EXCLUDED}
      GROUP BY oi.product_id, oi.product_name, oi.product_type ORDER BY quantity DESC LIMIT ?`,
    [limit]
  );
  res.json({ data: data.map((d) => ({ ...d, quantity: Number(d.quantity), revenue: Number(d.revenue) })) });
}

async function lowStock(req, res) {
  const data = await query(
    `SELECT p.id, p.name, p.sku, p.product_type, p.stock_quantity, p.reorder_level, c.name AS category_name
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.stock_quantity <= p.reorder_level ORDER BY p.stock_quantity ASC, p.name`
  );
  res.json({ data });
}

async function upcoming(req, res) {
  const data = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.fulfillment_type, o.event_date, o.total_amount,
            c.full_name AS customer_name
       FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.event_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND o.status NOT IN ('COMPLETED','CANCELLED','REJECTED')
      ORDER BY o.event_date, o.id LIMIT 10`
  );
  res.json({ data });
}

module.exports = { summary, ordersByStatus, sales, topProducts, lowStock, upcoming };
