const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('../utils/audit');

async function rolesWithPermissions() {
  const roles = await query(
    `SELECT r.id, r.name, r.description, r.is_system, r.created_at,
            (SELECT COUNT(*) FROM staff s WHERE s.role_id = r.id) AS staff_count
       FROM roles r ORDER BY r.is_system DESC, r.name`
  );
  const links = await query(
    'SELECT rp.role_id, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id'
  );
  for (const r of roles) {
    r.is_system = !!r.is_system;
    r.permissions = links.filter((l) => l.role_id === r.id).map((l) => l.code);
  }
  return roles;
}

async function listPermissions(req, res) {
  res.json({ data: await query('SELECT id, code, description, module FROM permissions ORDER BY module, id') });
}

async function list(req, res) {
  res.json({ data: await rolesWithPermissions() });
}

async function resolvePermissionIds(conn, codes) {
  const unique = [...new Set(codes)];
  if (!unique.length) return [];
  const rows = await conn.q('SELECT id, code FROM permissions WHERE code IN (?)', [unique]);
  if (rows.length !== unique.length) {
    throw ApiError.unprocessable('Invalid permissions', { permissions: 'One or more permissions are invalid' });
  }
  return rows.map((r) => r.id);
}

// US02 - Create role with permissions
async function create(req, res) {
  const { name, description, permissions = [] } = req.body;
  const id = await withTransaction(async (conn) => {
    const dup = await conn.q('SELECT id FROM roles WHERE name = ?', [name]);
    if (dup.length) throw ApiError.conflict('A role with this name already exists');
    const r = await conn.q('INSERT INTO roles (name, description) VALUES (?,?)', [name, description || null]);
    const ids = await resolvePermissionIds(conn, permissions);
    if (ids.length) await conn.q('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [ids.map((p) => [r.insertId, p])]);
    return r.insertId;
  });
  await logAudit(req, 'ROLE_CREATED', { entityType: 'role', entityId: id, details: { name, permissions } });
  const role = (await rolesWithPermissions()).find((r) => r.id === id);
  res.status(201).json({ role, message: 'Role created' });
}

// US02 - Update role permissions
async function update(req, res) {
  const id = req.params.id;
  const { name, description, permissions = [] } = req.body;
  const before = (await rolesWithPermissions()).find((r) => r.id === id);
  if (!before) throw ApiError.notFound('Role not found');
  if (before.name === 'Admin') {
    throw ApiError.badRequest('The Admin role always has full access and cannot be modified');
  }
  if (req.staff.role_id === id && !permissions.includes('roles.manage')) {
    throw ApiError.badRequest('You cannot remove role-management access from your own role');
  }
  await withTransaction(async (conn) => {
    const dup = await conn.q('SELECT id FROM roles WHERE name = ? AND id <> ?', [name, id]);
    if (dup.length) throw ApiError.conflict('A role with this name already exists');
    // System role names are fixed; their permissions can still be edited.
    await conn.q('UPDATE roles SET name = ?, description = ? WHERE id = ?', [before.is_system ? before.name : name, description || null, id]);
    await conn.q('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    const ids = await resolvePermissionIds(conn, permissions);
    if (ids.length) await conn.q('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [ids.map((p) => [id, p])]);
  });
  await logAudit(req, 'ROLE_UPDATED', {
    entityType: 'role', entityId: id,
    details: { name, added: permissions.filter((p) => !before.permissions.includes(p)), removed: before.permissions.filter((p) => !permissions.includes(p)) },
  });
  const role = (await rolesWithPermissions()).find((r) => r.id === id);
  res.json({ role, message: 'Role updated' });
}

async function remove(req, res) {
  const role = (await rolesWithPermissions()).find((r) => r.id === req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.is_system) throw ApiError.badRequest('System roles cannot be deleted');
  if (role.staff_count > 0) throw ApiError.conflict('This role is assigned to staff members. Reassign them first.');
  await query('DELETE FROM roles WHERE id = ?', [role.id]);
  await logAudit(req, 'ROLE_DELETED', { entityType: 'role', entityId: role.id, details: { name: role.name } });
  res.json({ message: 'Role deleted' });
}

module.exports = { listPermissions, list, create, update, remove };
