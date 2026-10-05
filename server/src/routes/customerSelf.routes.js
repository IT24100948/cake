const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requireCustomer } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const { passwordRule, phoneRule, nameRule, idParam } = require('../validators/common');
const { orderCreateRules, parseMultipartPayload } = require('../validators/order.validators');
const customerAuth = require('../controllers/customerAuth.controller');
const orders = require('../controllers/order.controller');
const notifications = require('../controllers/notification.controller');

const c = requireCustomer;

// Profile (US12)
router.put(
  '/customer/profile', c,
  validate([
    nameRule('fullName'),
    phoneRule('phone'),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 255 }).withMessage('Address is too long'),
    body('city').optional({ values: 'falsy' }).trim().isLength({ max: 80 }).withMessage('City is too long'),
  ]),
  customerAuth.updateProfile
);
router.put(
  '/customer/password', c,
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    passwordRule('newPassword'),
    body('confirmPassword').custom((v, { req }) => v === req.body.newPassword).withMessage('Passwords do not match'),
  ]),
  customerAuth.changePassword
);

// Orders (US13, US14, US15, US18)
router.post('/orders', c, imageUpload('referenceImage'), parseMultipartPayload, validate(orderCreateRules), orders.create);
router.get('/my/orders', c, orders.myOrders);
router.get('/my/orders/:id', c, validate([idParam()]), orders.myOrder);
// Online payment through the built-in gateway (card fields are validated by the gateway itself)
router.get('/my/payments/test-cards', c, orders.testCards);
router.post(
  '/my/orders/:id/pay', c,
  validate([
    idParam(),
    body('idempotencyKey').isString().matches(/^[A-Za-z0-9_-]{8,64}$/).withMessage('A unique payment request key is required'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Invalid amount').toFloat(),
  ]),
  orders.payMyOrder
);
router.patch(
  '/my/orders/:id/cancel', c,
  validate([idParam(), body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 255 })]),
  orders.cancelMyOrder
);

// Notifications (US24)
router.get('/my/notifications', c, notifications.list);
router.get('/my/notifications/unread-count', c, notifications.unreadCount);
router.patch('/my/notifications/read-all', c, notifications.markAllRead);
router.patch('/my/notifications/:id/read', c, validate([idParam()]), notifications.markRead);

module.exports = router;
