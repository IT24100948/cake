const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { setAuthCookie, clearAuthCookie, loadStaff } = require('../middleware/auth');
const { LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES } = require('../config/constants');

const INVALID = 'Invalid email or password';

// US03 - Secure staff login
async function login(req, res) {
  const { email, password } = req.body;
  const rows = await query('SELECT * FROM staff WHERE email = ?', [email]);
  const staff = rows[0];

  if (!staff) {
    await logAudit(req, 'LOGIN_FAILED', { details: { email, reason: 'Unknown email' } });
    throw ApiError.unauthorized(INVALID);
  }
  const actor = { type: 'STAFF', id: staff.id, name: staff.full_name };

  if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
    await logAudit(req, 'LOGIN_BLOCKED', { actor, entityType: 'staff', entityId: staff.id, details: { reason: 'Account locked' } });
    const mins = Math.ceil((new Date(staff.locked_until) - new Date()) / 60000);
    throw new ApiError(423, `Too many failed attempts. Try again in ${mins} minute(s).`);
  }

  const ok = await bcrypt.compare(password, staff.password_hash);
  if (!ok) {
    const attempts = staff.failed_login_attempts + 1;
    const lock = attempts >= LOGIN_MAX_ATTEMPTS;
    await query(
      `UPDATE staff SET failed_login_attempts = ?, locked_until = ${lock ? 'DATE_ADD(NOW(), INTERVAL ? MINUTE)' : 'NULL'} WHERE id = ?`,
      lock ? [0, LOGIN_LOCK_MINUTES, staff.id] : [attempts, staff.id]
    );
    await logAudit(req, lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', {
      actor, entityType: 'staff', entityId: staff.id, details: { reason: 'Wrong password', attempts },
    });
    if (lock) throw new ApiError(423, `Too many failed attempts. Account locked for ${LOGIN_LOCK_MINUTES} minutes.`);
    throw ApiError.unauthorized(INVALID);
  }

  if (!staff.is_active) {
    await logAudit(req, 'LOGIN_BLOCKED', { actor, entityType: 'staff', entityId: staff.id, details: { reason: 'Account deactivated' } });
    throw ApiError.forbidden('Your account has been deactivated. Please contact the administrator.');
  }

  await query('UPDATE staff SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [staff.id]);
  setAuthCookie(res, 'staff', staff.id);
  await logAudit(req, 'LOGIN_SUCCESS', { actor, entityType: 'staff', entityId: staff.id });
  res.json({ staff: await loadStaff(staff.id) });
}

async function logout(req, res) {
  if (req.staff) await logAudit(req, 'LOGOUT', { entityType: 'staff', entityId: req.staff.id });
  clearAuthCookie(res, 'staff');
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  res.json({ staff: req.staff });
}

// US04 - Manage own password
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const [row] = await query('SELECT password_hash FROM staff WHERE id = ?', [req.staff.id]);
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw ApiError.unprocessable('Current password is incorrect', { currentPassword: 'Current password is incorrect' });
  }
  if (await bcrypt.compare(newPassword, row.password_hash)) {
    throw ApiError.unprocessable('Choose a new password', { newPassword: 'New password must be different from the current password' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    'UPDATE staff SET password_hash = ?, must_change_password = 0, password_changed_at = NOW() WHERE id = ?',
    [hash, req.staff.id]
  );
  await logAudit(req, 'PASSWORD_CHANGED', { entityType: 'staff', entityId: req.staff.id });
  res.json({ message: 'Password updated successfully', staff: await loadStaff(req.staff.id) });
}

module.exports = { login, logout, me, changePassword };
