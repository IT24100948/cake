/** EP01 - Staff, roles and audit (staff portal). */
const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requirePermission, requireAnyPermission } = require('../middleware/auth');
const { passwordRule, emailRule, phoneRule, nameRule, idParam } = require('../validators/common');
const staff = require('../controllers/staff.controller');
const roles = require('../controllers/role.controller');
const audit = require('../controllers/audit.controller');

// Staff accounts (US01, US02, US04, US05)
router.get('/staff/options', requireAnyPermission('deliveries.manage', 'staff.manage'), staff.options);
router.get('/staff', requirePermission('staff.manage'), staff.list);
router.get('/staff/:id', requirePermission('staff.manage'), validate([idParam()]), staff.getOne);
router.post(
  '/staff',
  requirePermission('staff.manage'),
  validate([
    nameRule('fullName'),
    emailRule('email'),
    phoneRule('phone', { optional: true }),
    body('roleId').isInt({ min: 1 }).withMessage('Select a role').toInt(),
    passwordRule('password'),
  ]),
  staff.create
);
router.put(
  '/staff/:id',
  requirePermission('staff.manage'),
  validate([idParam(), nameRule('fullName'), emailRule('email'), phoneRule('phone', { optional: true })]),
  staff.update
);
router.patch(
  '/staff/:id/role',
  requirePermission('roles.manage'),
  validate([idParam(), body('roleId').isInt({ min: 1 }).withMessage('Select a role').toInt()]),
  staff.assignRole
);
router.patch(
  '/staff/:id/status',
  requirePermission('staff.manage'),
  validate([
    idParam(),
    body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
    body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  staff.setStatus
);
router.post(
  '/staff/:id/reset-password',
  requirePermission('staff.manage'),
  validate([idParam(), passwordRule('password')]),
  staff.resetPassword
);

// Roles & permissions (US02)
router.get('/permissions', requirePermission('roles.manage'), roles.listPermissions);
router.get('/roles', requireAnyPermission('roles.manage', 'staff.manage'), roles.list);
const roleRules = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Role name must be 2-50 characters'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  body('permissions').isArray().withMessage('Permissions must be a list'),
  body('permissions.*').isString(),
];
router.post('/roles', requirePermission('roles.manage'), validate(roleRules), roles.create);
router.put('/roles/:id', requirePermission('roles.manage'), validate([idParam(), ...roleRules]), roles.update);
router.delete('/roles/:id', requirePermission('roles.manage'), validate([idParam()]), roles.remove);

// Audit (US06)
router.get('/audit-logs', requirePermission('audit.view'), audit.list);
router.get('/audit-logs/actions', requirePermission('audit.view'), audit.actions);

module.exports = router;
