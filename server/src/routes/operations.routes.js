/** EP03 / EP04 staff side - customers, orders, payments, deliveries, reports. */
const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');
const { idParam, phoneRule } = require('../validators/common');
const { orderUpdateRules } = require('../validators/order.validators');
const { PAYMENT_METHODS, PAYMENT_STATUS, ORDER_STATUS } = require('../config/constants');
const customers = require('../controllers/customer.controller');
const orders = require('../controllers/order.controller');
const payments = require('../controllers/payment.controller');
const deliveries = require('../controllers/delivery.controller');
const reports = require('../controllers/report.controller');

// US16 - Customers
router.get('/customers', requirePermission('customers.view'), customers.list);
router.get('/customers/:id', requirePermission('customers.view'), validate([idParam()]), customers.getOne);

// US16, US17, US19, US23 - Orders
router.get('/orders', requirePermission('orders.view'), orders.list);
router.get('/orders/:id', requirePermission('orders.view'), validate([idParam()]), orders.getOne);
router.put('/orders/:id', requirePermission('orders.update'), validate([idParam(), ...orderUpdateRules]), orders.update);
router.patch(
  '/orders/:id/confirm',
  requirePermission('orders.confirm'),
  validate([
    idParam(),
    body('cakeQuote').optional({ values: 'null' }).isFloat({ min: 0, max: 10000000 }).withMessage('Enter a valid cake price').toFloat(),
    body('deliveryFee').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }).withMessage('Enter a valid delivery fee').toFloat(),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  ]),
  orders.confirm
);
router.patch(
  '/orders/:id/status',
  requirePermission('orders.update'),
  validate([
    idParam(),
    body('status').isIn(Object.values(ORDER_STATUS).filter((s) => !['PENDING', 'CONFIRMED'].includes(s)))
      .withMessage('Invalid status'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
  ]),
  orders.changeStatus
);

// US20, US21 - Payments
router.get('/payments', requirePermission('payments.manage'), payments.list);
router.get('/orders/:id/payments', requirePermission('payments.manage'), validate([idParam()]), payments.listForOrder);
router.post(
  '/orders/:id/payments',
  requirePermission('payments.manage'),
  validate([
    idParam(),
    body('amount').isFloat({ min: 0.01, max: 10000000 }).withMessage('Enter an amount greater than 0').toFloat(),
    body('method').isIn(PAYMENT_METHODS).withMessage('Select a payment method'),
    body('referenceNo')
      .if(body('method').isIn(['BANK_TRANSFER', 'ONLINE_TRANSFER', 'CARD']))
      .trim().isLength({ min: 2, max: 80 }).withMessage('Reference number is required for this payment method'),
    body('referenceNo').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
    body('paidAt').optional({ values: 'falsy' }).isISO8601().withMessage('Enter a valid date and time')
      .custom((v) => new Date(v) <= new Date(Date.now() + 60000)).withMessage('Payment date cannot be in the future')
      .customSanitizer((v) => new Date(v)),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  payments.record
);
router.patch(
  '/orders/:id/payment-status',
  requirePermission('payments.manage'),
  validate([
    idParam(),
    body('paymentStatus').isIn(PAYMENT_STATUS).withMessage('Invalid payment status'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  payments.updateStatus
);

// US22 - Delivery / collection
router.get('/deliveries', requirePermission('deliveries.manage'), deliveries.list);
router.put(
  '/orders/:id/delivery',
  requirePermission('deliveries.manage'),
  validate([
    idParam(),
    body('type').isIn(['DELIVERY', 'COLLECTION']).withMessage('Choose delivery or collection'),
    body('recipientName').trim().isLength({ min: 2, max: 100 }).withMessage('Recipient name is required'),
    phoneRule('contactPhone'),
    body('address').if(body('type').equals('DELIVERY')).trim().isLength({ min: 5, max: 255 }).withMessage('Delivery address is required'),
    body('city').if(body('type').equals('DELIVERY')).trim().isLength({ min: 2, max: 80 }).withMessage('City is required'),
    body('scheduledDate').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Enter a valid date')
      .customSanitizer((v) => v.slice(0, 10)),
    body('scheduledTimeSlot').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
    body('assignedStaffId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  deliveries.update
);
router.patch(
  '/deliveries/:id/status',
  requirePermission('deliveries.manage'),
  validate([
    idParam(),
    body('status').isIn(['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'READY_FOR_COLLECTION', 'COLLECTED'])
      .withMessage('Invalid delivery status'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
  ]),
  deliveries.updateStatus
);

// Management & Reporting
router.get('/reports/summary', requirePermission('reports.view'), reports.summary);
router.get('/reports/orders-by-status', requirePermission('reports.view'), reports.ordersByStatus);
router.get('/reports/sales', requirePermission('reports.view'), reports.sales);
router.get('/reports/top-products', requirePermission('reports.view'), reports.topProducts);
router.get('/reports/low-stock', requirePermission('reports.view'), reports.lowStock);
router.get('/reports/upcoming', requirePermission('reports.view'), reports.upcoming);

module.exports = router;
