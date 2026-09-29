const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { paginate, pageMeta } = require('../utils/helpers');

// US10 - Inventory overview with stock levels
async function list(req, res) {
  const { search, type, status } = req.query;
  const where = [];
  const params = [];
  if (search) { where.push('(p.name LIKE ? OR p.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (type) { where.push('p.product_type = ?'); params.push(type); }
  if (status === 'low') where.push('p.stock_quantity <= p.reorder_level AND p.stock_quantity > 0');
  if (status === 'out') where.push('p.stock_quantity = 0');
  if (status === 'ok') where.push('p.stock_quantity > p.reorder_level');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query, 25);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);
  const data = await query(
    `SELECT p.id, p.name, p.sku, p.product_type, p.stock_quantity, p.reorder_level, p.is_available, p.image_url,
            c.name AS category_name,
            (p.stock_quantity <= p.reorder_level) AS is_low_stock,
            (SELECT MAX(t.created_at) FROM inventory_transactions t WHERE t.product_id = p.id) AS last_movement_at
       FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}
      ORDER BY (p.stock_quantity <= p.reorder_level) DESC, p.name LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  const [summary] = await query(
    `SELECT COUNT(*) AS total_products, COALESCE(SUM(stock_quantity),0) AS total_units,
            COALESCE(SUM(stock_quantity <= reorder_level AND stock_quantity > 0),0) AS low_stock,
            COALESCE(SUM(stock_quantity = 0),0) AS out_of_stock
       FROM products`
  );
  res.json({
    data: data.map((d) => ({ ...d, is_low_stock: !!d.is_low_stock, is_available: !!d.is_available })),
    meta: pageMeta(total, pg),
    summary: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Number(v)])),
  });
}

/**
 * US10 - Manage inventory quantities.
 * RESTOCK: adds quantity. ADJUSTMENT: sets a counted quantity (stock take) or subtracts
 * damaged/expired stock. Stock can never fall below zero.
 */
async function adjust(req, res) {
  const productId = req.params.productId;
  const { type, quantity, mode, reason } = req.body;
  const result = await withTransaction(async (conn) => {
    const [p] = await conn.q('SELECT id, name, stock_quantity FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!p) throw ApiError.notFound('Product not found');
    let change;
    if (type === 'RESTOCK') change = quantity;
    else if (mode === 'SET') change = quantity - p.stock_quantity;
    else change = -quantity; // mode === 'REMOVE'
    const balance = p.stock_quantity + change;
    if (balance < 0) {
      throw ApiError.unprocessable('Insufficient stock', { quantity: `Only ${p.stock_quantity} unit(s) in stock` });
    }
    if (change === 0) throw ApiError.unprocessable('No change', { quantity: 'The stock level is already at this quantity' });
    await conn.q('UPDATE products SET stock_quantity = ?, updated_by = ? WHERE id = ?', [balance, req.staff.id, p.id]);
    await conn.q(
      `INSERT INTO inventory_transactions (product_id, change_qty, type, reason, balance_after, staff_id)
       VALUES (?,?,?,?,?,?)`,
      [p.id, change, type, reason, balance, req.staff.id]
    );
    return { product: p, change, balance };
  });
  await logAudit(req, 'STOCK_ADJUSTED', {
    entityType: 'product', entityId: productId,
    details: { name: result.product.name, type, change: result.change, from: result.product.stock_quantity, to: result.balance, reason },
  });
  res.json({ message: `Stock updated to ${result.balance}`, stockQuantity: result.balance });
}

async function history(req, res) {
  const [p] = await query('SELECT id, name, sku, stock_quantity FROM products WHERE id = ?', [req.params.productId]);
  if (!p) throw ApiError.notFound('Product not found');
  const pg = paginate(req.query, 20);
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM inventory_transactions WHERE product_id = ?', [p.id]);
  const data = await query(
    `SELECT t.*, s.full_name AS staff_name, o.order_number
       FROM inventory_transactions t
       LEFT JOIN staff s ON s.id = t.staff_id
       LEFT JOIN orders o ON o.id = t.order_id
      WHERE t.product_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`,
    [p.id, pg.limit, pg.offset]
  );
  res.json({ product: p, data, meta: pageMeta(total, pg) });
}

module.exports = { list, adjust, history };
