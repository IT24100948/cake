const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { jwt: jwtCfg, cookieSecure } = require('../config/env');
const ApiError = require('../utils/ApiError');

const STAFF_COOKIE = 'devma_staff';
const CUSTOMER_COOKIE = 'devma_customer';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  path: '/',
};

function signToken(typ, id) {
  return jwt.sign({ sub: id, typ }, jwtCfg.secret, { expiresIn: jwtCfg.expiresIn });
}

function setAuthCookie(res, typ, id) {
  const token = signToken(typ, id);
  const decoded = jwt.decode(token);
  res.cookie(typ === 'staff' ? STAFF_COOKIE : CUSTOMER_COOKIE, token, {
    ...cookieOptions,
    expires: new Date(decoded.exp * 1000),
  });
  return token;
}

function clearAuthCookie(res, typ) {
  res.clearCookie(typ === 'staff' ? STAFF_COOKIE : CUSTOMER_COOKIE, cookieOptions);
}

/** Reads the token from the cookie, or from an `Authorization: Bearer` header (for Postman). */
function readToken(req, cookieName, typ) {
  let token = req.cookies?.[cookieName];
  const header = req.get('authorization');
  if (!token && header?.startsWith('Bearer ')) token = header.slice(7);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtCfg.secret);
    return payload.typ === typ ? payload : null;
  } catch {
    return null;
  }
}

/** Loads a staff member with role name and permission codes. */
async function loadStaff(id) {
  const rows = await query(
    `SELECT s.id, s.full_name, s.email, s.phone, s.role_id, s.is_active, s.must_change_password,
            s.last_login_at, r.name AS role_name
       FROM staff s JOIN roles r ON r.id = s.role_id WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const staff = rows[0];
  const perms = await query(
    `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
    [staff.role_id]
  );
  staff.permissions = perms.map((p) => p.code);
  staff.is_active = !!staff.is_active;
  staff.must_change_password = !!staff.must_change_password;
  return staff;
}

/**
 * Requires a logged-in, active staff member (US03, US05).
 * Staff flagged with must_change_password may only use routes marked allowPasswordChange.
 */
function requireStaff({ allowPasswordChange = false } = {}) {
  return async (req, res, next) => {
    const payload = readToken(req, STAFF_COOKIE, 'staff');
    if (!payload) throw ApiError.unauthorized('Please log in to continue');
    const staff = await loadStaff(payload.sub);
    if (!staff || !staff.is_active) {
      clearAuthCookie(res, 'staff');
      throw ApiError.unauthorized('Your account is inactive or no longer exists');
    }
    if (staff.must_change_password && !allowPasswordChange) {
      const err = ApiError.forbidden('You must change your password before continuing');
      err.code = 'PASSWORD_CHANGE_REQUIRED';
      throw err;
    }
    req.staff = staff;
    next();
  };
}

/** Requires the logged-in staff member's role to include every given permission (US02). */
function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.staff) throw ApiError.unauthorized();
    const missing = codes.filter((c) => !req.staff.permissions.includes(c));
    if (missing.length) throw ApiError.forbidden();
    next();
  };
}

/** Requires the logged-in staff member to have at least one of the given permissions. */
function requireAnyPermission(...codes) {
  return (req, res, next) => {
    if (!req.staff) throw ApiError.unauthorized();
    if (!codes.some((c) => req.staff.permissions.includes(c))) throw ApiError.forbidden();
    next();
  };
}

/** Requires a logged-in, active customer (US12). */
async function requireCustomer(req, res, next) {
  const payload = readToken(req, CUSTOMER_COOKIE, 'customer');
  if (!payload) throw ApiError.unauthorized('Please log in to continue');
  const rows = await query(
    'SELECT id, full_name, email, phone, address, city, is_active, created_at FROM customers WHERE id = ?',
    [payload.sub]
  );
  if (!rows.length || !rows[0].is_active) {
    clearAuthCookie(res, 'customer');
    throw ApiError.unauthorized('Your account is inactive or no longer exists');
  }
  req.customer = rows[0];
  next();
}

module.exports = {
  setAuthCookie, clearAuthCookie, loadStaff,
  requireStaff, requirePermission, requireAnyPermission, requireCustomer,
};
