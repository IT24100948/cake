const { pool } = require('../config/db');

/**
 * Write an audit record (US06). Never throws - auditing must not break the main action.
 * @param {object} req  Express request (used for actor, IP and user agent). May be null.
 * @param {string} action  e.g. 'STAFF_CREATED'
 * @param {object} [opts] { entityType, entityId, details, actor, conn }
 */
async function logAudit(req, action, opts = {}) {
  const { entityType = null, entityId = null, details = null, conn } = opts;
  let actor = opts.actor;
  if (!actor && req) {
    if (req.staff) actor = { type: 'STAFF', id: req.staff.id, name: req.staff.full_name };
    else if (req.customer) actor = { type: 'CUSTOMER', id: req.customer.id, name: req.customer.full_name };
  }
  actor = actor || { type: 'SYSTEM', id: null, name: 'System' };
  const params = [
    actor.type, actor.id, actor.name, action, entityType, entityId,
    details ? JSON.stringify(details) : null,
    req ? req.ip : null,
    req ? String(req.get?.('user-agent') || '').slice(0, 255) : null,
  ];
  const sql = `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, user_agent)
               VALUES (?,?,?,?,?,?,?,?,?)`;
  try {
    await (conn || pool).query(sql, params);
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
