const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');
const { paginate, pageMeta } = require('../utils/helpers');

const STAFF_COLUMNS = `s.id, s.full_name, s.email, s.phone, s.role_id, r.name AS role_name, s.is_active,
  s.must_change_password, s.last_login_at, s.created_at, s.updated_at, s.locked_until`;

async function findStaff(id) {
  const rows = await query(`SELECT ${STAFF_COLUMNS} FROM staff s JOIN roles r ON r.id = s.role_id WHERE s.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound('Staff member not found');
  return rows[0];
}

async function assertRoleExists(roleId) {
  const rows = await query('SELECT id, name FROM roles WHERE id = ?', [roleId]);
  if (!rows.length) throw ApiError.unprocessable('Invalid role', { roleId: 'Selected role does not exist' });
  return rows[0];
}

/** Number of active staff (other than `excludeId`) holding the 'roles.manage' + 'staff.manage' permissions. */
async function countOtherActiveAdmins(excludeId) {
  const [row] = await query(
    `SELECT COUNT(DISTINCT s.id) AS n FROM staff s
       JOIN role_permissions rp ON rp.role_id = s.role_id
       JOIN permissions p ON p.id = rp.permission_id AND p.code = 'roles.manage'
      WHERE s.is_active = 1 AND s.id <> ?`,
    [excludeId]
  );
  return row.n;
}

async function list(req, res) {
  const { search, roleId, status } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(s.full_name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (roleId) { where.push('s.role_id = ?'); params.push(roleId); }
  if (status === 'active') where.push('s.is_active = 1');
  if (status === 'inactive') where.push('s.is_active = 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pg = paginate(req.query);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM staff s ${whereSql}`, params);
  const data = await query(
    `SELECT ${STAFF_COLUMNS} FROM staff s JOIN roles r ON r.id = s.role_id ${whereSql}
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  res.json({ data, meta: pageMeta(total, pg) });
}

async function getOne(req, res) {
  res.json({ staff: await findStaff(req.params.id) });
}

// US01 - Create staff accounts
async function create(req, res) {
  const { fullName, email, phone, roleId, password } = req.body;
  const role = await assertRoleExists(roleId);
  const exists = await query('SELECT id FROM staff WHERE email = ?', [email]);
  if (exists.length) throw ApiError.conflict('A staff account with this email already exists');
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO staff (full_name, email, phone, password_hash, role_id, must_change_password, created_by)
     VALUES (?,?,?,?,?,1,?)`,
    [fullName, email, phone || null, hash, roleId, req.staff.id]
  );
  await logAudit(req, 'STAFF_CREATED', {
    entityType: 'staff', entityId: result.insertId, details: { fullName, email, role: role.name },
  });
  res.status(201).json({ staff: await findStaff(result.insertId), message: 'Staff account created' });
}

async function update(req, res) {
  const current = await findStaff(req.params.id);
  const { fullName, email, phone } = req.body;
  if (email !== current.email) {
    const exists = await query('SELECT id FROM staff WHERE email = ? AND id <> ?', [email, current.id]);
    if (exists.length) throw ApiError.conflict('A staff account with this email already exists');
  }
  await query('UPDATE staff SET full_name = ?, email = ?, phone = ? WHERE id = ?', [fullName, email, phone || null, current.id]);
  await logAudit(req, 'STAFF_UPDATED', {
    entityType: 'staff', entityId: current.id,
    details: { before: { fullName: current.full_name, email: current.email, phone: current.phone }, after: { fullName, email, phone } },
  });
  res.json({ staff: await findStaff(current.id), message: 'Staff details updated' });
}

// US02 - Assign a role to a staff member
async function assignRole(req, res) {
  const current = await findStaff(req.params.id);
  const role = await assertRoleExists(req.body.roleId);
  if (current.id === req.staff.id && role.id !== current.role_id) {
    const perms = await query(
      `SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ? AND p.code = 'roles.manage'`, [role.id]
    );
    if (!perms.length) throw ApiError.badRequest('You cannot remove your own role-management access');
  }
  await query('UPDATE staff SET role_id = ? WHERE id = ?', [role.id, current.id]);
  await logAudit(req, 'STAFF_ROLE_CHANGED', {
    entityType: 'staff', entityId: current.id, details: { from: current.role_name, to: role.name },
  });
  res.json({ staff: await findStaff(current.id), message: `Role changed to ${role.name}` });
}

// US05 - Activate / deactivate staff accounts
async function setStatus(req, res) {
  const current = await findStaff(req.params.id);
  const isActive = req.body.isActive;
  if (!isActive) {
    if (current.id === req.staff.id) throw ApiError.badRequest('You cannot deactivate your own account');
    if ((await countOtherActiveAdmins(current.id)) === 0) {
      throw ApiError.badRequest('At least one active administrator account must remain');
    }
  }
  await query(
    `UPDATE staff SET is_active = ?${isActive ? ', failed_login_attempts = 0, locked_until = NULL' : ''} WHERE id = ?`,
    [isActive ? 1 : 0, current.id]
  );
  await logAudit(req, isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED', {
    entityType: 'staff', entityId: current.id, details: { email: current.email, reason: req.body.reason || null },
  });
  res.json({ staff: await findStaff(current.id), message: isActive ? 'Account activated' : 'Account deactivated' });
}

// US04 - Admin resets a staff password (staff must change it at next login)
async function resetPassword(req, res) {
  const current = await findStaff(req.params.id);
  const hash = await bcrypt.hash(req.body.password, 10);
  await query(
    'UPDATE staff SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
    [hash, current.id]
  );
  await logAudit(req, 'STAFF_PASSWORD_RESET', { entityType: 'staff', entityId: current.id, details: { email: current.email } });
  res.json({ message: 'Temporary password set. The staff member must change it at next login.' });
}

/** Minimal active staff list used for assigning deliveries. */
async function options(req, res) {
  const data = await query(
    `SELECT s.id, s.full_name, r.name AS role_name FROM staff s JOIN roles r ON r.id = s.role_id
      WHERE s.is_active = 1 ORDER BY s.full_name`
  );
  res.json({ data });
}

module.exports = { list, getOne, create, update, assignRole, setStatus, resetPassword, options };
