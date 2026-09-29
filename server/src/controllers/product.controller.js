const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { paginate, pageMeta } = require('../utils/helpers');
const { publicUrl, removeUpload } = require('../middleware/upload');

const PRODUCT_COLUMNS = `p.id, p.category_id, c.name AS category_name, p.name, p.sku, p.description, p.price,
  p.image_url, p.product_type, p.is_available, p.stock_quantity, p.reorder_level,
  (p.stock_quantity <= p.reorder_level) AS is_low_stock, p.created_at, p.updated_at`;

const SORTS = {
  newest: 'p.created_at DESC',
  name: 'p.name ASC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  stock_asc: 'p.stock_quantity ASC',
};

function normalize(p) {
  return { ...p, is_available: !!p.is_available, is_low_stock: !!p.is_low_stock };
}

async function findProduct(id) {
  const rows = await query(`SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound('Product not found');
  return normalize(rows[0]);
}

async function assertCategory(categoryId, productType) {
  const [cat] = await query('SELECT id, type FROM categories WHERE id = ?', [categoryId]);
  if (!cat) throw ApiError.unprocessable('Invalid category', { categoryId: 'Selected category does not exist' });
  if (cat.type !== productType) {
    throw ApiError.unprocessable('Category mismatch', { categoryId: `Choose a ${productType.toLowerCase()} category` });
  }
}

/** Shared filtering for the staff list (US08) and the public catalog (US11). */
async function searchProducts(q, { publicOnly }) {
  const where = [];
  const params = [];
  if (publicOnly) where.push('p.is_available = 1');
  if (q.search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR c.name LIKE ?)');
    params.push(...Array(4).fill(`%${q.search}%`));
  }
  if (q.type) { where.push('p.product_type = ?'); params.push(q.type); }
  if (q.categoryId) { where.push('p.category_id = ?'); params.push(q.categoryId); }
  if (!publicOnly && q.availability === 'available') where.push('p.is_available = 1');
  if (!publicOnly && q.availability === 'unavailable') where.push('p.is_available = 0');
  if (!publicOnly && q.lowStock === 'true') where.push('p.stock_quantity <= p.reorder_level');
  if (q.minPrice) { where.push('p.price >= ?'); params.push(q.minPrice); }
  if (q.maxPrice) { where.push('p.price <= ?'); params.push(q.maxPrice); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(q, publicOnly ? 12 : 20);
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`, params
  );
  const rows = await query(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}
     ORDER BY ${SORTS[q.sort] || SORTS.newest}, p.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return { data: rows.map(normalize), meta: pageMeta(total, pg) };
}

// ----- Public catalog (US11) -----
async function catalogList(req, res) {
  const result = await searchProducts(req.query, { publicOnly: true });
  // Customers see stock availability but not internal reorder levels.
  result.data = result.data.map(({ reorder_level, is_low_stock, ...p }) => p);
  res.json(result);
}

async function catalogGet(req, res) {
  const p = await findProduct(req.params.id);
  if (!p.is_available) throw ApiError.notFound('Product not found');
  const { reorder_level, is_low_stock, ...pub } = p;
  res.json({ product: pub });
}

// ----- Staff product management -----
// US08 - View and search products
async function list(req, res) {
  res.json(await searchProducts(req.query, { publicOnly: false }));
}

async function getOne(req, res) {
  res.json({ product: await findProduct(req.params.id) });
}

// US07 - Add new products
async function create(req, res) {
  const b = req.body;
  await assertCategory(b.categoryId, b.productType);
  const imageUrl = publicUrl(req.file);
  const id = await withTransaction(async (conn) => {
    const r = await conn.q(
      `INSERT INTO products (category_id, name, sku, description, price, image_url, product_type, is_available,
                             stock_quantity, reorder_level, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.categoryId, b.name, b.sku, b.description || null, b.price, imageUrl, b.productType,
        b.isAvailable === false ? 0 : 1, b.stockQuantity, b.reorderLevel, req.staff.id, req.staff.id]
    );
    if (b.stockQuantity > 0) {
      await conn.q(
        `INSERT INTO inventory_transactions (product_id, change_qty, type, reason, balance_after, staff_id)
         VALUES (?,?, 'INITIAL', 'Opening stock', ?, ?)`,
        [r.insertId, b.stockQuantity, b.stockQuantity, req.staff.id]
      );
    }
    return r.insertId;
  });
  await logAudit(req, 'PRODUCT_CREATED', {
    entityType: 'product', entityId: id, details: { name: b.name, sku: b.sku, price: b.price, stock: b.stockQuantity },
  });
  res.status(201).json({ product: await findProduct(id), message: 'Product added' });
}

// US09 - Update product information (price, description, image, availability)
async function update(req, res) {
  const before = await findProduct(req.params.id);
  const b = req.body;
  await assertCategory(b.categoryId, b.productType);
  let imageUrl = before.image_url;
  if (req.file) imageUrl = publicUrl(req.file);
  else if (b.removeImage === true) imageUrl = null;

  await query(
    `UPDATE products SET category_id = ?, name = ?, sku = ?, description = ?, price = ?, image_url = ?,
            product_type = ?, is_available = ?, reorder_level = ?, updated_by = ? WHERE id = ?`,
    [b.categoryId, b.name, b.sku, b.description || null, b.price, imageUrl, b.productType,
      b.isAvailable === false ? 0 : 1, b.reorderLevel, req.staff.id, before.id]
  );
  if (imageUrl !== before.image_url) removeUpload(before.image_url);

  const changes = {};
  const map = { name: 'name', sku: 'sku', description: 'description', price: 'price', productType: 'product_type', reorderLevel: 'reorder_level', categoryId: 'category_id' };
  for (const [k, col] of Object.entries(map)) {
    if (String(b[k] ?? '') !== String(before[col] ?? '')) changes[k] = { from: before[col], to: b[k] };
  }
  if ((b.isAvailable !== false) !== before.is_available) changes.isAvailable = { from: before.is_available, to: b.isAvailable !== false };
  if (imageUrl !== before.image_url) changes.image = 'changed';
  await logAudit(req, 'PRODUCT_UPDATED', { entityType: 'product', entityId: before.id, details: { name: b.name, changes } });
  res.json({ product: await findProduct(before.id), message: 'Product updated' });
}

async function setAvailability(req, res) {
  const before = await findProduct(req.params.id);
  const isAvailable = req.body.isAvailable;
  await query('UPDATE products SET is_available = ?, updated_by = ? WHERE id = ?', [isAvailable ? 1 : 0, req.staff.id, before.id]);
  await logAudit(req, 'PRODUCT_AVAILABILITY_CHANGED', {
    entityType: 'product', entityId: before.id, details: { name: before.name, isAvailable },
  });
  res.json({ product: await findProduct(before.id), message: isAvailable ? 'Product is now available' : 'Product marked unavailable' });
}

module.exports = { catalogList, catalogGet, list, getOne, create, update, setAvailability, findProduct };
