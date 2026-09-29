const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');

async function list(req, res) {
  const { type } = req.query;
  const data = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ${type ? 'WHERE c.type = ?' : ''} ORDER BY c.type, c.name`,
    type ? [type] : []
  );
  res.json({ data });
}

async function create(req, res) {
  const { name, type, description } = req.body;
  const r = await query('INSERT INTO categories (name, type, description) VALUES (?,?,?)', [name, type, description || null]);
  await logAudit(req, 'CATEGORY_CREATED', { entityType: 'category', entityId: r.insertId, details: { name, type } });
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [r.insertId]);
  res.status(201).json({ category, message: 'Category created' });
}

async function update(req, res) {
  const [existing] = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!existing) throw ApiError.notFound('Category not found');
  const { name, description } = req.body;
  await query('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description || null, existing.id]);
  await logAudit(req, 'CATEGORY_UPDATED', { entityType: 'category', entityId: existing.id, details: { from: existing.name, to: name } });
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [existing.id]);
  res.json({ category, message: 'Category updated' });
}

async function remove(req, res) {
  const [existing] = await query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!existing) throw ApiError.notFound('Category not found');
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [existing.id]);
  if (n > 0) throw ApiError.conflict('This category contains products and cannot be deleted');
  await query('DELETE FROM categories WHERE id = ?', [existing.id]);
  await logAudit(req, 'CATEGORY_DELETED', { entityType: 'category', entityId: existing.id, details: { name: existing.name } });
  res.json({ message: 'Category deleted' });
}

module.exports = { list, create, update, remove };
