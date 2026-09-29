const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireStaff, requireCustomer } = require('../middleware/auth');
const { passwordRule, emailRule, phoneRule, nameRule } = require('../validators/common');
const staffAuth = require('../controllers/staffAuth.controller');
const customerAuth = require('../controllers/customerAuth.controller');

const loginRules = validate([
  emailRule('email'),
  body('password').isString().notEmpty().withMessage('Password is required'),
]);

// Staff (US03, US04)
router.post('/staff/login', loginRules, staffAuth.login);
router.post('/staff/logout', requireStaff({ allowPasswordChange: true }), staffAuth.logout);
router.get('/staff/me', requireStaff({ allowPasswordChange: true }), staffAuth.me);
router.put(
  '/staff/password',
  requireStaff({ allowPasswordChange: true }),
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    passwordRule('newPassword'),
    body('confirmPassword').custom((v, { req }) => v === req.body.newPassword).withMessage('Passwords do not match'),
  ]),
  staffAuth.changePassword
);

// Customers (US12)
router.post(
  '/customer/register',
  validate([
    nameRule('fullName'),
    emailRule('email'),
    phoneRule('phone'),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }).withMessage('Address is too long'),
    body('city').optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('City is too long'),
    passwordRule('password'),
    body('confirmPassword').custom((v, { req }) => v === req.body.password).withMessage('Passwords do not match'),
  ]),
  customerAuth.register
);
router.post('/customer/login', loginRules, customerAuth.login);
router.post('/customer/logout', customerAuth.logout);
router.get('/customer/me', requireCustomer, customerAuth.me);

module.exports = router;
