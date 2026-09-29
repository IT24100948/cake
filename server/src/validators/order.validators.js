const { body } = require('express-validator');
const ApiError = require('../utils/ApiError');
const { toDateString } = require('../utils/helpers');
const { phoneRule } = require('./common');

/** Multipart order submissions send the JSON order in a `payload` field alongside the image. */
function parseMultipartPayload(req, res, next) {
  if (typeof req.body?.payload === 'string') {
    try {
      req.body = JSON.parse(req.body.payload);
    } catch {
      return next(ApiError.badRequest('Invalid order payload'));
    }
  }
  next();
}

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateString(d);
};

const futureDate = (field, label) =>
  body(field)
    .isISO8601({ strict: true }).withMessage(`${label} must be a valid date`)
    .bail()
    .custom((v) => v.slice(0, 10) >= tomorrow()).withMessage(`${label} must be tomorrow or later`)
    .customSanitizer((v) => v.slice(0, 10));

const itemRules = (prefix) => [
  body(prefix).optional().isArray({ max: 50 }).withMessage('Items must be a list'),
  body(`${prefix}.*.productId`).isInt({ min: 1 }).withMessage('Invalid product').toInt(),
  body(`${prefix}.*.quantity`).isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100').toInt(),
  body(`${prefix}.*.notes`).optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }).withMessage('Item note is too long'),
];

/** US13 - Cake requirement fields. */
const cakeRules = (prefix, { required }) => {
  const opt = (chain) => (required ? chain : chain.if(body(prefix).exists({ values: 'null' })));
  return [
    opt(body(`${prefix}.occasion`)).trim().isLength({ min: 2, max: 80 }).withMessage('Occasion is required'),
    opt(body(`${prefix}.flavor`)).trim().isLength({ min: 2, max: 80 }).withMessage('Flavor is required'),
    opt(body(`${prefix}.weightKg`)).isFloat({ min: 0.5, max: 20 }).withMessage('Weight must be between 0.5 and 20 kg').toFloat(),
    opt(body(`${prefix}.shape`)).trim().isLength({ min: 2, max: 40 }).withMessage('Shape is required'),
    opt(body(`${prefix}.tiers`)).optional().isInt({ min: 1, max: 5 }).withMessage('Tiers must be between 1 and 5').toInt(),
    body(`${prefix}.icingType`).optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
    body(`${prefix}.colors`).optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
    body(`${prefix}.theme`).optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
    body(`${prefix}.messageOnCake`).optional({ values: 'falsy' }).trim().isLength({ max: 120 }).withMessage('Message must be 120 characters or fewer'),
    body(`${prefix}.dietaryNotes`).optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
    body(`${prefix}.additionalDetails`).optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Details must be 1000 characters or fewer'),
  ];
};

const orderCreateRules = [
  ...itemRules('items'),
  body('cakeRequirement').optional({ values: 'null' }).isObject().withMessage('Invalid cake requirement'),
  ...cakeRules('cakeRequirement', { required: false }),
  body('fulfillmentType').isIn(['DELIVERY', 'COLLECTION']).withMessage('Choose delivery or collection'),
  futureDate('eventDate', 'Required date'),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('Notes must be 500 characters or fewer'),
  body('delivery.recipientName').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 100 }).withMessage('Recipient name must be 2-100 characters'),
  phoneRule('delivery.contactPhone', { optional: true }),
  body('delivery.address')
    .if(body('fulfillmentType').equals('DELIVERY'))
    .trim().isLength({ min: 5, max: 255 }).withMessage('Delivery address is required'),
  body('delivery.city')
    .if(body('fulfillmentType').equals('DELIVERY'))
    .trim().isLength({ min: 2, max: 80 }).withMessage('City is required'),
  body('delivery.preferredTimeSlot').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('delivery.notes').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];

const orderUpdateRules = [
  body('items').optional().isArray({ max: 50 }).withMessage('Items must be a list'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Invalid product').toInt(),
  body('items.*.quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100').toInt(),
  body('items.*.notes').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }),
  body('cakeRequirement').optional({ values: 'null' }).isObject(),
  ...cakeRules('cakeRequirement', { required: false }),
  body('eventDate').optional().isISO8601({ strict: true }).withMessage('Enter a valid date').customSanitizer((v) => v.slice(0, 10)),
  body('cakeQuote').optional({ values: 'null' }).isFloat({ min: 0, max: 10000000 }).withMessage('Enter a valid amount').toFloat(),
  body('deliveryFee').optional({ values: 'null' }).isFloat({ min: 0, max: 100000 }).withMessage('Enter a valid delivery fee').toFloat(),
  body('staffNotes').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }),
  body('customerNotes').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }),
];

module.exports = { parseMultipartPayload, orderCreateRules, orderUpdateRules, cakeRules };
