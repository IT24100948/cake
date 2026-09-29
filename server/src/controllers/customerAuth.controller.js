const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const PUBLIC_COLUMNS = 'id, full_name, email, phone, address, city, created_at';

async function loadCustomer(id) {
  const [c] = await query(`SELECT ${PUBLIC_COLUMNS} FROM customers WHERE id = ?`, [id]);
  return c;
}

// US12 - Customer creates an account
async function register(req, res) {
  const { fullName, email, phone, address, city, password } = req.body;
  const exists = await query('SELECT id FROM customers WHERE email = ?', [email]);
  if (exists.length) throw ApiError.unprocessable('Email already registered', { email: 'An account with this email already exists. Please log in.' });
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    'INSERT INTO customers (full_name, email, phone, address, city, password_hash) VALUES (?,?,?,?,?,?)',
    [fullName, email, phone, address || null, city || null, hash]
  );
  const customer = await loadCustomer(r.insertId);
  setAuthCookie(res, 'customer', customer.id);
  await logAudit(req, 'CUSTOMER_REGISTERED', {
    actor: { type: 'CUSTOMER', id: customer.id, name: customer.full_name }, entityType: 'customer', entityId: customer.id,
  });
  res.status(201).json({ customer, message: 'Account created successfully' });
}

async function login(req, res) {
  const { email, password } = req.body;
  const [c] = await query('SELECT * FROM customers WHERE email = ?', [email]);
  if (!c || !(await bcrypt.compare(password, c.password_hash))) {
    await logAudit(req, 'CUSTOMER_LOGIN_FAILED', { actor: c ? { type: 'CUSTOMER', id: c.id, name: c.full_name } : undefined, details: { email } });
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!c.is_active) throw ApiError.forbidden('Your account has been disabled. Please contact us.');
  setAuthCookie(res, 'customer', c.id);
  await logAudit(req, 'CUSTOMER_LOGIN', { actor: { type: 'CUSTOMER', id: c.id, name: c.full_name }, entityType: 'customer', entityId: c.id });
  res.json({ customer: await loadCustomer(c.id) });
}

async function logout(req, res) {
  clearAuthCookie(res, 'customer');
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  const { is_active, ...customer } = req.customer;
  res.json({ customer });
}

async function updateProfile(req, res) {
  const { fullName, phone, address, city } = req.body;
  await query('UPDATE customers SET full_name = ?, phone = ?, address = ?, city = ? WHERE id = ?',
    [fullName, phone, address || null, city || null, req.customer.id]);
  await logAudit(req, 'CUSTOMER_PROFILE_UPDATED', { entityType: 'customer', entityId: req.customer.id });
  res.json({ customer: await loadCustomer(req.customer.id), message: 'Profile updated' });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const [row] = await query('SELECT password_hash FROM customers WHERE id = ?', [req.customer.id]);
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw ApiError.unprocessable('Current password is incorrect', { currentPassword: 'Current password is incorrect' });
  }
  await query('UPDATE customers SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.customer.id]);
  await logAudit(req, 'CUSTOMER_PASSWORD_CHANGED', { entityType: 'customer', entityId: req.customer.id });
  res.json({ message: 'Password updated' });
}

module.exports = { register, login, logout, me, updateProfile, changePassword };
